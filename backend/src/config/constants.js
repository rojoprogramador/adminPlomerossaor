const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  AGENTE_SC: 'agente_sc',
  TECNICO: 'tecnico',
};

const ESTADO_SERVICIO = {
  PENDIENTE: 'pendiente',
  EN_PROGRESO: 'en_progreso',
  COMPLETADO: 'completado',
  CANCELADO: 'cancelado',
  CONVERTIDA: 'convertida',
};

const MEDIO_PAGO = {
  NEQUI: 'nequi',
  EFECTIVO: 'efectivo',
  BANCOLOMBIA: 'bancolombia',
  DAVIPLATA: 'daviplata',
  TRANSFERENCIA: 'transferencia',
};

const ESTADO_GARANTIA = {
  ACTIVA: 'activa',
  RECLAMADA: 'reclamada',
  RESUELTA: 'resuelta',
  VENCIDA: 'vencida',
};

const TIPO_RESOLUCION_GARANTIA = {
  GARANTIA_PURA: 'garantia_pura',
  COBRO_EXTRA: 'cobro_extra',
  MIXTA: 'mixta',
};

const ESTADO_ENTREGA_PAGO = {
  PENDIENTE: 'pendiente',
  ENTREGADO: 'entregado',
};

const ESTADO_DEUDA = {
  PENDIENTE: 'pendiente',
  ABONADA: 'abonada',
  SALDADA: 'saldada',
};

const TIPO_DOCUMENTO = {
  RECIBO: 'recibo',
  FACTURA: 'factura',
};

const ORIGEN_REGISTRO = {
  MANUAL: 'manual',
  EXCEL: 'excel',
  JSON: 'json',
};

const UMBRAL_VISITA = {
  BAJO: 30000,
  ALTO: 50000,
};

const TIPO_PAGO = {
  PORCENTAJE: 'porcentaje',
  NOMINA:     'nomina',
};

const PERIODO_PAGO = {
  MENSUAL:   'mensual',
  QUINCENAL: 'quincenal',
};

const PORCENTAJE_TECNICO_DEFAULT = 60;
const GARANTIA_DIAS_DEFAULT = 30;

module.exports = {
  ROLES,
  ESTADO_SERVICIO,
  MEDIO_PAGO,
  ESTADO_GARANTIA,
  TIPO_RESOLUCION_GARANTIA,
  ESTADO_ENTREGA_PAGO,
  ESTADO_DEUDA,
  TIPO_DOCUMENTO,
  ORIGEN_REGISTRO,
  UMBRAL_VISITA,
  TIPO_PAGO,
  PERIODO_PAGO,
  PORCENTAJE_TECNICO_DEFAULT,
  GARANTIA_DIAS_DEFAULT,
};
