const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Empresa = sequelize.define('Empresa', {
  id:                  { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  nombre:              { type: DataTypes.STRING, allowNull: false },
  nit:                 { type: DataTypes.STRING, allowNull: true },
  telefono:            { type: DataTypes.STRING, allowNull: true },
  logo_url:            { type: DataTypes.STRING, allowNull: true },
  direccion:           { type: DataTypes.STRING, allowNull: true },
  porcentaje_tecnico:  { type: DataTypes.DECIMAL(5, 2), defaultValue: 60, validate: { min: 0, max: 100 } },
  umbral_visita_bajo:  { type: DataTypes.DECIMAL(12, 2), defaultValue: 30000 },
  umbral_visita_alto:  { type: DataTypes.DECIMAL(12, 2), defaultValue: 50000 },
  activa:              { type: DataTypes.BOOLEAN, defaultValue: true },
}, { tableName: 'empresas' });

module.exports = Empresa;
