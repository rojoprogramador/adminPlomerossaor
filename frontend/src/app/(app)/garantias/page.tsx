'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Garantia, TipoServicio, Ciudad } from '@/types';
import { formatDate, formatCurrency, today, MEDIO_PAGO_OPTIONS, getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge, { estadoBadgeColor } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchSelect from '@/components/ui/SearchSelect';
import { AlertTriangle } from 'lucide-react';

type ModalType = 'reclamar' | 'cerrar' | null;

// Tarjeta de contexto reutilizable para mostrar el servicio original
function ServicioInfo({ g }: { g: Garantia }) {
  const s = g.servicio;
  const cliente = s?.nombre_cliente_anon || s?.cliente?.nombre_completo || 'Sin nombre';
  const telefono = s?.telefono_cliente_anon || s?.cliente?.telefono_1 || '';
  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm space-y-1">
      <div className="flex justify-between">
        <span className="text-slate-500">Cliente</span>
        <span className="font-medium">{cliente}{telefono ? ` · ${telefono}` : ''}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Técnico</span>
        <span className="font-medium">{g.tecnico?.nombre || '—'}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Servicio</span>
        <span className="font-medium">{s?.tipo_servicio?.nombre || '—'} — {s?.ciudad?.nombre || '—'}</span>
      </div>
      {s?.direccion && (
        <div className="flex justify-between">
          <span className="text-slate-500">Dirección</span>
          <span className="font-medium text-right max-w-xs">{s.direccion}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span className="text-slate-500">Garantía vence</span>
        <span className="font-medium">{formatDate(g.fecha_vence)}</span>
      </div>
    </div>
  );
}

export default function GarantiasPage() {
  const qc = useQueryClient();
  const [modal, setModal]       = useState<ModalType>(null);
  const [selected, setSelected] = useState<Garantia | null>(null);
  const [filters, setFilters] = useState({
    estado: '',
    tecnico_id: '',
    search: '',
  });

  const { data: garantias = [], isLoading } = useQuery<Garantia[]>({
    queryKey: ['garantias', filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.estado)      p.set('estado', filters.estado);
      if (filters.tecnico_id)  p.set('tecnico_id', filters.tecnico_id);
      if (filters.search)      p.set('search', filters.search);
      return api.get(`/garantias?${p}`).then(r => r.data);
    },
  });

  const { data: tecnicos = [] } = useQuery<any[]>({ queryKey: ['tecnicos-activos'], queryFn: () => api.get('/tecnicos?activo=true').then(r => r.data) });

  const { data: tipos = [] }    = useQuery<TipoServicio[]>({ queryKey: ['tipos-activos'],    queryFn: () => api.get('/tipos-servicio?activo=true').then(r => r.data) });
  const { data: ciudades = [] } = useQuery<Ciudad[]>({       queryKey: ['ciudades-activas'], queryFn: () => api.get('/ciudades?activa=true').then(r => r.data) });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['garantias'] });

  const columns = [
    {
      key: 'cliente', header: 'Cliente',
      render: (g: Garantia) => {
        const nombre = g.servicio?.nombre_cliente_anon || g.servicio?.cliente?.nombre_completo || '—';
        return <span className="font-medium text-slate-800">{nombre}</span>;
      },
    },
    {
      key: 'telefono', header: 'Teléfono',
      render: (g: Garantia) => {
        const tel = g.servicio?.telefono_cliente_anon || g.servicio?.cliente?.telefono_1 || '—';
        return <span className="text-sm text-slate-600">{tel}</span>;
      },
    },
    { key: 'tecnico',  header: 'Técnico',  render: (g: Garantia) => g.tecnico?.nombre || '—' },
    { key: 'tipo',     header: 'Servicio', render: (g: Garantia) => g.servicio?.tipo_servicio?.nombre || '—' },
    {
      key: 'direccion', header: 'Dirección',
      render: (g: Garantia) => (
        <span className="text-xs text-slate-600 max-w-xs block truncate" title={g.servicio?.direccion || ''}>
          {g.servicio?.direccion || '—'}
        </span>
      ),
    },
    { key: 'fecha_vence', header: 'Vence', render: (g: Garantia) => formatDate(g.fecha_vence) },
    {
      key: 'dias', header: 'Días',
      render: (g: Garantia) => {
        if (g.estado !== 'activa') return '—';
        const dias = g.dias_restantes ?? 0;
        const color = dias <= 0 ? 'text-red-600' : dias <= 7 ? 'text-orange-600' : 'text-green-700';
        return <span className={`font-medium ${color}`}>{dias > 0 ? `${dias}d` : 'Vencida'}</span>;
      },
    },
    {
      key: 'estado', header: 'Estado',
      render: (g: Garantia) => (
        <div className="flex items-center gap-1">
          <Badge label={g.estado} color={estadoBadgeColor(g.estado)} />
          {g.alerta && <AlertTriangle size={13} className="text-orange-500" />}
        </div>
      ),
    },
    {
      key: 'actions', header: '',
      render: (g: Garantia) => (
        <div className="flex gap-1">
          {g.estado === 'activa' && (
            <button onClick={() => { setSelected(g); setModal('reclamar'); }}
              className="text-xs rounded px-2 py-1 bg-orange-50 text-orange-600 hover:bg-orange-100 font-medium">
              Reclamar
            </button>
          )}
          {g.estado === 'reclamada' && (
            <button onClick={() => { setSelected(g); setModal('cerrar'); }}
              className="text-xs rounded px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
              Resolver
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <select value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            <option value="activa">Activa</option>
            <option value="reclamada">Reclamada</option>
            <option value="resuelta">Resuelta</option>
            <option value="vencida">Vencida</option>
          </select>
        </div>
        <div className="w-48">
          <SearchSelect value={filters.tecnico_id}
            onChange={v => setFilters(f => ({ ...f, tecnico_id: v }))}
            options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))}
            placeholder="Todos los técnicos" />
        </div>
        <div>
          <input type="text" value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
            placeholder="Cliente, teléfono o dirección..."
            className="w-64 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
      </div>

      <Table columns={columns} data={garantias} loading={isLoading} keyExtractor={g => g.id} emptyMessage="Sin garantías" />

      <ModalReclamar open={modal === 'reclamar'} garantia={selected} onClose={() => setModal(null)} onSuccess={invalidate} />
      <ModalResolver  open={modal === 'cerrar'}   garantia={selected} onClose={() => setModal(null)} onSuccess={invalidate}
        tipos={tipos} ciudades={ciudades} />
    </div>
  );
}

// ─── Modal Reclamar ───────────────────────────────────────────────────────────
function ModalReclamar({ open, garantia, onClose, onSuccess }: {
  open: boolean; garantia: Garantia | null; onClose: () => void; onSuccess: () => void;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [fecha_atencion, setFechaAtencion] = useState(today());
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post(`/garantias/${garantia?.id}/reclamar`, {
      descripcion_problema: descripcion,
      fecha_atencion,
    }),
    onSuccess: () => { onSuccess(); onClose(); setDescripcion(''); },
    onError: (e) => setError(getAxiosError(e)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Reclamar Garantía" size="sm">
      <div className="space-y-4">
        {garantia && <ServicioInfo g={garantia} />}
        <p className="text-xs text-slate-500">
          Al reclamar, la garantía queda marcada como <strong>en atención</strong>. El técnico va a resolver el problema. Luego usas <em>Resolver</em> para cerrarla.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Descripción del problema *</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} required
              placeholder="Qué falla, qué reporta el cliente..."
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700">Fecha de atención</label>
            <input type="date" value={fecha_atencion} onChange={e => setFechaAtencion(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { if (!descripcion.trim()) { setError('La descripción es requerida'); return; } setError(''); mutate(); }}
            loading={isPending} variant="danger">Reclamar</Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Modal Resolver ───────────────────────────────────────────────────────────
function ModalResolver({ open, garantia, onClose, onSuccess, tipos, ciudades }: {
  open: boolean; garantia: Garantia | null; onClose: () => void; onSuccess: () => void;
  tipos: TipoServicio[]; ciudades: Ciudad[];
}) {
  const [tipo_resolucion, setTipoRes]   = useState('garantia_pura');
  const [resolucion, setResolucion]     = useState('');
  const [cobro, setCobro] = useState({
    tipo_servicio_id: '', ciudad_id: '', valor: '', medio_pago: '',
    observaciones: '',
  });
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { tipo_resolucion, resolucion };
      if (tipo_resolucion !== 'garantia_pura') {
        body.cobro_extra = {
          tipo_servicio_id: cobro.tipo_servicio_id,
          ciudad_id:        cobro.ciudad_id || undefined,
          valor:            parseFloat(cobro.valor),
          medio_pago:       cobro.medio_pago,
          observaciones:    cobro.observaciones || undefined,
        };
      }
      return api.patch(`/garantias/${garantia?.id}/cerrar`, body);
    },
    onSuccess: () => { onSuccess(); onClose(); setResolucion(''); setTipoRes('garantia_pura'); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const esConCobro = tipo_resolucion !== 'garantia_pura';
  const sc = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setCobro(c => ({ ...c, [k]: e.target.value }));

  return (
    <Modal open={open} onClose={onClose} title="Resolver Garantía" size="lg">
      <div className="space-y-4">
        {garantia && <ServicioInfo g={garantia} />}

        <Select label="¿Cómo se resolvió?" value={tipo_resolucion} onChange={e => setTipoRes(e.target.value)}
          options={[
            { value: 'garantia_pura', label: 'Garantía pura — sin cobro adicional' },
            { value: 'cobro_extra',   label: 'Cobro extra — se cobró un servicio nuevo' },
            { value: 'mixta',         label: 'Mixta — parte garantía, parte cobro' },
          ]} />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Descripción de lo realizado *</label>
          <textarea value={resolucion} onChange={e => setResolucion(e.target.value)} rows={2} required
            placeholder="Qué se hizo para resolver el problema..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>

        {esConCobro && (
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <p className="text-sm font-semibold text-blue-700">Datos del cobro extra</p>
              <p className="text-xs text-blue-500 text-right max-w-[60%]">
                Se registrará un nuevo servicio completado. Si el tipo genera garantía, se abrirá una nueva garantía automáticamente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SearchSelect label="Tipo de Servicio *" value={cobro.tipo_servicio_id}
                onChange={v => setCobro(c => ({ ...c, tipo_servicio_id: v }))} required
                options={tipos.map(t => ({ value: t.id, label: t.nombre }))} placeholder="Buscar tipo..." />
              <SearchSelect label="Ciudad" value={cobro.ciudad_id}
                onChange={v => setCobro(c => ({ ...c, ciudad_id: v }))}
                options={ciudades.map(c => ({ value: c.id, label: c.nombre }))} placeholder="Misma del original" />
              <Input label="Valor *" type="number" value={cobro.valor}
                onChange={e => setCobro(c => ({ ...c, valor: e.target.value }))} placeholder="0" />
              <Select label="Medio de Pago *" value={cobro.medio_pago} onChange={sc('medio_pago')}
                options={MEDIO_PAGO_OPTIONS} placeholder="Seleccionar" />
              <div className="col-span-2 flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Observaciones</label>
                <textarea value={cobro.observaciones} onChange={sc('observaciones')} rows={2}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Opcional..." />
              </div>
            </div>
          </div>
        )}

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => { setError(''); mutate(); }} loading={isPending}>Resolver y Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}
