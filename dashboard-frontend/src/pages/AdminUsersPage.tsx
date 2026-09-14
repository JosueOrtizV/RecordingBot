import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api/client';
import { AdminUser, AdminStats } from '../types';
import { showToast } from '../utils/swal';
import {
  Users,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Video,
  Lock,
  AlertTriangle,
} from 'lucide-react';

export const AdminUsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  // If not admin, redirect to dashboard
  if (currentUser && currentUser.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended' | 'admin'>('all');

  // Modal states
  const [statusModalUser, setStatusModalUser] = useState<AdminUser | null>(null);
  const [roleModalUser, setRoleModalUser] = useState<AdminUser | null>(null);
  const [isActionLoading, setIsActionLoading] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        fetchApi<{ users: AdminUser[] }>('/api/admin/users'),
        fetchApi<AdminStats>('/api/admin/stats'),
      ]);
      setUsers(usersRes.users || []);
      setStats(statsRes);
    } catch (err: any) {
      console.error('Error loading admin data:', err);
      showToast.error('Error al cargar datos', err.message || 'No se pudo obtener la información de usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Format helpers
  const formatSeconds = (sec: number): string => {
    if (!sec || sec <= 0) return '0 min';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes > 0 ? `${minutes}m` : ''}`;
    }
    return `${minutes} min`;
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleToggleStatus = async () => {
    if (!statusModalUser) return;
    setIsActionLoading(true);
    const newStatus = !statusModalUser.isActive;
    try {
      await fetchApi(`/api/admin/users/${statusModalUser.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: newStatus }),
      });
      showToast.success(
        newStatus ? 'Cuenta reactivada' : 'Cuenta suspendida',
        `La cuenta de ${statusModalUser.name} ha sido ${newStatus ? 'reactivada' : 'suspendida'} correctamente.`
      );
      setStatusModalUser(null);
      await loadData();
    } catch (err: any) {
      showToast.error('Error al cambiar estado', err.message || 'No se pudo actualizar el estado.');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleChangeRole = async (targetRole: 'admin' | 'user') => {
    if (!roleModalUser) return;
    setIsActionLoading(true);
    try {
      await fetchApi(`/api/admin/users/${roleModalUser.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: targetRole }),
      });
      showToast.success(
        'Rol actualizado',
        `Rol de ${roleModalUser.name} actualizado a ${targetRole === 'admin' ? 'Administrador' : 'Usuario'}.`
      );
      setRoleModalUser(null);
      await loadData();
    } catch (err: any) {
      showToast.error('Error al cambiar rol', err.message || 'No se pudo actualizar el rol.');
    } finally {
      setIsActionLoading(false);
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.botDisplayName.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    if (filterStatus === 'active') return u.isActive;
    if (filterStatus === 'suspended') return !u.isActive;
    if (filterStatus === 'admin') return u.role === 'admin';
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Gestión de Usuarios
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Admin
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Control de cuentas, roles y métricas de infraestructura con estricta privacidad por diseño.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80 shadow-sm transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Privacy by Design Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-50/70 to-sky-50/70 dark:from-indigo-950/30 dark:to-sky-950/30 border border-indigo-200/60 dark:border-indigo-800/40 flex items-start gap-3.5 shadow-sm">
        <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-xs sm:text-sm">
          <h2 className="font-semibold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
            Gobernanza con Privacidad por Diseño
          </h2>
          <p className="text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
            Como administrador, puedes gestionar el acceso de los colaboradores y vigilar el consumo de recursos del VPS. Por diseño y seguridad, <strong>la plataforma no permite ver títulos de reuniones, archivos en Drive, audios ni transcripciones o minutas privadas de otros usuarios.</strong>
          </p>
        </div>
      </div>


      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Usuarios</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats?.totalUsers ?? '—'}
          </div>
          <div className="text-[11px] text-slate-500">Cuentas registradas</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Activos</span>
            <UserCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats?.activeUsers ?? '—'}
          </div>
          <div className="text-[11px] text-slate-500">Acceso y bots habilitados</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Suspendidos</span>
            <UserX className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats?.suspendedUsers ?? '—'}
          </div>
          <div className="text-[11px] text-slate-500">Cuentas bloqueadas</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Grabaciones</span>
            <Video className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats?.totalRecordings ?? '—'}
          </div>
          <div className="text-[11px] text-slate-500">
            ~ {formatSeconds(stats?.totalDurationSeconds || 0)} procesadas
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 sm:p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, correo o nombre de bot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'active', label: 'Activos' },
              { id: 'suspended', label: 'Suspendidos' },
              { id: 'admin', label: 'Admins' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterStatus(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                filterStatus === item.id
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users List - Desktop Table & Mobile Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-sm">Cargando usuarios...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium">No se encontraron usuarios</p>
            <p className="text-xs text-slate-500">Prueba ajustando los filtros o el término de búsqueda.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4">Usuario</th>
                    <th className="py-3.5 px-4">Bot Identidad</th>
                    <th className="py-3.5 px-4">Rol</th>
                    <th className="py-3.5 px-4">Estado</th>
                    <th className="py-3.5 px-4">Uso de Bot</th>
                    <th className="py-3.5 px-4">Último Login</th>
                    <th className="py-3.5 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Usuario */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {u.pictureUrl ? (
                              <img
                                src={u.pictureUrl}
                                alt={u.name}
                                referrerPolicy="no-referrer"
                                className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-500 flex items-center justify-center text-white text-xs font-bold">
                                {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{u.name || 'Sin nombre'}</span>
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono font-medium">
                                    Tú
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Bot Display Name */}
                        <td className="py-3 px-4">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                            {u.botDisplayName}
                          </span>
                        </td>

                        {/* Rol */}
                        <td className="py-3 px-4">
                          {u.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Usuario
                            </span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-3 px-4">
                          {u.isActive ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                              Activo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-400">
                              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                              Suspendido
                            </span>
                          )}
                        </td>

                        {/* Uso de Bot */}
                        <td className="py-3 px-4">
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                            {u.totalRecordings} grabaciones
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatSeconds(u.totalDurationSeconds)}
                          </div>
                        </td>

                        {/* Último Login */}
                        <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                          {formatDate(u.lastLoginAt)}
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Role Switcher */}
                            {!isSelf && (
                              <button
                                onClick={() => setRoleModalUser(u)}
                                className="px-2.5 py-1 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
                              >
                                {u.role === 'admin' ? 'Hacer Usuario' : 'Hacer Admin'}
                              </button>
                            )}

                            {/* Status Toggle */}
                            <button
                              disabled={isSelf}
                              onClick={() => setStatusModalUser(u)}
                              title={isSelf ? 'No puedes suspender tu propia cuenta' : ''}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                u.isActive
                                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60'
                                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60'
                              }`}
                            >
                              {u.isActive ? 'Suspender' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <div key={u.id} className="p-4 space-y-3">
                    {/* Header: User info + Status badge */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {u.pictureUrl ? (
                          <img
                            src={u.pictureUrl}
                            alt={u.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-sky-500 flex items-center justify-center text-white text-xs font-bold">
                            {u.name ? u.name.charAt(0).toUpperCase() : u.email.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 text-sm">
                            <span>{u.name || 'Sin nombre'}</span>
                            {isSelf && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono font-medium">
                                Tú
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {u.role === 'admin' ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                            Admin
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            Usuario
                          </span>
                        )}
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            Suspendido
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metadata chips */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Bot en llamadas</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                          {u.botDisplayName}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase">Actividad</span>
                        <span className="font-medium text-slate-700 dark:text-slate-300 block">
                          {u.totalRecordings} grabaciones ({formatSeconds(u.totalDurationSeconds)})
                        </span>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    {!isSelf && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => setRoleModalUser(u)}
                          className="flex-1 py-1.5 text-xs font-medium rounded-xl text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                          {u.role === 'admin' ? 'Degradar a Usuario' : 'Promover a Admin'}
                        </button>
                        <button
                          onClick={() => setStatusModalUser(u)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                            u.isActive
                              ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50'
                              : 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                          }`}
                        >
                          {u.isActive ? 'Suspender' : 'Reactivar'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal: Toggle Status */}
      {statusModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  statusModalUser.isActive
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {statusModalUser.isActive ? 'Suspender Usuario' : 'Activar Usuario'}
                </h3>
                <p className="text-xs text-slate-500">{statusModalUser.email}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {statusModalUser.isActive ? (
                <>
                  ¿Estás seguro de suspender a <strong>{statusModalUser.name}</strong>? Se cerrará su sesión de inmediato, no podrá iniciar sesión y el sistema dejará de sincronizar sus reuniones de Google Calendar para no consumir recursos del VPS. Sus grabaciones existentes no se perderán.
                </>
              ) : (
                <>
                  ¿Deseas reactivar la cuenta de <strong>{statusModalUser.name}</strong>? Podrá volver a ingresar al panel y el bot reanudará la asistencia a sus videollamadas con normalidad.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setStatusModalUser(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={handleToggleStatus}
                className={`px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-md transition-all ${
                  statusModalUser.isActive
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {isActionLoading
                  ? 'Procesando...'
                  : statusModalUser.isActive
                  ? 'Confirmar Suspensión'
                  : 'Reactivar Cuenta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Change Role */}
      {roleModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cambiar Rol de Usuario
                </h3>
                <p className="text-xs text-slate-500">{roleModalUser.email}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              ¿Deseas cambiar el rol de <strong>{roleModalUser.name}</strong> a{' '}
              <strong>{roleModalUser.role === 'admin' ? 'Usuario estándar' : 'Administrador'}</strong>?
              {roleModalUser.role !== 'admin'
                ? ' Un administrador podrá gestionar el estado y roles de otros colaboradores.'
                : ' El usuario dejará de tener acceso a esta pantalla de administración.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => setRoleModalUser(null)}
                className="px-4 py-2 text-sm font-medium rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isActionLoading}
                onClick={() => handleChangeRole(roleModalUser.role === 'admin' ? 'user' : 'admin')}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all"
              >
                {isActionLoading ? 'Actualizando...' : 'Confirmar Cambio de Rol'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsersPage;
