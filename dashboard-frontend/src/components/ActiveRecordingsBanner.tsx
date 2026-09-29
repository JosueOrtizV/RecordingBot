import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';
import { WorkerStatus } from '../types';
import { Radio, Loader2, User, Video, Mic, FileText, Square, Pause, Play } from 'lucide-react';
import { StopRecordingModal } from './StopRecordingModal';

export const ActiveRecordingsBanner: React.FC = () => {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRecording, setSelectedRecording] = useState<{ id: string; title: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await fetchApi<WorkerStatus>('/api/bot/status');
      setStatus(data);
    } catch (err) {
      console.warn('Could not fetch bot status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async (id: string) => {
    setActionLoading(id);
    try {
      await fetchApi(`/api/bot/recordings/${id}/pause`, { method: 'POST' });
      await fetchStatus();
    } catch (err: any) {
      alert(err?.message || 'Error al pausar la grabación');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(id);
    try {
      await fetchApi(`/api/bot/recordings/${id}/resume`, { method: 'POST' });
      await fetchStatus();
    } catch (err: any) {
      alert(err?.message || 'Error al reanudar la grabación');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !status) return null;

  const hasActive = status.activeRecordings && status.activeRecordings.length > 0;
  const hasQueue = status.queue.pending > 0;

  if (!hasActive && !hasQueue) return null;

  return (
    <div className="mb-6 space-y-3">
      {hasActive && (
        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-rose-500/10 via-indigo-500/10 to-sky-500/10 border border-rose-500/30 dark:border-rose-500/20 shadow-lg shadow-rose-500/5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <Radio className="w-4 h-4" />
              <span>Grabación en Vivo ({status.activeRecordings.length})</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Bot Activo</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {status.activeRecordings.map((rec) => {
              const isPaused = rec.status === 'paused';
              return (
                <div
                  key={rec.id}
                  className="bg-white/95 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs shadow-sm"
                >
                  <div className="truncate mr-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {rec.meeting_title || 'Reunión en Curso'}
                    </p>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-1.5 mt-0.5 truncate">
                      <User className="w-3 h-3 text-slate-400" />
                      <span>{rec.user_name}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 font-medium capitalize">
                        {rec.recording_mode === 'video' ? (
                          <>
                            <Video className="w-3 h-3 text-sky-500" />
                            <span>Video</span>
                          </>
                        ) : rec.recording_mode === 'audio' ? (
                          <>
                            <Mic className="w-3 h-3 text-emerald-500" />
                            <span>Audio</span>
                          </>
                        ) : (
                          <>
                            <FileText className="w-3 h-3 text-indigo-500" />
                            <span>Texto</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPaused ? (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-mono text-[10px] font-bold">
                        EN PAUSA
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-mono text-[10px] font-bold animate-pulse">
                        GRABANDO
                      </span>
                    )}

                    {isPaused ? (
                      <button
                        onClick={() => handleResume(rec.id)}
                        disabled={actionLoading === rec.id}
                        title="Reanudar grabación"
                        className="px-2.5 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {actionLoading === rec.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 fill-current" />
                        )}
                        <span>Reanudar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePause(rec.id)}
                        disabled={actionLoading === rec.id}
                        title="Pausar grabación"
                        className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition-all flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer active:scale-95 disabled:opacity-50"
                      >
                        {actionLoading === rec.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Pause className="w-3 h-3 fill-current" />
                        )}
                        <span>Pausar</span>
                      </button>
                    )}

                    <button
                      onClick={() => setSelectedRecording({ id: rec.id, title: rec.meeting_title || 'Reunión en Curso' })}
                      title="Detener grabación"
                      className="px-2.5 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-500/20 transition-all flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer active:scale-95"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Detener</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {hasQueue && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            <span>
              Cola de espera: <strong>{status.queue.pending}</strong> reunión(es) esperando worker
            </span>
          </div>
          <span className="text-slate-500 dark:text-slate-400 hidden sm:inline text-[11px]">
            Asignación automática por orden de llegada
          </span>
        </div>
      )}

      {selectedRecording && (
        <StopRecordingModal
          recordingId={selectedRecording.id}
          meetingTitle={selectedRecording.title}
          isOpen={true}
          onClose={() => setSelectedRecording(null)}
          onStopped={() => {
            fetchStatus();
          }}
        />
      )}
    </div>
  );
};
