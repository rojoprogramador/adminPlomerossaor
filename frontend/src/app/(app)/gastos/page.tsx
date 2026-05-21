'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Gasto } from '@/types';
import { formatCurrency, getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Plus, Pencil, Trash2 } from 'lucide-react';

const CATEGORIAS = [
  { value: 'publicidad',        label: 'Publicidad' },
  { value: 'sc',                label: 'Pago SC' },
  { value: 'arriendo',          label: 'Arriendo' },
  { value: 'nomina_interna',    label: 'Nómina interna' },
  { value: 'combustible',       label: 'Combustible' },
  { value: 'herramientas',      label: 'Herramientas' },
  { value: 'impuestos',         label: 'Impuestos' },
  { value: 'mantenimiento',     label: 'Mantenimiento' },
  { value: 'servicios_publicos',label: 'Serv. Públicos' },
  { value: 'otro',              label: 'Otro' },
];

const catColor = (cat: string): 'blue' | 'purple' | 'green' | 'gray' | 'yellow' | 'red' => {
  const m: Record<string, 'blue' | 'purple' | 'green' | 'gray' | 'yellow' | 'red'> = {
    publicidad: 'blue', sc: 'purple', arriendo: 'green',
    nomina_interna: 'gray', combustible: 'yellow', herramientas: 'gray',
    impuestos: 'red', mantenimiento: 'yellow', servicios_publicos: 'blue',
    otro: 'gray',
  };
  return m[cat] || 'gray';
};

const catLabel = (cat: string) => CATEGORIAS.find(c => c.value === cat)?.label || cat;

type Form = { concepto: string; monto: string; fecha: string; categoria: string; notas: string };
const thisMonth = () => new Date().toISOString().slice(0, 7);

const empty = (): Form => ({
  concepto: '', monto: '', fecha: new Date().toISOString().split('T')[0],
  categoria: 'otro', notas: '',
});

export default function GastosPage() {
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [form, setForm]       = useState<Form>(empty());
  const [error, setError]     = useState('');
  const [mes, setMes]         = useState(thisMonth());
  const [confirmDel, setConfirmDel] = useState<Gasto | null>(null);

  const desde = mes + '-01';
  const hasta = (() => { const [y, m] = mes.split('-'); return new Date(+y, +m, 0).toISOString().split('T')[0]; })();

  const { data: gastos = [], isLoading } = useQuery<Gasto[]>({
    queryKey: ['gastos', mes],
    queryFn: () => api.get('/gastos', { params: { desde, hasta } }).then(r => r.data),
  });

  const totalMes = gastos.reduce((s, g) => s + parseFloat(String(g.monto)), 0);

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/gastos/${editing.id}`, body) : api.post('/gastos', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gastos'] }); closeModal(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.delete(`/gastos/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gastos'] }); setConfirmDel(null); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const openCreate = () => { setForm(empty()); setEditing(null); setOpen(true); setError(''); };
  const openEdit   = (g: Gasto) => {
    setForm({ concepto: g.concepto, monto: String(g.monto), fecha: g.fecha, categoria: g.categoria, notas: g.notas || '' });
    setEditing(g); setOpen(true); setError('');
  };
  const closeModal = () => { setOpen(false); setEditing(null); };

  const s = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    save.mutate({ concepto: form.concepto, monto: parseFloat(form.monto), fecha: form.fecha, categoria: form.categoria, notas: form.notas || null });
  };

  const columns = [
    { key: 'fecha',    header: 'Fecha',     render: (g: Gasto) => g.fecha },
    { key: 'concepto', header: 'Concepto',  render: (g: Gasto) => <span className="font-medium">{g.concepto}</span> },
    { key: 'categoria',header: 'Categoría', render: (g: Gasto) => <Badge label={catLabel(g.categoria)} color={catColor(g.categoria)} /> },
    { key: 'monto',    header: 'Monto',     render: (g: Gasto) => <span className="font-semibold text-red-600">{formatCurrency(g.monto)}</span> },
    { key: 'notas',    header: 'Notas',     render: (g: Gasto) => <span className="text-slate-400 text-xs">{g.notas || '—'}</span> },
    { key: 'actions',  header: '',          render: (g: Gasto) => (
      <div className="flex gap-1">
        <button onClick={() => openEdit(g)} className="text-slate-400 hover:text-blue-600 p-1 rounded"><Pencil size={14} /></button>
        <button onClick={() => setConfirmDel(g)} className="text-slate-400 hover:text-red-500 p-1 rounded"><Trash2 size={14} /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Mes</label>
          <input type="month" value={mes} onChange={e => setMes(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div className="ml-auto flex items-center gap-4">
          {gastos.length > 0 && (
            <div className="text-sm text-slate-600">
              Total del mes: <span className="font-bold text-red-600">{formatCurrency(totalMes)}</span>
            </div>
          )}
          <Button onClick={openCreate}><Plus size={15} /> Registrar Gasto</Button>
        </div>
      </div>

      <Table columns={columns} data={gastos} loading={isLoading} keyExtractor={g => g.id}
        emptyMessage="Sin gastos registrados en este mes" />

      <Modal open={open} onClose={closeModal} title={editing ? 'Editar Gasto' : 'Registrar Gasto'}>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Concepto *" value={form.concepto} onChange={s('concepto')} required
                placeholder="Ej: Publicidad Meta Ads Mayo 2026" />
            </div>
            <Input label="Monto *" type="number" value={form.monto} onChange={s('monto')} required
              placeholder="0" min="1" step="any" />
            <Input label="Fecha *" type="date" value={form.fecha} onChange={s('fecha')} required />
            <div className="col-span-2">
              <Select label="Categoría" value={form.categoria} onChange={s('categoria')} options={CATEGORIAS} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Notas (opcional)</label>
              <textarea value={form.notas} onChange={s('notas')} rows={2}
                placeholder="Descripción adicional..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={save.isPending}>{editing ? 'Guardar' : 'Registrar'}</Button>
          </div>
        </form>
      </Modal>

      {/* Confirmar eliminación */}
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="Eliminar gasto" size="sm">
        <p className="text-sm text-slate-600 mb-4">
          ¿Eliminar <strong>{confirmDel?.concepto}</strong> por <strong>{confirmDel ? formatCurrency(confirmDel.monto) : ''}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setConfirmDel(null)}>Cancelar</Button>
          <Button variant="danger" loading={del.isPending} onClick={() => confirmDel && del.mutate(confirmDel.id)}>
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  );
}
