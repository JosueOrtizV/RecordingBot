import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';
import { ScheduledMeeting } from '../types';
import { Calendar, RefreshCw, Clock, Video, Check, Ban, ExternalLink, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const CalendarPage: React.FC = () => {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();

  const loadMeetings = async () => {
    try {
      const data = await fetchApi<{ meetings: ScheduledMeeting[] }>('/api/calendar/upcoming');
      setMeetings(data.meetings || []);
    } catch (err) {
      console.warn('Error loading calendar meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchApi<{ success: boolean; meetings: ScheduledMeeting[] }>('/api/calendar/refresh', {
        method: 'POST',
      });
      setMeetings(data.meetings || []);
    } catch (err: any) {
      alert('Error al sincronizar calendario: ' + err.message);
    } finally {
      setRefreshing(false);
    }
  };

  const toggleRecording = async (meeting: ScheduledMeeting) => {
    const nextState = !meeting.will_record;
    try {
      await fetchApi(`/api/calendar/toggle-record/${meeting.id}`, {
        method: 'PUT',
        body: JSON.stringify({ willRecord: nextState }),
      });
      setMeetings(meetings.map((m) => (m.id === meeting.id ? { ...m, will_record: nextState } : m)));
    } catch (err: any) {
      alert('Error al actualizar: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
            <Calendar className="w-6 h-6 text-sky-400" />
            Calendario de Reuniones
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Reuniones detectadas automáticamente desde tu Google Calendar para los próximos 7 días.
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all shrink-0 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-sky-400 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Sincronizando...' : 'Sincronizar Calendario'}</span>
        </button>
      </div>

      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        {loading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
            <p className="text-xs">Cargando tus reuniones de Google Calendar...</p>
          </div>
        ) : meetings.length === 0 ? (
          <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl space-y-3">
            <Calendar className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">No hay reuniones con Google Meet programadas</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Cualquier evento nuevo que agregues en tu Google Calendar con enlace de Google Meet aparecerá aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {meetings.map((meeting) => {
              const start = new Date(meeting.start_time);
              const end = new Date(meeting.end_time);

              return (
                <div
                  key={meeting.id}
                  className="py-4.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-200 text-sm truncate">{meeting.title}</h3>
                      {meeting.block_reason && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] flex items-center gap-1">
                          <Ban className="w-3 h-3" />
                          {meeting.block_reason}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {start.toLocaleDateString('es-MX', { weekday: 'long', month: 'short', day: 'numeric' })} • {start.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span>•</span>
                      <a
                        href={meeting.meet_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sky-400 hover:text-sky-300 font-mono text-[11px] flex items-center gap-1 hover:underline truncate max-w-[200px]"
                      >
                        {meeting.meet_url}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {/* Toggle auto-record */}
                    <button
                      onClick={() => toggleRecording(meeting)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        meeting.will_record
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 shadow-sm shadow-emerald-500/10 hover:bg-emerald-500/20'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {meeting.will_record ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Bot Activado</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-3.5 h-3.5 text-slate-500" />
                          <span>No Grabar</span>
                        </>
                      )}
                    </button>

                    {/* Join now shortcut */}
                    <button
                      onClick={() => navigate(`/join?url=${encodeURIComponent(meeting.meet_url)}&title=${encodeURIComponent(meeting.title)}`)}
                      title="Entrar ahora mismo con el bot"
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 transition-colors border border-slate-700/80"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
