const { Empresa } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresas = await Empresa.findAll({ order: [['nombre', 'ASC']] });
    return ok(res, empresas);
  } catch (e) { return serverErr(res, e); }
};

const obtener = async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(req.params.id);
    if (!empresa) return err(res, 'Empresa no encontrada', 404);
    return ok(res, empresa);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const { nombre, nit, telefono, logo_url, direccion, porcentaje_tecnico, umbral_visita_bajo, umbral_visita_alto } = req.body;
    if (!nombre) return err(res, 'El nombre es requerido');
    const empresa = await Empresa.create({ nombre, nit, telefono, logo_url, direccion, porcentaje_tecnico, umbral_visita_bajo, umbral_visita_alto });
    return ok(res, empresa, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const empresa = await Empresa.findByPk(req.params.id);
    if (!empresa) return err(res, 'Empresa no encontrada', 404);
    const { nombre, nit, telefono, logo_url, direccion, porcentaje_tecnico, umbral_visita_bajo, umbral_visita_alto, activa } = req.body;
    await empresa.update({ nombre, nit, telefono, logo_url, direccion, porcentaje_tecnico, umbral_visita_bajo, umbral_visita_alto, activa });
    return ok(res, empresa);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, obtener, crear, actualizar };
