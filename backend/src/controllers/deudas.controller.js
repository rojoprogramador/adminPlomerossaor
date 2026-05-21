const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { DeudaTecnico, Tecnico, Servicio } = require('../models');
const { ESTADO_DEUDA } = require('../config/constants');
const { ok, err, serverErr } = require('../utils/respuesta');

// GET /api/deudas?tecnico_id=&estado=
const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { tecnico_id, estado } = req.query;

    const tecnicos = await Tecnico.findAll({
      where: { empresa_id, ...(tecnico_id ? { id: tecnico_id } : {}) },
      attributes: ['id'],
    });
    const tecnico_ids = tecnicos.map(t => t.id);

    const where = { tecnico_id: { [Op.in]: tecnico_ids } };
    if (estado) where.estado = estado;
    else        where.estado = { [Op.ne]: ESTADO_DEUDA.SALDADA };

    const deudas = await DeudaTecnico.findAll({
      where,
      include: [
        { model: Tecnico,  as: 'tecnico',  attributes: ['id', 'nombre', 'saldo_deuda'] },
        { model: Servicio, as: 'servicio', attributes: ['id', 'fecha', 'valor', 'medio_pago'] },
      ],
      order: [['fecha_registro', 'ASC']],
    });
    return ok(res, deudas);
  } catch (e) { return serverErr(res, e); }
};

// POST /api/deudas/:id/abonar
const abonar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const empresa_id = req.usuario.empresa_id;
    const { monto_abono } = req.body;

    if (!monto_abono || parseFloat(monto_abono) <= 0) {
      await t.rollback();
      return err(res, 'El monto del abono debe ser mayor a 0');
    }

    const deuda = await DeudaTecnico.findByPk(req.params.id, {
      include: [{ model: Tecnico, as: 'tecnico', where: { empresa_id } }],
      transaction: t,
    });
    if (!deuda) { await t.rollback(); return err(res, 'Deuda no encontrada', 404); }
    if (deuda.estado === ESTADO_DEUDA.SALDADA) { await t.rollback(); return err(res, 'Esta deuda ya está saldada'); }

    const abono = Math.min(parseFloat(monto_abono), parseFloat(deuda.monto_pendiente));
    const nuevo_entregado = parseFloat(deuda.monto_entregado) + abono;
    const nuevo_pendiente = parseFloat(deuda.monto_pendiente) - abono;
    const nuevo_estado    = nuevo_pendiente <= 0 ? ESTADO_DEUDA.SALDADA : ESTADO_DEUDA.ABONADA;

    await deuda.update({
      monto_entregado: nuevo_entregado,
      monto_pendiente: nuevo_pendiente,
      estado:          nuevo_estado,
      fecha_abono:     new Date(),
    }, { transaction: t });

    await Tecnico.decrement('saldo_deuda', {
      by:    abono,
      where: { id: deuda.tecnico_id },
      transaction: t,
    });

    await t.commit();

    const tecnico = await Tecnico.findByPk(deuda.tecnico_id, { attributes: ['id', 'nombre', 'saldo_deuda'] });
    return ok(res, { deuda, tecnico, abono_aplicado: abono });
  } catch (e) {
    await t.rollback();
    return serverErr(res, e);
  }
};

module.exports = { listar, abonar };
