// Recalcula fecha_inicio/fecha_vence de garantías ya creadas, que se calcularon
// mal (con fecha_completado — momento del registro — en vez de la fecha real
// del servicio). Seguro de correr varias veces: si ya está correcta, no la toca.
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { sequelize, Garantia, Servicio, TipoServicio } = require('../src/models');
const { toFechaOnly, calcularFechaVence } = require('../src/services/completarServicio.service');
const { GARANTIA_DIAS_DEFAULT } = require('../src/config/constants');

(async () => {
  try {
    await sequelize.authenticate();

    const garantias = await Garantia.findAll({
      include: [{ model: Servicio, as: 'servicio', include: [{ model: TipoServicio, as: 'tipo_servicio' }] }],
    });

    let corregidas = 0;
    for (const g of garantias) {
      if (!g.servicio?.fecha) continue;
      const dias = g.servicio.tipo_servicio?.garantia_dias || GARANTIA_DIAS_DEFAULT;
      const fecha_inicio = toFechaOnly(g.servicio.fecha);
      const fecha_vence  = calcularFechaVence(fecha_inicio, dias);

      if (g.fecha_inicio !== fecha_inicio || g.fecha_vence !== fecha_vence) {
        console.log(`Garantía ${g.id} (servicio ${g.servicio_id}): ${g.fecha_inicio}→${fecha_inicio}  ${g.fecha_vence}→${fecha_vence}`);
        await g.update({ fecha_inicio, fecha_vence });
        corregidas++;
      }
    }

    console.log(`\n✓ ${corregidas} de ${garantias.length} garantías corregidas`);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
