const { dashboard } = require('../src/controllers/reportes.controller');
const { PagoTecnico, Servicio, Gasto, Tecnico, TipoServicio } = require('../src/models');
const { ok, err, serverErr } = require('../src/utils/respuesta');

// Mockear modelos y utilidades
jest.mock('../src/models', () => ({
  PagoTecnico: { findAll: jest.fn() },
  Gasto: { findAll: jest.fn() },
  Servicio: {},
  Tecnico: {},
  TipoServicio: {}
}));
jest.mock('../src/utils/respuesta', () => ({
  ok: jest.fn((res, data) => data),
  err: jest.fn(),
  serverErr: jest.fn()
}));

describe('Reportes Controller - Dashboard', () => {
  let req, res;

  beforeEach(() => {
    req = {
      usuario: { empresa_id: 'empresa-123' },
      query: { desde: '2023-01-01', hasta: '2023-01-31' }
    };
    res = {};
    jest.clearAllMocks();
  });

  it('Debe calcular correctamente la utilidad neta real en el dashboard', async () => {
    // Mockear respuestas de la base de datos
    PagoTecnico.findAll.mockResolvedValue([
      {
        valor_bruto: '100000',
        costo_materiales: '20000',
        costo_herramienta: '0',
        valor_neto: '80000',
        monto_tecnico: '48000',
        monto_empresa: '32000',
        tecnico_id: 'tec-1',
        servicio: { tipo_servicio: { id: 'ts-1' } }
      },
      {
        valor_bruto: '50000',
        costo_materiales: '0',
        costo_herramienta: '0',
        valor_neto: '50000',
        monto_tecnico: '30000',
        monto_empresa: '20000',
        tecnico_id: 'tec-2',
        servicio: { tipo_servicio: { id: 'ts-2' } }
      }
    ]);

    Gasto.findAll.mockResolvedValue([
      { monto: '10000' }, // Publicidad
      { monto: '5000' }   // Insumos
    ]);

    const resultado = await dashboard(req, res);

    // Verificaciones
    expect(ok).toHaveBeenCalled();
    const totales = resultado.totales;
    
    // Totales de servicios
    expect(totales.bruto).toBe(150000);
    expect(totales.costos).toBe(20000);
    expect(totales.neto).toBe(130000);
    expect(totales.nomina_tecnicos).toBe(78000);
    
    // Utilidad bruta (32000 + 20000 = 52000)
    expect(totales.utilidad_bruta).toBe(52000);
    
    // Gastos operacionales (10000 + 5000 = 15000)
    expect(totales.gastos_operacionales).toBe(15000);
    
    // Utilidad Neta Real (52000 - 15000 = 37000)
    expect(totales.utilidad_neta_real).toBe(37000);
  });
});
