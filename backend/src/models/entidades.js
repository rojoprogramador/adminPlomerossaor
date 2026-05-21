const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { ROLES, TIPO_PAGO, PERIODO_PAGO } = require('../config/constants');

// ─── CIUDAD ──────────────────────────────────────────────────────────────────
const Ciudad = sequelize.define('Ciudad', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:   { type: DataTypes.UUID, allowNull: false },
  nombre:       { type: DataTypes.STRING, allowNull: false },
  departamento: { type: DataTypes.STRING, allowNull: true },
  activa:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'ciudades' });

// ─── USUARIO ─────────────────────────────────────────────────────────────────
const Usuario = sequelize.define('Usuario', {
  id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:    { type: DataTypes.UUID, allowNull: true },  // null para superadmin
  nombre:        { type: DataTypes.STRING, allowNull: false },
  email:         { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  rol:           { type: DataTypes.ENUM(...Object.values(ROLES)), allowNull: false },
  activo:        { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'usuarios' });

// ─── CLIENTE ─────────────────────────────────────────────────────────────────
const Cliente = sequelize.define('Cliente', {
  id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:       { type: DataTypes.UUID, allowNull: false },
  ciudad_id:        { type: DataTypes.UUID, allowNull: true },
  cc_nit:           { type: DataTypes.STRING, allowNull: true },
  nombre_completo:  { type: DataTypes.STRING, allowNull: true },
  telefono_1:       { type: DataTypes.STRING, allowNull: true },
  telefono_2:       { type: DataTypes.STRING, allowNull: true },
  email:            { type: DataTypes.STRING, allowNull: true },
  whatsapp:         { type: DataTypes.STRING, allowNull: true },
  requiere_factura: { type: DataTypes.BOOLEAN, defaultValue: false },
  direccion:        { type: DataTypes.STRING, allowNull: true },
  barrio:           { type: DataTypes.STRING, allowNull: true },
}, { tableName: 'clientes' });

// ─── TECNICO ─────────────────────────────────────────────────────────────────
const Tecnico = sequelize.define('Tecnico', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:          { type: DataTypes.UUID, allowNull: false },
  nombre:              { type: DataTypes.STRING, allowNull: false },
  telefono:            { type: DataTypes.STRING, allowNull: true },
  tipo_pago:           { type: DataTypes.ENUM(...Object.values(TIPO_PAGO)), defaultValue: TIPO_PAGO.PORCENTAJE, allowNull: false },
  porcentaje_override: { type: DataTypes.DECIMAL(5, 2), allowNull: true, validate: { min: 0, max: 100 } },
  recibe_total:        { type: DataTypes.BOOLEAN, defaultValue: false },
  salario_mensual:     { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  periodo_pago:        { type: DataTypes.ENUM(...Object.values(PERIODO_PAGO)), allowNull: true },
  saldo_deuda:         { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  activo:              { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'tecnicos' });

// ─── AGENTE SC ───────────────────────────────────────────────────────────────
const AgenteSC = sequelize.define('AgenteSC', {
  id:           { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:   { type: DataTypes.UUID, allowNull: false },
  nombre:       { type: DataTypes.STRING, allowNull: false },
  telefono:     { type: DataTypes.STRING, allowNull: true },
  tipo_pago:    { type: DataTypes.ENUM('fijo', 'porcentaje'), defaultValue: 'fijo' },
  valor_pago:   { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  periodo_pago: { type: DataTypes.ENUM('semanal', 'quincenal', 'mensual'), defaultValue: 'semanal' },
  activo:       { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'agentes_sc' });

module.exports = { Ciudad, Usuario, Cliente, Tecnico, AgenteSC };
