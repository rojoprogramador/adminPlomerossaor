const { Op } = require('sequelize');
const { Cliente, Servicio, Tecnico, TipoServicio, Ciudad } = require('../models');
const { ok, err, serverErr } = require('../utils/respuesta');

const listar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { search, limit = 50, offset = 0 } = req.query;
    const where = { empresa_id };
    if (search) {
      where[Op.or] = [
        { nombre_completo: { [Op.iLike]: `%${search}%` } },
        { telefono_1:      { [Op.iLike]: `%${search}%` } },
        { cc_nit:          { [Op.iLike]: `%${search}%` } },
      ];
    }
    const { count, rows } = await Cliente.findAndCountAll({
      where,
      include: [{ model: Ciudad, as: 'ciudad', attributes: ['id', 'nombre'] }],
      limit:  Math.min(parseInt(limit), 100),
      offset: parseInt(offset),
      order:  [['nombre_completo', 'ASC']],
    });
    return ok(res, { total: count, clientes: rows });
  } catch (e) { return serverErr(res, e); }
};

const obtener = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, empresa_id },
      include: [{ model: Ciudad, as: 'ciudad', attributes: ['id', 'nombre'] }],
    });
    if (!cliente) return err(res, 'Cliente no encontrado', 404);
    return ok(res, cliente);
  } catch (e) { return serverErr(res, e); }
};

const crear = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { nombre_completo, telefono_1, telefono_2, email, whatsapp, cc_nit,
            requiere_factura, direccion, barrio, ciudad_id } = req.body;
    if (!nombre_completo && !telefono_1) return err(res, 'Se requiere al menos nombre o teléfono');
    if (requiere_factura && !cc_nit)    return err(res, 'El CC/NIT es obligatorio cuando requiere factura');
    if (cc_nit) {
      const dup = await Cliente.findOne({ where: { cc_nit, empresa_id } });
      if (dup) return err(res, 'Ya existe un cliente con ese CC/NIT');
    }
    const cliente = await Cliente.create({
      empresa_id, nombre_completo, telefono_1, telefono_2, email, whatsapp,
      cc_nit, requiere_factura: !!requiere_factura, direccion, barrio, ciudad_id,
    });
    return ok(res, cliente, 201);
  } catch (e) { return serverErr(res, e); }
};

const actualizar = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const cliente = await Cliente.findOne({ where: { id: req.params.id, empresa_id } });
    if (!cliente) return err(res, 'Cliente no encontrado', 404);
    await cliente.update(req.body);
    return ok(res, cliente);
  } catch (e) { return serverErr(res, e); }
};

const historial = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const cliente = await Cliente.findOne({ where: { id: req.params.id, empresa_id } });
    if (!cliente) return err(res, 'Cliente no encontrado', 404);
    const servicios = await Servicio.findAll({
      where: { cliente_id: req.params.id, empresa_id },
      include: [
        { model: Tecnico,      as: 'tecnico',       attributes: ['id', 'nombre'] },
        { model: TipoServicio, as: 'tipo_servicio',  attributes: ['id', 'nombre', 'categoria'] },
        { model: Ciudad,       as: 'ciudad',         attributes: ['id', 'nombre'] },
      ],
      order: [['fecha', 'DESC']],
    });
    const total_gastado = servicios
      .filter(s => s.estado === 'completado' && s.valor)
      .reduce((sum, s) => sum + parseFloat(s.valor), 0);
    return ok(res, { cliente, servicios, total_gastado });
  } catch (e) { return serverErr(res, e); }
};

const buscarPorTelefono = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { telefono } = req.query;
    if (!telefono) return err(res, 'El número de teléfono es requerido');

    // Buscar en telefono_1, telefono_2 o whatsapp
    const cliente = await Cliente.findOne({
      where: {
        empresa_id,
        [Op.or]: [
          { telefono_1: { [Op.iLike]: `%${telefono}%` } },
          { telefono_2: { [Op.iLike]: `%${telefono}%` } },
          { whatsapp:   { [Op.iLike]: `%${telefono}%` } },
        ]
      },
      include: [{ model: Ciudad, as: 'ciudad', attributes: ['id', 'nombre'] }],
    });

    if (!cliente) return err(res, 'Cliente no encontrado', 404);

    // Si lo encuentra, traer de una vez su historial (como en el endpoint historial)
    const servicios = await Servicio.findAll({
      where: { cliente_id: cliente.id, empresa_id },
      include: [
        { model: Tecnico,      as: 'tecnico',       attributes: ['id', 'nombre'] },
        { model: TipoServicio, as: 'tipo_servicio', attributes: ['id', 'nombre', 'categoria'] },
        { model: Ciudad,       as: 'ciudad',        attributes: ['id', 'nombre'] },
      ],
      order: [['fecha', 'DESC']],
    });

    const total_gastado = servicios
      .filter(s => s.estado === 'completado' && s.valor)
      .reduce((sum, s) => sum + parseFloat(s.valor), 0);

    return ok(res, { cliente, servicios, total_gastado });
  } catch (e) { return serverErr(res, e); }
};

module.exports = { listar, obtener, crear, actualizar, historial, buscarPorTelefono };
