const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const { ROLES } = require('../config/constants');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.rol === ROLES.SUPERADMIN
      ? (req.query.empresa_id || undefined)
      : req.usuario.empresa_id;
    const where = { activo: true };
    if (empresa_id) where.empresa_id = empresa_id;
    const usuarios = await Usuario.findAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [['nombre', 'ASC']],
    });
    return ok(res, usuarios);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const esSuperadmin = req.usuario.rol === ROLES.SUPERADMIN;
    const empresa_id = esSuperadmin
      ? (req.body.empresa_id || null)
      : req.usuario.empresa_id;

    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) return err(res, 'Nombre, email, contraseña y rol son requeridos');
    if (!Object.values(ROLES).includes(rol)) return err(res, 'Rol inválido');
    const existe = await Usuario.findOne({ where: { email } });
    if (existe) return err(res, 'Ya existe un usuario con ese email');
    const password_hash = await bcrypt.hash(password, 10);
    const usuario = await Usuario.create({ empresa_id, nombre, email, password_hash, rol });
    const { password_hash: _ph, ...data } = usuario.toJSON();
    return ok(res, data, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const esSuperadmin = req.usuario.rol === ROLES.SUPERADMIN;
    const where = esSuperadmin
      ? { id: req.params.id }
      : { id: req.params.id, empresa_id: req.usuario.empresa_id };
    const usuario = await Usuario.findOne({ where });
    if (!usuario) return err(res, 'Usuario no encontrado', 404);
    const { nombre, rol, activo, empresa_id } = req.body;
    const updates = { nombre, rol, activo };
    if (esSuperadmin && empresa_id !== undefined) updates.empresa_id = empresa_id || null;
    await usuario.update(updates);
    const { password_hash: _ph, ...data } = usuario.toJSON();
    return ok(res, data);
  } catch (e) { return serverErr(res, e); }
};

const cambiarPassword = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { password_nueva } = req.body;
    if (!password_nueva || password_nueva.length < 6) return err(res, 'La contraseña debe tener mínimo 6 caracteres');
    const usuario = await Usuario.findOne({ where: { id: req.params.id, empresa_id } });
    if (!usuario) return err(res, 'Usuario no encontrado', 404);
    await usuario.update({ password_hash: await bcrypt.hash(password_nueva, 10) });
    return ok(res, { mensaje: 'Contraseña actualizada' });
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, crear, actualizar, cambiarPassword };
