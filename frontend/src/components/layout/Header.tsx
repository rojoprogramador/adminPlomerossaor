'use client';
import { usePathname } from 'next/navigation';

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

export default function Header() {
  const pathname = usePathname();
  const base = '/' + (pathname.split('/')[1] || '');
  const title = titles[base] || 'Plomeros SAOR';

  return (
    <header className="flex h-14 items-center border-b border-slate-200 bg-white px-6">
      <h1 className="text-base font-semibold text-slate-800">{title}</h1>
    </header>
  );
}
