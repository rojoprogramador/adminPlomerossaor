'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Ciudad } from '@/types';
import { getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { Plus, Pencil } from 'lucide-react';

export default function CiudadesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Ciudad | null>(null);
  const [creating, setCreating] = useState(false);
  const [nombre, setNombre] = useState('');
  const [activa, setActiva] = useState(true);
  const [error, setError] = useState('');

  const { data: ciudades = [], isLoading } = useQuery<Ciudad[]>({
    queryKey: ['ciudades'],
    queryFn: () => api.get('/ciudades').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/ciudades/${editing.id}`, body) : api.post('/ciudades', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ciudades'] }); close(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const open   = (c?: Ciudad) => { setEditing(c || null); setNombre(c?.nombre || ''); setActiva(c?.activa ?? true); setCreating(true); setError(''); };
  const close  = () => { setCreating(false); setEditing(null); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); setError(''); save.mutate({ nombre, activa }); };

  const columns = [
    { key: 'nombre', header: 'Nombre', render: (c: Ciudad) => <span className="font-medium">{c.nombre}</span> },
    { key: 'activa', header: 'Estado', render: (c: Ciudad) => <Badge label={c.activa ? 'Activa' : 'Inactiva'} color={c.activa ? 'green' : 'gray'} /> },
    { key: 'actions', header: '', render: (c: Ciudad) => <button onClick={() => open(c)} className="text-slate-400 hover:text-blue-600 p-1 rounded"><Pencil size={14} /></button> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => open()}><Plus size={15} /> Nueva Ciudad</Button>
      </div>
      <Table columns={columns} data={ciudades} loading={isLoading} keyExtractor={c => c.id} />

      <Modal open={creating} onClose={close} title={editing ? 'Editar Ciudad' : 'Nueva Ciudad'} size="sm">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nombre *" value={nombre} onChange={e => setNombre(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={activa} onChange={e => setActiva(e.target.checked)} className="rounded" />
            Ciudad activa
          </label>
          {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={close}>Cancelar</Button>
            <Button type="submit" loading={save.isPending}>{editing ? 'Guardar' : 'Crear'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
