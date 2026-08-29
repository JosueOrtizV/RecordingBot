import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';
import { WorkerStatus } from '../types';
import { Radio, Loader2 } from 'lucide-react';

export const ActiveRecordingsBanner: React.FC = () => {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="mb-6 space-y-2">
      {hasActive && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-purple-950/20 to-slate-900 border border-rose-500/30 shadow-lg shadow-rose-950/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <Radio className="w-4 h-4" />
              <span>Grabación en Curso ({status.activeRecordings.length})</span>
            </div>
            <span className="text-xs text-slate-400">Workers Ocupados: {status.workers.active} / {status.workers.total}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
            {status.activeRecordings.map((rec) => (
              <div key={rec.id} className="bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div className="truncate mr-2">
                  <p className="font-medium text-slate-200 truncate">{rec.meeting_title || 'Reunión'}</p>
                  <p className="text-slate-400 text-[11px] truncate">👤 {rec.user_name} • Modo: {rec.recording_mode}</p>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono text-[10px] shrink-0 animate-pulse">
                  EN VIVO
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasQueue && (
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/20 flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span>Cola de espera: <strong>{status.queue.pending}</strong> reunión(es) esperando un worker libre</span>
          </div>
          <span className="text-slate-400">Los workers se asignarán en orden de llegada</span>
        </div>
      )}
    </div>
  );
};
