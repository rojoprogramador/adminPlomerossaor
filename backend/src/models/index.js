const { sequelize } = require('../config/database');

const Empresa = require('./Empresa');
const { Ciudad, Usuario, Cliente, Tecnico, AgenteSC } = require('./entidades');
const { TipoServicio, Servicio } = require('./Servicio');
const { Garantia, PagoTecnico, DeudaTecnico, PagoAgente, Documento, Gasto, DocumentoTecnico } = require('./financiero');

// ─── ASOCIACIONES ─────────────────────────────────────────────────────────────

// Empresa → relaciones
Empresa.hasMany(Ciudad,        { foreignKey: 'empresa_id', as: 'ciudades' });
Empresa.hasMany(Usuario,       { foreignKey: 'empresa_id', as: 'usuarios' });
Empresa.hasMany(Cliente,       { foreignKey: 'empresa_id', as: 'clientes' });
Empresa.hasMany(Tecnico,       { foreignKey: 'empresa_id', as: 'tecnicos' });
Empresa.hasMany(AgenteSC,      { foreignKey: 'empresa_id', as: 'agentes_sc' });
Empresa.hasMany(TipoServicio,  { foreignKey: 'empresa_id', as: 'tipos_servicio' });
Empresa.hasMany(Servicio,      { foreignKey: 'empresa_id', as: 'servicios' });
Empresa.hasMany(PagoAgente,    { foreignKey: 'empresa_id', as: 'pagos_agente' });
Empresa.hasMany(Documento,     { foreignKey: 'empresa_id', as: 'documentos' });
Empresa.hasMany(Gasto,         { foreignKey: 'empresa_id', as: 'gastos' });

// Inversos
Ciudad.belongsTo(Empresa,       { foreignKey: 'empresa_id', as: 'empresa' });
Usuario.belongsTo(Empresa,      { foreignKey: 'empresa_id', as: 'empresa' });
Cliente.belongsTo(Empresa,      { foreignKey: 'empresa_id', as: 'empresa' });
Tecnico.belongsTo(Empresa,      { foreignKey: 'empresa_id', as: 'empresa' });
AgenteSC.belongsTo(Empresa,     { foreignKey: 'empresa_id', as: 'empresa' });
TipoServicio.belongsTo(Empresa, { foreignKey: 'empresa_id', as: 'empresa' });
Servicio.belongsTo(Empresa,     { foreignKey: 'empresa_id', as: 'empresa' });

// Ciudad → Clientes y Servicios
Ciudad.hasMany(Cliente,  { foreignKey: 'ciudad_id', as: 'clientes' });
Ciudad.hasMany(Servicio, { foreignKey: 'ciudad_id', as: 'servicios' });
Cliente.belongsTo(Ciudad,  { foreignKey: 'ciudad_id', as: 'ciudad' });
Servicio.belongsTo(Ciudad, { foreignKey: 'ciudad_id', as: 'ciudad' });

// Cliente → Servicios
Cliente.hasMany(Servicio,   { foreignKey: 'cliente_id', as: 'servicios' });
Servicio.belongsTo(Cliente, { foreignKey: 'cliente_id', as: 'cliente' });

// Técnico → Servicios, Pagos, Deudas
Tecnico.hasMany(Servicio,      { foreignKey: 'tecnico_id', as: 'servicios' });
Tecnico.hasMany(PagoTecnico,   { foreignKey: 'tecnico_id', as: 'pagos' });
Tecnico.hasMany(DeudaTecnico,  { foreignKey: 'tecnico_id', as: 'deudas' });
Servicio.belongsTo(Tecnico,    { foreignKey: 'tecnico_id', as: 'tecnico' });
PagoTecnico.belongsTo(Tecnico, { foreignKey: 'tecnico_id', as: 'tecnico' });
DeudaTecnico.belongsTo(Tecnico, { foreignKey: 'tecnico_id', as: 'tecnico' });

// AgenteSC → Servicios, Pagos
AgenteSC.hasMany(Servicio,   { foreignKey: 'agente_sc_id', as: 'servicios' });
AgenteSC.hasMany(PagoAgente, { foreignKey: 'agente_sc_id', as: 'pagos' });
Servicio.belongsTo(AgenteSC,   { foreignKey: 'agente_sc_id', as: 'agente_sc' });
PagoAgente.belongsTo(AgenteSC, { foreignKey: 'agente_sc_id', as: 'agente_sc' });

// TipoServicio → Servicios
TipoServicio.hasMany(Servicio,   { foreignKey: 'tipo_servicio_id', as: 'servicios' });
Servicio.belongsTo(TipoServicio, { foreignKey: 'tipo_servicio_id', as: 'tipo_servicio' });

// Servicio → auto-referencia (padre → hijos)
Servicio.belongsTo(Servicio, { foreignKey: 'servicio_padre_id', as: 'servicio_padre' });
Servicio.hasMany(Servicio,   { foreignKey: 'servicio_padre_id', as: 'servicios_hijos' });

// Servicio → Garantía, PagoTecnico, DeudaTecnico, Documento
Servicio.hasOne(Garantia,     { foreignKey: 'servicio_id', as: 'garantia' });
Servicio.hasOne(PagoTecnico,  { foreignKey: 'servicio_id', as: 'pago_tecnico' });
Servicio.hasOne(DeudaTecnico, { foreignKey: 'servicio_id', as: 'deuda' });
Servicio.hasMany(Documento,   { foreignKey: 'servicio_id', as: 'documentos' });

Garantia.belongsTo(Servicio,     { foreignKey: 'servicio_id', as: 'servicio' });
PagoTecnico.belongsTo(Servicio,  { foreignKey: 'servicio_id', as: 'servicio' });
DeudaTecnico.belongsTo(Servicio, { foreignKey: 'servicio_id', as: 'servicio' });
Documento.belongsTo(Servicio,    { foreignKey: 'servicio_id', as: 'servicio' });

Garantia.belongsTo(Tecnico, { foreignKey: 'tecnico_id', as: 'tecnico' });

// DocumentoTecnico → Técnico
Tecnico.hasMany(DocumentoTecnico, { foreignKey: 'tecnico_id', as: 'documentos_tecnicos' });
DocumentoTecnico.belongsTo(Tecnico, { foreignKey: 'tecnico_id', as: 'tecnico' });

// ─── EXPORTAR ─────────────────────────────────────────────────────────────────
module.exports = {
  sequelize,
  Empresa,
  Ciudad,
  Usuario,
  Cliente,
  Tecnico,
  AgenteSC,
  TipoServicio,
  Servicio,
  Garantia,
  PagoTecnico,
  DeudaTecnico,
  PagoAgente,
  Documento,
  Gasto,
  DocumentoTecnico,
};
