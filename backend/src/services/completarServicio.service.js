const { PagoTecnico, DeudaTecnico, Garantia, Tecnico } = require('../models');
const { calcularPago, calcularValorNeto } = require('./calculoPago.service');
const {
  MEDIO_PAGO, ESTADO_DEUDA, ESTADO_GARANTIA,
  ESTADO_ENTREGA_PAGO, GARANTIA_DIAS_DEFAULT, TIPO_PAGO,
} = require('../config/constants');

// La garantía cuenta desde la fecha real del servicio (campo `fecha`), no desde
// el momento en que se registró/completó en el sistema (`fecha_completado`).
const toFechaOnly = (fecha) => (fecha instanceof Date ? fecha.toISOString() : String(fecha)).split('T')[0];

const calcularFechaVence = (fechaInicio, dias) => {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().split('T')[0];
};

async function completarServicioTx(servicio, empresa, t, { efectivo_ya_entregado = false } = {}) {
  const tecnico = await Tecnico.findByPk(servicio.tecnico_id, { transaction: t });

  // ── Técnico de nómina: empresa retiene el total, su sueldo se paga aparte ──
  if (tecnico?.tipo_pago === TIPO_PAGO.NOMINA) {
    const valor_neto = calcularValorNeto({
      valor:             servicio.valor,
      tiene_materiales:  servicio.tiene_materiales,
      costo_materiales:  servicio.costo_materiales,
      tiene_herramienta: servicio.tiene_herramienta,
      costo_herramienta: servicio.costo_herramienta,
    });
    const pago = await PagoTecnico.create({
      servicio_id:          servicio.id,
      tecnico_id:           servicio.tecnico_id,
      valor_bruto:          parseFloat(servicio.valor) || 0,
      tiene_materiales:     !!servicio.tiene_materiales,
      costo_materiales:     servicio.tiene_materiales ? (parseFloat(servicio.costo_materiales) || 0) : 0,
      tiene_herramienta:    !!servicio.tiene_herramienta,
      costo_herramienta:    servicio.tiene_herramienta ? (parseFloat(servicio.costo_herramienta) || 0) : 0,
      valor_neto,
      tecnico_recibio_total: false,
      porcentaje_aplicado:  0,
      monto_tecnico:        0,
      monto_empresa:        valor_neto,
      medio_pago_cliente:   servicio.medio_pago,
      estado_entrega:       ESTADO_ENTREGA_PAGO.ENTREGADO,
      fecha_entrega:        servicio.fecha_completado || new Date(),
      fecha_registro:       servicio.fecha_completado,
    }, { transaction: t });

    let garantia = null;
    const tieneGarantiaN = servicio.tipo_servicio?.genera_garantia !== false
      && !servicio.es_visita && !servicio.es_garantia;
    if (tieneGarantiaN) {
      const dias = servicio.tipo_servicio?.garantia_dias || GARANTIA_DIAS_DEFAULT;
      const fecha_inicio = toFechaOnly(servicio.fecha);
      garantia = await Garantia.create({
        servicio_id:  servicio.id,
        tecnico_id:   servicio.tecnico_id,
        fecha_inicio,
        fecha_vence:  calcularFechaVence(fecha_inicio, dias),
        estado:       ESTADO_GARANTIA.ACTIVA,
      }, { transaction: t });
    }
    return { pago, deuda: null, garantia };
  }

  // ── Técnico por porcentaje ────────────────────────────────────────────────
  const recibe_total = servicio.tecnico_recibe_total || tecnico?.recibe_total || false;
  const pct_override = servicio.porcentaje_tecnico_override ?? tecnico?.porcentaje_override ?? null;

  const calculo = calcularPago({
    valor:                       servicio.valor,
    tiene_materiales:            servicio.tiene_materiales,
    costo_materiales:            servicio.costo_materiales,
    tiene_herramienta:           servicio.tiene_herramienta,
    costo_herramienta:           servicio.costo_herramienta,
    tecnico_recibe_total:        recibe_total,
    porcentaje_tecnico_override: pct_override,
    tipo_servicio_porcentaje:    servicio.tipo_servicio?.porcentaje_tecnico,
    empresa_porcentaje:          empresa?.porcentaje_tecnico,
    es_visita:                   servicio.es_visita,
    umbral_visita_bajo:          empresa?.umbral_visita_bajo,
    umbral_visita_alto:          empresa?.umbral_visita_alto,
  });

  const esEfectivo     = servicio.medio_pago === MEDIO_PAGO.EFECTIVO;
  // Si la empresa queda debiendo al técnico su parte (pago electrónico diferido)
  const empresaDebeTec = !esEfectivo && !!servicio.empresa_debe_tecnico;
  // Liquidado: electrónico inmediato, o efectivo donde el técnico YA entregó la parte de la empresa
  const esLiquidado    = (!esEfectivo && !empresaDebeTec) || (esEfectivo && efectivo_ya_entregado);
  const estado_entrega = esLiquidado ? ESTADO_ENTREGA_PAGO.ENTREGADO : ESTADO_ENTREGA_PAGO.PENDIENTE;
  const fecha_entrega  = esLiquidado ? (servicio.fecha_completado || new Date()) : null;

  const pago = await PagoTecnico.create({
    servicio_id:        servicio.id,
    tecnico_id:         servicio.tecnico_id,
    ...calculo,
    medio_pago_cliente: servicio.medio_pago,
    estado_entrega,
    fecha_entrega,
    fecha_registro:     servicio.fecha_completado,
  }, { transaction: t });

  let deuda = null;
  const entregado = efectivo_ya_entregado || !!servicio.efectivo_entregado;
  if (servicio.medio_pago === MEDIO_PAGO.EFECTIVO && calculo.monto_empresa > 0 && !entregado) {
    deuda = await DeudaTecnico.create({
      tecnico_id:      servicio.tecnico_id,
      servicio_id:     servicio.id,
      monto_cobrado:   calculo.valor_bruto,
      monto_entregado: 0,
      monto_pendiente: calculo.monto_empresa,
      estado:          ESTADO_DEUDA.PENDIENTE,
      fecha_registro:  new Date(),
    }, { transaction: t });
    await Tecnico.increment('saldo_deuda', {
      by:    calculo.monto_empresa,
      where: { id: servicio.tecnico_id },
      transaction: t,
    });
  }

  let garantia = null;
  const tieneGarantia = servicio.tipo_servicio?.genera_garantia !== false
    && !servicio.es_visita
    && !servicio.es_garantia;

  if (tieneGarantia) {
    const dias = servicio.tipo_servicio?.garantia_dias || GARANTIA_DIAS_DEFAULT;
    const fecha_inicio = toFechaOnly(servicio.fecha);
    garantia = await Garantia.create({
      servicio_id:  servicio.id,
      tecnico_id:   servicio.tecnico_id,
      fecha_inicio,
      fecha_vence:  calcularFechaVence(fecha_inicio, dias),
      estado:       ESTADO_GARANTIA.ACTIVA,
    }, { transaction: t });
  }

  return { pago, deuda, garantia };
}

// Revierte los efectos financieros generados al completar un servicio
// (pago al técnico, deuda pendiente + saldo del técnico, garantía), para
// poder eliminar o recalcular un servicio ya cerrado/completado.
async function revertirEfectosFinancieros(servicio_id, t) {
  const deudas = await DeudaTecnico.findAll({ where: { servicio_id }, transaction: t });
  for (const deuda of deudas) {
    if (parseFloat(deuda.monto_pendiente) > 0) {
      await Tecnico.decrement('saldo_deuda', {
        by:    deuda.monto_pendiente,
        where: { id: deuda.tecnico_id },
        transaction: t,
      });
    }
  }
  await DeudaTecnico.destroy({ where: { servicio_id }, transaction: t });
  await PagoTecnico.destroy({ where: { servicio_id }, transaction: t });
  await Garantia.destroy({ where: { servicio_id }, transaction: t });
}

module.exports = { completarServicioTx, revertirEfectosFinancieros, toFechaOnly, calcularFechaVence };
