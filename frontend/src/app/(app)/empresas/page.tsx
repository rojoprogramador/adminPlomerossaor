'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Empresa } from '@/types';
import { getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Plus, Pencil } from 'lucide-react';

type Form = {
  nombre: string; nit: string; telefono: string; direccion: string;
  porcentaje_tecnico: string; umbral_visita_bajo: string; umbral_visita_alto: string;
};
const empty = (): Form => ({ nombre: '', nit: '', telefono: '', direccion: '', porcentaje_tecnico: '60', umbral_visita_bajo: '30000', umbral_visita_alto: '50000' });

export default function EmpresasPage() {
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<Empresa | null>(null);
  const [form, setForm]       = useState<Form>(empty());
  const [error, setError]     = useState('');

  const { data: empresas = [], isLoading } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: () => api.get('/empresas').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/empresas/${editing.id}`, body) : api.post('/empresas', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['empresas'] }); closeModal(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const openCreate = () => { setForm(empty()); setEditing(null); setOpen(true); setError(''); };
  const openEdit   = (e: Empresa) => {
    setForm({
      nombre: e.nombre, nit: '', telefono: '', direccion: '',
      porcentaje_tecnico: String(e.porcentaje_tecnico ?? 60),
      umbral_visita_bajo: String(e.umbral_visita_bajo ?? 30000),
      umbral_visita_alto: String(e.umbral_visita_alto ?? 50000),
    });
    setEditing(e); setOpen(true); setError('');
  };
  const closeModal = () => { setOpen(false); setEditing(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    save.mutate({
      nombre:              form.nombre,
      nit:                 form.nit     || null,
      telefono:            form.telefono || null,
      direccion:           form.direccion || null,
      porcentaje_tecnico:  parseFloat(form.porcentaje_tecnico) || 60,
      umbral_visita_bajo:  parseFloat(form.umbral_visita_bajo) || 30000,
      umbral_visita_alto:  parseFloat(form.umbral_visita_alto) || 50000,
    });
  };

  const s = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const columns = [
    { key: 'nombre',     header: 'Empresa',    render: (e: Empresa) => <span className="font-semibold">{e.nombre}</span> },
    { key: 'pct',        header: '% Técnico',  render: (e: Empresa) => `${e.porcentaje_tecnico ?? 60}%` },
    { key: 'umbral_bajo',header: 'Umbral bajo',render: (e: Empresa) => `$${(e.umbral_visita_bajo ?? 30000).toLocaleString()}` },
    { key: 'umbral_alto',header: 'Umbral alto',render: (e: Empresa) => `$${(e.umbral_visita_alto ?? 50000).toLocaleString()}` },
    { key: 'actions',    header: '',           render: (e: Empresa) => <button onClick={() => openEdit(e)} className="text-slate-400 hover:text-blue-600 p-1 rounded"><Pencil size={14} /></button> },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
        Como superadmin, crea aquí la empresa y luego crea un usuario <strong>admin</strong> para esa empresa. Inicia sesión con ese admin para gestionar tecnicos, servicios, etc.
      </div>
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus size={15} /> Nueva Empresa</Button>
      </div>
      <Table columns={columns} data={empresas} loading={isLoading} keyExtractor={e => e.id} emptyMessage="Sin empresas registradas" />

      <Modal open={open} onClose={closeModal} title={editing ? 'Editar Empresa' : 'Nueva Empresa'} size="lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Nombre *" value={form.nombre} onChange={s('nombre')} required placeholder="Plomeros SAOR" />
            </div>
            <Input label="NIT" value={form.nit} onChange={s('nit')} placeholder="900123456-1" />
            <Input label="Teléfono" value={form.telefono} onChange={s('telefono')} placeholder="3001234567" />
            <Input label="Dirección" value={form.direccion} onChange={s('direccion')} placeholder="Calle 1 # 2-3" />
            <Input label="% Técnico (default)" type="number" value={form.porcentaje_tecnico} onChange={s('porcentaje_tecnico')} min="0" max="100" />
            <Input label="Umbral visita bajo ($)" type="number" value={form.umbral_visita_bajo} onChange={s('umbral_visita_bajo')} />
            <Input label="Umbral visita alto ($)" type="number" value={form.umbral_visita_alto} onChange={s('umbral_visita_alto')} />
          </div>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button type="submit" loading={save.isPending}>{editing ? 'Guardar' : 'Crear Empresa'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
