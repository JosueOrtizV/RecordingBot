import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LogOut, User as UserIcon, Sun, Moon, Menu, Radio } from 'lucide-react';

interface NavbarProps {
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="h-16 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-200">
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors md:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 text-white shrink-0">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base sm:text-lg tracking-tight">
                RecordingBot
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-mono hidden sm:inline-block">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Panel Multi-Usuario de Grabación
            </p>
          </div>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-slate-200/80 dark:border-slate-800"
          aria-label="Alternar tema"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        {user && (
          <>
            {/* User Profile Chip */}
            <div className="flex items-center gap-2.5 bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-2xl transition-colors">
              {user.pictureUrl ? (
                <img
                  src={user.pictureUrl}
                  alt={user.name}
                  className="w-6 h-6 rounded-full ring-1 ring-slate-300 dark:ring-slate-700 object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <UserIcon className="w-3.5 h-3.5" />
                </div>
              )}
              <div className="text-xs hidden md:block text-left">
                <p className="font-semibold text-slate-800 dark:text-slate-200 leading-tight truncate max-w-[130px]">
                  {user.name}
                </p>
                <p className="text-slate-500 dark:text-slate-400 text-[10px] truncate max-w-[130px]">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-900/50"
              aria-label="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
