'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DocumentoTecnico } from '@/types';
import { formatDate, today, getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

type DocConTecnico = DocumentoTecnico & { tecnico?: { id: string; nombre: string; telefono?: string } };

const DURACION_TIPO: Record<string, number> = {
  'ARL': 30, 'Seguridad Social': 30,
  'Cámara de Comercio': 365, 'Examen Médico': 180,
};

function calcEstado(fechaVence: string): 'vencido' | 'por_vencer' | 'vigente' {
  const hoy = today();
  const en7 = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  if (fechaVence < hoy) return 'vencido';
  if (fechaVence <= en7) return 'por_vencer';
  return 'vigente';
}

function diasRestantes(fechaVence: string): number {
  const diff = new Date(fechaVence).getTime() - new Date(today()).getTime();
  return Math.ceil(diff / 86400000);
}

export default function DocumentosTecnicosPage() {
  const qc = useQueryClient();
  const [filtroEstado, setFiltroEstado] = useState('');
  const [renovando, setRenovando] = useState<DocConTecnico | null>(null);
  const [formRenovar, setFormRenovar] = useState({ fecha_inicio: today(), fecha_vence: '' });
  const [error, setError] = useState('');

  const { data: docs = [], isLoading } = useQuery<DocConTecnico[]>({
    queryKey: ['docs-todos', filtroEstado],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filtroEstado) p.set('estado', filtroEstado);
      return api.get(`/tecnicos/documentos/todos?${p}`).then(r => r.data);
    },
  });

  const renovar = useMutation({
    mutationFn: () => api.put(`/tecnicos/${renovando?.tecnico_id}/documentos/${renovando?.id}`, {
      tipo:         renovando?.tipo,
      fecha_inicio: formRenovar.fecha_inicio,
      fecha_vence:  formRenovar.fecha_vence,
      notas:        renovando?.notas,
      activo:       true,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs-todos'] });
      qc.invalidateQueries({ queryKey: ['docs-tecnico'] });
      setRenovando(null);
      setError('');
    },
    onError: (e) => setError(getAxiosError(e)),
  });

  const abrirRenovar = (doc: DocConTecnico) => {
    const dias = DURACION_TIPO[doc.tipo] ?? 30;
    const nuevaVence = new Date(today());
    nuevaVence.setDate(nuevaVence.getDate() + dias);
    setFormRenovar({
      fecha_inicio: today(),
      fecha_vence: nuevaVence.toISOString().split('T')[0],
    });
    setError('');
    setRenovando(doc);
  };

  // Contadores por estado
  const vencidos   = docs.filter(d => calcEstado(d.fecha_vence) === 'vencido').length;
  const porVencer  = docs.filter(d => calcEstado(d.fecha_vence) === 'por_vencer').length;
  const vigentes   = docs.filter(d => calcEstado(d.fecha_vence) === 'vigente').length;

  const columns = [
    {
      key: 'tecnico', header: 'Técnico',
      render: (d: DocConTecnico) => (
        <div>
          <p className="font-medium text-slate-800">{d.tecnico?.nombre || '—'}</p>
          {d.tecnico?.telefono && <p className="text-xs text-slate-400">{d.tecnico.telefono}</p>}
        </div>
      ),
    },
    { key: 'tipo', header: 'Documento', render: (d: DocConTecnico) => <span className="font-medium">{d.tipo}</span> },
    {
      key: 'periodo', header: 'Vigencia',
      render: (d: DocConTecnico) => (
        <div className="text-sm">
          <p className="text-slate-600">{formatDate(d.fecha_inicio)} → {formatDate(d.fecha_vence)}</p>
          {d.notas && <p className="text-xs text-slate-400">{d.notas}</p>}
        </div>
      ),
    },
    {
      key: 'dias', header: 'Días',
      render: (d: DocConTecnico) => {
        const estado = calcEstado(d.fecha_vence);
        const dias   = diasRestantes(d.fecha_vence);
        if (estado === 'vencido')    return <span className="font-semibold text-red-600">Vencido ({Math.abs(dias)}d)</span>;
        if (estado === 'por_vencer') return <span className="font-semibold text-amber-600">{dias}d</span>;
        return <span className="text-green-700">{dias}d</span>;
      },
    },
    {
      key: 'estado', header: 'Estado',
      render: (d: DocConTecnico) => {
        const estado = calcEstado(d.fecha_vence);
        if (estado === 'vencido')    return <Badge label="Vencido"     color="red" />;
        if (estado === 'por_vencer') return <Badge label="Por vencer"  color="yellow" />;
        return <Badge label="Vigente" color="green" />;
      },
    },
    {
      key: 'actions', header: '',
      render: (d: DocConTecnico) => (
        <button onClick={() => abrirRenovar(d)}
          className="flex items-center gap-1 text-xs rounded px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
          <RefreshCw size={11} /> Renovar
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Resumen de alertas */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${vencidos > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
          <XCircle size={22} className={vencidos > 0 ? 'text-red-500' : 'text-slate-300'} />
          <div>
            <p className="text-xl font-bold text-slate-800">{vencidos}</p>
            <p className="text-xs text-slate-500">Vencidos</p>
          </div>
        </div>
        <div className={`rounded-xl border p-4 flex items-center gap-3 ${porVencer > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
          <AlertTriangle size={22} className={porVencer > 0 ? 'text-amber-500' : 'text-slate-300'} />
          <div>
            <p className="text-xl font-bold text-slate-800">{porVencer}</p>
            <p className="text-xs text-slate-500">Por vencer (7 días)</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3">
          <CheckCircle size={22} className="text-green-500" />
          <div>
            <p className="text-xl font-bold text-slate-800">{vigentes}</p>
            <p className="text-xs text-slate-500">Vigentes</p>
          </div>
        </div>
      </div>

      {/* Filtro */}
      <div className="flex items-center gap-3">
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="">Todos los estados</option>
          <option value="vencido">Vencidos</option>
          <option value="por_vencer">Por vencer</option>
          <option value="vigente">Vigentes</option>
        </select>
      </div>

      <Table
        columns={columns}
        data={docs}
        loading={isLoading}
        keyExtractor={d => d.id}
        emptyMessage="Sin documentos registrados"
        rowClassName={(d: DocConTecnico) => {
          const estado = calcEstado(d.fecha_vence);
          if (estado === 'vencido')    return 'bg-red-50';
          if (estado === 'por_vencer') return 'bg-amber-50';
          return '';
        }}
      />

      {/* Modal Renovar */}
      <Modal open={!!renovando} onClose={() => setRenovando(null)} title="Renovar Documento" size="sm">
        <div className="space-y-4">
          {renovando && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
              <p className="font-medium text-slate-800">{renovando.tecnico?.nombre}</p>
              <p className="text-slate-500">{renovando.tipo}</p>
              <p className="text-xs text-slate-400 mt-0.5">Vencía: {formatDate(renovando.fecha_vence)}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Nueva fecha de inicio</label>
              <input type="date" value={formRenovar.fecha_inicio}
                onChange={e => setFormRenovar(f => ({ ...f, fecha_inicio: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Nueva fecha de vencimiento</label>
              <input type="date" value={formRenovar.fecha_vence}
                onChange={e => setFormRenovar(f => ({ ...f, fecha_vence: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenovando(null)}>Cancelar</Button>
            <Button onClick={() => { if (!formRenovar.fecha_vence) { setError('La fecha de vencimiento es requerida'); return; } renovar.mutate(); }} loading={renovar.isPending}>
              Confirmar Renovación
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
