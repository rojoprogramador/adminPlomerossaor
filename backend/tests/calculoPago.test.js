const { calcularPago, calcularValorNeto } = require('../src/services/calculoPago.service');

describe('Cálculo de Pagos Service', () => {
  it('Debe calcular el valor neto correctamente descontando materiales y herramientas', () => {
    const neto = calcularValorNeto({
      valor: 100000,
      tiene_materiales: true,
      costo_materiales: 20000,
      tiene_herramienta: true,
      costo_herramienta: 10000
    });
    expect(neto).toBe(70000);
  });

  it('Debe calcular el monto del técnico y de la empresa correctamente (60/40)', () => {
    const resultado = calcularPago({
      valor: 100000,
      tiene_materiales: false,
      costo_materiales: 0,
      tiene_herramienta: false,
      costo_herramienta: 0,
      tecnico_recibe_total: false,
      porcentaje_tecnico_override: null,
      tipo_servicio_porcentaje: null,
      empresa_porcentaje: null,
      es_visita: false
    });

    expect(resultado.valor_neto).toBe(100000);
    expect(resultado.porcentaje_aplicado).toBe(60); // 60% por defecto
    expect(resultado.monto_tecnico).toBe(60000);
    expect(resultado.monto_empresa).toBe(40000);
  });

  it('Debe aplicar el override del porcentaje si se provee', () => {
    const resultado = calcularPago({
      valor: 200000,
      tiene_materiales: false,
      tecnico_recibe_total: false,
      porcentaje_tecnico_override: 70, // 70%
    });

    expect(resultado.monto_tecnico).toBe(140000);
    expect(resultado.monto_empresa).toBe(60000);
  });
});
