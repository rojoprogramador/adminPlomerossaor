'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, firstDayOfMonth, today } from '@/lib/utils';
import { StatCard } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];

export default function DashboardPage() {
  const [desde, setDesde] = useState(firstDayOfMonth());
  const [hasta, setHasta] = useState(today());

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', desde, hasta],
    queryFn: () => api.get(`/reportes/dashboard?desde=${desde}&hasta=${hasta}`).then(r => r.data),
  });

  const t = data?.totales;

  return (
    <div className="space-y-6">
      {/* filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Desde</label>
          <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600">Hasta</label>
          <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard label="Servicios"     value={t?.cantidad ?? (isLoading ? '...' : 0)} color="blue" />
        <StatCard label="Bruto"         value={t ? formatCurrency(t.bruto) : '—'}     color="green" />
        <StatCard label="Materiales"    value={t ? formatCurrency(t.costos) : '—'}    color="yellow" />
        <StatCard label="Nómina"        value={t ? formatCurrency(t.nomina_tecnicos) : '—'} color="purple" />
        <StatCard label="Utilidad Bruta" value={t ? formatCurrency(t.utilidad_bruta) : '—'} color="blue" />
        <StatCard label="Gastos Oper."  value={t ? formatCurrency(t.gastos_operacionales || 0) : '—'} color="red" />
        <StatCard label="Utilidad Neta" value={t ? formatCurrency(t.utilidad_neta_real || 0) : '—'} color="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Por técnico */}
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Por Técnico</h2>
          {isLoading ? <p className="text-sm text-slate-400">Cargando...</p> : (
            <div className="space-y-2">
              {(data?.por_tecnico || []).map((r: { tecnico: { id: number; nombre: string; tipo_pago?: string; salario_mensual?: number }; cantidad: number; bruto: number; costos: number; neto: number; a_pagar: number; monto_empresa: number }) => (
                <div key={r.tecnico.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {r.tecnico.nombre}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5">
                      {r.cantidad} servicios
                      {r.tecnico.tipo_pago && (
                        <span className={`rounded px-1 py-0.5 text-[10px] font-semibold ${r.tecnico.tipo_pago === 'nomina' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.tecnico.tipo_pago === 'nomina' ? 'Nómina' : '%'}
                        </span>
                      )}
                    </p>
                    {r.costos > 0 && (
                      <p className="text-xs text-slate-400">Costos: {formatCurrency(r.costos)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {r.tecnico.tipo_pago === 'nomina' ? (
                      <p className="text-sm font-semibold text-purple-700">Nómina</p>
                    ) : (
                      <p className="text-sm font-semibold text-green-700">Ganó: {formatCurrency(r.a_pagar)}</p>
                    )}
                    <p className="text-xs text-blue-600">Empresa: {formatCurrency(r.monto_empresa)}</p>
                  </div>
                </div>
              ))}
              {!data?.por_tecnico?.length && <p className="text-sm text-slate-400">Sin datos</p>}
            </div>
          )}
        </div>

        {/* Por tipo de servicio */}
        <div className="rounded-xl bg-white border border-slate-200 p-5">
          <h2 className="mb-4 font-semibold text-slate-800">Por Tipo de Servicio</h2>
          {isLoading ? <p className="text-sm text-slate-400">Cargando...</p> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.por_tipo_servicio || []} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="tipo.nombre" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v as number)} />
                <Bar dataKey="neto" radius={[4,4,0,0]}>
                  {(data?.por_tipo_servicio || []).map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
