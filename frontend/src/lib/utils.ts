import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export const formatDate = (date?: string | null): string => {
  if (!date) return '—';
  try {
    return format(parseISO(date.includes('T') ? date : date + 'T00:00:00'), 'dd/MM/yyyy', { locale: es });
  } catch {
    return date;
  }
};

export const formatDateTime = (date?: string | null): string => {
  if (!date) return '—';
  try {
    return format(parseISO(date), 'dd/MM/yyyy HH:mm', { locale: es });
  } catch {
    return date;
  }
};

export const formatCurrency = (value?: number | null): string => {
  if (value == null) return '—';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const today = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export const firstDayOfMonth = (): string => {
  const d = new Date();
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(d);
  return local.slice(0, 7) + '-01';
};

export const diasRestantes = (fechaVence?: string): number => {
  if (!fechaVence) return 0;
  try {
    return differenceInDays(parseISO(fechaVence + 'T23:59:59'), new Date());
  } catch {
    return 0;
  }
};

export const MEDIO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  nequi: 'Nequi',
  bancolombia: 'Bancolombia',
  daviplata: 'Daviplata',
  transferencia: 'Transferencia',
};

export const MEDIO_PAGO_OPTIONS = Object.entries(MEDIO_PAGO_LABELS).map(([value, label]) => ({ value, label }));

export const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En Progreso',
  completado: 'Completado',
  cancelado: 'Cancelado',
  convertida: 'Convertida',
};

export const ESTADO_GARANTIA_LABELS: Record<string, string> = {
  activa: 'Activa',
  vencida: 'Vencida',
  reclamada: 'Reclamada',
  resuelta: 'Resuelta',
  cancelada: 'Cancelada',
};

export const ESTADO_DEUDA_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  saldada: 'Saldada',
};

export const cn = (...classes: (string | undefined | false | null)[]): string =>
  classes.filter(Boolean).join(' ');

export const getAxiosError = (error: unknown): string => {
  if (error && typeof error === 'object' && 'response' in error) {
    const e = error as { response?: { data?: { error?: string } } };
    return e.response?.data?.error || 'Error desconocido';
  }
  return 'Error de conexión';
};
