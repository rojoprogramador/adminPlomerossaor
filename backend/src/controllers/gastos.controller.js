const { Op } = require('sequelize');
const { Gasto } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { desde, hasta, categoria } = req.query;
    const where = { empresa_id };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha[Op.gte] = desde;
      if (hasta) where.fecha[Op.lte] = hasta;
    }
    if (categoria) where.categoria = categoria;
    const gastos = await Gasto.findAll({ where, order: [['fecha', 'DESC']] });
    return ok(res, gastos);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { concepto, monto, fecha, categoria, notas } = req.body;
    if (!concepto) return err(res, 'El concepto es requerido');
    if (!monto || parseFloat(monto) <= 0) return err(res, 'El monto debe ser mayor a cero');
    if (!fecha) return err(res, 'La fecha es requerida');
    const gasto = await Gasto.create({ empresa_id, concepto, monto: parseFloat(monto), fecha, categoria: categoria || 'otro', notas });
    return ok(res, gasto, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const gasto = await Gasto.findOne({ where: { id: req.params.id, empresa_id } });
    if (!gasto) return err(res, 'Gasto no encontrado', 404);
    const { concepto, monto, fecha, categoria, notas } = req.body;
    await gasto.update({ concepto, monto: monto ? parseFloat(monto) : gasto.monto, fecha, categoria, notas });
    return ok(res, gasto);
  } catch (e) { return serverErr(res, e); }
};

const eliminar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const gasto = await Gasto.findOne({ where: { id: req.params.id, empresa_id } });
    if (!gasto) return err(res, 'Gasto no encontrado', 404);
    await gasto.destroy();
    return ok(res, { mensaje: 'Gasto eliminado' });
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, crear, actualizar, eliminar };
