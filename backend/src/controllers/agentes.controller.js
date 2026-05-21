const { AgenteSC, Servicio } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { incluir_inactivos } = req.query;
    const where = { empresa_id };
    if (!incluir_inactivos) where.activo = true;
    const agentes = await AgenteSC.findAll({ where, order: [['nombre', 'ASC']] });
    return ok(res, agentes);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { nombre, telefono } = req.body;
    if (!nombre) return err(res, 'El nombre es requerido');
    const agente = await AgenteSC.create({ empresa_id, nombre, telefono });
    return ok(res, agente, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const agente = await AgenteSC.findOne({ where: { id: req.params.id, empresa_id } });
    if (!agente) return err(res, 'Agente SC no encontrado', 404);
    const { nombre, telefono, activo } = req.body;
    await agente.update({ nombre, telefono, activo });
    return ok(res, agente);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, crear, actualizar };
