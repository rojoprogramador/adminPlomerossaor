const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  ESTADO_GARANTIA, TIPO_RESOLUCION_GARANTIA,
  ESTADO_ENTREGA_PAGO, ESTADO_DEUDA,
  MEDIO_PAGO, TIPO_DOCUMENTO,
} = require('../config/constants');

// ─── GARANTIA ─────────────────────────────────────────────────────────────────
const Garantia = sequelize.define('Garantia', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  servicio_id:         { type: DataTypes.UUID, allowNull: false },
  tecnico_id:          { type: DataTypes.UUID, allowNull: false },
  fecha_inicio:        { type: DataTypes.DATEONLY, allowNull: false },
  fecha_vence:         { type: DataTypes.DATEONLY, allowNull: false },
  estado:              { type: DataTypes.ENUM(...Object.values(ESTADO_GARANTIA)), defaultValue: ESTADO_GARANTIA.ACTIVA },
  descripcion_problema: { type: DataTypes.TEXT, allowNull: true },
  tipo_resolucion:     { type: DataTypes.ENUM(...Object.values(TIPO_RESOLUCION_GARANTIA)), allowNull: true },
  fecha_atencion:      { type: DataTypes.DATEONLY, allowNull: true },
  resolucion:          { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'garantias' });

// ─── PAGO TECNICO ─────────────────────────────────────────────────────────────
const PagoTecnico = sequelize.define('PagoTecnico', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  servicio_id:         { type: DataTypes.UUID, allowNull: false },
  tecnico_id:          { type: DataTypes.UUID, allowNull: false },
  valor_bruto:         { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  tiene_materiales:    { type: DataTypes.BOOLEAN, defaultValue: false },
  costo_materiales:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  tiene_herramienta:   { type: DataTypes.BOOLEAN, defaultValue: false },
  costo_herramienta:   { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_neto:          { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  tecnico_recibio_total: { type: DataTypes.BOOLEAN, defaultValue: false },
  porcentaje_aplicado: { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  monto_tecnico:       { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  monto_empresa:       { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  medio_pago_cliente:  { type: DataTypes.ENUM(...Object.values(MEDIO_PAGO)), allowNull: true },
  estado_entrega:      { type: DataTypes.ENUM(...Object.values(ESTADO_ENTREGA_PAGO)), defaultValue: ESTADO_ENTREGA_PAGO.PENDIENTE },
  fecha_registro:      { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  fecha_entrega:       { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'pagos_tecnicos' });

// ─── DEUDA TECNICO ────────────────────────────────────────────────────────────
const DeudaTecnico = sequelize.define('DeudaTecnico', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tecnico_id:       { type: DataTypes.UUID, allowNull: false },
  servicio_id:      { type: DataTypes.UUID, allowNull: false },
  monto_cobrado:    { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  monto_entregado:  { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  monto_pendiente:  { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  estado:           { type: DataTypes.ENUM(...Object.values(ESTADO_DEUDA)), defaultValue: ESTADO_DEUDA.PENDIENTE },
  fecha_registro:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  fecha_abono:      { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'deudas_tecnicos' });

// ─── PAGO AGENTE ──────────────────────────────────────────────────────────────
const PagoAgente = sequelize.define('PagoAgente', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:   { type: DataTypes.UUID, allowNull: false },
  agente_sc_id: { type: DataTypes.UUID, allowNull: false },
  semana_inicio: { type: DataTypes.DATEONLY, allowNull: false },
  semana_fin:    { type: DataTypes.DATEONLY, allowNull: false },
  monto_total:   { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  estado:        { type: DataTypes.ENUM('pendiente', 'pagado'), defaultValue: 'pendiente' },
  fecha_pago:    { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'pagos_agentes' });

// ─── DOCUMENTO ────────────────────────────────────────────────────────────────
const Documento = sequelize.define('Documento', {
  id:                   { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:           { type: DataTypes.UUID, allowNull: false },
  servicio_id:          { type: DataTypes.UUID, allowNull: false },
  tipo:                 { type: DataTypes.ENUM(...Object.values(TIPO_DOCUMENTO)), allowNull: false },
  numero:               { type: DataTypes.STRING, allowNull: false },
  nombre_cliente:       { type: DataTypes.STRING, allowNull: false },
  cc_nit_cliente:       { type: DataTypes.STRING, allowNull: true },
  descripcion_servicio: { type: DataTypes.TEXT, allowNull: false },
  valor_bruto:          { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  costo_materiales:     { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  costo_herramienta:    { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  valor_total:          { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  pdf_url:              { type: DataTypes.STRING, allowNull: true },
  enviado_whatsapp:     { type: DataTypes.BOOLEAN, defaultValue: false },
  enviado_email:        { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'documentos' });

// ─── GASTO OPERACIONAL ────────────────────────────────────────────────────────
const Gasto = sequelize.define('Gasto', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:        { type: DataTypes.UUID, allowNull: false },
  concepto:          { type: DataTypes.STRING, allowNull: false },
  monto:             { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  fecha:             { type: DataTypes.DATEONLY, allowNull: false },
  categoria:         { type: DataTypes.ENUM('publicidad', 'sc', 'arriendo', 'nomina_interna', 'combustible', 'herramientas', 'impuestos', 'mantenimiento', 'servicios_publicos', 'otro'), defaultValue: 'otro' },
  notas:             { type: DataTypes.TEXT, allowNull: true },
  tecnico_id:        { type: DataTypes.UUID, allowNull: true },
  registrado_por_id: { type: DataTypes.UUID, allowNull: true },
}, { tableName: 'gastos' });

// ─── DOCUMENTO TÉCNICO ────────────────────────────────────────────────────────
const DocumentoTecnico = sequelize.define('DocumentoTecnico', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:   { type: DataTypes.UUID, allowNull: false },
  tecnico_id:   { type: DataTypes.UUID, allowNull: false },
  tipo:         { type: DataTypes.STRING(100), allowNull: false },
  fecha_inicio: { type: DataTypes.DATEONLY, allowNull: false },
  fecha_vence:  { type: DataTypes.DATEONLY, allowNull: false },
  notas:        { type: DataTypes.TEXT, allowNull: true },
  activo:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'documentos_tecnicos' });

// ─── AJUSTE CONTABLE ──────────────────────────────────────────────────────────
const AjusteContable = sequelize.define('AjusteContable', {
  id:                { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:        { type: DataTypes.UUID, allowNull: false },
  servicio_id:       { type: DataTypes.UUID, allowNull: false },
  pago_tecnico_id:   { type: DataTypes.UUID, allowNull: true },
  campo_modificado:  { type: DataTypes.STRING, allowNull: false },
  valor_anterior:    { type: DataTypes.STRING, allowNull: true },
  valor_nuevo:       { type: DataTypes.STRING, allowNull: true },
  motivo:            { type: DataTypes.TEXT, allowNull: false },
  realizado_por_id:  { type: DataTypes.UUID, allowNull: false },
}, { tableName: 'ajustes_contables' });

module.exports = { Garantia, PagoTecnico, DeudaTecnico, PagoAgente, Documento, Gasto, DocumentoTecnico, AjusteContable };
