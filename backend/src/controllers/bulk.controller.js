const multer  = require('multer');
const { sequelize } = require('../config/database');
const { Servicio, Empresa } = require('../models');
const { generarPlantilla, cargarDesdeJSON, cargarDesdeExcel } = require('../services/cargaMasiva.service');
const { completarServicioTx } = require('../services/completarServicio.service');
const { ok, err, serverErr } = require('../utils/respuesta');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// GET /api/servicios/bulk/plantilla
const plantilla = (req, res) => {
  try {
    const buffer = generarPlantilla();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_servicios.xlsx"');
    return res.send(buffer);
  } catch (e) { return serverErr(res, e); }
};

// POST /api/servicios/bulk   — body: { servicios: [...] }
const bulkJSON = async (req, res) => {
  try {
    const empresa_id = req.usuario.empresa_id;
    const { servicios } = req.body;
    if (!Array.isArray(servicios) || servicios.length === 0) return err(res, 'Se requiere un array "servicios"');
    if (servicios.length > 500) return err(res, 'Máximo 500 servicios por carga');

    const { filas_validas, errores } = await cargarDesdeJSON(servicios, empresa_id);
    const resultado = await _crear(filas_validas, empresa_id);

    return ok(res, _respuesta(servicios.length, resultado, errores));
  } catch (e) { return serverErr(res, e); }
};

// POST /api/servicios/bulk/excel  — multipart field: "archivo"
const bulkExcel = (req, res) => {
  upload.single('archivo')(req, res, async (uploadErr) => {
    if (uploadErr) return err(res, uploadErr.message);
    if (!req.file)  return err(res, 'Se requiere el archivo Excel (campo: archivo)');
    try {
      const empresa_id = req.usuario.empresa_id;
      const { filas_validas, errores } = await cargarDesdeExcel(req.file.buffer, empresa_id);
      const resultado = await _crear(filas_validas, empresa_id);
      return ok(res, _respuesta(filas_validas.length + errores.length, resultado, errores));
    } catch (e) { return serverErr(res, e); }
  });
};

// ─── HELPER: crear servicios uno por uno ────────────────────────────────────
async function _crear(filas_validas, empresa_id) {
  const empresa = await Empresa.findByPk(empresa_id);
  const creados          = [];
  const errores_creacion = [];

  for (const fila of filas_validas) {
    const t = await sequelize.transaction();
    try {
      const { _tipo_servicio_obj, _fila, ...data } = fila;
      const servicio = await Servicio.create({ ...data, empresa_id }, { transaction: t });

      if (servicio.estado === 'completado') {
        servicio.fecha_completado = new Date();
        await servicio.save({ transaction: t });
        servicio.tipo_servicio = _tipo_servicio_obj;
        servicio.empresa       = empresa;
        await completarServicioTx(servicio, empresa, t);
      }

      await t.commit();
      creados.push({ id: servicio.id, fila: _fila, estado: servicio.estado });
    } catch (e) {
      await t.rollback();
      errores_creacion.push({ fila: fila._fila, mensaje: e.message });
    }
  }
  return { creados, errores_creacion };
}

const _respuesta = (total, { creados, errores_creacion }, errores_validacion) => ({
  total,
  exitosos:           creados.length,
  errores_validacion: errores_validacion.length,
  errores_creacion:   errores_creacion.length,
  detalle_errores:    [...errores_validacion, ...errores_creacion],
  servicios_creados:  creados,
});

module.exports = { plantilla, bulkJSON, bulkExcel };
