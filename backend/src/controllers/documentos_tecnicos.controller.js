const { Op } = require('sequelize');
const { DocumentoTecnico, Tecnico } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

// GET /api/tecnicos/:id/documentos
const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const tecnico = await Tecnico.findOne({ where: { id: req.params.id, empresa_id } });
    if (!tecnico) return err(res, 'Técnico no encontrado', 404);
    const docs = await DocumentoTecnico.findAll({
      where: { tecnico_id: req.params.id, empresa_id },
      order: [['fecha_vence', 'ASC']],
    });
    return ok(res, docs);
  } catch (e) { return serverErr(res, e); }
};

// POST /api/tecnicos/:id/documentos
const crear = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { tipo, fecha_inicio, fecha_vence, notas } = req.body;
    if (!tipo || !fecha_inicio || !fecha_vence) return err(res, 'tipo, fecha_inicio y fecha_vence son requeridos');
    const tecnico = await Tecnico.findOne({ where: { id: req.params.id, empresa_id } });
    if (!tecnico) return err(res, 'Técnico no encontrado', 404);
    const doc = await DocumentoTecnico.create({
      empresa_id, tecnico_id: req.params.id,
      tipo, fecha_inicio, fecha_vence, notas: notas || null,
    });
    return ok(res, doc, 201);
  } catch (e) { return serverErr(res, e); }
};

// PUT /api/tecnicos/:id/documentos/:docId  (renovar / editar)
const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const doc = await DocumentoTecnico.findOne({ where: { id: req.params.docId, empresa_id, tecnico_id: req.params.id } });
    if (!doc) return err(res, 'Documento no encontrado', 404);
    const { tipo, fecha_inicio, fecha_vence, notas, activo } = req.body;
    await doc.update({ tipo, fecha_inicio, fecha_vence, notas, activo });
    return ok(res, doc);
  } catch (e) { return serverErr(res, e); }
};

// DELETE /api/tecnicos/:id/documentos/:docId  (soft-delete)
const eliminar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const doc = await DocumentoTecnico.findOne({ where: { id: req.params.docId, empresa_id, tecnico_id: req.params.id } });
    if (!doc) return err(res, 'Documento no encontrado', 404);
    await doc.update({ activo: false });
    return ok(res, { ok: true });
  } catch (e) { return serverErr(res, e); }
};

// GET /api/tecnicos/documentos/todos  — todos los docs de la empresa
const listarTodos = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { estado } = req.query; // 'vencido' | 'por_vencer' | 'vigente'
    const hoy = new Date().toISOString().split('T')[0];
    const en7dias = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    const whereDoc = { empresa_id, activo: true };
    if (estado === 'vencido')    whereDoc.fecha_vence = { [Op.lt]: hoy };
    else if (estado === 'por_vencer') whereDoc.fecha_vence = { [Op.between]: [hoy, en7dias] };
    else if (estado === 'vigente')    whereDoc.fecha_vence = { [Op.gt]: en7dias };

    const docs = await DocumentoTecnico.findAll({
      where: whereDoc,
      include: [{ model: Tecnico, as: 'tecnico', attributes: ['id', 'nombre', 'telefono'] }],
      order: [['fecha_vence', 'ASC']],
    });
    return ok(res, docs);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, listarTodos, crear, actualizar, eliminar };
