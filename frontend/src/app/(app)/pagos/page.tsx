'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { PagoTecnico, PagoAgente, AgenteSC } from '@/types';
import { formatCurrency, formatDate, getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge, { estadoBadgeColor } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

type Tab = 'tecnicos' | 'agentes';

export default function PagosPage() {
  const [tab, setTab] = useState<Tab>('tecnicos');
  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 w-fit">
        {(['tecnicos', 'agentes'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
            {t === 'tecnicos' ? 'Técnicos' : 'Agentes SC'}
          </button>
        ))}
      </div>
      {tab === 'tecnicos' ? <PagosTecnicos /> : <PagosAgentes />}
    </div>
  );
}

function PagosTecnicos() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<PagoTecnico | null>(null);
  const [descuento, setDescuento] = useState('');
  const [error, setError] = useState('');
  const [filtro, setFiltro] = useState<'pendiente' | 'entregado' | ''>('pendiente');

  const { data: pagos = [], isLoading } = useQuery<PagoTecnico[]>({
    queryKey: ['pagos-tecnicos', filtro],
    queryFn: () => {
      const qs = filtro ? `?estado_entrega=${filtro}` : '';
      return api.get(`/pagos/tecnicos${qs}`).then(r => r.data);
    },
  });

  const entregar = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      if (descuento) body.descuento_deuda = parseFloat(descuento);
      return api.patch(`/pagos/tecnicos/${selected?.id}/entregar`, body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pagos-tecnicos'] }); setSelected(null); setDescuento(''); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const METODOS_LABEL: Record<string, string> = {
    efectivo: 'Efectivo',
    nequi: 'Nequi',
    bancolombia: 'Bancolombia',
    daviplata: 'Daviplata',
    transferencia: 'Transferencia',
    tarjeta: 'Tarjeta',
    otro: 'Otro',
  };

  const columns = [
    { key: 'tecnico',   header: 'Técnico',   render: (p: PagoTecnico) => <span className="font-medium">{p.tecnico?.nombre || '—'}</span> },
    {
      key: 'servicio', header: 'Servicio',
      render: (p: PagoTecnico) => (
        <div>
          <p className="text-slate-700">{p.servicio?.tipo_servicio?.nombre || '—'}</p>
          <p className="text-xs text-slate-400">{formatDate(p.servicio?.fecha)}{p.servicio?.es_visita ? ' · Visita' : ''}</p>
        </div>
      ),
    },
    {
      key: 'metodo', header: 'Pago cliente',
      render: (p: PagoTecnico) => {
        const m = p.medio_pago_cliente || '';
        const esEfectivo = m === 'efectivo';
        return (
          <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${esEfectivo ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
            {METODOS_LABEL[m] || m || '—'}
          </span>
        );
      },
    },
    { key: 'pagar',     header: 'A transferir al técnico',   render: (p: PagoTecnico) => <span className="font-semibold text-green-700">{formatCurrency(p.monto_tecnico)}</span> },
    { key: 'estado',    header: 'Estado',    render: (p: PagoTecnico) => <Badge label={p.estado_entrega} color={estadoBadgeColor(p.estado_entrega)} /> },
    {
      key: 'actions', header: '',
      render: (p: PagoTecnico) => {
        if (p.estado_entrega !== 'pendiente') return null;
        const esEfectivo = p.medio_pago_cliente === 'efectivo';
        if (esEfectivo) {
          return <span className="text-xs text-slate-400 italic">Ver en Deudas</span>;
        }
        return (
          <button onClick={() => { setSelected(p); setDescuento(''); setError(''); }}
            className="text-xs rounded px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100">
            Marcar transferido
          </button>
        );
      },
    },
  ];

  return (
    <>
      <div className="flex items-center gap-2">
        <label htmlFor="filtro-pagos" className="text-sm font-medium text-slate-600">Mostrar:</label>
        <select id="filtro-pagos" value={filtro} onChange={e => setFiltro(e.target.value as typeof filtro)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
          <option value="pendiente">Pendientes de entrega</option>
          <option value="">Todos</option>
          <option value="entregado">Entregados</option>
        </select>
      </div>
      <Table columns={columns} data={pagos} loading={isLoading} keyExtractor={p => p.id} emptyMessage="Sin registros" />
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Entregar Pago" size="sm">
        <div className="space-y-4">
          {selected && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{selected.tecnico?.nombre} — Servicio #{selected.servicio_id}</p>
              <p className="text-slate-500 mt-0.5">A pagar: <span className="font-semibold text-blue-700">{formatCurrency(selected.monto_tecnico)}</span></p>
            </div>
          )}
          <Input label="Descuento por deuda (opcional)" type="number" value={descuento}
            onChange={e => setDescuento(e.target.value)} placeholder="0" />
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={() => { setError(''); entregar.mutate(); }} loading={entregar.isPending}>Confirmar Entrega</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function PagosAgentes() {
  const qc = useQueryClient();
  const [calcModal, setCalcModal] = useState(false);
  const [agente_id, setAgenteId] = useState('');
  const [desde, setDesde]         = useState('');
  const [hasta, setHasta]         = useState('');
  const [error, setError]         = useState('');

  const { data: agentes = [] } = useQuery<AgenteSC[]>({
    queryKey: ['agentes-activos'],
    queryFn: () => api.get('/agentes?activo=true').then(r => r.data),
  });

  const { data: pagos = [], isLoading } = useQuery<PagoAgente[]>({
    queryKey: ['pagos-agentes'],
    queryFn: () => api.get('/pagos/agentes').then(r => r.data),
  });

  const calcular = useMutation({
    mutationFn: () => api.post('/pagos/agentes/calcular-semana', { agente_id: parseInt(agente_id), fecha_desde: desde, fecha_hasta: hasta }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pagos-agentes'] }); setCalcModal(false); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const pagar = useMutation({
    mutationFn: (id: number) => api.patch(`/pagos/agentes/${id}/pagar`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pagos-agentes'] }),
  });

  const columns = [
    { key: 'agente',    header: 'Agente',   render: (p: PagoAgente) => <span className="font-medium">{p.agente?.nombre || '—'}</span> },
    { key: 'periodo',   header: 'Período',  render: (p: PagoAgente) => `${formatDate(p.fecha_desde)} - ${formatDate(p.fecha_hasta)}` },
    { key: 'monto',     header: 'Monto',    render: (p: PagoAgente) => <span className="font-semibold text-blue-700">{formatCurrency(p.monto_total)}</span> },
    { key: 'ref',       header: 'Ref',      render: (p: PagoAgente) => p.referencia || '—' },
    { key: 'estado',    header: 'Estado',   render: (p: PagoAgente) => <Badge label={p.estado} color={estadoBadgeColor(p.estado)} /> },
    {
      key: 'actions', header: '',
      render: (p: PagoAgente) => p.estado === 'pendiente' ? (
        <button onClick={() => pagar.mutate(p.id)} className="text-xs rounded px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100">Pagar</button>
      ) : null,
    },
  ];

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => { setCalcModal(true); setError(''); }}>Calcular Semana</Button>
      </div>
      <Table columns={columns} data={pagos} loading={isLoading} keyExtractor={p => p.id} emptyMessage="Sin pagos de agentes" />

      <Modal open={calcModal} onClose={() => setCalcModal(false)} title="Calcular Pago Semanal" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Agente</label>
            <select value={agente_id} onChange={e => setAgenteId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Seleccionar</option>
              {agentes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <Input label="Desde" type="date" value={desde} onChange={e => setDesde(e.target.value)} />
          <Input label="Hasta" type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCalcModal(false)}>Cancelar</Button>
            <Button onClick={() => { setError(''); calcular.mutate(); }} loading={calcular.isPending}>Calcular</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
