'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Servicio, Tecnico, TipoServicio, Ciudad } from '@/types';
import { formatDate, formatCurrency, today, MEDIO_PAGO_OPTIONS, getAxiosError } from '@/lib/utils';
import Table from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import Badge, { estadoBadgeColor } from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchSelect from '@/components/ui/SearchSelect';
import { Plus, CheckCircle, RefreshCw, XCircle, Edit } from 'lucide-react';
import { useAuth } from '@/lib/auth';

type ModalType = 'crear' | 'editar' | 'completar' | 'convertir' | 'cancelar' | null;

// ─── Cálculo de liquidación (espeja la lógica del backend) ───────────────────
const PAGO_DEFAULT_PCT   = 60;
const UMBRAL_VISITA_BAJO = 30_000;

type Liquidacion = {
  bruto: number; neto: number; pct: number;
  monto_tecnico: number; monto_empresa: number; recibe_total: boolean;
  es_nomina: boolean;
};

function calcularLiquidacion({
  valor, medio_pago, es_visita,
  tiene_materiales, costo_materiales,
  tiene_herramienta, costo_herramienta,
  tecnico, tipo,
}: {
  valor: string; medio_pago: string; es_visita: boolean;
  tiene_materiales: boolean; costo_materiales: string;
  tiene_herramienta: boolean; costo_herramienta: string;
  tecnico?: Tecnico | null; tipo?: TipoServicio | null;
}): Liquidacion | null {
  const v = parseFloat(valor);
  if (!v || !medio_pago) return null;
  const mat  = tiene_materiales  ? (parseFloat(costo_materiales)  || 0) : 0;
  const her  = tiene_herramienta ? (parseFloat(costo_herramienta) || 0) : 0;
  const neto = v - mat - her;
  if (neto < 0) return null;

  if (tecnico?.tipo_pago === 'nomina') {
    return { bruto: v, neto, pct: 0, monto_tecnico: 0, monto_empresa: neto, recibe_total: false, es_nomina: true };
  }

  let recibe_total = tecnico?.recibe_total || false;
  if (es_visita && !recibe_total) recibe_total = v <= UMBRAL_VISITA_BAJO;

  let pct = PAGO_DEFAULT_PCT;
  if (recibe_total) {
    pct = 100;
  } else if (tecnico?.porcentaje_override != null) {
    pct = Number(tecnico.porcentaje_override);
  } else if (tipo?.porcentaje_tecnico != null) {
    pct = Number(tipo.porcentaje_tecnico);
  }

  const monto_tecnico = Math.round(neto * (pct / 100));
  const monto_empresa = Math.round(neto - monto_tecnico);
  return { bruto: v, neto, pct, monto_tecnico, monto_empresa, recibe_total, es_nomina: false };
}

// ─── Panel de liquidación ────────────────────────────────────────────────────
function PanelLiquidacion({ liq, medio_pago, efectivo_entregado, empresa_debe_tecnico, onEntregadoChange, onEmpresaDebeChange }: {
  liq: Liquidacion | null;
  medio_pago: string;
  efectivo_entregado: boolean;
  empresa_debe_tecnico: boolean;
  onEntregadoChange: (v: boolean) => void;
  onEmpresaDebeChange: (v: boolean) => void;
}) {
  if (!liq) return null;

  if (liq.es_nomina) {
    return (
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-sm space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Técnico de nómina</p>
        <div className="flex justify-between text-slate-600">
          <span>Valor bruto</span>
          <span className="font-medium">{formatCurrency(liq.bruto)}</span>
        </div>
        {liq.bruto !== liq.neto && (
          <div className="flex justify-between text-slate-400 text-xs">
            <span>Costos (mat/herr)</span>
            <span>— {formatCurrency(liq.bruto - liq.neto)}</span>
          </div>
        )}
        <div className="flex justify-between text-blue-700 font-medium">
          <span>Empresa (100%)</span>
          <span>{formatCurrency(liq.neto)}</span>
        </div>
        <div className="border-t border-purple-200 pt-2">
          <p className="text-xs text-purple-700 bg-purple-100 border border-purple-200 rounded px-2 py-1.5">
            Este técnico es de nómina — la empresa retiene el total. Su sueldo se paga aparte.
          </p>
        </div>
      </div>
    );
  }

  const deduccion  = liq.bruto - liq.neto;
  const esEfectivo = medio_pago === 'efectivo';
  const conDeuda   = esEfectivo && liq.monto_empresa > 0 && !efectivo_entregado;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Liquidación estimada</p>
      <div className="flex justify-between text-slate-600">
        <span>Valor bruto</span>
        <span className="font-medium">{formatCurrency(liq.bruto)}</span>
      </div>
      {deduccion > 0 && (
        <div className="flex justify-between text-slate-400 text-xs">
          <span>Costos (mat/herr)</span>
          <span>— {formatCurrency(deduccion)}</span>
        </div>
      )}
      <div className="flex justify-between text-green-700 font-medium">
        <span>Técnico ({liq.pct}%)</span>
        <span>{formatCurrency(liq.monto_tecnico)}</span>
      </div>
      <div className="flex justify-between text-blue-700 font-medium">
        <span>Empresa ({100 - liq.pct}%)</span>
        <span>{formatCurrency(liq.monto_empresa)}</span>
      </div>

      {esEfectivo && liq.monto_empresa > 0 && (
        <div className="border-t border-slate-200 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input type="checkbox" checked={efectivo_entregado} onChange={e => onEntregadoChange(e.target.checked)} className="rounded" />
            <span className="text-xs font-medium">Técnico entregó los {formatCurrency(liq.monto_empresa)} a la empresa ahora</span>
          </label>
        </div>
      )}

      {!esEfectivo && liq.monto_tecnico > 0 && (
        <div className="border-t border-slate-200 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-slate-700">
            <input type="checkbox" checked={empresa_debe_tecnico} onChange={e => onEmpresaDebeChange(e.target.checked)} className="rounded" />
            <span className="text-xs font-medium">Pendiente transferir al técnico {formatCurrency(liq.monto_tecnico)} — desmarcar si ya se transfirió</span>
          </label>
        </div>
      )}

      <div className="border-t border-slate-200 pt-2">
        {liq.monto_empresa === 0 ? (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
            ✓ Técnico recibe el 100% — Quedan a paz y salvo
          </p>
        ) : esEfectivo && efectivo_entregado ? (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
            ✓ Técnico entregó efectivo completo — Quedan a paz y salvo
          </p>
        ) : esEfectivo ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            ⚠ Técnico quedará con deuda de {formatCurrency(liq.monto_empresa)} con la empresa
          </p>
        ) : empresa_debe_tecnico ? (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            ⏳ Empresa le debe al técnico {formatCurrency(liq.monto_tecnico)} — quedará pendiente en pagos
          </p>
        ) : (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1.5">
            ✓ Pago digital — técnico cobra su parte ({formatCurrency(liq.monto_tecnico)}) de inmediato. A paz y salvo
          </p>
        )}
      </div>
      {conDeuda && <p className="text-xs text-slate-400">Se registrará una deuda pendiente al guardar.</p>}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function ServiciosPage() {
  const { user } = useAuth();
  const isAdminOrAgente = ['admin', 'superadmin', 'agente_sc'].includes(user?.rol || '');
  const qc = useQueryClient();
  const [modal, setModal]       = useState<ModalType>(null);
  const [selected, setSelected] = useState<Servicio | null>(null);
  const mesActual = today().slice(0, 7);
  const [filters, setFilters] = useState({
    desde:      mesActual + '-01',
    hasta:      today(),
    tecnico_id: '',
    estado:     '',
    ciudad_id:  '',
    es_visita:  '',
    es_garantia:'',
  });

  const { data: servicios = [], isLoading } = useQuery<Servicio[]>({
    queryKey: ['servicios', filters],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filters.desde)      p.set('fecha_desde', filters.desde);
      if (filters.hasta)      p.set('fecha_hasta', filters.hasta);
      if (filters.tecnico_id) p.set('tecnico', filters.tecnico_id);
      if (filters.estado)     p.set('estado', filters.estado);
      if (filters.ciudad_id)  p.set('ciudad_id', filters.ciudad_id);
      if (filters.es_visita)  p.set('es_visita', filters.es_visita);
      if (filters.es_garantia)p.set('es_garantia', filters.es_garantia);
      p.set('limit', '100');
      return api.get(`/servicios?${p}`).then(r => r.data.servicios ?? r.data);
    },
  });

  const { data: tecnicos = [] } = useQuery<Tecnico[]>({
    queryKey: ['tecnicos-activos'],
    queryFn: () => api.get('/tecnicos?activo=true').then(r => r.data),
  });
  const { data: tipos = [] } = useQuery<TipoServicio[]>({
    queryKey: ['tipos-activos'],
    queryFn: () => api.get('/tipos-servicio?activo=true').then(r => r.data),
  });
  const { data: ciudades = [] } = useQuery<Ciudad[]>({
    queryKey: ['ciudades-activas'],
    queryFn: () => api.get('/ciudades?activa=true').then(r => r.data),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['servicios'] });

  const columns = [
    { key: 'fecha',       header: 'Fecha',    render: (s: Servicio) => formatDate(s.fecha) },
    { key: 'tecnico',     header: 'Técnico',  render: (s: Servicio) => s.tecnico?.nombre || '—' },
    { key: 'tipo',        header: 'Tipo',     render: (s: Servicio) => s.tipo_servicio?.nombre || '—' },
    { key: 'ciudad',      header: 'Ciudad',   render: (s: Servicio) => s.ciudad?.nombre || '—' },
    { key: 'cliente',     header: 'Cliente',  render: (s: Servicio) => s.nombre_cliente_anon || '—' },
    { key: 'direccion',   header: 'Dirección', render: (s: Servicio) => s.direccion || '—' },
    { key: 'valor',       header: 'Valor',    render: (s: Servicio) => s.valor ? formatCurrency(s.valor) : '—' },
    {
      key: 'estado', header: 'Estado',
      render: (sv: Servicio) => {
        const motivoLabel: Record<string, string> = {
          cliente_no_pago: '💰 Cobro pendiente',
          en_cotizacion:   '📋 Cotizando',
          reagendar:       '📅 Reagendar',
          falta_material:  '🔧 Sin material',
          otro:            '⏳ Pendiente',
        };
        return (
          <div className="space-y-0.5">
            <Badge label={sv.estado} color={estadoBadgeColor(sv.estado)} />
            {sv.motivo_pendiente && motivoLabel[sv.motivo_pendiente] && (
              <p className="text-xs text-slate-500">{motivoLabel[sv.motivo_pendiente]}</p>
            )}
          </div>
        );
      },
    },
    {
      key: 'acciones', header: '',
      render: (s: Servicio) => (
        <div className="flex gap-1">
          {isAdminOrAgente && s.estado !== 'cancelado' && (
            <button onClick={() => { setSelected(s); setModal('editar'); }}
              className="rounded p-1 text-slate-500 hover:bg-slate-100" title="Editar">
              <Edit size={15} />
            </button>
          )}
          {['pendiente', 'en_progreso'].includes(s.estado) && (
            <button onClick={() => { setSelected(s); setModal('completar'); }}
              className="rounded p-1 text-green-600 hover:bg-green-50" title="Completar">
              <CheckCircle size={15} />
            </button>
          )}
          {s.es_visita && ['pendiente', 'en_progreso'].includes(s.estado) && (
            <button onClick={() => { setSelected(s); setModal('convertir'); }}
              className="rounded p-1 text-blue-600 hover:bg-blue-50" title="Convertir a Servicio">
              <RefreshCw size={15} />
            </button>
          )}
          {['pendiente', 'en_progreso'].includes(s.estado) && (
            <button onClick={() => { setSelected(s); setModal('cancelar'); }}
              className="rounded p-1 text-red-500 hover:bg-red-50" title="Cancelar">
              <XCircle size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
          <input type="date" value={filters.desde}
            onChange={e => setFilters(f => ({ ...f, desde: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
          <input type="date" value={filters.hasta}
            onChange={e => setFilters(f => ({ ...f, hasta: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Técnico</label>
          <SearchSelect value={filters.tecnico_id}
            onChange={v => setFilters(f => ({ ...f, tecnico_id: v }))}
            options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))}
            placeholder="Todos" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Ciudad</label>
          <SearchSelect value={filters.ciudad_id}
            onChange={v => setFilters(f => ({ ...f, ciudad_id: v }))}
            options={ciudades.map(c => ({ value: c.id, label: c.nombre }))}
            placeholder="Todas" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Estado</label>
          <select value={filters.estado} onChange={e => setFilters(f => ({ ...f, estado: e.target.value }))}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_progreso">En Progreso</option>
            <option value="completado">Completado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Filtros extra</label>
          <div className="flex gap-2">
            <select value={filters.es_visita} onChange={e => setFilters(f => ({ ...f, es_visita: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Visita (Todo)</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
            <select value={filters.es_garantia} onChange={e => setFilters(f => ({ ...f, es_garantia: e.target.value }))}
              className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
              <option value="">Garantía (Todo)</option>
              <option value="true">Sí</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>
        <Button onClick={() => setModal('crear')} className="ml-auto">
          <Plus size={15} /> Nuevo Servicio
        </Button>
      </div>

      <Table columns={columns} data={servicios} loading={isLoading} keyExtractor={s => s.id} emptyMessage="No hay servicios para este filtro" />

      <ModalCrear open={modal === 'crear'} onClose={() => setModal(null)} onSuccess={invalidate}
        tecnicos={tecnicos} tipos={tipos} ciudades={ciudades} />
      <ModalEditar open={modal === 'editar'} servicio={selected} onClose={() => setModal(null)} onSuccess={invalidate}
        tecnicos={tecnicos} tipos={tipos} ciudades={ciudades} />
      <ModalCompletar open={modal === 'completar'} servicio={selected} onClose={() => setModal(null)} onSuccess={invalidate}
        tecnicos={tecnicos} tipos={tipos} />
      <ModalConvertir open={modal === 'convertir'} servicio={selected} onClose={() => setModal(null)} onSuccess={invalidate}
        tecnicos={tecnicos} tipos={tipos} ciudades={ciudades} />
      <ModalCancelar open={modal === 'cancelar'} servicio={selected} onClose={() => setModal(null)} onSuccess={invalidate} />
    </div>
  );
}

// ─── Modal Crear ─────────────────────────────────────────────────────────────
function ModalCrear({ open, onClose, onSuccess, tecnicos, tipos, ciudades }: {
  open: boolean; onClose: () => void; onSuccess: () => void;
  tecnicos: Tecnico[]; tipos: TipoServicio[]; ciudades: Ciudad[];
}) {
  const emptyForm = () => ({
    tecnico_id: '', tipo_servicio_id: '', ciudad_id: '',
    cliente_id: '', nombre_cliente_anon: '', telefono_cliente_anon: '',
    direccion: '',
    fecha: today(), valor: '', medio_pago: '', es_visita: false,
    tiene_materiales: false, costo_materiales: '',
    tiene_herramienta: false, costo_herramienta: '',
    completado: false, efectivo_entregado: false, empresa_debe_tecnico: false,
    motivo_pendiente: '', observaciones: '',
  });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  
  useEffect(() => {
    if (form.telefono_cliente_anon && form.telefono_cliente_anon.length >= 7) {
      const timer = setTimeout(() => {
        api.get(`/clientes/buscar-telefono?telefono=${form.telefono_cliente_anon}`)
          .then(res => {
            if (res.data?.cliente) {
              setForm(f => ({ 
                ...f, 
                nombre_cliente_anon: res.data.cliente.nombre_completo, 
                cliente_id: res.data.cliente.id,
                direccion: res.data.cliente.direccion || f.direccion,
                ciudad_id: res.data.cliente.ciudad_id ? String(res.data.cliente.ciudad_id) : f.ciudad_id
              }));
            }
          }).catch(() => {
            if (form.cliente_id) setForm(f => ({ ...f, cliente_id: '' }));
          });
      }, 500);
      return () => clearTimeout(timer);
    } else if (form.telefono_cliente_anon.length < 7 && form.cliente_id) {
      setForm(f => ({ ...f, cliente_id: '' }));
    }
  }, [form.telefono_cliente_anon]);

  useEffect(() => {
    if (form.nombre_cliente_anon && form.nombre_cliente_anon.length >= 4 && !form.cliente_id) {
      const timer = setTimeout(() => {
        api.get(`/clientes?search=${form.nombre_cliente_anon}&limit=1`)
          .then(res => {
            const clientes = res.data?.clientes || res.data;
            if (clientes && clientes.length > 0) {
              const c = clientes[0];
              if (c.nombre_completo.toLowerCase() === form.nombre_cliente_anon.toLowerCase()) {
                setForm(f => ({ 
                  ...f, 
                  telefono_cliente_anon: c.telefono_1 || f.telefono_cliente_anon, 
                  cliente_id: c.id,
                  direccion: c.direccion || f.direccion,
                  ciudad_id: c.ciudad_id ? String(c.ciudad_id) : f.ciudad_id
                }));
              }
            }
          }).catch(() => {});
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [form.nombre_cliente_anon, form.cliente_id]);

  useEffect(() => {
    if (form.medio_pago && form.medio_pago !== 'efectivo') {
      setForm(f => ({ ...f, empresa_debe_tecnico: true }));
    } else {
      setForm(f => ({ ...f, empresa_debe_tecnico: false }));
    }
  }, [form.medio_pago]);

  const { mutate, isPending } = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/servicios', body),
    onSuccess: () => { onSuccess(); onClose(); setForm(emptyForm()); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const tecnico = tecnicos.find(t => String(t.id) === form.tecnico_id) ?? null;
  const tipo    = tipos.find(t => String(t.id) === form.tipo_servicio_id) ?? null;
  const liq = calcularLiquidacion({
    valor: form.valor, medio_pago: form.medio_pago, es_visita: form.es_visita,
    tiene_materiales: form.tiene_materiales, costo_materiales: form.costo_materiales,
    tiene_herramienta: form.tiene_herramienta, costo_herramienta: form.costo_herramienta,
    tecnico, tipo,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    mutate({
      tecnico_id:            form.tecnico_id,
      tipo_servicio_id:      form.tipo_servicio_id,
      ciudad_id:             form.ciudad_id,
      cliente_id:            form.cliente_id || null,
      cliente_anonimo:       !form.cliente_id,
      nombre_cliente_anon:   form.nombre_cliente_anon || null,
      telefono_cliente_anon: form.telefono_cliente_anon || null,
      direccion:             form.direccion || null,
      fecha:                 form.fecha,
      valor:                 form.valor ? parseFloat(form.valor) : null,
      medio_pago:            form.medio_pago || null,
      es_visita:             form.es_visita,
      tiene_materiales:      form.tiene_materiales,
      costo_materiales:      form.tiene_materiales ? parseFloat(form.costo_materiales || '0') : 0,
      tiene_herramienta:     form.tiene_herramienta,
      costo_herramienta:     form.tiene_herramienta ? parseFloat(form.costo_herramienta || '0') : 0,
      estado:               form.completado ? 'completado' : undefined,
      efectivo_entregado:   form.efectivo_entregado,
      empresa_debe_tecnico: form.completado && form.medio_pago !== 'efectivo' ? form.empresa_debe_tecnico : false,
      motivo_pendiente:     !form.completado && form.motivo_pendiente ? form.motivo_pendiente : null,
      observaciones:       form.observaciones || null,
    });
  };

  const s = (k: string) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Nuevo Servicio" size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SearchSelect label="Técnico *" value={form.tecnico_id} onChange={v => s('tecnico_id')(v)} required
            options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))} placeholder="Buscar técnico..." />
          <SearchSelect label="Tipo de Servicio *" value={form.tipo_servicio_id} onChange={v => s('tipo_servicio_id')(v)} required
            options={tipos.map(t => ({ value: t.id, label: t.nombre }))} placeholder="Buscar tipo..." />
          <SearchSelect label="Ciudad *" value={form.ciudad_id} onChange={v => s('ciudad_id')(v)} required
            options={ciudades.map(c => ({ value: c.id, label: c.nombre }))} placeholder="Buscar ciudad..." />
          <Input label="Fecha *" type="date" value={form.fecha} onChange={e => s('fecha')(e.target.value)} required />
          <div className="relative">
            <Input label="Cliente" value={form.nombre_cliente_anon} onChange={e => s('nombre_cliente_anon')(e.target.value)} placeholder="Nombre" />
            {form.cliente_id && <span className="absolute right-2 top-8 flex h-4 items-center rounded-full bg-green-100 px-2 text-[10px] font-medium text-green-700">Existente</span>}
          </div>
          <div className="relative">
            <Input label="Teléfono" value={form.telefono_cliente_anon} onChange={e => s('telefono_cliente_anon')(e.target.value)} placeholder="3001234567" />
            {form.cliente_id && <span className="absolute right-2 top-8 flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-green-600"><CheckCircle size={10} /></span>}
          </div>
          <div className="col-span-2">
            <Input label="Dirección" value={form.direccion} onChange={e => s('direccion')(e.target.value)} placeholder="Calle 34 #98b-35, Gualanday plaza, Valle del Lili" />
          </div>
          <Input label="Valor" type="number" value={form.valor} onChange={e => s('valor')(e.target.value)} placeholder="0" />
          <Select label="Medio de Pago" value={form.medio_pago} onChange={e => s('medio_pago')(e.target.value)}
            options={MEDIO_PAGO_OPTIONS} placeholder="Seleccionar" />
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.es_visita} onChange={e => s('es_visita')(e.target.checked)} className="rounded" />
            Es visita
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.completado} onChange={e => s('completado')(e.target.checked)} className="rounded" />
            Marcar como completado
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tiene_materiales} onChange={e => s('tiene_materiales')(e.target.checked)} className="rounded" />
            Materiales
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tiene_herramienta} onChange={e => s('tiene_herramienta')(e.target.checked)} className="rounded" />
            Herramienta
          </label>
        </div>

        {form.tiene_materiales && (
          <Input label="Costo Materiales" type="number" value={form.costo_materiales}
            onChange={e => s('costo_materiales')(e.target.value)} placeholder="0" />
        )}
        {form.tiene_herramienta && (
          <Input label="Costo Herramienta" type="number" value={form.costo_herramienta}
            onChange={e => s('costo_herramienta')(e.target.value)} placeholder="0" />
        )}

        {!form.completado && (
          <Select label="Motivo pendiente" value={form.motivo_pendiente}
            onChange={e => s('motivo_pendiente')(e.target.value)}
            options={[
              { value: 'cliente_no_pago',  label: 'Cliente no pagó — cobro pendiente' },
              { value: 'en_cotizacion',    label: 'En cotización / cliente decidiendo' },
              { value: 'reagendar',        label: 'Reagendar visita' },
              { value: 'falta_material',   label: 'Falta material / pieza' },
              { value: 'otro',             label: 'Otro' },
            ]}
            placeholder="Sin motivo (completar ahora)" />
        )}

        <Input label="Observaciones" value={form.observaciones} onChange={e => s('observaciones')(e.target.value)} placeholder="Opcional" />

        <PanelLiquidacion
          liq={liq}
          medio_pago={form.medio_pago}
          efectivo_entregado={form.efectivo_entregado}
          empresa_debe_tecnico={form.empresa_debe_tecnico}
          onEntregadoChange={v => setForm(f => ({ ...f, efectivo_entregado: v }))}
          onEmpresaDebeChange={v => setForm(f => ({ ...f, empresa_debe_tecnico: v }))}
        />

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isPending}>Crear Servicio</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Editar ──────────────────────────────────────────────────────────────
function ModalEditar({ open, servicio, onClose, onSuccess, tecnicos, tipos, ciudades }: {
  open: boolean; servicio: Servicio | null; onClose: () => void; onSuccess: () => void;
  tecnicos: Tecnico[]; tipos: TipoServicio[]; ciudades: Ciudad[];
}) {
  const emptyForm = () => ({
    fecha: '', nombre_cliente_anon: '',
    tecnico_id: '', tipo_servicio_id: '', ciudad_id: '',
    direccion: '', valor: '',
    tiene_materiales: false, costo_materiales: '',
    tiene_herramienta: false, costo_herramienta: '',
    observaciones: '', es_visita: false
  });
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (servicio && open) {
      setForm({
        fecha: servicio.fecha || '',
        nombre_cliente_anon: servicio.nombre_cliente_anon || '',
        tecnico_id: servicio.tecnico_id ? String(servicio.tecnico_id) : '',
        tipo_servicio_id: servicio.tipo_servicio_id ? String(servicio.tipo_servicio_id) : '',
        ciudad_id: servicio.ciudad_id ? String(servicio.ciudad_id) : '',
        direccion: servicio.direccion || '',
        valor: servicio.valor ? String(servicio.valor) : '',
        tiene_materiales: !!servicio.tiene_materiales,
        costo_materiales: servicio.costo_materiales ? String(servicio.costo_materiales) : '',
        tiene_herramienta: !!servicio.tiene_herramienta,
        costo_herramienta: servicio.costo_herramienta ? String(servicio.costo_herramienta) : '',
        observaciones: servicio.observaciones || '',
        es_visita: !!servicio.es_visita,
      });
      setError('');
    }
  }, [servicio, open]);

  const { mutate, isPending } = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.put(`/servicios/${servicio?.id}`, body),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    mutate({
      fecha:                 form.fecha || undefined,
      nombre_cliente_anon:   form.nombre_cliente_anon || null,
      tecnico_id:            form.tecnico_id || undefined,
      tipo_servicio_id:      form.tipo_servicio_id || undefined,
      ciudad_id:             form.ciudad_id || undefined,
      direccion:             form.direccion || null,
      valor:                 form.valor ? parseFloat(form.valor) : null,
      es_visita:             form.es_visita,
      tiene_materiales:      form.tiene_materiales,
      costo_materiales:      form.tiene_materiales ? parseFloat(form.costo_materiales || '0') : 0,
      tiene_herramienta:     form.tiene_herramienta,
      costo_herramienta:     form.tiene_herramienta ? parseFloat(form.costo_herramienta || '0') : 0,
      observaciones:         form.observaciones || null,
    });
  };

  const isCompletado = servicio?.estado === 'completado';

  const s = (k: string) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Editar Servicio" size="lg">
      <form onSubmit={submit} className="space-y-4">
        {isCompletado && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-3 py-2 rounded-lg">
            Este servicio está completado. Puedes corregir errores de digitación (fecha, cliente, técnico, dirección), pero <b>no puedes alterar los valores cobrados</b> para no afectar la contabilidad.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha *" type="date" value={form.fecha} onChange={e => s('fecha')(e.target.value)} required />
          <Input label="Cliente (Texto)" value={form.nombre_cliente_anon} onChange={e => s('nombre_cliente_anon')(e.target.value)} placeholder="Ej: Juan Perez" />
          <SearchSelect label="Técnico *" value={form.tecnico_id} onChange={v => s('tecnico_id')(v as string)} required
            options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))} placeholder="Buscar técnico..." />
          <SearchSelect label="Tipo de Servicio *" value={form.tipo_servicio_id} onChange={v => s('tipo_servicio_id')(v as string)} required
            options={tipos.map(t => ({ value: t.id, label: t.nombre }))} placeholder="Buscar tipo..." />
          <SearchSelect label="Ciudad *" value={form.ciudad_id} onChange={v => s('ciudad_id')(v as string)} required
            options={ciudades.map(c => ({ value: c.id, label: c.nombre }))} placeholder="Buscar ciudad..." />
          <Input label="Valor Cobrado" type="number" value={form.valor} onChange={e => s('valor')(e.target.value)} placeholder="0" disabled={isCompletado} />
          <div className="col-span-2">
            <Input label="Dirección" value={form.direccion} onChange={e => s('direccion')(e.target.value)} placeholder="Ej: Calle 123..." />
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.es_visita} onChange={e => s('es_visita')(e.target.checked)} className="rounded" />
            Es visita
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tiene_materiales} onChange={e => s('tiene_materiales')(e.target.checked)} className="rounded" disabled={isCompletado} />
            Materiales
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tiene_herramienta} onChange={e => s('tiene_herramienta')(e.target.checked)} className="rounded" disabled={isCompletado} />
            Herramienta
          </label>
        </div>

        {form.tiene_materiales && (
          <Input label="Costo Materiales" type="number" value={form.costo_materiales}
            onChange={e => s('costo_materiales')(e.target.value)} placeholder="0" disabled={isCompletado} />
        )}
        {form.tiene_herramienta && (
          <Input label="Costo Herramienta" type="number" value={form.costo_herramienta}
            onChange={e => s('costo_herramienta')(e.target.value)} placeholder="0" disabled={isCompletado} />
        )}

        <Input label="Observaciones" value={form.observaciones} onChange={e => s('observaciones')(e.target.value)} placeholder="Opcional" />

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={isPending}>Guardar Cambios</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Completar ──────────────────────────────────────────────────────────
function ModalCompletar({ open, servicio, onClose, onSuccess, tecnicos, tipos }: {
  open: boolean; servicio: Servicio | null; onClose: () => void; onSuccess: () => void;
  tecnicos: Tecnico[]; tipos: TipoServicio[];
}) {
  const [form, setForm] = useState({
    valor: '', medio_pago: '',
    tiene_materiales: false, costo_materiales: '',
    tiene_herramienta: false, costo_herramienta: '',
    efectivo_entregado: false, empresa_debe_tecnico: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (form.medio_pago && form.medio_pago !== 'efectivo') {
      setForm(f => ({ ...f, empresa_debe_tecnico: true }));
    } else {
      setForm(f => ({ ...f, empresa_debe_tecnico: false }));
    }
  }, [form.medio_pago]);

  const { mutate, isPending } = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/servicios/${servicio?.id}/completar`, body),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const tecnico = tecnicos.find(t => servicio?.tecnico_id && String(t.id) === String(servicio.tecnico_id)) ?? null;
  const tipo    = tipos.find(t => servicio?.tipo_servicio_id && String(t.id) === String(servicio.tipo_servicio_id)) ?? null;
  const liq = calcularLiquidacion({
    valor: form.valor, medio_pago: form.medio_pago, es_visita: servicio?.es_visita ?? false,
    tiene_materiales: form.tiene_materiales, costo_materiales: form.costo_materiales,
    tiene_herramienta: form.tiene_herramienta, costo_herramienta: form.costo_herramienta,
    tecnico, tipo,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    mutate({
      valor:                parseFloat(form.valor),
      medio_pago:           form.medio_pago,
      efectivo_entregado:   form.efectivo_entregado,
      empresa_debe_tecnico: form.medio_pago !== 'efectivo' ? form.empresa_debe_tecnico : false,
      tiene_materiales:     form.tiene_materiales,
      costo_materiales:     form.tiene_materiales  ? parseFloat(form.costo_materiales  || '0') : 0,
      tiene_herramienta:    form.tiene_herramienta,
      costo_herramienta:    form.tiene_herramienta ? parseFloat(form.costo_herramienta || '0') : 0,
    });
  };

  const s = (k: string) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const cliente = servicio?.nombre_cliente_anon || 'Sin nombre';

  return (
    <Modal open={open} onClose={onClose} title={`Completar — ${cliente}`}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor *" type="number" value={form.valor} onChange={e => s('valor')(e.target.value)} required placeholder="0" />
          <Select label="Medio de Pago *" value={form.medio_pago} onChange={e => s('medio_pago')(e.target.value)} required
            options={MEDIO_PAGO_OPTIONS} placeholder="Seleccionar" />
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tiene_materiales} onChange={e => s('tiene_materiales')(e.target.checked)} className="rounded" />
            Materiales
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.tiene_herramienta} onChange={e => s('tiene_herramienta')(e.target.checked)} className="rounded" />
            Herramienta
          </label>
        </div>
        {form.tiene_materiales && <Input label="Costo Materiales" type="number" value={form.costo_materiales} onChange={e => s('costo_materiales')(e.target.value)} placeholder="0" />}
        {form.tiene_herramienta && <Input label="Costo Herramienta" type="number" value={form.costo_herramienta} onChange={e => s('costo_herramienta')(e.target.value)} placeholder="0" />}

        <PanelLiquidacion
          liq={liq}
          medio_pago={form.medio_pago}
          efectivo_entregado={form.efectivo_entregado}
          empresa_debe_tecnico={form.empresa_debe_tecnico}
          onEntregadoChange={v => setForm(f => ({ ...f, efectivo_entregado: v }))}
          onEmpresaDebeChange={v => setForm(f => ({ ...f, empresa_debe_tecnico: v }))}
        />

        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="primary" loading={isPending}>Completar</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Convertir visita ───────────────────────────────────────────────────
function ModalConvertir({ open, servicio, onClose, onSuccess, tecnicos, tipos, ciudades }: {
  open: boolean; servicio: Servicio | null; onClose: () => void; onSuccess: () => void;
  tecnicos: Tecnico[]; tipos: TipoServicio[]; ciudades: Ciudad[];
}) {
  const [form, setForm] = useState({
    tecnico_id: '', tipo_servicio_id: '', ciudad_id: '',
    valor: '', medio_pago: '',
    tiene_materiales: false, costo_materiales: '',
    tiene_herramienta: false, costo_herramienta: '',
    observaciones: '',
    completado: false, efectivo_entregado: false, empresa_debe_tecnico: false,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (servicio && open) {
      setForm({
        tecnico_id: servicio.tecnico_id ? String(servicio.tecnico_id) : '',
        tipo_servicio_id: servicio.tipo_servicio_id ? String(servicio.tipo_servicio_id) : '',
        ciudad_id: servicio.ciudad_id ? String(servicio.ciudad_id) : '',
        valor: '', medio_pago: '',
        tiene_materiales: false, costo_materiales: '',
        tiene_herramienta: false, costo_herramienta: '',
        observaciones: '',
        completado: false, efectivo_entregado: false, empresa_debe_tecnico: false,
      });
    }
  }, [servicio, open]);

  useEffect(() => {
    if (form.medio_pago && form.medio_pago !== 'efectivo') {
      setForm(f => ({ ...f, empresa_debe_tecnico: true }));
    } else {
      setForm(f => ({ ...f, empresa_debe_tecnico: false }));
    }
  }, [form.medio_pago]);

  const { mutate, isPending } = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/servicios/${servicio?.id}/convertir`, body),
    onSuccess: () => { onSuccess(); onClose(); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    mutate({
      tecnico_id:           form.tecnico_id || undefined,
      tipo_servicio_id:     form.tipo_servicio_id || undefined,
      ciudad_id:            form.ciudad_id || undefined,
      valor:                form.completado ? parseFloat(form.valor) : undefined,
      medio_pago:           form.completado ? form.medio_pago : undefined,
      efectivo_entregado:   form.completado ? form.efectivo_entregado : undefined,
      empresa_debe_tecnico: form.completado && form.medio_pago !== 'efectivo' ? form.empresa_debe_tecnico : undefined,
      tiene_materiales:     form.completado ? form.tiene_materiales : undefined,
      costo_materiales:     form.completado && form.tiene_materiales ? parseFloat(form.costo_materiales || '0') : undefined,
      tiene_herramienta:    form.completado ? form.tiene_herramienta : undefined,
      costo_herramienta:    form.completado && form.tiene_herramienta ? parseFloat(form.costo_herramienta || '0') : undefined,
      observaciones:        form.observaciones || undefined,
    });
  };

  const s = (k: string) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  // Liquidación para el SERVICIO convertido (es_visita=false → regla de visita no aplica aquí)
  const tecnicoConv = form.completado ? (tecnicos.find(t => String(t.id) === form.tecnico_id) ?? null) : null;
  const tipoConv    = form.completado ? (tipos.find(t => String(t.id) === form.tipo_servicio_id) ?? null) : null;
  const liqConv = form.completado ? calcularLiquidacion({
    valor: form.valor, medio_pago: form.medio_pago, es_visita: false,
    tiene_materiales: form.tiene_materiales, costo_materiales: form.costo_materiales,
    tiene_herramienta: form.tiene_herramienta, costo_herramienta: form.costo_herramienta,
    tecnico: tecnicoConv, tipo: tipoConv,
  }) : null;

  const cliente = servicio?.nombre_cliente_anon || 'Sin nombre';

  return (
    <Modal open={open} onClose={onClose} title={`Convertir a Servicio — ${cliente}`} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {servicio && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm space-y-1 mb-2">
            <p className="text-xs font-semibold text-blue-700 uppercase">Datos originales (Se copiarán)</p>
            <div className="flex justify-between text-blue-900"><span className="opacity-70">Dirección:</span> <span className="font-medium text-right max-w-xs">{servicio.direccion || '—'}</span></div>
            <div className="flex justify-between text-blue-900"><span className="opacity-70">Teléfono:</span> <span className="font-medium">{servicio.telefono_cliente_anon || '—'}</span></div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <SearchSelect label="Técnico *" value={form.tecnico_id} onChange={v => s('tecnico_id')(v as string)} required
            options={tecnicos.map(t => ({ value: t.id, label: t.nombre }))} placeholder="Mismo técnico u otro..." />
          <SearchSelect label="Tipo de Servicio *" value={form.tipo_servicio_id} onChange={v => s('tipo_servicio_id')(v as string)} required
            options={tipos.map(t => ({ value: t.id, label: t.nombre }))} placeholder="Buscar tipo..." />
          <div className="col-span-2">
            <SearchSelect label="Ciudad *" value={form.ciudad_id} onChange={v => s('ciudad_id')(v as string)} required
              options={ciudades.map(c => ({ value: c.id, label: c.nombre }))} placeholder="Buscar ciudad..." />
          </div>
        </div>

        <div className="border-t border-slate-200 pt-3">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input type="checkbox" checked={form.completado} onChange={e => s('completado')(e.target.checked)} className="rounded text-blue-600" />
            <span className="font-medium text-slate-700">Completar servicio ahora mismo y registrar cobro</span>
          </label>
        </div>

        {form.completado && (
          <div className="space-y-3 pl-6 border-l-2 border-blue-200">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valor Cobrado *" type="number" value={form.valor} onChange={e => s('valor')(e.target.value)} placeholder="0" required={form.completado} />
              <Select label="Medio de Pago *" value={form.medio_pago} onChange={e => s('medio_pago')(e.target.value)} required={form.completado}
                options={MEDIO_PAGO_OPTIONS} placeholder="Seleccionar" />
            </div>
            
            <div className="flex gap-4 text-sm mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.tiene_materiales} onChange={e => s('tiene_materiales')(e.target.checked)} className="rounded" />
                Materiales
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.tiene_herramienta} onChange={e => s('tiene_herramienta')(e.target.checked)} className="rounded" />
                Herramienta
              </label>
            </div>
            {form.tiene_materiales && <Input label="Costo Materiales" type="number" value={form.costo_materiales} onChange={e => s('costo_materiales')(e.target.value)} placeholder="0" />}
            {form.tiene_herramienta && <Input label="Costo Herramienta" type="number" value={form.costo_herramienta} onChange={e => s('costo_herramienta')(e.target.value)} placeholder="0" />}
            <PanelLiquidacion
              liq={liqConv}
              medio_pago={form.medio_pago}
              efectivo_entregado={form.efectivo_entregado}
              empresa_debe_tecnico={form.empresa_debe_tecnico}
              onEntregadoChange={v => setForm(f => ({ ...f, efectivo_entregado: v }))}
              onEmpresaDebeChange={v => setForm(f => ({ ...f, empresa_debe_tecnico: v }))}
            />
          </div>
        )}

        <Input label="Observaciones" value={form.observaciones} onChange={e => s('observaciones')(e.target.value)} placeholder="Opcional..." />
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>Descartar</Button>
          <Button type="submit" loading={isPending}>Convertir</Button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Cancelar ───────────────────────────────────────────────────────────
function ModalCancelar({ open, servicio, onClose, onSuccess }: {
  open: boolean; servicio: Servicio | null; onClose: () => void; onSuccess: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  
  const { mutate, isPending } = useMutation({
    mutationFn: () => api.patch(`/servicios/${servicio?.id}/cancelar`, { motivo }),
    onSuccess: () => { onSuccess(); onClose(); setMotivo(''); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    mutate();
  };

  return (
    <Modal open={open} onClose={onClose} title="Cancelar Servicio / Visita" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          ¿Estás seguro de que deseas cancelar este registro? Si es una visita que no se concretó o un servicio anulado, puedes escribir el motivo (opcional).
        </p>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Motivo de cancelación (opcional)</label>
          <textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={3}
            placeholder="El cliente no aceptó la cotización..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
        </div>
        {error && <p className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>No, salir</Button>
          <Button type="submit" variant="danger" loading={isPending}>Sí, Cancelar</Button>
        </div>
      </form>
    </Modal>
  );
}
