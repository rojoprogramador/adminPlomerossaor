import { cn } from '@/lib/utils';

type BadgeColor = 'gray' | 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange';

interface BadgeProps {
  label: string;
  color?: BadgeColor;
  className?: string;
}

const colors: Record<BadgeColor, string> = {
  gray:   'bg-slate-100 text-slate-700',
  blue:   'bg-blue-100 text-blue-700',
  green:  'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
};

export default function Badge({ label, color = 'gray', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', colors[color], className)}>
      {label}
    </span>
  );
}

export const estadoBadgeColor = (estado: string): BadgeColor => {
  const map: Record<string, BadgeColor> = {
    pendiente: 'yellow', en_progreso: 'blue', completado: 'green',
    cancelado: 'red', convertida: 'purple',
    activa: 'green', vencida: 'red', reclamada: 'orange', resuelta: 'blue',
    saldada: 'green', parcial: 'orange',
    entregado: 'green',
  };
  return map[estado] || 'gray';
};
