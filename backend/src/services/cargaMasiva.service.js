const XLSX    = require('xlsx');
const { Tecnico, TipoServicio, Ciudad } = require('../models');
const { MEDIO_PAGO }    = require('../config/constants');
const { validarCostos } = require('./calculoPago.service');

// ─── PLANTILLA ────────────────────────────────────────────────────────────────
function generarPlantilla() {
  const ejemplo = [{
    tecnico_nombre:          'Juan Pérez',
    tipo_servicio_nombre:    'Destape',
    ciudad_nombre:           'Cali',
    cliente_nombre:          'María López',
    cliente_telefono:        '3001234567',
    fecha:                   new Date().toISOString().split('T')[0],
    valor:                   150000,
    medio_pago:              'nequi',
    tiene_materiales:        'N',
    costo_materiales:        0,
    descripcion_materiales:  '',
    tiene_herramienta:       'N',
    costo_herramienta:       0,
    descripcion_herramienta: '',
    completado:              'S',
    motivo_pendiente:        '',
    observaciones:           '',
  }];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(ejemplo);
  XLSX.utils.book_append_sheet(wb, ws, 'Servicios');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ─── ENTRADA PRINCIPAL ────────────────────────────────────────────────────────
async function cargarDesdeJSON(rows, empresa_id) {
  return _procesar(rows, empresa_id, 'json');
}

async function cargarDesdeExcel(buffer, empresa_id) {
  const wb   = XLSX.read(buffer, { type: 'buffer' });
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
  return _procesar(rows, empresa_id, 'excel');
}

// ─── PROCESAMIENTO ────────────────────────────────────────────────────────────
async function _procesar(rows, empresa_id, origen) {
  const [tecnicos, tipos, ciudades] = await Promise.all([
    Tecnico.findAll({ where: { empresa_id, activo: true } }),
    TipoServicio.findAll({ where: { empresa_id, activo: true } }),
    Ciudad.findAll({ where: { empresa_id, activa: true } }),
  ]);
  const tecnicoMap = new Map(tecnicos.map(t => [t.nombre.toLowerCase().trim(), t]));
  const tipoMap    = new Map(tipos.map(t => [t.nombre.toLowerCase().trim(), t]));
  const ciudadMap  = new Map(ciudades.map(c => [c.nombre.toLowerCase().trim(), c]));

  const filas_validas = [];
  const errores       = [];

  rows.forEach((row, idx) => {
    const fila = idx + 2;
    const rowErrors = _validar(row, fila, tecnicoMap, tipoMap, ciudadMap);
    if (rowErrors.length > 0) {
      errores.push(...rowErrors);
    } else {
      const tecnico = tecnicoMap.get(row.tecnico_nombre?.toLowerCase().trim());
      const tipo    = tipoMap.get(row.tipo_servicio_nombre?.toLowerCase().trim());
      const ciudad  = ciudadMap.get(row.ciudad_nombre?.toLowerCase().trim());
      filas_validas.push({
        empresa_id,
        tecnico_id:              tecnico.id,
        tipo_servicio_id:        tipo.id,
        ciudad_id:               ciudad.id,
        _tipo_servicio_obj:      tipo,
        cliente_anonimo:         true,
        nombre_cliente_anon:     row.cliente_nombre   || null,
        telefono_cliente_anon:   row.cliente_telefono || null,
        fecha:                   row.fecha || new Date().toISOString().split('T')[0],
        valor:                   row.valor != null ? parseFloat(row.valor) : null,
        medio_pago:              row.medio_pago ? row.medio_pago.toLowerCase() : null,
        tiene_materiales:        _bool(row.tiene_materiales),
        costo_materiales:        _bool(row.tiene_materiales) ? (parseFloat(row.costo_materiales) || 0) : 0,
        descripcion_materiales:  row.descripcion_materiales  || null,
        tiene_herramienta:       _bool(row.tiene_herramienta),
        costo_herramienta:       _bool(row.tiene_herramienta) ? (parseFloat(row.costo_herramienta) || 0) : 0,
        descripcion_herramienta: row.descripcion_herramienta || null,
        estado:                  _bool(row.completado) ? 'completado' : 'pendiente',
        motivo_pendiente:        row.motivo_pendiente || null,
        observaciones:           row.observaciones    || null,
        origen,
        _fila: fila,
      });
    }
  });

  return { filas_validas, errores };
}

// ─── VALIDACIÓN ───────────────────────────────────────────────────────────────
function _validar(row, fila, tecnicoMap, tipoMap, ciudadMap) {
  const errors = [];

  if (!row.tecnico_nombre?.trim() || !tecnicoMap.has(row.tecnico_nombre.toLowerCase().trim()))
    errors.push({ fila, campo: 'tecnico_nombre', mensaje: `Técnico '${row.tecnico_nombre}' no encontrado o inactivo` });

  if (!row.tipo_servicio_nombre?.trim() || !tipoMap.has(row.tipo_servicio_nombre.toLowerCase().trim()))
    errors.push({ fila, campo: 'tipo_servicio_nombre', mensaje: `Tipo de servicio '${row.tipo_servicio_nombre}' no encontrado` });

  if (!row.ciudad_nombre?.trim() || !ciudadMap.has(row.ciudad_nombre.toLowerCase().trim()))
    errors.push({ fila, campo: 'ciudad_nombre', mensaje: `Ciudad '${row.ciudad_nombre}' no registrada` });

  if (row.valor != null && row.valor !== '') {
    const v = parseFloat(row.valor);
    if (isNaN(v) || v <= 0) errors.push({ fila, campo: 'valor', mensaje: 'El valor debe ser un número positivo' });
  }

  if (row.medio_pago && !Object.values(MEDIO_PAGO).includes(row.medio_pago.toLowerCase()))
    errors.push({ fila, campo: 'medio_pago', mensaje: `Medio de pago inválido. Use: ${Object.values(MEDIO_PAGO).join(' / ')}` });

  const completado = _bool(row.completado);
  if (completado) {
    if (!row.valor)      errors.push({ fila, campo: 'valor',      mensaje: 'Valor requerido para servicio completado' });
    if (!row.medio_pago) errors.push({ fila, campo: 'medio_pago', mensaje: 'Medio de pago requerido para servicio completado' });
  }

  if (row.valor) {
    const v = validarCostos({
      valor:             row.valor,
      tiene_materiales:  _bool(row.tiene_materiales),
      costo_materiales:  row.costo_materiales,
      tiene_herramienta: _bool(row.tiene_herramienta),
      costo_herramienta: row.costo_herramienta,
    });
    if (!v.valido) errors.push({ fila, campo: 'costos', mensaje: v.mensaje });
  }

  return errors;
}

const _bool = (v) => {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number')  return v === 1;
  return ['s', 'si', 'sí', 'true', '1', 'yes'].includes(String(v).toLowerCase().trim());
};

module.exports = { generarPlantilla, cargarDesdeJSON, cargarDesdeExcel };
