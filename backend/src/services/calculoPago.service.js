const { PORCENTAJE_TECNICO_DEFAULT, UMBRAL_VISITA } = require('../config/constants');

const calcularValorNeto = ({ valor, tiene_materiales, costo_materiales, tiene_herramienta, costo_herramienta }) => {
  const bruto = parseFloat(valor) || 0;
  const mat   = tiene_materiales  ? (parseFloat(costo_materiales)  || 0) : 0;
  const her   = tiene_herramienta ? (parseFloat(costo_herramienta) || 0) : 0;
  return bruto - mat - her;
};

const determinarPorcentajeTecnico = ({
  tecnico_recibe_total,
  porcentaje_tecnico_override,
  tipo_servicio_porcentaje,
  empresa_porcentaje,
}) => {
  if (tecnico_recibe_total) return 100;
  if (porcentaje_tecnico_override !== null && porcentaje_tecnico_override !== undefined) {
    return parseFloat(porcentaje_tecnico_override);
  }
  if (tipo_servicio_porcentaje !== null && tipo_servicio_porcentaje !== undefined) {
    return parseFloat(tipo_servicio_porcentaje);
  }
  if (empresa_porcentaje !== null && empresa_porcentaje !== undefined) {
    return parseFloat(empresa_porcentaje);
  }
  return PORCENTAJE_TECNICO_DEFAULT;
};

const evaluarReglaVisita = ({ valor, umbral_visita_bajo, umbral_visita_alto }) => {
  const v    = parseFloat(valor) || 0;
  const bajo = parseFloat(umbral_visita_bajo) || UMBRAL_VISITA.BAJO;
  return v <= bajo;
};

const calcularPago = ({
  valor,
  tiene_materiales,
  costo_materiales,
  tiene_herramienta,
  costo_herramienta,
  tecnico_recibe_total,
  porcentaje_tecnico_override,
  tipo_servicio_porcentaje,
  empresa_porcentaje,
  es_visita,
  umbral_visita_bajo,
  umbral_visita_alto,
}) => {
  let recibe_total = tecnico_recibe_total;
  if (es_visita && !tecnico_recibe_total) {
    recibe_total = evaluarReglaVisita({ valor, umbral_visita_bajo, umbral_visita_alto });
  }

  const valor_neto = calcularValorNeto({ valor, tiene_materiales, costo_materiales, tiene_herramienta, costo_herramienta });
  const porcentaje = determinarPorcentajeTecnico({
    tecnico_recibe_total: recibe_total,
    porcentaje_tecnico_override,
    tipo_servicio_porcentaje,
    empresa_porcentaje,
  });

  const monto_tecnico = Math.round(valor_neto * (porcentaje / 100));
  const monto_empresa = Math.round(valor_neto - monto_tecnico);

  return {
    valor_bruto:           parseFloat(valor) || 0,
    tiene_materiales:      !!tiene_materiales,
    costo_materiales:      tiene_materiales  ? (parseFloat(costo_materiales)  || 0) : 0,
    tiene_herramienta:     !!tiene_herramienta,
    costo_herramienta:     tiene_herramienta ? (parseFloat(costo_herramienta) || 0) : 0,
    valor_neto,
    tecnico_recibio_total: recibe_total,
    porcentaje_aplicado:   porcentaje,
    monto_tecnico,
    monto_empresa,
  };
};

const validarCostos = ({ valor, tiene_materiales, costo_materiales, tiene_herramienta, costo_herramienta }) => {
  const neto = calcularValorNeto({ valor, tiene_materiales, costo_materiales, tiene_herramienta, costo_herramienta });
  if (neto < 0) {
    return { valido: false, mensaje: 'Los costos de materiales y herramienta no pueden superar el valor del servicio' };
  }
  return { valido: true };
};

module.exports = { calcularValorNeto, determinarPorcentajeTecnico, evaluarReglaVisita, calcularPago, validarCostos };
