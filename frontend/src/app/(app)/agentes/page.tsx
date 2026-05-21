'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getAxiosError, formatCurrency } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Badge from '@/components/ui/Badge';
import { Plus, Pencil } from 'lucide-react';

type AgenteSC = {
  id: string;
  nombre: string;
  telefono: string;
  tipo_pago: 'fijo' | 'porcentaje';
  valor_pago: string | number;
  periodo_pago: 'semanal' | 'quincenal' | 'mensual';
  activo: boolean;
};

type Form = {
  nombre: string;
  telefono: string;
  tipo_pago: string;
  valor_pago: string;
  periodo_pago: string;
  activo: boolean;
};

const empty = (): Form => ({
  nombre: '',
  telefono: '',
  tipo_pago: 'fijo',
  valor_pago: '',
  periodo_pago: 'semanal',
  activo: true,
});

export default function AgentesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AgenteSC | null>(null);
  const [form, setForm] = useState<Form>(empty());
  const [error, setError] = useState('');

  const { data: agentes = [], isLoading } = useQuery<AgenteSC[]>({
    queryKey: ['agentes'],
    queryFn: () => api.get('/agentes').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/agentes/${editing.id}`, body) : api.post('/agentes', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agentes'] }); closeModal(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const openCreate = () => { setForm(empty()); setEditing(null); setOpen(true); setError(''); };
  const openEdit = (a: AgenteSC) => {
    setForm({
      nombre: a.nombre,
      telefono: a.telefono || '',
      tipo_pago: a.tipo_pago,
      valor_pago: a.valor_pago ? String(a.valor_pago) : '',
      periodo_pago: a.periodo_pago,
      activo: a.activo,
    });
    setEditing(a); setOpen(true); setError('');
  };
  const closeModal = () => { setOpen(false); setEditing(null); };

  const s = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    save.mutate({
      nombre: form.nombre,
      telefono: form.telefono || null,
      tipo_pago: form.tipo_pago,
      valor_pago: form.valor_pago ? parseFloat(form.valor_pago) : null,
      periodo_pago: form.periodo_pago,
      activo: form.activo,
    });
  };

  const columns = [
    { key: 'nombre', header: 'Nombre', render: (a: AgenteSC) => <span className="font-medium">{a.nombre}</span> },
    { key: 'telefono', header: 'Teléfono', render: (a: AgenteSC) => a.telefono || '—' },
    { key: 'pago', header: 'Configuración Pago', render: (a: AgenteSC) => (
      <span className="text-sm">
        {a.tipo_pago === 'fijo' 
          ? `${formatCurrency(Number(a.valor_pago))} (${a.periodo_pago})` 
          : `${Number(a.valor_pago)}% (${a.periodo_pago})`
        }
      </span>
    )},
    { key: 'activo', header: 'Estado', render: (a: AgenteSC) => <Badge label={a.activo ? 'Activo' : 'Inactivo'} color={a.activo ? 'green' : 'gray'} /> },
    { key: 'actions', header: '', render: (a: AgenteSC) => <button onClick={() => openEdit(a)} className="text-slate-400 hover:text-blue-600 p-1 rounded"><Pencil size={14} /></button> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Agentes SC (Call Center)</h1>
        <Button onClick={openCreate}><Plus size={15} /> Nuevo Agente</Button>
      </div>
      <Table columns={columns} data={agentes} loading={isLoading} keyExtractor={a => a.id} emptyMessage="No hay agentes registrados" />

      <Modal open={open} onClose={closeModal} title={editing ? 'Editar Agente' : 'Nuevo Agente'} size="md">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Nombre *" value={form.nombre} onChange={s('nombre')} required />
            </div>
            <div className="col-span-2">
              <Input label="Teléfono" value={form.telefono} onChange={s('telefono')} />
            </div>
            
            <div className="col-span-2 border-t pt-3 mt-1">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Configuración de Pago</h4>
            </div>
            <Select label="Tipo de Pago" value={form.tipo_pago} onChange={s('tipo_pago')}
              options={[
                { value: 'fijo', label: 'Monto Fijo' },
                { value: 'porcentaje', label: 'Porcentaje (%)' },
              ]} />
            <Input label={form.tipo_pago === 'fijo' ? 'Valor Fijo ($)' : 'Porcentaje (%)'} type="number" step="any" required value={form.valor_pago} onChange={s('valor_pago')} />
            <div className="col-span-2">
              <Select label="Periodo de Pago" value={form.periodo_pago} onChange={s('periodo_pago')}
                options={[
                  { value: 'semanal', label: 'Semanal' },
                  { value: 'quincenal', label: 'Quincenal' },
                  { value: 'mensual', label: 'Mensual' },
                ]} />
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-sm cursor-pointer mt-3">
            <input type="checkbox" checked={form.activo}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />
            Agente activo
          </label>
          
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={save.isPending}>{editing ? 'Guardar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
