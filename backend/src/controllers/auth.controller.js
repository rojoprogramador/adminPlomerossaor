const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { Usuario, Empresa } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return err(res, 'Email y contraseña requeridos');

    const usuario = await Usuario.findOne({
      where: { email, activo: true },
      include: [{ model: Empresa, as: 'empresa', attributes: ['id', 'nombre', 'activa'] }],
    });

    if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
    if (usuario.empresa && !usuario.empresa.activa) return res.status(401).json({ error: 'Empresa inactiva' });

    const valido = await bcrypt.compare(password, usuario.password_hash);
    if (!valido) return res.status(401).json({ error: 'Credenciales inválidas' });

    const payload = {
      id:         usuario.id,
      empresa_id: usuario.empresa_id,
      rol:        usuario.rol,
      nombre:     usuario.nombre,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    });

    return ok(res, {
      token,
      usuario: {
        id:      usuario.id,
        nombre:  usuario.nombre,
        email:   usuario.email,
        rol:     usuario.rol,
        empresa: usuario.empresa,
      },
    });
  } catch (e) { return serverErr(res, e); }
};

const me = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, {
      attributes: { exclude: ['password_hash'] },
      include: [{ model: Empresa, as: 'empresa', attributes: ['id', 'nombre', 'logo_url'] }],
    });
    if (!usuario) return err(res, 'Usuario no encontrado', 404);
    return ok(res, usuario);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { login, me };
