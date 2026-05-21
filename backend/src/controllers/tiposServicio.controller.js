const { TipoServicio } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { categoria, incluir_inactivos } = req.query;
    const where = { empresa_id };
    if (!incluir_inactivos) where.activo = true;
    if (categoria) where.categoria = categoria;
    const tipos = await TipoServicio.findAll({ where, order: [['nombre', 'ASC']] });
    return ok(res, tipos);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { nombre, categoria, porcentaje_tecnico, genera_garantia, garantia_dias, tarifa_base } = req.body;
    if (!nombre)    return err(res, 'El nombre es requerido');
    if (!categoria) return err(res, 'La categoría es requerida');
    const tipo = await TipoServicio.create({
      empresa_id, nombre, categoria,
      porcentaje_tecnico, genera_garantia, garantia_dias, tarifa_base,
    });
    return ok(res, tipo, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const tipo = await TipoServicio.findOne({ where: { id: req.params.id, empresa_id } });
    if (!tipo) return err(res, 'Tipo de servicio no encontrado', 404);
    const { nombre, categoria, porcentaje_tecnico, genera_garantia, garantia_dias, tarifa_base, activo } = req.body;
    await tipo.update({ nombre, categoria, porcentaje_tecnico, genera_garantia, garantia_dias, tarifa_base, activo });
    return ok(res, tipo);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, crear, actualizar };
