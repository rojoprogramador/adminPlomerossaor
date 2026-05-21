const { ROLES } = require('../config/constants');

const requireRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario.rol)) {
    return res.status(403).json({ error: 'Sin permiso para esta acción' });
  }
  next();
};

const isSuperadmin   = requireRoles(ROLES.SUPERADMIN);
const isAdmin        = requireRoles(ROLES.SUPERADMIN, ROLES.ADMIN);
const isAdminOrAgente = requireRoles(ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.AGENTE_SC);

module.exports = { requireRoles, isSuperadmin, isAdmin, isAdminOrAgente };
