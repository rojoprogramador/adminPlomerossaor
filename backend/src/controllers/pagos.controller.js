const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { PagoTecnico, PagoAgente, DeudaTecnico, Tecnico, Servicio, AgenteSC, TipoServicio } = require('../models');
const { ESTADO_ENTREGA_PAGO, ESTADO_DEUDA } = require('../config/constants');
const { ok, err, serverErr } = require('../utils/respuesta');

// ── PAGOS TÉCNICOS ────────────────────────────────────────────────────────────

// GET /api/pagos/tecnicos?estado=&tecnico_id=
const listarTecnicos = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { estado, tecnico_id } = req.query;

    const tecnicos = await Tecnico.findAll({
      where: { empresa_id, ...(tecnico_id ? { id: tecnico_id } : {}) },
      attributes: ['id'],
    });
    const ids = tecnicos.map(t => t.id);

    const where = { tecnico_id: { [Op.in]: ids } };
    if (estado) where.estado_entrega = estado;

    const pagos = await PagoTecnico.findAll({
      where,
      include: [
        { model: Tecnico,  as: 'tecnico',  attributes: ['id', 'nombre', 'saldo_deuda'] },
        { model: Servicio, as: 'servicio', attributes: ['id', 'fecha', 'es_visita'], include: [{ model: TipoServicio, as: 'tipo_servicio', attributes: ['nombre'] }] },
      ],
      order: [['fecha_registro', 'DESC']],
    });
    return ok(res, pagos);
  } catch (e) { return serverErr(res, e); }
};

// PATCH /api/pagos/tecnicos/:id/entregar
// Body: { descuento_deuda?: number }
const entregarPago = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa_id = req.usuario.empresa_id;
    const { descuento_deuda } = req.body;

    const pago = await PagoTecnico.findByPk(req.params.id, {
      include: [{ model: Tecnico, as: 'tecnico', where: { empresa_id } }],
      transaction: t,
    });
    if (!pago) { await t.rollback(); return err(res, 'Pago no encontrado', 404); }
    if (pago.estado_entrega === ESTADO_ENTREGA_PAGO.ENTREGADO) { await t.rollback(); return err(res, 'Este pago ya fue entregado'); }

    await pago.update({
      estado_entrega: ESTADO_ENTREGA_PAGO.ENTREGADO,
      fecha_entrega:  new Date(),
    }, { transaction: t });

    // Opción: descontar deuda del monto entregado
    let deuda_abonada = null;
    if (descuento_deuda && parseFloat(descuento_deuda) > 0) {
      const deudaPendiente = await DeudaTecnico.findOne({
        where: { tecnico_id: pago.tecnico_id, estado: { [Op.ne]: ESTADO_DEUDA.SALDADA } },
        order: [['fecha_registro', 'ASC']],
        transaction: t,
      });
      if (deudaPendiente) {
        const abono = Math.min(parseFloat(descuento_deuda), parseFloat(deudaPendiente.monto_pendiente));
        const nuevo_pendiente = parseFloat(deudaPendiente.monto_pendiente) - abono;
        await deudaPendiente.update({
          monto_entregado: parseFloat(deudaPendiente.monto_entregado) + abono,
          monto_pendiente: nuevo_pendiente,
          estado:          nuevo_pendiente <= 0 ? ESTADO_DEUDA.SALDADA : ESTADO_DEUDA.ABONADA,
          fecha_abono:     new Date(),
        }, { transaction: t });
        await Tecnico.decrement('saldo_deuda', { by: abono, where: { id: pago.tecnico_id }, transaction: t });
        deuda_abonada = { deuda_id: deudaPendiente.id, abono_aplicado: abono };
      }
    }

    await t.commit();
    return ok(res, { pago, deuda_abonada });
  } catch (e) {
    await t.rollback();
    return serverErr(res, e);
  }
};

// ── PAGOS AGENTE SC ───────────────────────────────────────────────────────────

// GET /api/pagos/agentes?agente_sc_id=&estado=
const listarAgentes = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { agente_sc_id, estado } = req.query;
    const where = { empresa_id };
    if (agente_sc_id) where.agente_sc_id = agente_sc_id;
    if (estado)       where.estado       = estado;

    const pagos = await PagoAgente.findAll({
      where,
      include: [{ model: AgenteSC, as: 'agente_sc', attributes: ['id', 'nombre'] }],
      order: [['semana_inicio', 'DESC']],
    });
    return ok(res, pagos);
  } catch (e) { return serverErr(res, e); }
};

// POST /api/pagos/agentes/calcular-semana
// Body: { agente_sc_id, semana_inicio (YYYY-MM-DD lunes), monto_total }
const calcularSemana = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { agente_sc_id, semana_inicio, monto_total } = req.body;

    if (!agente_sc_id)  return err(res, 'El agente SC es requerido');
    if (!semana_inicio) return err(res, 'La semana inicio es requerida');
    if (!monto_total)   return err(res, 'El monto total es requerido');

    const agente = await AgenteSC.findOne({ where: { id: agente_sc_id, empresa_id } });
    if (!agente) return err(res, 'Agente SC no encontrado', 404);

    // Calcular viernes de la semana
    const lunes   = new Date(semana_inicio);
    const viernes = new Date(lunes);
    viernes.setDate(lunes.getDate() + 4);
    const semana_fin = viernes.toISOString().split('T')[0];

    // Verificar que no exista ya un pago para esa semana/agente
    const existe = await PagoAgente.findOne({ where: { agente_sc_id, semana_inicio, empresa_id } });
    if (existe) return err(res, 'Ya existe un pago registrado para esa semana y agente');

    // Contar servicios gestionados en esa semana (referencia)
    const serviciosReferencia = await Servicio.findAll({
      where: {
        empresa_id,
        agente_sc_id,
        fecha:  { [Op.between]: [semana_inicio, semana_fin] },
        estado: 'completado',
      },
      attributes: ['id', 'valor'],
    });

    const pago = await PagoAgente.create({
      empresa_id,
      agente_sc_id,
      semana_inicio,
      semana_fin,
      monto_total: parseFloat(monto_total),
      estado: 'pendiente',
    });

    return ok(res, {
      pago,
      referencia: {
        servicios_gestionados: serviciosReferencia.length,
        valor_total_servicios:  serviciosReferencia.reduce((s, sv) => s + (parseFloat(sv.valor) || 0), 0),
      },
    }, 201);
  } catch (e) { return serverErr(res, e); }
};

// PATCH /api/pagos/agentes/:id/pagar
const pagarAgente = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const pago = await PagoAgente.findOne({ where: { id: req.params.id, empresa_id } });
    if (!pago) return err(res, 'Pago no encontrado', 404);
    if (pago.estado === 'pagado') return err(res, 'Este pago ya fue realizado');

    const { monto_total } = req.body;
    await pago.update({
      estado:     'pagado',
      fecha_pago: new Date(),
      ...(monto_total ? { monto_total: parseFloat(monto_total) } : {}),
    });
    return ok(res, pago);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listarTecnicos, entregarPago, listarAgentes, calcularSemana, pagarAgente };
