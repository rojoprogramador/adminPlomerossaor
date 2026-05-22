'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Wrench, Users, MapPin, Settings,
  Shield, CreditCard, FileText, Upload, LogOut, ChevronRight,
  Banknote, Star, Building2, UserCog, TrendingDown, ClipboardList
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const navAdmin = [
  { href: '/dashboard',      label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/servicios',      label: 'Servicios',          icon: Wrench },
  { href: '/garantias',      label: 'Garantías',          icon: Shield },
  { href: '/deudas',         label: 'Deudas',             icon: Banknote },
  { href: '/pagos',          label: 'Pagos',              icon: CreditCard },
  { href: '/reportes',       label: 'Reportes',           icon: FileText },
  { href: '/carga-masiva',   label: 'Carga Masiva',       icon: Upload },
  { href: '/gastos',         label: 'Gastos',             icon: TrendingDown },
];

const navAgente = [
  { href: '/servicios',    label: 'Servicios',   icon: Wrench },
  { href: '/garantias',    label: 'Garantías',   icon: Shield },
  { href: '/reportes',     label: 'Reportes',    icon: FileText },
  { href: '/carga-masiva', label: 'Carga Masiva', icon: Upload },
];

const navCatalogos = [
  { href: '/usuarios',              label: 'Usuarios',           icon: UserCog },
  { href: '/tecnicos',              label: 'Técnicos',           icon: Star },
  { href: '/agentes',               label: 'Agentes SC',         icon: Users },
  { href: '/documentos-tecnicos',   label: 'Docs Técnicos',      icon: ClipboardList },
  { href: '/clientes',              label: 'Clientes',           icon: Users },
  { href: '/ciudades',              label: 'Ciudades',           icon: MapPin },
  { href: '/tipos-servicio',        label: 'Tipos de Servicio',  icon: Settings },
];

const navSuperadmin = [
  { href: '/empresas',       label: 'Empresas',           icon: Building2 },
  { href: '/usuarios',       label: 'Usuarios',           icon: UserCog },
];

interface SidebarProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const isSuperadmin = user?.rol === 'superadmin';
  const isAgente     = user?.rol === 'agente_sc';

  const renderLink = (item: { href: string; label: string; icon: React.ElementType }) => {
    const Icon = item.icon;
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    return (
      <Link key={item.href} href={item.href} onClick={onClose}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        )}
      >
        <Icon size={16} className={active ? 'text-blue-600' : 'text-slate-400'} />
        {item.label}
        {active && <ChevronRight size={14} className="ml-auto text-blue-400" />}
      </Link>
    );
  };

  return (
    <aside className={cn(
      'fixed inset-y-0 left-0 z-50 flex h-screen w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-200',
      'lg:static lg:z-auto lg:translate-x-0',
      open ? 'translate-x-0' : '-translate-x-full'
    )}>
      {/* logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
          <Wrench size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900">Plomeros SAOR</p>
          <p className="text-xs text-slate-400">{user?.rol || 'admin'}</p>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {isSuperadmin && (
          <>
            <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Sistema</p>
            {navSuperadmin.map(renderLink)}
          </>
        )}
        {isAgente && (
          <>
            <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Atención al Cliente</p>
            {navAgente.map(renderLink)}
            <div className="my-2 border-t border-slate-100" />
            <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Catálogos</p>
            {navCatalogos.map(renderLink)}
          </>
        )}
        {!isSuperadmin && !isAgente && (
          <>
            <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Operaciones</p>
            {navAdmin.map(renderLink)}
            <div className="my-2 border-t border-slate-100" />
            <p className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Catálogos</p>
            {navCatalogos.map(renderLink)}
          </>
        )}
      </nav>

      {/* user */}
      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
            {user?.nombre?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-slate-700">{user?.nombre || 'Usuario'}</p>
          </div>
          <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
