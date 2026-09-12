import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { Recording, RecordingStats } from '../types';
import { showToast, showConfirm } from '../utils/swal';
import {
  Disc,
  FileText,
  ExternalLink,
  Trash2,
  Video,
  Mic,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Calendar,
  Search,
  X,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Activity,
  Eye,
  Square,
  XCircle,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { StopRecordingModal } from '../components/StopRecordingModal';
import { RecordingCardMobile } from '../components/RecordingCardMobile';

type TimeRangeFilter = 'today' | 'week' | 'month' | 'all';
type ModeFilter = 'all' | 'video' | 'audio' | 'transcript_only';
type StatusFilter = 'all' | 'completed' | 'recording' | 'failed' | 'cancelled';

export const RecordingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedForStop, setSelectedForStop] = useState<{ id: string; title: string } | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [stats, setStats] = useState<RecordingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filter States - Default to 'week'
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [onlyTranscript, setOnlyTranscript] = useState(false);

  // Date labels for tabs
  const now = new Date();
  const weekLabel = useMemo(() => {
    const start = startOfWeek(now, { weekStartsOn: 1 });
    const end = endOfWeek(now, { weekStartsOn: 1 });
    return `${format(start, 'd MMM', { locale: es })} – ${format(end, 'd MMM', { locale: es })}`;
  }, []);

  const monthLabel = useMemo(() => {
    return format(now, 'MMMM yyyy', { locale: es });
  }, []);

  const loadRecordings = async (pageNumber = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(pageNumber));
      params.set('limit', '15');
      params.set('timeRange', timeRange);

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      if (modeFilter !== 'all') {
        params.set('mode', modeFilter);
      }
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }
      if (onlyTranscript) {
        params.set('hasTranscript', 'true');
      }

      const data = await fetchApi<{
        recordings: Recording[];
        pagination: { totalPages: number; page: number; total: number };
        stats: RecordingStats;
      }>(`/api/recordings?${params.toString()}`);

      setRecordings(data.recordings || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setPage(pageNumber);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.warn('Error loading recordings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reload when discrete filters change
  useEffect(() => {
    loadRecordings(1);
  }, [timeRange, modeFilter, statusFilter, onlyTranscript]);

  // Debounced search handler
  useEffect(() => {
    const timer = setTimeout(() => {
      loadRecordings(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const deleteRecording = async (id: string) => {
    const confirmed = await showConfirm({
      title: '¿Eliminar registro?',
      text: 'Se eliminará este registro del historial del bot. El archivo en Google Drive se conservará intacto.',
      confirmText: 'Sí, eliminar',
      cancelText: 'Cancelar',
      isDestructive: true,
    });
    if (!confirmed) return;

    try {
      await fetchApi(`/api/recordings/${id}`, { method: 'DELETE' });
      showToast.success('Registro eliminado', 'La reunión se quitó del historial.');
      loadRecordings(page);
    } catch (err: any) {
      showToast.error('Error al eliminar', err.message || 'No se pudo eliminar el registro.');
    }
  };

  const resetFilters = () => {
    setTimeRange('week');
    setSearchQuery('');
    setModeFilter('all');
    setStatusFilter('all');
    setOnlyTranscript(false);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const hasActiveFilters = searchQuery.trim() !== '' || modeFilter !== 'all' || statusFilter !== 'all' || onlyTranscript;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
            <Disc className="w-6 h-6 text-indigo-500" />
            Historial de Grabaciones
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Consulta, reproduce y descarga las grabaciones y minutas generadas por tu bot en Google Drive.
          </p>
        </div>

        <button
          onClick={() => loadRecordings(page)}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 shadow-sm transition-all active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Stats Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Disc className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {timeRange === 'today' ? 'Grabaciones Hoy' : timeRange === 'week' ? 'Esta Semana' : timeRange === 'month' ? 'Este Mes' : 'Total Grabaciones'}
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {stats?.totalCount ?? recordings.length}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Tiempo Total Grabado
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {formatDuration(stats?.totalSeconds)}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-sm flex items-center gap-3.5 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Minutas con IA
            </div>
            <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 font-mono">
              {stats?.withTranscriptCount ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-5 transition-colors">
        
        {/* Controls Toolbar: Time Range Pills & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          
          {/* Time Range Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 rounded-2xl overflow-x-auto">
            <button
              onClick={() => setTimeRange('today')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                timeRange === 'today'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/40 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>Hoy</span>
              {stats?.countsByRange !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  timeRange === 'today'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}>
                  {stats.countsByRange.today}
                </span>
              )}
            </button>

            <button
              onClick={() => setTimeRange('week')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                timeRange === 'week'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/40 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
              title={weekLabel}
            >
              <span>Esta semana</span>
              {stats?.countsByRange !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  timeRange === 'week'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}>
                  {stats.countsByRange.week}
                </span>
              )}
            </button>

            <button
              onClick={() => setTimeRange('month')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                timeRange === 'month'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/40 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
              title={monthLabel}
            >
              <span>Este mes</span>
              {stats?.countsByRange !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  timeRange === 'month'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}>
                  {stats.countsByRange.month}
                </span>
              )}
            </button>

            <button
              onClick={() => setTimeRange('all')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
                timeRange === 'all'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/40 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              <span>Todas</span>
              {stats?.countsByRange !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                  timeRange === 'all'
                    ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }`}>
                  {stats.countsByRange.all}
                </span>
              )}
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por reunión o enlace..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Bar: Mode, Status & Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Mode Select */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-2xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Modo:</span>
              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
                className="bg-transparent text-slate-800 dark:text-slate-100 font-semibold focus:outline-none text-xs cursor-pointer dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 [&>option]:bg-white [&>option]:text-slate-800"
              >
                <option value="all">Todos los modos</option>
                <option value="video">Video (.mp4)</option>
                <option value="audio">Audio (.mp3)</option>
                <option value="transcript_only">Solo Minuta (Texto)</option>
              </select>
            </div>

            {/* Status Select */}
            <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl shadow-2xs">
              <Activity className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 shrink-0" />
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Estado:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="bg-transparent text-slate-800 dark:text-slate-100 font-semibold focus:outline-none text-xs cursor-pointer dark:[&>option]:bg-slate-900 dark:[&>option]:text-slate-100 [&>option]:bg-white [&>option]:text-slate-800"
              >
                <option value="all">Todos los estados</option>
                <option value="completed">Completadas</option>
                <option value="recording">En Curso</option>
                <option value="failed">Fallidas</option>
                <option value="cancelled">Canceladas</option>
              </select>
            </div>

            {/* Transcript Toggle Pill */}
            <button
              onClick={() => setOnlyTranscript(!onlyTranscript)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border transition-all ${
                onlyTranscript
                  ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-300 dark:border-indigo-700/80 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-2xs'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Solo con Transcripción</span>
            </button>
          </div>

          {/* Active Filter Clear */}
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Content Table / Empty State */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
            <p className="text-xs font-medium">Cargando grabaciones...</p>
          </div>
        ) : recordings.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-600">
              <Disc className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {hasActiveFilters
                  ? 'No se encontraron grabaciones con los filtros seleccionados'
                  : timeRange === 'today'
                  ? 'No hay grabaciones realizadas hoy'
                  : timeRange === 'week'
                  ? 'No hay grabaciones registradas en esta semana'
                  : 'No hay grabaciones registradas'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                {hasActiveFilters
                  ? 'Intenta buscar con otro término o restablece los filtros para ver más resultados.'
                  : 'Cuando tu bot asista a tus reuniones, los enlaces directos a Google Drive y las minutas automáticas se listarán aquí.'}
              </p>
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                <span>Mostrar todas las de esta semana</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="pb-3 font-bold">Reunión</th>
                  <th className="pb-3 font-bold">Fecha y Hora</th>
                  <th className="pb-3 font-bold">Duración</th>
                  <th className="pb-3 font-bold">Modo</th>
                  <th className="pb-3 font-bold">Estado</th>
                  <th className="pb-3 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {recordings.map((rec) => {
                  const date = new Date(rec.created_at);

                  return (
                    <tr
                      key={rec.id}
                      onClick={() => navigate(`/recordings/${rec.id}`)}
                      className="hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors group cursor-pointer"
                    >
                      {/* Meeting Title & Meet Link */}
                      <td className="py-4 pr-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 max-w-[260px] truncate text-[13px] group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {rec.meeting_title || 'Reunión sin título'}
                        </div>
                        {rec.meeting_url && (
                          <a
                            href={rec.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 truncate max-w-[260px] mt-0.5"
                            title={`Abrir Google Meet: ${rec.meeting_url}`}
                          >
                            <span className="truncate">{rec.meeting_url}</span>
                            <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                          </a>
                        )}
                      </td>

                      {/* Date and Time */}
                      <td className="py-4 pr-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{format(date, 'd MMM yyyy', { locale: es })}</span>
                        </div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-mono pl-5">
                          {format(date, 'HH:mm')} hrs
                        </span>
                      </td>

                      {/* Duration */}
                      <td className="py-4 pr-4 text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold">{formatDuration(rec.duration_seconds)}</span>
                        </div>
                      </td>

                      {/* Mode Badge */}
                      <td className="py-4 pr-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl font-bold border border-slate-200/50 dark:border-slate-700/50">
                          {rec.recording_mode === 'video' ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-sky-500" />
                              <span>Video (.mp4)</span>
                            </>
                          ) : rec.recording_mode === 'audio' ? (
                            <>
                              <Mic className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Audio (.mp3)</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Solo Minuta</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 pr-4 whitespace-nowrap">
                        {rec.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Completada
                          </span>
                        ) : rec.status === 'recording' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-bold animate-pulse">
                            En Curso
                          </span>
                        ) : rec.status === 'failed' ? (
                          <span
                            title={rec.error_message || 'Error desconocido'}
                            className="inline-flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-bold cursor-help"
                          >
                            <AlertCircle className="w-3 h-3" />
                            Fallida
                          </span>
                        ) : rec.status === 'cancelled' ? (
                          <span
                            title={rec.error_message || 'Cancelada por el usuario'}
                            className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2.5 py-0.5 rounded-full font-bold"
                          >
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Cancelada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-bold">
                            Pendiente
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {(rec.status === 'recording' || rec.status === 'pending') && (
                            <button
                              onClick={() => setSelectedForStop({ id: rec.id, title: rec.meeting_title || 'Reunión' })}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/20 font-bold text-[11px] transition-all active:scale-95 cursor-pointer"
                              title="Detener o cancelar grabación"
                            >
                              <Square className="w-3 h-3 fill-current" />
                              <span>Detener</span>
                            </button>
                          )}

                          <button
                            onClick={() => navigate(`/recordings/${rec.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] transition-all active:scale-95 shadow-xs shadow-indigo-600/30"
                            title="Ver grabación, reproductor y transcripción"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </button>

                          {rec.drive_url && (
                            <a
                              href={rec.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold text-[11px] transition-colors border border-emerald-500/20 shadow-xs"
                              title="Abrir en Google Drive"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Drive</span>
                            </a>
                          )}

                          <button
                            onClick={() => deleteRecording(rec.id)}
                            title="Eliminar del historial"
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Accordion Cards View (visible only on mobile) */}
          <div className="md:hidden space-y-3">
            {recordings.map((rec) => (
              <RecordingCardMobile
                key={rec.id}
                recording={rec}
                onStop={(r) => setSelectedForStop(r)}
                onDelete={(id) => deleteRecording(id)}
                showDelete={true}
              />
            ))}
          </div>

          {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-5 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Página <span className="font-bold text-slate-800 dark:text-slate-200">{page}</span> de <span className="font-bold text-slate-800 dark:text-slate-200">{totalPages}</span>
                  {stats?.totalCount ? ` (${stats.totalCount} resultados)` : ''}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadRecordings(page - 1)}
                    disabled={page <= 1 || loading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Anterior</span>
                  </button>
                  <button
                    onClick={() => loadRecordings(page + 1)}
                    disabled={page >= totalPages || loading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>Siguiente</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedForStop && (
        <StopRecordingModal
          recordingId={selectedForStop.id}
          meetingTitle={selectedForStop.title}
          isOpen={true}
          onClose={() => setSelectedForStop(null)}
          onStopped={() => {
            loadRecordings(page);
          }}
        />
      )}
    </div>
  );
};

