'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Usuario, Empresa } from '@/types';
import { getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import PasswordInput from '@/components/ui/PasswordInput';
import { Plus, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type Form = { nombre: string; email: string; password: string; rol: string; empresa_id: string; activo: boolean };
const empty = (): Form => ({ nombre: '', email: '', password: '', rol: 'admin', empresa_id: '', activo: true });

export default function UsuariosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<Usuario | null>(null);
  const [form, setForm]       = useState<Form>(empty());
  const [error, setError]     = useState('');

  const { data: usuarios = [], isLoading } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then(r => r.data),
  });

  const { data: empresas = [] } = useQuery<Empresa[]>({
    queryKey: ['empresas'],
    queryFn: () => api.get('/empresas').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/usuarios/${editing.id}`, body) : api.post('/usuarios', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); closeModal(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const openCreate = () => { setForm(empty()); setEditing(null); setOpen(true); setError(''); };
  const openEdit   = (u: Usuario) => {
    setForm({ nombre: u.nombre, email: u.email, password: '', rol: u.rol, empresa_id: String(u.empresa_id ?? ''), activo: u.activo });
    setEditing(u); setOpen(true); setError('');
  };
  const closeModal = () => { setOpen(false); setEditing(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const body: Record<string, unknown> = {
      nombre:     form.nombre,
      email:      form.email,
      rol:        form.rol,
      empresa_id: form.empresa_id || null,
      activo:     form.activo,
    };
    if (form.password) body.password = form.password;
    save.mutate(body);
  };

  const s = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }));

  const rolColor = (rol: string) => {
    const m: Record<string, 'purple' | 'blue' | 'green' | 'gray'> = { superadmin: 'purple', admin: 'blue', agente_sc: 'green', tecnico: 'gray' };
    return m[rol] || 'gray';
  };

  const columns = [
    { key: 'nombre',  header: 'Nombre',  render: (u: Usuario) => <span className="font-medium">{u.nombre}</span> },
    { key: 'email',   header: 'Email',   render: (u: Usuario) => u.email },
    { key: 'rol',     header: 'Rol',     render: (u: Usuario) => <Badge label={u.rol} color={rolColor(u.rol)} /> },
    { key: 'activo',  header: 'Estado',  render: (u: Usuario) => <Badge label={u.activo ? 'Activo' : 'Inactivo'} color={u.activo ? 'green' : 'gray'} /> },
    { key: 'actions', header: '',        render: (u: Usuario) => <button onClick={() => openEdit(u)} className="text-slate-400 hover:text-blue-600 p-1 rounded"><Pencil size={14} /></button> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus size={15} /> Nuevo Usuario</Button>
      </div>
      <Table columns={columns} data={usuarios} loading={isLoading} keyExtractor={u => u.id} />

      <Modal open={open} onClose={closeModal} title={editing ? 'Editar Usuario' : 'Nuevo Usuario'} size="md">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombre *" value={form.nombre} onChange={s('nombre')} required />
            <Input label="Email *" type="email" value={form.email} onChange={s('email')} required />
            <PasswordInput label={editing ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña *'}
              value={form.password} onChange={s('password')} required={!editing} />
            <Select label="Rol" value={form.rol} onChange={s('rol')}
              options={[
                { value: 'admin',     label: 'Admin' },
                { value: 'agente_sc', label: 'Agente SC' },
                { value: 'tecnico',   label: 'Técnico' },
              ]} />
            {user?.rol === 'superadmin' && (
              <div className="col-span-2">
                <Select label="Empresa" value={form.empresa_id} onChange={s('empresa_id')}
                  options={empresas.map(e => ({ value: e.id, label: e.nombre }))}
                  placeholder="Sin empresa (superadmin)" />
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={form.activo}
              onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="rounded" />
            Usuario activo
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
