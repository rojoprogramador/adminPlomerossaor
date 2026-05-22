'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, firstDayOfMonth, today } from '@/lib/utils';
import { StatCard } from '@/components/ui/Card';
import Badge, { estadoBadgeColor } from '@/components/ui/Badge';
import SearchSelect from '@/components/ui/SearchSelect';
import { Download } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Tecnico } from '@/types';

type Tab = 'cierre' | 'cierre_mensual' | 'nomina' | 'garantias';

export default function ReportesPage() {
  const { user } = useAuth();
  const isAgente = user?.rol === 'agente_sc';
  const [tab, setTab] = useState<Tab>('cierre');

  const allTabs: { key: Tab; label: string; adminOnly?: boolean }[] = [
    { key: 'cierre',         label: 'Cierre del Día' },
    { key: 'cierre_mensual', label: 'Cierre Mensual', adminOnly: true },
    { key: 'nomina',         label: 'Nómina Mensual', adminOnly: true },
    { key: 'garantias',      label: 'Garantías por Técnico' },
  ];
  const tabs = isAgente ? allTabs.filter(t => !t.adminOnly) : allTabs;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'cierre'         && <CierreDia />}
      {tab === 'cierre_mensual' && <CierreMensual />}
      {tab === 'nomina'         && <Nomina />}
      {tab === 'garantias'      && <GarantiasTecnico />}
    </div>
  );
}

function CierreDia() {
  const [fecha,      setFecha]     = useState(today());
  const [tecnicoId,  setTecnicoId] = useState('');

  const { data: tecnicos = [] } = useQuery<Tecnico[]>({
    queryKey: ['tecnicos-activos'],
    queryFn: () => api.get('/tecnicos?activo=true').then(r => r.data),
  });

  const params = new URLSearchParams({ fecha });
  if (tecnicoId) params.set('tecnico_id', tecnicoId);

  const { data, isLoading } = useQuery({
    queryKey: ['cierre-dia', fecha, tecnicoId],
    queryFn: () => api.get(`/reportes/cierre-dia?${params}`).then(r => r.data),
  });

  const exportar = async () => {
    const exParams = new URLSearchParams({ desde: fecha, hasta: fecha });
    if (tecnicoId) exParams.set('tecnico_id', tecnicoId);
    const resp = await api.get(`/reportes/exportar-excel?${exParams}`, { responseType: 'blob' });
    const url  = URL.createObjectURL(resp.data);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cierre_${fecha}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = data?.totales;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <SearchSelect
          value={tecnicoId}
          onChange={v => setTecnicoId(v)}
          options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))}
          placeholder="Todos los técnicos"
        />
        <button onClick={exportar} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white hover:bg-slate-50 transition-colors">
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard label="Servicios" value={data.resumen?.total_servicios ?? 0} color="blue" />
            <StatCard label="Completados" value={data.resumen?.completados ?? 0} color="green" />
            <StatCard label="Pendientes" value={data.resumen?.pendientes ?? 0} color="yellow" />
            <StatCard label="Bruto" value={formatCurrency(t?.bruto)} color="green" />
            <StatCard label="Utilidad" value={formatCurrency(t?.utilidad_empresa)} color="purple" />
          </div>

          {data.detalle?.length > 0 && (
            <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100">
                <p className="font-semibold text-slate-800">Servicios Completados</p>
              </div>
              <table className="min-w-full text-sm divide-y divide-slate-50">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    {['Técnico', 'Tipo', 'Cliente', 'Valor', 'Medio', 'Estado'].map(h => (
                      <th key={h} className="px-4 py-2 text-left font-semibold tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.detalle.map((s: { id: string; tecnico?: { nombre: string }; tipo_servicio?: { nombre: string }; nombre_cliente_anon?: string; valor?: number; medio_pago?: string; estado: string }) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-medium">{s.tecnico?.nombre}</td>
                      <td className="px-4 py-2">{s.tipo_servicio?.nombre}</td>
                      <td className="px-4 py-2">{s.nombre_cliente_anon || '—'}</td>
                      <td className="px-4 py-2">{formatCurrency(s.valor)}</td>
                      <td className="px-4 py-2">{s.medio_pago || '—'}</td>
                      <td className="px-4 py-2"><Badge label={s.estado} color={estadoBadgeColor(s.estado)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isLoading && <p className="text-sm text-slate-400">Cargando...</p>}
        </>
      )}
    </div>
  );
}

function CierreMensual() {
  const now = new Date();
  const [mes, setMes]   = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['cierre-mensual', mes, anio],
    queryFn: () => api.get(`/reportes/cierre-mensual?mes=${mes}&anio=${anio}`).then(r => r.data),
  });

  const t = data?.totales;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={mes} onChange={e => setMes(parseInt(e.target.value))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <input type="number" value={anio} onChange={e => setAnio(parseInt(e.target.value))} min="2020" max="2030"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard label="Servicios" value={data.resumen?.total_servicios ?? 0} color="blue" />
            <StatCard label="Completados" value={data.resumen?.completados ?? 0} color="green" />
            <StatCard label="Pendientes" value={data.resumen?.pendientes ?? 0} color="yellow" />
            <StatCard label="Bruto" value={formatCurrency(t?.bruto)} color="green" />
            <StatCard label="Utilidad" value={formatCurrency(t?.utilidad_empresa)} color="purple" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl bg-white border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-500 mb-2">Desglose Financiero</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-600">Ingreso Bruto:</span><span className="font-semibold text-slate-800">{formatCurrency(t?.bruto)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Costos (Mat/Herr):</span><span className="font-semibold text-red-600">- {formatCurrency(t?.costos)}</span></div>
                <div className="border-t border-slate-100 pt-1 flex justify-between"><span className="text-slate-600">Neto:</span><span className="font-semibold text-slate-800">{formatCurrency(t?.neto)}</span></div>
                <div className="flex justify-between"><span className="text-slate-600">Nómina Técnicos:</span><span className="font-semibold text-orange-600">- {formatCurrency(t?.nomina_tecnicos)}</span></div>
                <div className="border-t border-slate-100 pt-1 flex justify-between"><span className="text-slate-800 font-medium">Utilidad Empresa:</span><span className="font-bold text-green-700">{formatCurrency(t?.utilidad_empresa)}</span></div>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-slate-200 p-4 col-span-1 md:col-span-2">
               <p className="text-sm font-medium text-slate-500 mb-2">Visitas y Otros</p>
               <div className="flex gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg flex-1">
                    <p className="text-xs text-slate-500">Visitas sin convertir</p>
                    <p className="text-lg font-semibold text-slate-800">{data.resumen?.visitas_sin_convertir}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg flex-1">
                    <p className="text-xs text-slate-500">Deudas generadas</p>
                    <p className="text-lg font-semibold text-slate-800">{data.deudas_generadas?.length}</p>
                  </div>
               </div>
            </div>
          </div>

          {/* Por técnico */}
          {data.por_tecnico?.length > 0 && (
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <p className="font-semibold text-slate-800 mb-3">Por Técnico</p>
              <div className="space-y-2">
                {(data.por_tecnico as { tecnico: { id: string; nombre: string }; cantidad: number; bruto: number; costos: number; a_pagar: number; monto_empresa: number }[]).map(r => (
                  <div key={r.tecnico.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{r.tecnico.nombre}</p>
                      <p className="text-xs text-slate-500">{r.cantidad} servicios{r.costos > 0 ? ` · Costos: ${formatCurrency(r.costos)}` : ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-700">Ganó: {formatCurrency(r.a_pagar)}</p>
                      <p className="text-xs text-blue-600">Empresa: {formatCurrency(r.monto_empresa)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      {isLoading && <p className="text-sm text-slate-400">Cargando...</p>}
    </div>
  );
}

function Nomina() {
  const now = new Date();
  const [mes, setMes]   = useState(now.getMonth() + 1);
  const [anio, setAnio] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['nomina', mes, anio],
    queryFn: () => api.get(`/reportes/nomina?mes=${mes}&anio=${anio}`).then(r => r.data),
  });

  const r = data?.resumen_global;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <select value={mes} onChange={e => setMes(parseInt(e.target.value))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'].map((m, i) => (
            <option key={i+1} value={i+1}>{m}</option>
          ))}
        </select>
        <input type="number" value={anio} onChange={e => setAnio(parseInt(e.target.value))} min="2020" max="2030"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-24 focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      {r && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Bruto" value={formatCurrency(r.bruto)} color="blue" />
          <StatCard label="Costos" value={formatCurrency(r.costos)} color="yellow" />
          <StatCard label="Neto" value={formatCurrency(r.neto)} color="green" />
          <StatCard label="Nómina" value={formatCurrency(r.a_pagar)} color="purple" />
        </div>
      )}

      {isLoading ? <p className="text-sm text-slate-400">Cargando...</p> : (
        <div className="space-y-2">
          {(data?.por_tecnico || []).map((row: { tecnico: { id: number; nombre: string }; cantidad: number; a_pagar: number; pagado: number; pendiente: number }) => (
            <div key={row.tecnico.id} className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-5 py-3">
              <div>
                <p className="font-medium text-slate-800">{row.tecnico.nombre}</p>
                <p className="text-xs text-slate-500">{row.cantidad} servicios</p>
              </div>
              <div className="flex gap-6 text-sm">
                <div className="text-right">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="font-semibold">{formatCurrency(row.a_pagar)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Pagado</p>
                  <p className="font-semibold text-green-700">{formatCurrency(row.pagado)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Pendiente</p>
                  <p className="font-semibold text-orange-600">{formatCurrency(row.pendiente)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GarantiasTecnico() {
  const [desde, setDesde] = useState(firstDayOfMonth());
  const [hasta, setHasta] = useState(today());

  const { data, isLoading } = useQuery({
    queryKey: ['garantias-tecnico', desde, hasta],
    queryFn: () => api.get(`/reportes/garantias-tecnico?desde=${desde}&hasta=${hasta}`).then(r => r.data),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-600">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      {isLoading ? <p className="text-sm text-slate-400">Cargando...</p> : (
        <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
          <table className="min-w-full text-sm divide-y divide-slate-100">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                {['Técnico', 'Servicios', 'Garantías Reclamadas', '% Reclamación'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(data?.por_tecnico || []).map((row: { tecnico: { id: number; nombre: string }; servicios_realizados: number; garantias_reclamadas: number; porcentaje_reclamacion: number }) => (
                <tr key={row.tecnico.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{row.tecnico.nombre}</td>
                  <td className="px-4 py-3">{row.servicios_realizados}</td>
                  <td className="px-4 py-3">{row.garantias_reclamadas}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${row.porcentaje_reclamacion > 20 ? 'text-red-600' : row.porcentaje_reclamacion > 10 ? 'text-orange-600' : 'text-green-700'}`}>
                      {row.porcentaje_reclamacion}%
                    </span>
                  </td>
                </tr>
              ))}
              {!data?.por_tecnico?.length && (
                <tr><td colSpan={4} className="py-8 text-center text-slate-400">Sin datos para el período</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
