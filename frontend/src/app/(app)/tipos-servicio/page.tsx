'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { TipoServicio } from '@/types';
import { getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Plus, Pencil } from 'lucide-react';

const CATEGORIAS = [
  { value: 'destape',        label: 'Destape' },
  { value: 'hidraulico',     label: 'Hidráulico' },
  { value: 'instalacion',    label: 'Instalación' },
  { value: 'reparacion',     label: 'Reparación' },
  { value: 'mantenimiento',  label: 'Mantenimiento' },
  { value: 'visita',         label: 'Visita / Revisión' },
  { value: 'otro',           label: 'Otro' },
];

const catColor = (cat: string): 'blue' | 'green' | 'purple' | 'gray' => {
  const m: Record<string, 'blue' | 'green' | 'purple' | 'gray'> = {
    destape: 'blue', hidraulico: 'purple', instalacion: 'green',
    reparacion: 'blue', mantenimiento: 'gray', visita: 'gray', otro: 'gray',
  };
  return m[cat] || 'gray';
};

const catLabel = (cat: string) => CATEGORIAS.find(c => c.value === cat)?.label || cat;

type Form = {
  nombre: string; categoria: string;
  genera_garantia: boolean; garantia_dias: string;
  activo: boolean;
};
const empty = (): Form => ({ nombre: '', categoria: 'destape', genera_garantia: true, garantia_dias: '30', activo: true });

export default function TiposServicioPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TipoServicio | null>(null);
  const [open, setOpen]       = useState(false);
  const [form, setForm]       = useState<Form>(empty());
  const [error, setError]     = useState('');

  const { data: tipos = [], isLoading } = useQuery<TipoServicio[]>({
    queryKey: ['tipos-servicio-admin'],
    queryFn: () => api.get('/tipos-servicio', { params: { incluir_inactivos: true } }).then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/tipos-servicio/${editing.id}`, body) : api.post('/tipos-servicio', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tipos-servicio-admin'] });
      qc.invalidateQueries({ queryKey: ['tipos-activos'] });
      closeModal();
    },
    onError: (e) => setError(getAxiosError(e)),
  });

  const openCreate = () => { setForm(empty()); setEditing(null); setOpen(true); setError(''); };
  const openEdit   = (t: TipoServicio) => {
    setForm({
      nombre:          t.nombre,
      categoria:       t.categoria,
      genera_garantia: t.genera_garantia,
      garantia_dias:   String((t as TipoServicio & { garantia_dias?: number }).garantia_dias ?? 30),
      activo:          t.activo,
    });
    setEditing(t); setOpen(true); setError('');
  };
  const closeModal = () => { setOpen(false); setEditing(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    save.mutate({
      nombre:          form.nombre,
      categoria:       form.categoria,
      genera_garantia: form.genera_garantia,
      garantia_dias:   form.genera_garantia ? Number.parseInt(form.garantia_dias || '30') : null,
      activo:          form.activo,
    });
  };

  const columns = [
    { key: 'nombre',    header: 'Nombre',    render: (t: TipoServicio) => <span className="font-medium">{t.nombre}</span> },
    { key: 'categoria', header: 'Categoría', render: (t: TipoServicio) => <Badge label={catLabel(t.categoria)} color={catColor(t.categoria)} /> },
    { key: 'garantia',  header: 'Garantía',  render: (t: TipoServicio) => <Badge label={t.genera_garantia ? 'Sí' : 'No'} color={t.genera_garantia ? 'green' : 'gray'} /> },
    { key: 'activo',    header: 'Estado',    render: (t: TipoServicio) => <Badge label={t.activo ? 'Activo' : 'Inactivo'} color={t.activo ? 'green' : 'gray'} /> },
    { key: 'actions',   header: '',          render: (t: TipoServicio) => (
      <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-blue-600 p-1 rounded">
        <Pencil size={14} />
      </button>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus size={15} /> Nuevo Tipo</Button>
      </div>
      <Table columns={columns} data={tipos} loading={isLoading} keyExtractor={t => t.id}
        emptyMessage="Sin tipos de servicio registrados" />

      <Modal open={open} onClose={closeModal} title={editing ? 'Editar Tipo de Servicio' : 'Nuevo Tipo de Servicio'} size="sm">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nombre *" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required
            placeholder="Ej: Destape de sanitario" />
          <Select label="Categoría *" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            options={CATEGORIAS} />

          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.genera_garantia}
                onChange={e => setForm(f => ({ ...f, genera_garantia: e.target.checked }))} className="rounded" />{' '}
              Genera garantía
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.activo}
                onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />{' '}
              Activo
            </label>
          </div>

          {form.genera_garantia && (
            <Input label="Días de garantía" type="number" value={form.garantia_dias}
              onChange={e => setForm(f => ({ ...f, garantia_dias: e.target.value }))}
              placeholder="30" min="1" max="365" />
          )}

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
