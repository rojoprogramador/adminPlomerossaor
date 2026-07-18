'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { X, Calculator, ArrowRight, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface SalarySimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SalarySimulatorModal({ isOpen, onClose }: SalarySimulatorModalProps) {
  const [tecnicoId, setTecnicoId] = useState('');
  const [mesAnio, setMesAnio] = useState(format(new Date(), 'yyyy-MM'));
  const [salarioFijo, setSalarioFijo] = useState('');

  // Fetch tecnicos
  const { data: tecnicosData } = useQuery({
    queryKey: ['tecnicos-simulator'],
    queryFn: async () => {
      const { data } = await api.get('/tecnicos');
      return data;
    },
    enabled: isOpen,
  });

  // Mutation para simular
  const simulateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/bi/simulate-salary', payload);
      return data;
    }
  });

  if (!isOpen) return null;

  const handleSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tecnicoId || !mesAnio || !salarioFijo) return;
    simulateMutation.mutate({
      tecnico_id: tecnicoId,
      mes_anio: mesAnio,
      salario_fijo_propuesto: parseFloat(salarioFijo)
    });
  };

  const result = simulateMutation.data;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Calculator size={20} />
            </div>
            <h2 className="text-lg font-semibold text-slate-800">Simulador de Salario vs Porcentaje</h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-slate-500 mb-6">
            Calcula si es más rentable para la empresa pagarle un salario fijo a un técnico en base a lo que se le pagó en comisiones en un mes específico.
          </p>

          <form onSubmit={handleSimulate} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Técnico</label>
              <select 
                value={tecnicoId} 
                onChange={e => setTecnicoId(e.target.value)}
                className="w-full text-sm rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                required
              >
                <option value="">Seleccione...</option>
                {Array.isArray(tecnicosData) && tecnicosData.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mes a analizar</label>
              <input 
                type="month" 
                value={mesAnio}
                onChange={e => setMesAnio(e.target.value)}
                className="w-full text-sm rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Salario Fijo Propuesto ($)</label>
              <input 
                type="number" 
                value={salarioFijo}
                onChange={e => setSalarioFijo(e.target.value)}
                placeholder="Ej. 1500000"
                className="w-full text-sm rounded-lg border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="md:col-span-3 flex justify-end mt-2">
              <button 
                type="submit" 
                disabled={simulateMutation.isPending}
                className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {simulateMutation.isPending ? 'Calculando...' : 'Calcular Rentabilidad'} <ArrowRight size={16} />
              </button>
            </div>
          </form>

          {simulateMutation.isError && (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm flex gap-2 items-start">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <p>Error al realizar la simulación. Revisa que el técnico tenga servicios en ese periodo.</p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-1">Comisión Histórica Pagada</p>
                  <p className="text-xl font-bold text-slate-800">${result.comision_pagada_historica.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <p className="text-xs font-medium text-slate-500 mb-1">Salario Fijo Propuesto</p>
                  <p className="text-xl font-bold text-slate-800">${result.salario_fijo_propuesto.toLocaleString()}</p>
                </div>
              </div>

              <div className={`p-6 rounded-xl border ${result.conviene_fijo ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                <div className="flex items-center gap-3 mb-2">
                  {result.conviene_fijo ? (
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp size={24} /></div>
                  ) : (
                    <div className="p-2 bg-red-100 text-red-600 rounded-full"><TrendingDown size={24} /></div>
                  )}
                  <h3 className={`text-lg font-bold ${result.conviene_fijo ? 'text-emerald-800' : 'text-red-800'}`}>
                    {result.conviene_fijo ? '¡Es más rentable el salario fijo!' : '¡Es mejor mantenerlo a porcentaje!'}
                  </h3>
                </div>
                <p className={`text-sm ${result.conviene_fijo ? 'text-emerald-700' : 'text-red-700'}`}>
                  {result.conviene_fijo ? (
                    <>Al pasar a este técnico a salario fijo, la empresa se ahorraría y ganaría <strong>${result.diferencia_a_favor_empresa.toLocaleString()}</strong> mensuales asumiendo el mismo nivel de trabajo.</>
                  ) : (
                    <>El técnico no genera suficientes comisiones para cubrir el salario fijo. La empresa perdería <strong>${Math.abs(result.diferencia_a_favor_empresa).toLocaleString()}</strong> mensuales.</>
                  )}
                </p>
              </div>

              <div className="text-xs text-slate-400 text-center">
                Basado en {result.total_trabajos} trabajos realizados en {result.periodo}. Ingresos netos para la empresa (sin materiales): ${result.ingresos_generados_netos.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
