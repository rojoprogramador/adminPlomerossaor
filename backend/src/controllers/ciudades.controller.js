const { Ciudad } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const ciudades = await Ciudad.findAll({
      where: { empresa_id, activa: true },
      order: [['nombre', 'ASC']],
    });
    return ok(res, ciudades);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { nombre, departamento } = req.body;
    if (!nombre) return err(res, 'El nombre es requerido');
    const ciudad = await Ciudad.create({ empresa_id, nombre, departamento });
    return ok(res, ciudad, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const ciudad = await Ciudad.findOne({ where: { id: req.params.id, empresa_id } });
    if (!ciudad) return err(res, 'Ciudad no encontrada', 404);
    const { nombre, departamento, activa } = req.body;
    await ciudad.update({ nombre, departamento, activa });
    return ok(res, ciudad);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, crear, actualizar };
