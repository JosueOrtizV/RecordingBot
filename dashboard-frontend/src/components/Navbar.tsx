import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, User as UserIcon } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20 text-white font-bold text-lg">
          🎙️
        </div>
        <div>
          <h1 className="font-bold text-slate-100 text-lg leading-tight tracking-tight flex items-center gap-2">
            RecordingBot <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">v2.0</span>
          </h1>
          <p className="text-xs text-slate-400">Panel Multi-Usuario de Grabación</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <>
            <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-full">
              {user.pictureUrl ? (
                <img src={user.pictureUrl} alt={user.name} className="w-7 h-7 rounded-full" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-slate-300">
                  <UserIcon className="w-4 h-4" />
                </div>
              )}
              <div className="text-xs">
                <p className="font-semibold text-slate-200 leading-tight">{user.name}</p>
                <p className="text-slate-400 text-[10px]">{user.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              title="Cerrar sesión"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/20"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </header>
  );
};
