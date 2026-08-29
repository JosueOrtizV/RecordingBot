import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api/client';
import { Video, Mic, FileText, Send, CheckCircle2, AlertCircle, Loader2, Radio } from 'lucide-react';
import { WorkerStatus } from '../types';

export const JoinMeetingPage: React.FC = () => {
  const { settings } = useAuth();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'video' | 'audio' | 'transcript_only'>('video');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; botId?: string } | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);

  // Sync default mode with user settings
  useEffect(() => {
    if (settings) {
      if (settings.enable_video) setMode('video');
      else if (settings.enable_audio) setMode('audio');
      else setMode('transcript_only');
    }
  }, [settings]);

  const fetchStatus = async () => {
    try {
      const data = await fetchApi<WorkerStatus>('/api/bot/status');
      setWorkerStatus(data);
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const isValidMeetUrl = (str: string) => {
    return /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}([\?#].*)?$/i.test(str.trim());
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    if (!isValidMeetUrl(url)) {
      setResult({
        success: false,
        message: 'Por favor ingresa un enlace válido de Google Meet (ej. https://meet.google.com/abc-defg-hij)',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const data = await fetchApi<{ success: boolean; message: string; botId: string; estimatedWait: string }>(
        '/api/bot/join',
        {
          method: 'POST',
          body: JSON.stringify({
            url: url.trim(),
            meetingTitle: title.trim() || undefined,
            recordingMode: mode,
          }),
        }
      );

      setResult({
        success: true,
        message: `${data.message} (${data.estimatedWait})`,
        botId: data.botId,
      });

      setUrl('');
      setTitle('');
      fetchStatus();
    } catch (err: any) {
      setResult({
        success: false,
        message: err.message || 'Error al despachar el bot a la reunión',
      });
    } finally {
      setLoading(false);
    }
  };

  const isUrlValid = url.trim() ? isValidMeetUrl(url) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2.5">
          <Video className="w-6 h-6 text-sky-400" />
          Unirse a una Reunión (On-Demand)
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Pega el enlace de cualquier Google Meet para que el bot ingrese de inmediato a grabar y transcribir.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
          <form onSubmit={handleJoin} className="space-y-5">
            {/* Meet URL */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Enlace de Google Meet <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className={`w-full bg-slate-950/80 border rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none transition-all font-mono ${
                    isUrlValid === false
                      ? 'border-rose-500/60 focus:border-rose-400'
                      : isUrlValid === true
                      ? 'border-emerald-500/60 focus:border-emerald-400'
                      : 'border-slate-800 focus:border-sky-500'
                  }`}
                  required
                />
                {isUrlValid === true && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 absolute right-3.5 top-3.5" />
                )}
              </div>
              {isUrlValid === false && (
                <p className="text-xs text-rose-400 mt-1.5 pl-1">
                  El formato debe ser https://meet.google.com/xxx-xxxx-xxx
                </p>
              )}
            </div>

            {/* Optional Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Título o Asunto de la Reunión (Opcional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Daily Standup con Equipo / Sync de Proyecto"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            {/* Recording Mode Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Modo de Grabación para esta sesión
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('video')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    mode === 'video'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-300 shadow-md shadow-sky-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Video className="w-5 h-5" />
                  <span className="text-xs font-semibold">Video + CC</span>
                  <span className="text-[10px] text-slate-500">Video y Audio completo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('audio')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    mode === 'audio'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-300 shadow-md shadow-sky-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <Mic className="w-5 h-5" />
                  <span className="text-xs font-semibold">Audio + CC</span>
                  <span className="text-[10px] text-slate-500">Ligero y optimizado</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('transcript_only')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all ${
                    mode === 'transcript_only'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-300 shadow-md shadow-sky-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <FileText className="w-5 h-5" />
                  <span className="text-xs font-semibold">Solo Transcripción</span>
                  <span className="text-[10px] text-slate-500">Minuta en texto puro</span>
                </button>
              </div>
            </div>

            {/* Status notification */}
            {result && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in duration-200 ${
                  result.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{result.message}</p>
                  {result.botId && (
                    <p className="text-[11px] font-mono text-emerald-400/80 mt-0.5">
                      Bot ID: {result.botId}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-lg shadow-sky-500/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Despachando Bot...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Despachar Bot a la Reunión</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right Info Box */}
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-3xl space-y-4">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-400" />
              Estado de los Workers
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Workers Disponibles:</span>
                <span className="font-semibold text-emerald-400">
                  {workerStatus ? `${workerStatus.workers.idle} / ${workerStatus.workers.total}` : '...'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                <span className="text-slate-400">Reuniones en Cola:</span>
                <span className="font-semibold text-slate-200">
                  {workerStatus ? workerStatus.queue.pending : '0'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-2">
              <p>⚡ <strong>Tiempo de ingreso:</strong> El bot tardará entre 10 a 20 segundos en abrir el navegador y solicitar acceso.</p>
              <p>📁 <strong>Google Drive:</strong> Al terminar la reunión, el archivo se subirá automáticamente a tu carpeta configurada.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
