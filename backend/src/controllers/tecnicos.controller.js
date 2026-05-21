const { Op } = require('sequelize');
const { Tecnico, Servicio, PagoTecnico, DeudaTecnico, TipoServicio } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { incluir_inactivos } = req.query;
    const where = { empresa_id };
    if (!incluir_inactivos) where.activo = true;
    const tecnicos = await Tecnico.findAll({ where, order: [['nombre', 'ASC']] });
    return ok(res, tecnicos);
  } catch (e) { return serverErr(res, e); }
};

const obtener = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const tecnico = await Tecnico.findOne({ where: { id: req.params.id, empresa_id } });
    if (!tecnico) return err(res, 'Técnico no encontrado', 404);
    return ok(res, tecnico);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { nombre, telefono, tipo_pago, porcentaje_override, recibe_total, salario_mensual, periodo_pago } = req.body;
    if (!nombre) return err(res, 'El nombre es requerido');
    const esNomina = tipo_pago === 'nomina';
    const tecnico = await Tecnico.create({
      empresa_id, nombre, telefono,
      tipo_pago:           tipo_pago || 'porcentaje',
      porcentaje_override: esNomina ? null : (porcentaje_override ?? null),
      recibe_total:        esNomina ? false : !!recibe_total,
      salario_mensual:     esNomina ? (parseFloat(salario_mensual) || null) : null,
      periodo_pago:        esNomina ? (periodo_pago || null) : null,
    });
    return ok(res, tecnico, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const tecnico = await Tecnico.findOne({ where: { id: req.params.id, empresa_id } });
    if (!tecnico) return err(res, 'Técnico no encontrado', 404);
    const { nombre, telefono, tipo_pago, porcentaje_override, recibe_total, salario_mensual, periodo_pago, activo } = req.body;
    const esNomina = (tipo_pago ?? tecnico.tipo_pago) === 'nomina';
    await tecnico.update({
      nombre, telefono, activo,
      tipo_pago:           tipo_pago ?? tecnico.tipo_pago,
      porcentaje_override: esNomina ? null : (porcentaje_override ?? null),
      recibe_total:        esNomina ? false : (recibe_total === undefined ? tecnico.recibe_total : !!recibe_total),
      salario_mensual:     esNomina ? (parseFloat(salario_mensual) || null) : null,
      periodo_pago:        esNomina ? (periodo_pago || null) : null,
    });
    return ok(res, tecnico);
  } catch (e) { return serverErr(res, e); }
};

const nomina = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { id } = req.params;
    const { desde, hasta } = req.query;
    const tecnico = await Tecnico.findOne({ where: { id, empresa_id } });
    if (!tecnico) return err(res, 'Técnico no encontrado', 404);

    const where = { tecnico_id: id };
    if (desde || hasta) {
      where.fecha_registro = {};
      if (desde) where.fecha_registro[Op.gte] = new Date(desde);
      if (hasta) where.fecha_registro[Op.lte] = new Date(hasta + 'T23:59:59');
    }

    const pagos = await PagoTecnico.findAll({
      where,
      include: [{
        model: Servicio, as: 'servicio',
        attributes: ['id', 'fecha', 'es_visita', 'es_garantia'],
        include: [{ model: TipoServicio, as: 'tipo_servicio', attributes: ['nombre'] }],
      }],
      order: [['fecha_registro', 'DESC']],
    });

    const resumen = pagos.reduce((acc, p) => {
      acc.total_bruto      += parseFloat(p.valor_bruto) || 0;
      acc.total_materiales += p.tiene_materiales  ? (parseFloat(p.costo_materiales)  || 0) : 0;
      acc.total_herramienta += p.tiene_herramienta ? (parseFloat(p.costo_herramienta) || 0) : 0;
      acc.total_neto       += parseFloat(p.valor_neto)    || 0;
      acc.total_tecnico    += parseFloat(p.monto_tecnico) || 0;
      acc.total_empresa    += parseFloat(p.monto_empresa) || 0;
      return acc;
    }, { total_bruto: 0, total_materiales: 0, total_herramienta: 0, total_neto: 0, total_tecnico: 0, total_empresa: 0 });

    return ok(res, { tecnico, resumen, pagos });
  } catch (e) { return serverErr(res, e); }
};

const deudas = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { id } = req.params;
    const tecnico = await Tecnico.findOne({ where: { id, empresa_id } });
    if (!tecnico) return err(res, 'Técnico no encontrado', 404);

    const deudas = await DeudaTecnico.findAll({
      where: { tecnico_id: id, estado: { [Op.ne]: 'saldada' } },
      include: [{ model: Servicio, as: 'servicio', attributes: ['id', 'fecha', 'valor', 'medio_pago'] }],
      order: [['fecha_registro', 'ASC']],
    });

    return ok(res, {
      tecnico: { id: tecnico.id, nombre: tecnico.nombre, saldo_deuda: tecnico.saldo_deuda },
      deudas,
    });
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, obtener, crear, actualizar, nomina, deudas };
