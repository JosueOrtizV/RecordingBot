import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api/client';
import { ScheduledMeeting, Recording } from '../types';
import { Video, Calendar, Disc, ExternalLink, FileText, ArrowRight, Clock, CheckCircle2 } from 'lucide-react';
import { TranscriptModal } from '../components/TranscriptModal';

export const DashboardPage: React.FC = () => {
  const { user, settings } = useAuth();

  const [upcoming, setUpcoming] = useState<ScheduledMeeting[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  // Transcript modal state
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);

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

  const openTranscript = async (id: string, title: string) => {
    setSelectedRecordingId(id);
    setSelectedTitle(title);
    setSelectedTranscript(null);
    try {
      const data = await fetchApi<{ transcript: string }>(`/api/recordings/${id}/transcript`);
      setSelectedTranscript(data.transcript);
    } catch (err: any) {
      setSelectedTranscript('No se pudo cargar la transcripción: ' + err.message);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-sky-900/40 via-indigo-950/40 to-slate-900 border border-sky-500/20 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">
            Bienvenido de vuelta
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight mt-1">
            Hola, {user?.name?.split(' ')[0] || 'Josué'} 👋
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Tu bot <strong>{user?.botDisplayName || "Josue's Notetaker"}</strong> está listo para unirse a tus reuniones y guardar las minutas en tu Google Drive.
          </p>
        </div>

        <Link
          to="/join"
          className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-semibold px-5 py-3 rounded-2xl shadow-lg shadow-sky-500/25 transition-all shrink-0 active:scale-95 text-sm"
        >
          <Video className="w-4 h-4" />
          <span>Unirse a Reunión Directa</span>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Próximas Reuniones</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{upcoming.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Grabaciones Listas</p>
            <p className="text-2xl font-bold text-slate-100 mt-1">{recordings.length}</p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Disc className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Carpeta en Drive</p>
            <p className="text-base font-bold text-slate-100 mt-1 truncate max-w-[150px]">
              {settings?.drive_folder_name || 'RecordingBot'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Grid: Upcoming Meetings & Recent Recordings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upcoming Meetings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              Próximas en Calendario
            </h2>
            <Link to="/calendar" className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 font-medium">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <p className="text-xs text-slate-500 py-6 text-center">Cargando reuniones...</p>
            ) : upcoming.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-400">No hay reuniones de Google Meet en los próximos 7 días.</p>
              </div>
            ) : (
              upcoming.slice(0, 4).map((meeting) => {
                const start = new Date(meeting.start_time);
                return (
                  <div
                    key={meeting.id}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate">
                      <p className="font-semibold text-slate-200 truncate">{meeting.title}</p>
                      <p className="text-slate-400 text-[11px] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {start.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric' })} a las {start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
                        meeting.will_record
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {meeting.will_record ? '🤖 Grabará' : 'Pausado'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Recordings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-100 text-base flex items-center gap-2">
              <Disc className="w-4 h-4 text-indigo-400" />
              Últimas Grabaciones
            </h2>
            <Link to="/recordings" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium">
              Ver historial <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {loading ? (
              <p className="text-xs text-slate-500 py-6 text-center">Cargando grabaciones...</p>
            ) : recordings.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-slate-800 rounded-2xl">
                <p className="text-xs text-slate-400">Aún no tienes grabaciones registradas.</p>
              </div>
            ) : (
              recordings.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="truncate">
                    <p className="font-semibold text-slate-200 truncate">{rec.meeting_title || 'Reunión'}</p>
                    <p className="text-slate-400 text-[11px] flex items-center gap-2 mt-0.5">
                      <span>{new Date(rec.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}</span>
                      <span>•</span>
                      <span>⏱️ {formatDuration(rec.duration_seconds)}</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {rec.has_transcript && (
                      <button
                        onClick={() => openTranscript(rec.id, rec.meeting_title)}
                        title="Ver Transcripción"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    )}

                    {rec.drive_url && (
                      <a
                        href={rec.drive_url}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir en Google Drive"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transcript Viewer Modal */}
      <TranscriptModal
        recordingId={selectedRecordingId}
        title={selectedTitle}
        transcript={selectedTranscript}
        onClose={() => setSelectedRecordingId(null)}
      />
    </div>
  );
};
