import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api/client';
import { ScheduledMeeting, Recording } from '../types';
import { Video, Calendar, Disc, ExternalLink, FileText, ArrowRight, Clock, HardDrive, Sparkles, Bot } from 'lucide-react';
import { startOfWeek, endOfWeek, isToday } from 'date-fns';
import { RecordingCardMobile } from '../components/RecordingCardMobile';

export const DashboardPage: React.FC = () => {
  const { user, settings } = useAuth();

  const [upcoming, setUpcoming] = useState<ScheduledMeeting[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [calData, recData] = await Promise.all([
        fetchApi<{ meetings: ScheduledMeeting[] }>('/api/calendar/upcoming'),
        fetchApi<{ recordings: Recording[] }>('/api/recordings?limit=5'),
      ]);
      setUpcoming(calData.meetings || []);
      setRecordings(recData.recordings || []);
    } catch (err) {
      console.warn('Dashboard data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const meetingsThisWeek = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 0 });
    const end = endOfWeek(new Date(), { weekStartsOn: 0 });
    return upcoming.filter((m) => {
      const d = new Date(m.start_time);
      return d >= start && d <= end;
    });
  }, [upcoming]);

  const meetingsToday = useMemo(() => {
    return upcoming.filter((m) => isToday(new Date(m.start_time)));
  }, [upcoming]);

  const driveFolderUrl = useMemo(() => {
    if (settings?.drive_folder_id) {
      return `https://drive.google.com/drive/folders/${settings.drive_folder_id}`;
    }
    const folderName = settings?.drive_folder_name || 'RecordingBot';
    return `https://drive.google.com/drive/search?q=${encodeURIComponent(folderName)}`;
  }, [settings]);


  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Hero / Welcome Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-transparent border border-sky-500/20 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-1.5 z-10">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Sistema Listo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Hola, {user?.name || 'Josué'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl leading-relaxed">
            Tu bot <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.botDisplayName || "Josue's Notetaker"}</span> está monitoreando tu calendario para entrar a tus reuniones y guardar las grabaciones en tu Google Drive.
          </p>
        </div>

        <Link
          to="/join"
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold px-5 py-3 rounded-2xl shadow-md shadow-sky-600/20 transition-all shrink-0 active:scale-95 text-sm z-10"
        >
          <Video className="w-4 h-4" />
          <span>Unirse a Reunión Directa</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {/* Card 1: Reuniones Esta Semana */}
        <Link
          to="/calendar"
          className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:border-sky-500/40 hover:shadow-md hover:scale-[1.01] cursor-pointer group"
          title="Ir al calendario"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Reuniones Esta Semana
              </p>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {meetingsThisWeek.length}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              {meetingsToday.length} {meetingsToday.length === 1 ? 'programada para hoy' : 'programadas para hoy'}
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 group-hover:bg-sky-500/20 group-hover:scale-105 transition-all">
            <Calendar className="w-6 h-6" />
          </div>
        </Link>

        {/* Card 2: Grabaciones Listas */}
        <Link
          to="/recordings"
          className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:border-indigo-500/40 hover:shadow-md hover:scale-[1.01] cursor-pointer group"
          title="Ir al historial de grabaciones"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Grabaciones Listas
              </p>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
              {recordings.length}
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Ver historial completo
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:scale-105 transition-all">
            <Disc className="w-6 h-6" />
          </div>
        </Link>

        {/* Card 3: Carpeta Google Drive */}
        <a
          href={driveFolderUrl}
          target="_blank"
          rel="noreferrer"
          className="p-6 rounded-3xl bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:border-emerald-500/40 hover:shadow-md hover:scale-[1.01] cursor-pointer group"
          title="Abrir carpeta de grabaciones en Google Drive"
        >
          <div className="truncate mr-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Carpeta Drive
              </p>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all" />
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
              {settings?.drive_folder_name || 'RecordingBot'}
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
              <span>Abrir en Drive</span>
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0 group-hover:bg-emerald-500/20 group-hover:scale-105 transition-all">
            <HardDrive className="w-6 h-6" />
          </div>
        </a>
      </div>

      {/* Main Grid: Upcoming Meetings & Recent Recordings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Meetings */}
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-500" />
              <span>Próximas en Calendario</span>
            </h2>
            <Link
              to="/calendar"
              className="text-xs text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 flex items-center gap-1 font-semibold transition-colors"
            >
              Ver calendario completo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">Cargando reuniones...</p>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No hay reuniones programadas para los próximos días.
                </p>
              </div>
            ) : (
              upcoming.slice(0, 4).map((meeting) => {
                const start = new Date(meeting.start_time);
                return (
                  <div
                    key={meeting.id}
                    className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs transition-colors"
                  >
                    <div className="truncate">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {meeting.title}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {start.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' })} a las {start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 flex items-center gap-1 ${
                        meeting.will_record
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Bot className="w-3 h-3" />
                      <span>{meeting.will_record ? 'Programado' : 'Pausado'}</span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Recordings */}
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
              <Disc className="w-4 h-4 text-indigo-500" />
              <span>Últimas Grabaciones</span>
            </h2>
            <Link
              to="/recordings"
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 font-semibold transition-colors"
            >
              Ver historial <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <p className="text-xs text-slate-400 py-6 text-center">Cargando grabaciones...</p>
            ) : recordings.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-500 dark:text-slate-400">Aún no tienes grabaciones registradas.</p>
              </div>
            ) : (
              <>
                {/* Mobile Accordion View (< sm) */}
                <div className="sm:hidden space-y-2.5">
                  {recordings.map((rec) => (
                    <RecordingCardMobile key={rec.id} recording={rec} />
                  ))}
                </div>

                {/* Desktop Compact Rows (>= sm) */}
                <div className="hidden sm:block space-y-2.5">
                  {recordings.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs transition-colors"
                    >
                      <div className="truncate">
                        <Link
                          to={`/recordings/${rec.id}`}
                          className="font-semibold text-slate-900 dark:text-slate-100 truncate hover:text-sky-600 dark:hover:text-sky-400 transition-colors block"
                        >
                          {rec.meeting_title || 'Reunión'}
                        </Link>
                        <p className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                          <span>{new Date(rec.started_at || rec.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {formatDuration(rec.duration_seconds)}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link
                          to={`/recordings/${rec.id}`}
                          title="Ver grabación y transcripción"
                          className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 transition-colors"
                        >
                          <FileText className="w-4 h-4" />
                        </Link>

                        {rec.drive_url && (
                          <a
                            href={rec.drive_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir en Google Drive"
                            className="p-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-emerald-600 dark:text-emerald-400 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
