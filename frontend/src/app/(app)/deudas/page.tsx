'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DeudaTecnico } from '@/types';
import { formatCurrency, formatDate, getAxiosError } from '@/lib/utils';
import SearchSelect from '@/components/ui/SearchSelect';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge, { estadoBadgeColor } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';

export default function DeudasPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<DeudaTecnico | null>(null);
  const [monto, setMonto]       = useState('');
  const [error, setError]       = useState('');
  const [filtroTecnico, setFiltroTecnico] = useState('');

  const { data: deudas = [], isLoading } = useQuery<DeudaTecnico[]>({
    queryKey: ['deudas', filtroTecnico],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filtroTecnico) p.set('tecnico_id', filtroTecnico);
      return api.get(`/deudas?${p}`).then(r => r.data);
    },
  });

  const { data: tecnicos = [] } = useQuery<{ id: number; nombre: string }[]>({
    queryKey: ['tecnicos-activos'],
    queryFn: () => api.get('/tecnicos?activo=true').then(r => r.data),
  });

  const abonar = useMutation({
    mutationFn: () => api.post(`/deudas/${selected?.id}/abonar`, { monto_abono: parseFloat(monto) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['deudas'] }); setSelected(null); setMonto(''); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const columns = [
    { key: 'tecnico',    header: 'Técnico',   render: (d: DeudaTecnico) => <span className="font-medium">{d.tecnico?.nombre || '—'}</span> },
    {
      key: 'servicio', header: 'Servicio',
      render: (d: DeudaTecnico) => (
        <div>
          <p className="text-slate-700">{formatDate(d.servicio?.fecha)}</p>
          {d.servicio?.valor && <p className="text-xs text-slate-400">Cobrado: {formatCurrency(d.servicio.valor)}</p>}
        </div>
      ),
    },
    { key: 'cobrado',    header: 'Total cobrado', render: (d: DeudaTecnico) => formatCurrency(d.monto_cobrado) },
    { key: 'pendiente',  header: 'Pendiente',     render: (d: DeudaTecnico) => <span className="font-semibold text-red-700">{formatCurrency(d.monto_pendiente)}</span> },
    { key: 'estado',     header: 'Estado',        render: (d: DeudaTecnico) => <Badge label={d.estado} color={estadoBadgeColor(d.estado)} /> },
    {
      key: 'actions', header: '',
      render: (d: DeudaTecnico) => d.estado !== 'saldada' ? (
        <button onClick={() => { setSelected(d); setMonto(''); setError(''); }}
          className="text-xs rounded px-2 py-1 bg-green-50 text-green-700 hover:bg-green-100">
          Abonar
        </button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SearchSelect value={filtroTecnico} onChange={setFiltroTecnico}
          options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))}
          placeholder="Todos los técnicos" />
      </div>

      <Table columns={columns} data={deudas} loading={isLoading} keyExtractor={d => d.id} emptyMessage="Sin deudas pendientes" />

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Registrar Abono" size="sm">
        <div className="space-y-4">
          {selected && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{selected.tecnico?.nombre}</p>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-slate-500">Pendiente: <span className="font-semibold text-red-700">{formatCurrency(selected.monto_pendiente)}</span></span>
                <button type="button" onClick={() => setMonto(selected.monto_pendiente.toString())}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                  Pagar todo →
                </button>
              </div>
            </div>
          )}
          <Input label="Monto a abonar" type="number" value={monto}
            onChange={e => setMonto(e.target.value)} placeholder="0" min="1"
            max={selected?.monto_pendiente?.toString()} />
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={() => { setError(''); abonar.mutate(); }} loading={abonar.isPending}>Registrar Abono</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
