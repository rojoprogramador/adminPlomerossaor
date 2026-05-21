'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Search, Phone } from 'lucide-react';

type BusquedaRapidaProps = {
  open: boolean;
  onClose: () => void;
};

export default function BusquedaRapidaModal({ open, onClose }: BusquedaRapidaProps) {
  const [telefono, setTelefono] = useState('');
  const [searchedTelefono, setSearchedTelefono] = useState('');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['busqueda-telefono', searchedTelefono],
    queryFn: () => api.get(`/clientes/buscar-telefono?telefono=${searchedTelefono}`).then(r => r.data),
    enabled: !!searchedTelefono,
    retry: false,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (telefono.trim().length >= 4) {
      setSearchedTelefono(telefono.trim());
    }
  };

  const handleClose = () => {
    setTelefono('');
    setSearchedTelefono('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Búsqueda Rápida SC (WhatsApp)" size="lg">
      <div className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2 items-end">
          <div className="flex-1">
            <Input 
              label="Número de Teléfono" 
              value={telefono} 
              onChange={e => setTelefono(e.target.value)} 
              placeholder="Ej: 3001234567" 
              autoFocus
            />
          </div>
          <Button type="submit" disabled={telefono.length < 4} loading={isLoading}>
            <Search size={16} className="mr-2" /> Buscar
          </Button>
        </form>

        {isError && (
          <div className="rounded-lg bg-red-50 p-4 border border-red-100">
            <p className="text-sm text-red-600 font-medium">No se encontró ningún cliente con ese número.</p>
            <p className="text-xs text-red-500 mt-1">Si es un cliente nuevo, debes registrarlo.</p>
          </div>
        )}

        {data?.cliente && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            {/* Tarjeta del Cliente */}
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold text-blue-900">{data.cliente.nombre_completo}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-blue-700">
                    <Phone size={14} /> {data.cliente.telefono_1} {data.cliente.whatsapp ? `(WA: ${data.cliente.whatsapp})` : ''}
                  </div>
                </div>
                <div className="text-right bg-white px-3 py-1.5 rounded-lg border border-blue-100 shadow-sm">
                  <p className="text-xs text-slate-500 font-medium">Total Gastado</p>
                  <p className="text-base font-bold text-green-600">{formatCurrency(data.total_gastado)}</p>
                </div>
              </div>
              <div className="text-sm text-slate-600 mt-2">
                <p>📍 {data.cliente.direccion} - {data.cliente.barrio} ({data.cliente.ciudad?.nombre})</p>
              </div>
            </div>

            {/* Historial de Servicios */}
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Historial de Servicios ({data.servicios.length})</h4>
              {data.servicios.length === 0 ? (
                <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">No tiene servicios registrados.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                  {data.servicios.map((s: any) => (
                    <div key={s.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{s.tipo_servicio?.nombre || 'Servicio General'}</span>
                          <Badge label={s.estado} color={s.estado === 'completado' ? 'green' : s.estado === 'cancelado' ? 'red' : 'blue'} />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">📅 {formatDate(s.fecha)} • 👨‍🔧 {s.tecnico?.nombre}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-slate-700">{formatCurrency(s.valor)}</p>
                        {s.es_garantia && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded uppercase">Garantía</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
