const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { ESTADO_SERVICIO, MEDIO_PAGO, ORIGEN_REGISTRO, TIPO_DOCUMENTO } = require('../config/constants');

// ─── TIPO DE SERVICIO ─────────────────────────────────────────────────────────
const TipoServicio = sequelize.define('TipoServicio', {
  id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id:         { type: DataTypes.UUID, allowNull: false },
  nombre:             { type: DataTypes.STRING, allowNull: false },
  categoria:          { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'destape' },
  porcentaje_tecnico: { type: DataTypes.DECIMAL(5, 2), allowNull: true, validate: { min: 0, max: 100 } },
  genera_garantia:    { type: DataTypes.BOOLEAN, defaultValue: true },
  garantia_dias:      { type: DataTypes.INTEGER, defaultValue: 30 },
  tarifa_base:        { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  activo:             { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'tipos_servicio' });

// ─── SERVICIO (tabla central) ─────────────────────────────────────────────────
const Servicio = sequelize.define('Servicio', {
  id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  empresa_id: { type: DataTypes.UUID, allowNull: false },

  // Cliente
  cliente_id:            { type: DataTypes.UUID, allowNull: true },
  cliente_anonimo:       { type: DataTypes.BOOLEAN, defaultValue: false },
  nombre_cliente_anon:   { type: DataTypes.STRING, allowNull: true },
  telefono_cliente_anon: { type: DataTypes.STRING, allowNull: true },

  // Asignación
  tecnico_id:       { type: DataTypes.UUID, allowNull: false },
  agente_sc_id:     { type: DataTypes.UUID, allowNull: true },
  tipo_servicio_id: { type: DataTypes.UUID, allowNull: false },
  ciudad_id:        { type: DataTypes.UUID, allowNull: false },
  servicio_padre_id: { type: DataTypes.UUID, allowNull: true },

  // Dirección del servicio
  direccion: { type: DataTypes.STRING, allowNull: true },

  // Fecha y hora
  fecha: { type: DataTypes.DATEONLY, allowNull: false, defaultValue: DataTypes.NOW },
  hora:  { type: DataTypes.TIME, allowNull: true },

  // Tipo de registro
  es_visita:   { type: DataTypes.BOOLEAN, defaultValue: false },
  es_garantia: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Valor y costos
  valor:                   { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  tiene_materiales:        { type: DataTypes.BOOLEAN, defaultValue: false },
  costo_materiales:        { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  descripcion_materiales:  { type: DataTypes.TEXT, allowNull: true },
  tiene_herramienta:       { type: DataTypes.BOOLEAN, defaultValue: false },
  costo_herramienta:       { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  descripcion_herramienta: { type: DataTypes.TEXT, allowNull: true },

  // Distribución del pago
  tecnico_recibe_total:        { type: DataTypes.BOOLEAN, defaultValue: false },
  porcentaje_tecnico_override: { type: DataTypes.DECIMAL(5, 2), allowNull: true, validate: { min: 0, max: 100 } },

  // Pago del cliente
  medio_pago:           { type: DataTypes.ENUM(...Object.values(MEDIO_PAGO)), allowNull: true },
  efectivo_entregado:   { type: DataTypes.BOOLEAN, defaultValue: false },
  // Cuando el pago NO es en efectivo y la empresa aún le debe al técnico su parte
  empresa_debe_tecnico: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Estado
  estado:           { type: DataTypes.ENUM(...Object.values(ESTADO_SERVICIO)), defaultValue: ESTADO_SERVICIO.PENDIENTE },
  motivo_pendiente: { type: DataTypes.TEXT, allowNull: true },
  fecha_completado: { type: DataTypes.DATE, allowNull: true },

  // Documento
  documento_requerido: { type: DataTypes.ENUM(...Object.values(TIPO_DOCUMENTO)), allowNull: true },

  // Trazabilidad
  observaciones:      { type: DataTypes.TEXT, allowNull: true },
  origen:             { type: DataTypes.ENUM(...Object.values(ORIGEN_REGISTRO)), defaultValue: ORIGEN_REGISTRO.MANUAL },
  registrado_por_id:  { type: DataTypes.UUID, allowNull: true },
}, {
  tableName: 'servicios',
  getterMethods: {
    valor_neto() {
      if (this.valor === null || this.valor === undefined) return null;
      const mat = this.tiene_materiales ? (parseFloat(this.costo_materiales) || 0) : 0;
      const her = this.tiene_herramienta ? (parseFloat(this.costo_herramienta) || 0) : 0;
      return parseFloat(this.valor) - mat - her;
    },
  },
});

module.exports = { TipoServicio, Servicio };
