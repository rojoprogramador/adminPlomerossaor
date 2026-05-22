'use client';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';

const titles: Record<string, string> = {
  '/dashboard':      'Dashboard',
  '/servicios':      'Servicios',
  '/garantias':      'Garantías',
  '/deudas':         'Deudas',
  '/pagos':          'Pagos',
  '/reportes':       'Reportes',
  '/carga-masiva':   'Carga Masiva',
  '/tecnicos':       'Técnicos',
  '/clientes':       'Clientes',
  '/ciudades':       'Ciudades',
  '/tipos-servicio': 'Tipos de Servicio',
  '/empresas':       'Empresas',
  '/usuarios':       'Usuarios',
  '/gastos':         'Gastos Operacionales',
};

export default function Header({ onMenuClick }: { readonly onMenuClick: () => void }) {
  const pathname = usePathname();
  const base = '/' + (pathname.split('/')[1] || '');
  const title = titles[base] || 'Plomeros SAOR';

  return (
    <header className="flex h-14 items-center border-b border-slate-200 bg-white px-4 lg:px-6">
      <button
        onClick={onMenuClick}
        className="mr-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors lg:hidden"
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>
      <h1 className="text-base font-semibold text-slate-800">{title}</h1>
    </header>
  );
}
