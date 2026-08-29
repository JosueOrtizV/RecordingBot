import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Video, Calendar, Disc, Settings } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/join', label: 'Unirse a Reunión', icon: Video, badge: 'Directo' },
    { to: '/calendar', label: 'Calendario', icon: Calendar },
    { to: '/recordings', label: 'Grabaciones', icon: Disc },
    { to: '/settings', label: 'Configuración', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/80 p-4 flex flex-col justify-between shrink-0">
      <div className="space-y-1">
        <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
          Navegación
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-sm shadow-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/80 border border-transparent'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-300 font-semibold mb-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Sistema Activo
        </div>
        <p className="text-[11px] text-slate-500">Grabador multi-worker con deduplicación y subida directa a Google Drive.</p>
      </div>
    </aside>
  );
};
