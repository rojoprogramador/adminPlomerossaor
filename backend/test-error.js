const { sequelize } = require('./src/config/database');
const { Servicio, Empresa, Tecnico, TipoServicio, Ciudad } = require('./src/models');
const { completarServicioTx } = require('./src/services/completarServicio.service');

async function test() {
  const t = await sequelize.transaction();
  try {
    const empresa = await Empresa.findOne();
    if (!empresa) throw new Error('No empresa');

    const tecnico = await Tecnico.findOne({ where: { empresa_id: empresa.id } });
    const tipo = await TipoServicio.findOne({ where: { empresa_id: empresa.id } });
    const ciudad = await Ciudad.findOne({ where: { empresa_id: empresa.id } });

    const servicio = await Servicio.create({
      empresa_id: empresa.id,
      tecnico_id: tecnico.id,
      tipo_servicio_id: tipo.id,
      ciudad_id: ciudad.id,
      fecha: new Date(),
      valor: 300000,
      medio_pago: 'efectivo',
      estado: 'completado',
      fecha_completado: new Date(),
    }, { transaction: t });

    servicio.tipo_servicio = tipo;
    servicio.empresa = empresa;

    const extra = await completarServicioTx(servicio, empresa, t, { efectivo_ya_entregado: false });
    console.log('EXITO:', extra);
    await t.rollback();
  } catch (e) {
    console.error('ERROR TEST:', e);
    await t.rollback();
  } finally {
    process.exit();
  }
}

test();
