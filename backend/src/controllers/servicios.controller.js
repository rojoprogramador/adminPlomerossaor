const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  Servicio, Empresa, TipoServicio, Cliente, Tecnico, AgenteSC, Ciudad,
  PagoTecnico, DeudaTecnico, Garantia,
} = require('../models');
const { calcularPago, validarCostos } = require('../services/calculoPago.service');
const { completarServicioTx } = require('../services/completarServicio.service');
const { ESTADO_SERVICIO } = require('../config/constants');
const { ok, err, serverErr } = require('../utils/respuesta');

// Estados en los que los campos financieros quedan bloqueados
const ESTADOS_FINANCIERO_BLOQUEADO = new Set([ESTADO_SERVICIO.COMPLETADO, ESTADO_SERVICIO.CERRADO]);
// Estados válidos para crear un servicio (sin completar)
const ESTADOS_VALIDOS_CREAR = new Set([ESTADO_SERVICIO.EN_COTIZACION, ESTADO_SERVICIO.PENDIENTE, ESTADO_SERVICIO.EN_PROGRESO]);

const calcularEstadoInicial = (completado, estado) => {
  if (completado) return ESTADO_SERVICIO.COMPLETADO;
  if (ESTADOS_VALIDOS_CREAR.has(estado)) return estado;
  return ESTADO_SERVICIO.PENDIENTE;
};

// Auto-transiciona servicios COMPLETADO → CERRADO cuando su garantía está vencida o no tiene garantía activa
const autoTransicionarCerrados = async (empresa_id) => {
  await sequelize.query(`
    UPDATE servicios SET estado = 'cerrado'
    WHERE empresa_id = :empresa_id
      AND estado = 'completado'
      AND id NOT IN (
        SELECT servicio_id FROM garantias
        WHERE estado IN ('activa', 'reclamada')
          AND fecha_vence >= CURRENT_DATE
      )
  `, { replacements: { empresa_id }, type: sequelize.QueryTypes.UPDATE });
};

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { fecha, fecha_desde, fecha_hasta, tecnico, estado, ciudad_id, es_visita, es_garantia, cliente_id, limit = 50, offset = 0 } = req.query;
    const where = { empresa_id };
    if (fecha) where.fecha = fecha;
    if (fecha_desde || fecha_hasta) {
      where.fecha = {};
      if (fecha_desde) where.fecha[Op.gte] = fecha_desde;
      if (fecha_hasta) where.fecha[Op.lte] = fecha_hasta;
    }
    if (tecnico) where.tecnico_id = tecnico;
    if (estado)  where.estado     = estado;
    if (ciudad_id) where.ciudad_id = ciudad_id;
    if (es_visita !== undefined) where.es_visita = es_visita === 'true';
    if (es_garantia !== undefined) where.es_garantia = es_garantia === 'true';
    if (cliente_id) where.cliente_id = cliente_id;

    await autoTransicionarCerrados(empresa_id);

    const { count, rows } = await Servicio.findAndCountAll({
      where,
      include: [
        { model: Cliente,      as: 'cliente',      attributes: ['id', 'nombre_completo', 'telefono_1'] },
        { model: Tecnico,      as: 'tecnico',      attributes: ['id', 'nombre'] },
        { model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre', 'categoria'] },
        { model: Ciudad,       as: 'ciudad',        attributes: ['id', 'nombre'] },
        { model: AgenteSC,     as: 'agente_sc',     attributes: ['id', 'nombre'] },
      ],
      limit:  Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      order:  [['fecha', 'DESC'], ['created_at', 'DESC']],
    });
    return ok(res, { total: count, servicios: rows });
  } catch (e) { return serverErr(res, e); }
};

// ─── OBTENER UNO ──────────────────────────────────────────────────────────────
const obtener = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const servicio = await Servicio.findOne({
      where: { id: req.params.id, empresa_id },
      include: [
        { model: Cliente,      as: 'cliente' },
        { model: Tecnico,      as: 'tecnico',      attributes: ['id', 'nombre', 'telefono'] },
        { model: TipoServicio, as: 'tipo_servicio' },
        { model: Ciudad,       as: 'ciudad' },
        { model: AgenteSC,     as: 'agente_sc',    attributes: ['id', 'nombre'] },
        { model: PagoTecnico,  as: 'pago_tecnico' },
        { model: DeudaTecnico, as: 'deuda' },
        { model: Garantia,     as: 'garantia' },
      ],
    });
    if (!servicio) return err(res, 'Servicio no encontrado', 404);
    return ok(res, servicio);
  } catch (e) { return serverErr(res, e); }
};

const validarBodyCrear = (body) => {
  const { tecnico_id, tipo_servicio_id, ciudad_id, estado, valor, medio_pago,
          tiene_materiales, costo_materiales, tiene_herramienta, costo_herramienta } = body;
  if (!tecnico_id)       return 'El técnico es requerido';
  if (!tipo_servicio_id) return 'El tipo de servicio es requerido';
  if (!ciudad_id)        return 'La ciudad es requerida';
  const completado = (estado === ESTADO_SERVICIO.COMPLETADO);
  if (completado && !valor)      return 'Debes ingresar el valor cobrado para completar el servicio';
  if (completado && !medio_pago) return 'Debes ingresar el medio de pago';
  if (valor && (tiene_materiales || tiene_herramienta)) {
    const v = validarCostos({ valor, tiene_materiales, costo_materiales, tiene_herramienta, costo_herramienta });
    if (!v.valido) return v.mensaje;
  }
  return null;
};

const buildDatosServicio = (body, empresa_id) => {
  const {
    cliente_id, cliente_anonimo, nombre_cliente_anon, telefono_cliente_anon,
    tecnico_id, agente_sc_id, tipo_servicio_id, ciudad_id, servicio_padre_id,
    fecha, hora, es_visita, es_garantia, direccion,
    valor, tiene_materiales, costo_materiales, descripcion_materiales,
    tiene_herramienta, costo_herramienta, descripcion_herramienta,
    tecnico_recibe_total, porcentaje_tecnico_override,
    medio_pago, efectivo_entregado, empresa_debe_tecnico,
    estado, motivo_pendiente, documento_requerido, observaciones,
    registrado_por_id,
  } = body;
  const completado = (estado === ESTADO_SERVICIO.COMPLETADO);
  return {
    empresa_id,
    cliente_id:            cliente_anonimo ? null : (cliente_id || null),
    cliente_anonimo:       !!cliente_anonimo,
    nombre_cliente_anon,   telefono_cliente_anon,
    tecnico_id, agente_sc_id, tipo_servicio_id, ciudad_id, servicio_padre_id,
    fecha: fecha || new Date().toLocaleString('en-CA', { timeZone: 'America/Bogota' }).split(',')[0],
    hora,
    es_visita:   !!es_visita,
    es_garantia: !!es_garantia,
    direccion,
    valor,
    tiene_materiales:        !!tiene_materiales,
    costo_materiales:        tiene_materiales  ? (costo_materiales  || 0) : 0,
    descripcion_materiales,
    tiene_herramienta:       !!tiene_herramienta,
    costo_herramienta:       tiene_herramienta ? (costo_herramienta || 0) : 0,
    descripcion_herramienta,
    tecnico_recibe_total:    !!tecnico_recibe_total,
    porcentaje_tecnico_override,
    medio_pago,
    efectivo_entregado:   !!efectivo_entregado,
    empresa_debe_tecnico: !efectivo_entregado && !!empresa_debe_tecnico,
    estado:          calcularEstadoInicial(completado, estado),
    fecha_completado: completado ? new Date() : null,
    motivo_pendiente, documento_requerido, observaciones,
    registrado_por_id: registrado_por_id || null,
  };
};

// ─── CREAR ────────────────────────────────────────────────────────────────────
const crear = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa_id = req.usuario.empresa_id;
    const mensajeError = validarBodyCrear(req.body);
    if (mensajeError) { await t.rollback(); return err(res, mensajeError); }

    const completado = (req.body.estado === ESTADO_SERVICIO.COMPLETADO);
    const servicio = await Servicio.create(buildDatosServicio(req.body, empresa_id), { transaction: t });

    let extra = {};
    if (completado) {
      const tipoServicio = await TipoServicio.findByPk(req.body.tipo_servicio_id, { transaction: t });
      const empresa      = await Empresa.findByPk(empresa_id, { transaction: t });
      servicio.tipo_servicio = tipoServicio;
      servicio.empresa       = empresa;
      extra = await completarServicioTx(servicio, empresa, t, { efectivo_ya_entregado: !!req.body.efectivo_entregado });
    }

    await t.commit();
    return ok(res, { servicio, ...extra }, 201);
  } catch (e) {
    await t.rollback();
    return serverErr(res, e);
  }
};

const CAMPOS_FINANCIEROS = ['valor', 'medio_pago', 'tiene_materiales', 'costo_materiales',
  'tiene_herramienta', 'costo_herramienta', 'tecnico_recibe_total', 'porcentaje_tecnico_override', 'estado'];

const bloquearCamposFinancieros = (body) => {
  CAMPOS_FINANCIEROS.forEach(c => delete body[c]);
};

const reasignarTecnico = async (servicio, nuevoTecnicoId) => {
  await PagoTecnico.update({ tecnico_id: nuevoTecnicoId }, { where: { servicio_id: servicio.id } });
  const deudas = await DeudaTecnico.findAll({ where: { servicio_id: servicio.id } });
  for (const d of deudas) {
    if (d.monto_pendiente > 0) {
      await Tecnico.decrement('saldo_deuda', { by: d.monto_pendiente, where: { id: servicio.tecnico_id } });
      await Tecnico.increment('saldo_deuda', { by: d.monto_pendiente, where: { id: nuevoTecnicoId } });
    }
  }
  await DeudaTecnico.update({ tecnico_id: nuevoTecnicoId }, { where: { servicio_id: servicio.id } });
  await Garantia.update({ tecnico_id: nuevoTecnicoId }, { where: { servicio_id: servicio.id } });
};

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────
const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const servicio = await Servicio.findOne({ where: { id: req.params.id, empresa_id } });
    if (!servicio) return err(res, 'Servicio no encontrado', 404);

    if (ESTADOS_FINANCIERO_BLOQUEADO.has(servicio.estado)) {
      bloquearCamposFinancieros(req.body);
      if (servicio.estado === ESTADO_SERVICIO.CERRADO) {
        delete req.body.tecnico_id;
      } else if (req.body.tecnico_id && req.body.tecnico_id !== servicio.tecnico_id) {
        await reasignarTecnico(servicio, req.body.tecnico_id);
      }
    } else {
      if (req.body.valor && (req.body.tiene_materiales || req.body.tiene_herramienta)) {
        const v = validarCostos({ ...servicio.toJSON(), ...req.body });
        if (!v.valido) return err(res, v.mensaje);
      }
    }

    await servicio.update(req.body);
    return ok(res, servicio);
  } catch (e) { return serverErr(res, e); }
};

// ─── COMPLETAR ────────────────────────────────────────────────────────────────
const completar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa_id = req.usuario.empresa_id;
    const servicio = await Servicio.findOne({
      where: { id: req.params.id, empresa_id },
      include: [
        { model: TipoServicio, as: 'tipo_servicio' },
        { model: Empresa,      as: 'empresa' },
      ],
      transaction: t,
    });
    if (!servicio) { await t.rollback(); return err(res, 'Servicio no encontrado', 404); }
    if (servicio.estado === ESTADO_SERVICIO.COMPLETADO) { await t.rollback(); return err(res, 'El servicio ya está completado'); }

    const { valor, medio_pago, efectivo_entregado, empresa_debe_tecnico } = req.body;
    if (!valor)      { await t.rollback(); return err(res, 'El valor cobrado es requerido'); }
    if (!medio_pago) { await t.rollback(); return err(res, 'El medio de pago es requerido'); }

    const v = validarCostos({ ...servicio.toJSON(), valor });
    if (!v.valido) { await t.rollback(); return err(res, v.mensaje); }

    servicio.valor                = valor;
    servicio.medio_pago           = medio_pago;
    servicio.efectivo_entregado   = !!efectivo_entregado;
    servicio.empresa_debe_tecnico = medio_pago !== 'efectivo' && !!empresa_debe_tecnico;
    servicio.estado             = ESTADO_SERVICIO.COMPLETADO;
    servicio.fecha_completado   = new Date();
    if (req.body.motivo_pendiente !== undefined) servicio.motivo_pendiente = null;
    await servicio.save({ transaction: t });

    const extra = await completarServicioTx(servicio, servicio.empresa, t, { efectivo_ya_entregado: !!efectivo_entregado });
    await t.commit();
    return ok(res, { servicio, ...extra });
  } catch (e) {
    await t.rollback();
    return serverErr(res, e);
  }
};

// ─── CANCELAR ─────────────────────────────────────────────────────────────────
const cancelar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const servicio = await Servicio.findOne({ where: { id: req.params.id, empresa_id } });
    if (!servicio) return err(res, 'Servicio no encontrado', 404);
    if (servicio.estado === ESTADO_SERVICIO.COMPLETADO) return err(res, 'No se puede cancelar un servicio ya completado');
    if (servicio.estado === ESTADO_SERVICIO.CANCELADO) return err(res, 'El servicio ya está cancelado');

    servicio.estado = ESTADO_SERVICIO.CANCELADO;
    servicio.observaciones = req.body.motivo ? `Cancelado: ${req.body.motivo} | ${servicio.observaciones || ''}` : servicio.observaciones;
    await servicio.save();
    return ok(res, servicio);
  } catch (e) {
    return serverErr(res, e);
  }
};

// ─── CONVERTIR VISITA → SERVICIO ─────────────────────────────────────────────
const convertir = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa_id = req.usuario.empresa_id;
    const visita = await Servicio.findOne({ where: { id: req.params.id, empresa_id, es_visita: true }, transaction: t });
    if (!visita) { await t.rollback(); return err(res, 'Visita no encontrada', 404); }
    if (visita.estado === ESTADO_SERVICIO.CONVERTIDA)  { await t.rollback(); return err(res, 'Esta visita ya fue convertida'); }
    if (visita.estado === ESTADO_SERVICIO.COMPLETADO)  { await t.rollback(); return err(res, 'Esta visita ya fue completada. No se puede convertir para evitar doble conteo de pagos'); }
    if (visita.estado === ESTADO_SERVICIO.CANCELADO)   { await t.rollback(); return err(res, 'No se puede convertir una visita cancelada'); }

    const { tecnico_id, tipo_servicio_id, ciudad_id, fecha, hora, valor, medio_pago, observaciones,
            tiene_materiales, costo_materiales, tiene_herramienta, costo_herramienta,
            empresa_debe_tecnico } = req.body;

    const completado = !!(valor && medio_pago);
    const nuevoServicio = await Servicio.create({
      empresa_id,
      cliente_id:          visita.cliente_id,
      cliente_anonimo:     visita.cliente_anonimo,
      nombre_cliente_anon: visita.nombre_cliente_anon,
      telefono_cliente_anon: visita.telefono_cliente_anon,
      tecnico_id:       tecnico_id       || visita.tecnico_id,
      agente_sc_id:     visita.agente_sc_id,
      tipo_servicio_id: tipo_servicio_id || visita.tipo_servicio_id,
      ciudad_id:        ciudad_id        || visita.ciudad_id,
      servicio_padre_id: visita.id,
      fecha: fecha || visita.fecha,
      hora,
      es_visita: false, es_garantia: false,
      valor, medio_pago, observaciones,
      tiene_materiales: !!tiene_materiales, costo_materiales:  tiene_materiales  ? (costo_materiales  || 0) : 0,
      tiene_herramienta: !!tiene_herramienta, costo_herramienta: tiene_herramienta ? (costo_herramienta || 0) : 0,
      empresa_debe_tecnico: completado && medio_pago !== 'efectivo' && !!empresa_debe_tecnico,
      estado:           completado ? ESTADO_SERVICIO.COMPLETADO : ESTADO_SERVICIO.PENDIENTE,
      fecha_completado: completado ? new Date() : null,
    }, { transaction: t });

    visita.estado = ESTADO_SERVICIO.CONVERTIDA;
    await visita.save({ transaction: t });

    let extra = {};
    if (completado) {
      const tipoServicio = await TipoServicio.findByPk(nuevoServicio.tipo_servicio_id, { transaction: t });
      const empresa      = await Empresa.findByPk(empresa_id, { transaction: t });
      nuevoServicio.tipo_servicio = tipoServicio;
      nuevoServicio.empresa       = empresa;
      extra = await completarServicioTx(nuevoServicio, empresa, t);
    }

    await t.commit();
    return ok(res, { servicio: nuevoServicio, visita_convertida: { id: visita.id, estado: visita.estado }, ...extra }, 201);
  } catch (e) {
    await t.rollback();
    return serverErr(res, e);
  }
};


module.exports = { listar, obtener, crear, actualizar, completar, convertir, cancelar };
