const { AjusteContable, Servicio, PagoTecnico, Usuario } = require('../models');
const { ROLES } = require('../config/constants');
const { ok, err, serverErr } = require('../utils/respuesta');

// ─── LISTAR ajustes de un servicio ───────────────────────────────────────────
const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { servicio_id } = req.query;

    const where = { empresa_id };
    if (servicio_id) where.servicio_id = servicio_id;

    const ajustes = await AjusteContable.findAll({
      where,
      include: [
        { model: Usuario,     as: 'realizado_por', attributes: ['id', 'nombre', 'email'] },
        { model: Servicio,    as: 'servicio',      attributes: ['id', 'fecha', 'estado'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    return ok(res, ajustes);
  } catch (e) { return serverErr(res, e); }
};

// ─── CREAR ajuste contable (solo admin) ──────────────────────────────────────
const crear = async (req, res) => {
  try {
    const empresa_id  = req.usuario.empresa_id;
    const usuario_rol = req.usuario.rol;

    if (![ROLES.ADMIN, ROLES.SUPERADMIN].includes(usuario_rol)) {
      return err(res, 'Solo un administrador puede crear ajustes contables', 403);
    }

    const { servicio_id, pago_tecnico_id, campo_modificado, valor_anterior, valor_nuevo, motivo } = req.body;

    if (!servicio_id)       return err(res, 'El servicio es requerido');
    if (!campo_modificado)  return err(res, 'El campo modificado es requerido');
    if (!motivo)            return err(res, 'El motivo del ajuste es requerido');

    const servicio = await Servicio.findOne({ where: { id: servicio_id, empresa_id } });
    if (!servicio) return err(res, 'Servicio no encontrado', 404);

    if (pago_tecnico_id) {
      const pago = await PagoTecnico.findOne({ where: { id: pago_tecnico_id, servicio_id } });
      if (!pago) return err(res, 'Pago técnico no encontrado', 404);
    }

    const ajuste = await AjusteContable.create({
      empresa_id,
      servicio_id,
      pago_tecnico_id: pago_tecnico_id || null,
      campo_modificado,
      valor_anterior:  valor_anterior !== undefined ? String(valor_anterior) : null,
      valor_nuevo:     valor_nuevo     !== undefined ? String(valor_nuevo)    : null,
      motivo,
      realizado_por_id: req.usuario.id,
    });

    return ok(res, ajuste, 201);
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, crear };
