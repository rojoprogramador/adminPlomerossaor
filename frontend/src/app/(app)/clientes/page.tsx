'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Cliente, Ciudad } from '@/types';
import { getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import BusquedaRapidaModal from '@/components/ui/BusquedaRapidaModal';
import { Plus, Pencil, Search, Zap } from 'lucide-react';

type Form = {
  nombre_completo: string;
  telefono_1: string;
  telefono_2: string;
  email: string;
  whatsapp: string;
  cc_nit: string;
  requiere_factura: boolean;
  direccion: string;
  barrio: string;
  ciudad_id: string;
};

const empty = (): Form => ({
  nombre_completo: '', telefono_1: '', telefono_2: '', email: '',
  whatsapp: '', cc_nit: '', requiere_factura: false,
  direccion: '', barrio: '', ciudad_id: '',
});

export default function ClientesPage() {
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [form, setForm]       = useState<Form>(empty());
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [busquedaRapidaOpen, setBusquedaRapidaOpen] = useState(false);

  const { data, isLoading } = useQuery<{ total: number; clientes: Cliente[] }>({
    queryKey: ['clientes', search],
    queryFn: () => api.get('/clientes', { params: { search: search || undefined, limit: 100 } }).then(r => r.data),
  });
  const clientes = data?.clientes ?? [];

  const { data: ciudades = [] } = useQuery<Ciudad[]>({
    queryKey: ['ciudades'],
    queryFn: () => api.get('/ciudades').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/clientes/${editing.id}`, body) : api.post('/clientes', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); closeModal(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const openCreate = () => { setForm(empty()); setEditing(null); setOpen(true); setError(''); };
  const openEdit   = (c: Cliente) => {
    setForm({
      nombre_completo: c.nombre_completo ?? '',
      telefono_1:      c.telefono_1 ?? '',
      telefono_2:      c.telefono_2 ?? '',
      email:           c.email ?? '',
      whatsapp:        c.whatsapp ?? '',
      cc_nit:          c.cc_nit ?? '',
      requiere_factura: c.requiere_factura ?? false,
      direccion:       c.direccion ?? '',
      barrio:          c.barrio ?? '',
      ciudad_id:       c.ciudad_id ?? '',
    });
    setEditing(c); setOpen(true); setError('');
  };
  const closeModal = () => { setOpen(false); setEditing(null); };

  const s = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const body: Record<string, unknown> = {
      nombre_completo:  form.nombre_completo  || undefined,
      telefono_1:       form.telefono_1       || undefined,
      telefono_2:       form.telefono_2       || undefined,
      email:            form.email            || undefined,
      whatsapp:         form.whatsapp         || undefined,
      cc_nit:           form.cc_nit           || undefined,
      requiere_factura: form.requiere_factura,
      direccion:        form.direccion        || undefined,
      barrio:           form.barrio           || undefined,
      ciudad_id:        form.ciudad_id        || undefined,
    };
    save.mutate(body);
  };

  const columns = [
    { key: 'nombre',    header: 'Nombre',    render: (c: Cliente) => <span className="font-medium">{c.nombre_completo || '—'}</span> },
    { key: 'telefono',  header: 'Teléfono',  render: (c: Cliente) => c.telefono_1 || '—' },
    { key: 'whatsapp',  header: 'WhatsApp',  render: (c: Cliente) => c.whatsapp || '—' },
    { key: 'ciudad',    header: 'Ciudad',    render: (c: Cliente) => c.ciudad?.nombre || '—' },
    { key: 'direccion', header: 'Dirección', render: (c: Cliente) => c.direccion || '—' },
    { key: 'actions',   header: '',          render: (c: Cliente) => (
      <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-blue-600 p-1 rounded">
        <Pencil size={14} />
      </button>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o CC/NIT..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" onClick={() => setBusquedaRapidaOpen(true)}>
            <Zap size={15} className="mr-1 text-blue-500" /> Búsqueda Rápida SC
          </Button>
          <Button onClick={openCreate}><Plus size={15} /> Nuevo Cliente</Button>
        </div>
      </div>

      <BusquedaRapidaModal open={busquedaRapidaOpen} onClose={() => setBusquedaRapidaOpen(false)} />

      <Table
        columns={columns}
        data={clientes}
        loading={isLoading}
        keyExtractor={c => c.id}
        emptyMessage="Sin clientes registrados"
      />

      <Modal open={open} onClose={closeModal} title={editing ? 'Editar Cliente' : 'Nuevo Cliente'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Nombre completo" value={form.nombre_completo} onChange={s('nombre_completo')} placeholder="Ej: Juan Pérez García" />
            </div>
            <Input label="Teléfono 1"  value={form.telefono_1} onChange={s('telefono_1')} placeholder="3001234567" />
            <Input label="Teléfono 2"  value={form.telefono_2} onChange={s('telefono_2')} placeholder="Opcional" />
            <Input label="WhatsApp"    value={form.whatsapp}   onChange={s('whatsapp')}   placeholder="3001234567" />
            <Input label="Email"       type="email" value={form.email} onChange={s('email')} placeholder="cliente@email.com" />
            <Input label="CC / NIT"    value={form.cc_nit}     onChange={s('cc_nit')}     placeholder="123456789" />
            <Select
              label="Ciudad"
              value={form.ciudad_id}
              onChange={s('ciudad_id')}
              options={ciudades.map(c => ({ value: String(c.id), label: c.nombre }))}
              placeholder="Seleccionar ciudad"
            />
            <Input label="Dirección"   value={form.direccion}  onChange={s('direccion')}  placeholder="Calle 123 # 45-67" />
            <Input label="Barrio"      value={form.barrio}     onChange={s('barrio')}     placeholder="Ej: El Poblado" />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.requiere_factura}
              onChange={e => setForm(f => ({ ...f, requiere_factura: e.target.checked }))}
              className="rounded"
            />{' '}
            Requiere factura (CC/NIT obligatorio)
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
