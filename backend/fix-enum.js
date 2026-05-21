const { sequelize } = require('./src/config/database');

async function fixEnum() {
  try {
    console.log('Agregando "transferencia" a los ENUM de PostgreSQL...');
    await sequelize.query(`ALTER TYPE "enum_servicios_medio_pago" ADD VALUE IF NOT EXISTS 'transferencia';`);
    console.log('Enum enum_servicios_medio_pago actualizado.');
  } catch (e) {
    console.log('Aviso (servicios):', e.message);
  }

  try {
    await sequelize.query(`ALTER TYPE "enum_pagos_tecnicos_medio_pago_cliente" ADD VALUE IF NOT EXISTS 'transferencia';`);
    console.log('Enum enum_pagos_tecnicos_medio_pago_cliente actualizado.');
  } catch (e) {
    console.log('Aviso (pagos_tecnicos):', e.message);
  }

  console.log('Listo.');
  process.exit();
}

fixEnum();
