'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Tecnico, DocumentoTecnico } from '@/types';
import { formatCurrency, formatDate, getAxiosError, today } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Plus, Pencil, FileText } from 'lucide-react';

type Form = {
  nombre: string; telefono: string; email: string;
  tipo_pago: 'porcentaje' | 'nomina';
  porcentaje_override: string; recibe_total: boolean;
  salario_mensual: string; periodo_pago: string;
  activo: boolean;
};

const emptyForm = (): Form => ({
  nombre: '', telefono: '', email: '',
  tipo_pago: 'porcentaje',
  porcentaje_override: '', recibe_total: false,
  salario_mensual: '', periodo_pago: 'mensual',
  activo: true,
});

export default function TecnicosPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Tecnico | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [error, setError] = useState('');
  const [docsModal, setDocsModal] = useState<Tecnico | null>(null);

  const { data: tecnicos = [], isLoading } = useQuery<Tecnico[]>({
    queryKey: ['tecnicos'],
    queryFn: () => api.get('/tecnicos?incluir_inactivos=true').then(r => r.data),
  });

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editing ? api.put(`/tecnicos/${editing.id}`, body) : api.post('/tecnicos', body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tecnicos'] }); closeModal(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const openCreate = () => { setForm(emptyForm()); setEditing(null); setCreating(true); setError(''); };
  const openEdit = (t: Tecnico) => {
    setForm({
      nombre: t.nombre, telefono: t.telefono || '', email: t.email || '',
      tipo_pago: t.tipo_pago || 'porcentaje',
      porcentaje_override: t.porcentaje_override?.toString() || '',
      recibe_total: t.recibe_total,
      salario_mensual: t.salario_mensual?.toString() || '',
      periodo_pago: t.periodo_pago || 'mensual',
      activo: t.activo,
    });
    setEditing(t); setCreating(true); setError('');
  };
  const closeModal = () => { setCreating(false); setEditing(null); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    const esNomina = form.tipo_pago === 'nomina';
    if (esNomina && !form.salario_mensual) { setError('El salario mensual es requerido'); return; }
    save.mutate({
      nombre:              form.nombre,
      telefono:            form.telefono || null,
      email:               form.email || null,
      tipo_pago:           form.tipo_pago,
      porcentaje_override: (!esNomina && form.porcentaje_override) ? parseFloat(form.porcentaje_override) : null,
      recibe_total:        !esNomina && form.recibe_total,
      salario_mensual:     esNomina ? parseFloat(form.salario_mensual) : null,
      periodo_pago:        esNomina ? form.periodo_pago : null,
      activo:              form.activo,
    });
  };

  const sf = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const esNomina = form.tipo_pago === 'nomina';

  const columns = [
    { key: 'nombre',   header: 'Nombre',   render: (t: Tecnico) => <span className="font-medium">{t.nombre}</span> },
    { key: 'telefono', header: 'Teléfono', render: (t: Tecnico) => t.telefono || '—' },
    {
      key: 'pago', header: 'Pago',
      render: (t: Tecnico) => t.tipo_pago === 'nomina'
        ? <span className="text-purple-700 font-medium">Nómina {t.salario_mensual ? `· ${formatCurrency(t.salario_mensual)}/${t.periodo_pago === 'quincenal' ? '15d' : 'mes'}` : ''}</span>
        : t.recibe_total ? 'Total' : t.porcentaje_override ? `${t.porcentaje_override}%` : 'Empresa %',
    },
    {
      key: 'deuda', header: 'Deuda',
      render: (t: Tecnico) => t.tipo_pago === 'nomina'
        ? <span className="text-xs text-slate-400">—</span>
        : t.saldo_deuda > 0 ? <span className="text-red-600 font-medium">{formatCurrency(t.saldo_deuda)}</span> : '—',
    },
    { key: 'activo',  header: 'Estado',   render: (t: Tecnico) => <Badge label={t.activo ? 'Activo' : 'Inactivo'} color={t.activo ? 'green' : 'gray'} /> },
    { key: 'docs', header: 'Docs',
      render: (t: Tecnico) => (
        <button onClick={() => setDocsModal(t)} className="text-slate-400 hover:text-indigo-600 p-1 rounded">
          <FileText size={14} />
        </button>
      ),
    },
    { key: 'actions', header: '',          render: (t: Tecnico) => <button onClick={() => openEdit(t)} className="text-slate-400 hover:text-blue-600 p-1 rounded"><Pencil size={14} /></button> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus size={15} /> Nuevo Técnico</Button>
      </div>
      <Table columns={columns} data={tecnicos} loading={isLoading} keyExtractor={t => t.id} />

      <ModalDocumentos tecnico={docsModal} onClose={() => setDocsModal(null)} />

      <Modal open={creating} onClose={closeModal} title={editing ? 'Editar Técnico' : 'Nuevo Técnico'}>
        <form onSubmit={submit} className="space-y-4">
          {/* Datos básicos */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Nombre *" value={form.nombre} onChange={sf('nombre')} required />
            </div>
            <Input label="Teléfono" value={form.telefono} onChange={sf('telefono')} placeholder="3001234567" />
            <Input label="Email" type="email" value={form.email} onChange={sf('email')} placeholder="tecnico@email.com" />
          </div>

          {/* Tipo de pago */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Tipo de pago</p>
            <div className="flex gap-3">
              <label className={`flex-1 flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 cursor-pointer transition-colors ${!esNomina ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="tipo_pago" value="porcentaje" checked={!esNomina}
                  onChange={() => setForm(f => ({ ...f, tipo_pago: 'porcentaje' }))} className="sr-only" />
                <div>
                  <p className="font-medium text-sm">Por porcentaje</p>
                  <p className="text-xs opacity-70">Gana un % de cada servicio</p>
                </div>
              </label>
              <label className={`flex-1 flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 cursor-pointer transition-colors ${esNomina ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                <input type="radio" name="tipo_pago" value="nomina" checked={esNomina}
                  onChange={() => setForm(f => ({ ...f, tipo_pago: 'nomina' }))} className="sr-only" />
                <div>
                  <p className="font-medium text-sm">Nómina fija</p>
                  <p className="text-xs opacity-70">Sueldo mensual o quincenal</p>
                </div>
              </label>
            </div>
          </div>

          {/* Campos por porcentaje */}
          {!esNomina && (
            <div className="space-y-3">
              <Input label="% Override (vacío = usa % de la empresa)" type="number"
                value={form.porcentaje_override} onChange={sf('porcentaje_override')}
                placeholder="Ej: 65" min="0" max="100" />
              <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700">
                <input type="checkbox" checked={form.recibe_total} onChange={sf('recibe_total')} className="rounded" />
                Recibe el monto total del servicio (100%)
              </label>
            </div>
          )}

          {/* Campos de nómina */}
          {esNomina && (
            <div className="rounded-lg border border-purple-100 bg-purple-50 p-3 space-y-3">
              <Input label="Salario mensual *" type="number"
                value={form.salario_mensual} onChange={sf('salario_mensual')}
                placeholder="Ej: 1500000" min="0" />
              <Select
                label="Período de pago"
                value={form.periodo_pago}
                onChange={e => setForm(f => ({ ...f, periodo_pago: e.target.value }))}
                options={[
                  { value: 'mensual',   label: 'Mensual — un pago al mes' },
                  { value: 'quincenal', label: 'Quincenal — dos pagos (cada 15 días)' },
                ]}
              />
              {form.salario_mensual && form.periodo_pago === 'quincenal' && (
                <p className="text-xs text-purple-600">
                  Cada quincena: {formatCurrency(parseFloat(form.salario_mensual) / 2)}
                </p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer text-slate-700">
            <input type="checkbox" checked={form.activo} onChange={sf('activo')} className="rounded" />
            Técnico activo
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

// ─── MODAL DOCUMENTOS ─────────────────────────────────────────────────────────

const TIPOS_DOCUMENTO = [
  'ARL', 'Seguridad Social', 'Cámara de Comercio', 'RUT',
  'Seguro de Herramientas', 'Examen Médico', 'Otro',
];

const DURACION_TIPO: Record<string, number> = {
  'ARL': 30, 'Seguridad Social': 30,
  'Cámara de Comercio': 365, 'Examen Médico': 180,
};

function ModalDocumentos({ tecnico, onClose }: { tecnico: Tecnico | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: 'ARL', fecha_inicio: today(), fecha_vence: '', notas: '' });
  const [formError, setFormError] = useState('');

  const { data: docs = [] } = useQuery<DocumentoTecnico[]>({
    queryKey: ['docs-tecnico', tecnico?.id],
    queryFn: () => api.get(`/tecnicos/${tecnico?.id}/documentos`).then(r => r.data),
    enabled: !!tecnico,
  });

  const save = useMutation({
    mutationFn: () => api.post(`/tecnicos/${tecnico?.id}/documentos`, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['docs-tecnico', tecnico?.id] });
      setShowForm(false);
      setForm({ tipo: 'ARL', fecha_inicio: today(), fecha_vence: '', notas: '' });
    },
    onError: (e) => setFormError(getAxiosError(e)),
  });

  const renovar = useMutation({
    mutationFn: (doc: DocumentoTecnico) => {
      const nuevaInicio = today();
      const dias = DURACION_TIPO[doc.tipo] ?? 30;
      const nuevaVence = new Date(nuevaInicio);
      nuevaVence.setDate(nuevaVence.getDate() + dias);
      return api.put(`/tecnicos/${tecnico?.id}/documentos/${doc.id}`, {
        tipo: doc.tipo,
        fecha_inicio: nuevaInicio,
        fecha_vence: nuevaVence.toISOString().split('T')[0],
        notas: doc.notas,
        activo: true,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs-tecnico', tecnico?.id] }),
  });

  const setTipoConDuracion = (tipo: string, fechaInicio?: string) => {
    const fi = fechaInicio ?? form.fecha_inicio;
    const dias = DURACION_TIPO[tipo];
    if (dias) {
      const d = new Date(fi);
      d.setDate(d.getDate() + dias);
      setForm(f => ({ ...f, tipo, fecha_vence: d.toISOString().split('T')[0] }));
    } else {
      setForm(f => ({ ...f, tipo, fecha_vence: '' }));
    }
  };

  const now = today();

  const activeDocs = docs.filter(d => d.activo);

  return (
    <Modal open={!!tecnico} onClose={onClose} title={`Documentos — ${tecnico?.nombre}`} size="md">
      <div className="space-y-4">
        {/* Lista de documentos */}
        <div className="space-y-2">
          {activeDocs.map(doc => {
            const vencido = doc.fecha_vence < now;
            const sevenDaysOut = new Date(now);
            sevenDaysOut.setDate(sevenDaysOut.getDate() + 7);
            const porVencer = !vencido && doc.fecha_vence <= sevenDaysOut.toISOString().split('T')[0];
            return (
              <div key={doc.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${vencido ? 'border-red-200 bg-red-50' : porVencer ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div>
                  <p className="font-medium text-slate-800">{doc.tipo}</p>
                  <p className="text-xs text-slate-500">
                    {formatDate(doc.fecha_inicio)} →{' '}
                    <span className={vencido ? 'text-red-600 font-semibold' : porVencer ? 'text-amber-600 font-semibold' : ''}>
                      {formatDate(doc.fecha_vence)}
                    </span>
                    {vencido && ' · VENCIDO'}
                    {porVencer && ' · Por vencer'}
                  </p>
                  {doc.notas && <p className="text-xs text-slate-400">{doc.notas}</p>}
                </div>
                <button
                  onClick={() => renovar.mutate(doc)}
                  className="text-xs rounded px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium ml-2 shrink-0"
                >
                  Renovar
                </button>
              </div>
            );
          })}
          {activeDocs.length === 0 && (
            <p className="text-sm text-slate-400 py-2">Sin documentos registrados</p>
          )}
        </div>

        {/* Formulario de nuevo documento */}
        {showForm ? (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Tipo de documento *</label>
                <select
                  value={form.tipo}
                  onChange={e => setTipoConDuracion(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TIPOS_DOCUMENTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Fecha de inicio *</label>
                <input
                  type="date"
                  value={form.fecha_inicio}
                  onChange={e => { setForm(f => ({ ...f, fecha_inicio: e.target.value })); setTipoConDuracion(form.tipo, e.target.value); }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Fecha de vencimiento *</label>
                <input
                  type="date"
                  value={form.fecha_vence}
                  onChange={e => setForm(f => ({ ...f, fecha_vence: e.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Notas</label>
                <input
                  type="text"
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  placeholder="Proveedor, número de póliza, etc."
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            {formError && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button
                onClick={() => {
                  if (!form.fecha_vence) { setFormError('Fecha de vencimiento requerida'); return; }
                  setFormError('');
                  save.mutate();
                }}
                loading={save.isPending}
              >
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Agregar documento
          </Button>
        )}
      </div>
    </Modal>
  );
}
