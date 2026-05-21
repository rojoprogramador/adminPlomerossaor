const { sequelize } = require('../config/database');
const { Garantia, Servicio, Tecnico, TipoServicio, Cliente, Ciudad, Empresa } = require('../models');
const { completarServicioTx } = require('../services/completarServicio.service');
const { ESTADO_GARANTIA, TIPO_RESOLUCION_GARANTIA, ESTADO_SERVICIO } = require('../config/constants');
const { ok, err, serverErr } = require('../utils/respuesta');

// ── LISTAR ────────────────────────────────────────────────────────────────────
// GET /api/garantias?estado=activa&tecnico_id=&alertar_dias=5
const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { estado, tecnico_id, alertar_dias, servicio_id, cliente_id, search } = req.query;

    // Marcar vencidas en masa antes de listar
    await Garantia.update(
      { estado: ESTADO_GARANTIA.VENCIDA },
      {
        where: {
          estado:      ESTADO_GARANTIA.ACTIVA,
          fecha_vence: { [require('sequelize').Op.lt]: new Date().toISOString().split('T')[0] },
        },
      }
    );

    const where = {};
    if (estado) {
      where.estado = estado.includes(',') ? { [require('sequelize').Op.in]: estado.split(',') } : estado;
    }
    if (tecnico_id) where.tecnico_id = tecnico_id;
    if (servicio_id) where.servicio_id = servicio_id;

    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        { '$servicio.direccion$':             { [Op.iLike]: `%${search}%` } },
        { '$servicio.nombre_cliente_anon$':   { [Op.iLike]: `%${search}%` } },
        { '$servicio.telefono_cliente_anon$': { [Op.iLike]: `%${search}%` } },
        { '$servicio.cliente.nombre_completo$': { [Op.iLike]: `%${search}%` } },
        { '$servicio.cliente.telefono_1$':      { [Op.iLike]: `%${search}%` } },
      ];
    }

    const whereServicio = { empresa_id };
    if (cliente_id) whereServicio.cliente_id = cliente_id;

    const garantias = await Garantia.findAll({
      where,
      subQuery: false,
      include: [
        {
          model: Servicio, as: 'servicio',
          where: whereServicio,
          include: [
            { model: Cliente,  as: 'cliente',  attributes: ['id', 'nombre_completo', 'telefono_1', 'whatsapp'] },
            { model: Ciudad,   as: 'ciudad',   attributes: ['id', 'nombre'] },
            { model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre'] },
          ],
        },
        { model: Tecnico, as: 'tecnico', attributes: ['id', 'nombre', 'telefono'] },
      ],
      order: [['fecha_vence', 'ASC']],
    });

    const hoy = new Date().toISOString().split('T')[0];
    const umbral = parseInt(alertar_dias) || 5;

    const resultado = garantias.map(g => {
      const dias = Math.ceil((new Date(g.fecha_vence) - new Date(hoy)) / 86400000);
      return { ...g.toJSON(), dias_restantes: dias, alerta: dias <= umbral && dias >= 0 };
    });

    return ok(res, resultado);
  } catch (e) { return serverErr(res, e); }
};

// ── OBTENER ───────────────────────────────────────────────────────────────────
const obtener = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const garantia = await Garantia.findByPk(req.params.id, {
      include: [
        {
          model: Servicio, as: 'servicio',
          where: { empresa_id },
          include: [
            { model: Cliente,      as: 'cliente' },
            { model: TipoServicio, as: 'tipo_servicio' },
            { model: Ciudad,       as: 'ciudad' },
          ],
        },
        { model: Tecnico, as: 'tecnico', attributes: ['id', 'nombre', 'telefono'] },
      ],
    });
    if (!garantia) return err(res, 'Garantía no encontrada', 404);
    return ok(res, garantia);
  } catch (e) { return serverErr(res, e); }
};

// ── RECLAMAR ──────────────────────────────────────────────────────────────────
// POST /api/garantias/:id/reclamar
// Body: { descripcion_problema, fecha_atencion? }
const reclamar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { descripcion_problema, fecha_atencion } = req.body;

    if (!descripcion_problema) return err(res, 'La descripción del problema es requerida');

    const garantia = await Garantia.findByPk(req.params.id, {
      include: [{ model: Servicio, as: 'servicio', where: { empresa_id } }],
    });
    if (!garantia) return err(res, 'Garantía no encontrada', 404);
    if (garantia.estado === ESTADO_GARANTIA.RESUELTA) return err(res, 'Esta garantía ya fue resuelta');
    if (garantia.estado === ESTADO_GARANTIA.VENCIDA)  return err(res, 'Esta garantía ya venció');

    const hoy = new Date().toISOString().split('T')[0];
    if (garantia.fecha_vence < hoy) return err(res, `Garantía vencida el ${garantia.fecha_vence}`);

    await garantia.update({
      estado:               ESTADO_GARANTIA.RECLAMADA,
      descripcion_problema,
      fecha_atencion:       fecha_atencion || hoy,
    });
    return ok(res, garantia);
  } catch (e) { return serverErr(res, e); }
};

// ── CERRAR / RESOLVER ─────────────────────────────────────────────────────────
// PATCH /api/garantias/:id/cerrar
// Body:
//   { tipo_resolucion: 'garantia_pura', resolucion: '...' }
//   { tipo_resolucion: 'cobro_extra',   resolucion: '...', cobro_extra: { tipo_servicio_id, ciudad_id, valor, medio_pago, ... } }
//   { tipo_resolucion: 'mixta',         resolucion: '...', cobro_extra: { ... } }
const cerrar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa_id = req.usuario.empresa_id;
    const { tipo_resolucion, resolucion, cobro_extra } = req.body;

    if (!tipo_resolucion) { await t.rollback(); return err(res, 'El tipo de resolución es requerido'); }
    if (!resolucion)      { await t.rollback(); return err(res, 'La resolución es requerida'); }
    if (!Object.values(TIPO_RESOLUCION_GARANTIA).includes(tipo_resolucion)) {
      await t.rollback();
      return err(res, 'tipo_resolucion inválido: garantia_pura | cobro_extra | mixta');
    }

    const garantia = await Garantia.findByPk(req.params.id, {
      include: [{
        model: Servicio, as: 'servicio',
        where: { empresa_id },
        include: [{ model: TipoServicio, as: 'tipo_servicio' }],
      }],
      transaction: t,
    });
    if (!garantia) { await t.rollback(); return err(res, 'Garantía no encontrada', 404); }
    if (garantia.estado === ESTADO_GARANTIA.RESUELTA) { await t.rollback(); return err(res, 'Esta garantía ya fue resuelta'); }

    // Cerrar la garantía
    await garantia.update({
      estado:          ESTADO_GARANTIA.RESUELTA,
      tipo_resolucion,
      resolucion,
      fecha_atencion:  garantia.fecha_atencion || new Date().toISOString().split('T')[0],
    }, { transaction: t });

    let nuevo_servicio = null;
    let pago = null;
    let deuda = null;
    let nueva_garantia = null;

    // Cobro extra: crear nuevo servicio vinculado
    if (tipo_resolucion !== TIPO_RESOLUCION_GARANTIA.GARANTIA_PURA) {
      if (!cobro_extra)               { await t.rollback(); return err(res, 'cobro_extra es requerido para este tipo de resolución'); }
      if (!cobro_extra.tipo_servicio_id) { await t.rollback(); return err(res, 'cobro_extra.tipo_servicio_id es requerido'); }
      if (!cobro_extra.valor)            { await t.rollback(); return err(res, 'cobro_extra.valor es requerido'); }
      if (!cobro_extra.medio_pago)       { await t.rollback(); return err(res, 'cobro_extra.medio_pago es requerido'); }

      const servicio_original = garantia.servicio;
      const empresa = await Empresa.findByPk(empresa_id, { transaction: t });
      const tipoServicio = await TipoServicio.findByPk(cobro_extra.tipo_servicio_id, { transaction: t });

      const fecha_completado = new Date();
      nuevo_servicio = await Servicio.create({
        empresa_id,
        cliente_id:            servicio_original.cliente_id,
        cliente_anonimo:       servicio_original.cliente_anonimo,
        nombre_cliente_anon:   servicio_original.nombre_cliente_anon,
        telefono_cliente_anon: servicio_original.telefono_cliente_anon,
        tecnico_id:            cobro_extra.tecnico_id || servicio_original.tecnico_id,
        agente_sc_id:          servicio_original.agente_sc_id,
        tipo_servicio_id:      cobro_extra.tipo_servicio_id,
        ciudad_id:             cobro_extra.ciudad_id || servicio_original.ciudad_id,
        servicio_padre_id:     servicio_original.id,
        fecha:                 cobro_extra.fecha || fecha_completado.toISOString().split('T')[0],
        es_visita:             false,
        es_garantia:           false,
        valor:                 cobro_extra.valor,
        tiene_materiales:      !!cobro_extra.tiene_materiales,
        costo_materiales:      cobro_extra.tiene_materiales ? (cobro_extra.costo_materiales || 0) : 0,
        tiene_herramienta:     !!cobro_extra.tiene_herramienta,
        costo_herramienta:     cobro_extra.tiene_herramienta ? (cobro_extra.costo_herramienta || 0) : 0,
        medio_pago:            cobro_extra.medio_pago,
        estado:                ESTADO_SERVICIO.COMPLETADO,
        fecha_completado,
        observaciones:         cobro_extra.observaciones,
      }, { transaction: t });

      nuevo_servicio.tipo_servicio = tipoServicio;
      nuevo_servicio.empresa       = empresa;

      const resultado = await completarServicioTx(nuevo_servicio, empresa, t);
      pago           = resultado.pago;
      deuda          = resultado.deuda;
      nueva_garantia = resultado.garantia;
    }

    await t.commit();
    return ok(res, { garantia, nuevo_servicio, pago, deuda, nueva_garantia });
  } catch (e) {
    await t.rollback();
    return serverErr(res, e);
  }
};

module.exports = { listar, obtener, reclamar, cerrar };
