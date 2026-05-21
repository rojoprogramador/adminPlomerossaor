'use client';
import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { getAxiosError } from '@/lib/utils';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Upload, Download, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';

interface BulkResult {
  total: number;
  exitosos: number;
  errores_validacion: number;
  errores_creacion: number;
  detalle_errores: { fila?: number; campo?: string; mensaje: string }[];
  servicios_creados: { id: number; fila: number; estado: string }[];
}

export default function CargaMasivaPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError]   = useState('');

  const downloadPlantilla = async () => {
    const resp = await api.get('/servicios/bulk/plantilla', { responseType: 'blob' });
    const url  = URL.createObjectURL(resp.data);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'plantilla_servicios.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const uploadExcel = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append('archivo', file);
      return api.post('/servicios/bulk/excel', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: (res) => { setResult(res.data); setError(''); },
    onError: (e) => setError(getAxiosError(e)),
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null); setError('');
    uploadExcel.mutate(file);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* instrucciones */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-5 space-y-2">
        <h2 className="font-semibold text-blue-800 flex items-center gap-2">
          <FileSpreadsheet size={18} /> Instrucciones
        </h2>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Descarga la plantilla Excel con el formato requerido.</li>
          <li>Llena cada fila con los datos del servicio.</li>
          <li>Los campos <strong>tecnico_nombre</strong>, <strong>tipo_servicio_nombre</strong> y <strong>ciudad_nombre</strong> deben coincidir exactamente con los registros del sistema.</li>
          <li>Sube el archivo completado. Máximo 500 filas por carga.</li>
        </ol>
      </div>

      {/* acciones */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" onClick={downloadPlantilla}>
          <Download size={15} /> Descargar Plantilla
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        <Button onClick={() => fileRef.current?.click()} loading={uploadExcel.isPending}>
          <Upload size={15} /> Subir Excel
        </Button>
      </div>

      {error && <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</p>}

      {/* resultado */}
      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-slate-100 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800">{result.total}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total filas</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{result.exitosos}</p>
              <p className="text-xs text-green-600 mt-0.5">Creados</p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-3 text-center">
              <p className="text-2xl font-bold text-yellow-700">{result.errores_validacion}</p>
              <p className="text-xs text-yellow-600 mt-0.5">Err. validación</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{result.errores_creacion}</p>
              <p className="text-xs text-red-600 mt-0.5">Err. creación</p>
            </div>
          </div>

          {result.servicios_creados.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-medium text-green-800 flex items-center gap-1.5 mb-2">
                <CheckCircle size={15} /> Servicios creados
              </p>
              <div className="space-y-1">
                {result.servicios_creados.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-green-700">Fila {s.fila} → Servicio #{s.id}</span>
                    <Badge label={s.estado} color="green" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.detalle_errores.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800 flex items-center gap-1.5 mb-2">
                <XCircle size={15} /> Errores
              </p>
              <div className="space-y-1">
                {result.detalle_errores.map((e, i) => (
                  <div key={i} className="text-sm text-red-700">
                    {e.fila && <span className="font-medium">Fila {e.fila}: </span>}
                    {e.campo && <span className="font-medium">[{e.campo}] </span>}
                    {e.mensaje}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
