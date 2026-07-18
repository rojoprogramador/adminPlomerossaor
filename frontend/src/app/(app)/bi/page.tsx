'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { TrendingUp, Users, DollarSign, Briefcase, Calculator, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import SalarySimulatorModal from './SalarySimulatorModal';

export default function BIPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Redirigir si no es admin o superadmin
  useEffect(() => {
    if (user && user.rol !== 'admin' && user.rol !== 'superadmin') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const { data: dailyStats, isLoading: loadDaily } = useQuery({
    queryKey: ['bi-daily'],
    queryFn: async () => {
      const { data } = await api.get('/bi/daily');
      return data;
    }
  });

  const { data: monthlyStats, isLoading: loadMonthly } = useQuery({
    queryKey: ['bi-monthly'],
    queryFn: async () => {
      const { data } = await api.get('/bi/monthly');
      return data;
    }
  });

  const { data: serviceTypesData, isLoading: loadServiceTypes } = useQuery({
    queryKey: ['bi-service-types'],
    queryFn: async () => {
      const { data } = await api.get('/bi/service-types');
      return data;
    }
  });

  if (!user || (user.rol !== 'admin' && user.rol !== 'superadmin')) return null;

  if (loadDaily || loadMonthly || loadServiceTypes) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Cargando métricas de inteligencia de negocio...</div>;
  }

  // Preparar datos para gráficos
  const dailyData = dailyStats?.dailyTotals?.map((d: any) => ({
    fecha: d.fecha,
    Trabajos: parseInt(d.total_trabajos),
    Visitas: parseInt(d.total_visitas),
    Ingresos: parseFloat(d.ingresos_totales)
  })) || [];

  const monthlyData = monthlyStats?.monthlyTotals?.map((d: any) => ({
    mes: d.mes,
    Trabajos: parseInt(d.total_trabajos),
    Visitas: parseInt(d.total_visitas),
    Ingresos: parseFloat(d.ingresos_totales)
  })) || [];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const pieData = serviceTypesData?.serviceTypes?.map((s: any) => ({
    name: s.tipo_servicio?.nombre || 'Desconocido',
    value: parseInt(s.cantidad),
    ingresos: parseFloat(s.ingresos_totales),
    promedio: parseFloat(s.valor_promedio)
  })) || [];

  // Calcular crecimiento vs mes anterior
  let crecimientoTrabajos = 0;
  let crecimientoIngresos = 0;
  let tieneComparativo = false;

  if (monthlyData.length >= 2) {
    tieneComparativo = true;
    const ultimoMes = monthlyData[monthlyData.length - 1];
    const mesAnterior = monthlyData[monthlyData.length - 2];
    
    if (mesAnterior.Trabajos > 0) {
      crecimientoTrabajos = ((ultimoMes.Trabajos - mesAnterior.Trabajos) / mesAnterior.Trabajos) * 100;
    }
    if (mesAnterior.Ingresos > 0) {
      crecimientoIngresos = ((ultimoMes.Ingresos - mesAnterior.Ingresos) / mesAnterior.Ingresos) * 100;
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <TrendingUp className="text-blue-600" /> Inteligencia de Negocio
          </h1>
          <p className="text-sm text-slate-500 mt-1">Análisis de rendimiento, visitas, trabajos y comparativas financieras.</p>
        </div>
        <button 
          onClick={() => setIsSimulatorOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-lg font-medium shadow-md hover:shadow-lg transition-all"
        >
          <Calculator size={18} /> Simulador de Salarios
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Briefcase size={24} /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Trabajos Promedio / Día</p>
            <h3 className="text-2xl font-bold text-slate-900">
              {dailyData.length > 0 ? (dailyData.reduce((acc: number, curr: any) => acc + curr.Trabajos, 0) / dailyData.length).toFixed(1) : 0}
            </h3>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Users size={24} /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Visitas Promedio / Día</p>
            <h3 className="text-2xl font-bold text-slate-900">
              {dailyData.length > 0 ? (dailyData.reduce((acc: number, curr: any) => acc + curr.Visitas, 0) / dailyData.length).toFixed(1) : 0}
            </h3>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg"><DollarSign size={24} /></div>
          <div>
            <p className="text-sm font-medium text-slate-500">Ingresos Totales (Mes Actual)</p>
            <h3 className="text-2xl font-bold text-slate-900">
              ${monthlyData.length > 0 ? monthlyData[monthlyData.length - 1].Ingresos.toLocaleString() : 0}
            </h3>
          </div>
        </div>
        
        {/* Tarjeta de Comparativo Mensual */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col justify-center gap-2 hover:shadow-md transition-shadow">
          <p className="text-sm font-medium text-slate-500">Comparativo vs Mes Anterior</p>
          {tieneComparativo ? (
            <div className="flex flex-col gap-2 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Trabajos:</span>
                <span className={`flex items-center text-sm font-bold ${crecimientoTrabajos >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {crecimientoTrabajos >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {Math.abs(crecimientoTrabajos).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Ingresos:</span>
                <span className={`flex items-center text-sm font-bold ${crecimientoIngresos >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {crecimientoIngresos >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {Math.abs(crecimientoIngresos).toFixed(1)}%
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mt-2">No hay suficientes datos históricos.</p>
          )}
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico Mensual */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Tendencia Mensual (Trabajos vs Visitas)</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                <Bar dataKey="Trabajos" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                <Bar dataKey="Visitas" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Diario */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">Actividad Diaria (Últimos días)</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData.slice(-14)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="fecha" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                <Line yAxisId="left" type="monotone" dataKey="Trabajos" stroke="#3b82f6" strokeWidth={3} dot={{r: 4, fill: '#3b82f6', strokeWidth: 0}} activeDot={{r: 6}} />
                <Line yAxisId="right" type="monotone" dataKey="Ingresos" stroke="#10b981" strokeWidth={3} dot={false} activeDot={{r: 6}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Desglose por Tipo de Servicio */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-6">Distribución por Tipo de Servicio</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Legend layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Tipo de Servicio</th>
                  <th className="px-4 py-3 text-center">Cantidad</th>
                  <th className="px-4 py-3 text-right">Valor Promedio</th>
                  <th className="px-4 py-3 text-right rounded-tr-lg">Total Ingresos</th>
                </tr>
              </thead>
              <tbody>
                {pieData.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                      {item.name}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{item.value}</td>
                    <td className="px-4 py-3 text-right text-slate-600">${item.promedio.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800">${item.ingresos.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <SalarySimulatorModal isOpen={isSimulatorOpen} onClose={() => setIsSimulatorOpen(false)} />
    </div>
  );
}
