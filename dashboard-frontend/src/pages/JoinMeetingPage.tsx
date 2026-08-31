import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchApi } from '../api/client';
import { Video, Mic, FileText, Send, CheckCircle2, AlertCircle, Loader2, Radio, Zap, HardDrive } from 'lucide-react';
import { WorkerStatus } from '../types';

export const JoinMeetingPage: React.FC = () => {
  const { settings } = useAuth();
  const [searchParams] = useSearchParams();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState<'video' | 'audio' | 'transcript_only'>('video');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; botId?: string } | null>(null);
  const [workerStatus, setWorkerStatus] = useState<WorkerStatus | null>(null);

  // Auto-populate from URL query params (e.g. when coming from Calendar "Entrar Ahora")
  useEffect(() => {
    const urlParam = searchParams.get('url');
    const titleParam = searchParams.get('title');
    if (urlParam) setUrl(urlParam);
    if (titleParam) setTitle(titleParam);
  }, [searchParams]);

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
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
          <Video className="w-6 h-6 text-sky-500" />
          Unirse a una Reunión (On-Demand)
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ingresa el enlace de cualquier sala de Google Meet para que el bot asista de inmediato a grabar y transcribir.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-6 transition-colors">
          <form onSubmit={handleJoin} className="space-y-5">
            {/* Meet URL */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Enlace de Google Meet <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                  className={`w-full bg-slate-50 dark:bg-slate-950/80 border rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-all font-mono ${
                    isUrlValid === false
                      ? 'border-rose-500/60 focus:border-rose-400'
                      : isUrlValid === true
                      ? 'border-emerald-500/60 focus:border-emerald-400'
                      : 'border-slate-200 dark:border-slate-800 focus:border-sky-500'
                  }`}
                  required
                />
                {isUrlValid === true && (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 absolute right-3.5 top-3.5" />
                )}
              </div>
              {isUrlValid === false && (
                <p className="text-xs text-rose-500 mt-1.5 pl-1">
                  El formato debe ser https://meet.google.com/xxx-xxxx-xxx
                </p>
              )}
            </div>

            {/* Optional Title */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Título o Asunto de la Reunión (Opcional)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Daily Standup con Equipo / Sync de Proyecto"
                className="w-full bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-all"
              />
            </div>

            {/* Recording Mode Selector */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Modo de Grabación para esta sesión
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setMode('video')}
                  className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === 'video'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Video className="w-5 h-5 text-sky-500" />
                  <span className="text-xs font-bold">Video + CC</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Pantalla y Audio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('audio')}
                  className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === 'audio'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Mic className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold">Audio + CC</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Ligero y Rápido</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode('transcript_only')}
                  className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    mode === 'transcript_only'
                      ? 'bg-sky-500/10 border-sky-500 text-sky-700 dark:text-sky-300 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <FileText className="w-5 h-5 text-indigo-500" />
                  <span className="text-xs font-bold">Solo Texto</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Minuta en texto</span>
                </button>
              </div>
            </div>

            {/* Status notification */}
            {result && (
              <div
                className={`p-4 rounded-2xl border text-xs flex items-start gap-3 animate-in fade-in duration-200 ${
                  result.success
                    ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300'
                }`}
              >
                {result.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-semibold">{result.message}</p>
                  {result.botId && (
                    <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
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
              className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-sky-600/25 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-6 rounded-3xl shadow-sm space-y-4 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Radio className="w-4 h-4 text-sky-500" />
              Estado de los Workers
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Workers Disponibles:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {workerStatus ? `${workerStatus.workers.idle} / ${workerStatus.workers.total}` : '...'}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">Reuniones en Cola:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {workerStatus ? workerStatus.queue.pending : '0'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-2.5">
              <div className="flex items-start gap-2">
                <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Ingreso rápido:</strong> El bot tardará entre 10 y 20 segundos en abrir el navegador y entrar a la sala.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <HardDrive className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Google Drive:</strong> Al terminar la reunión, los archivos se sincronizarán en tu cuenta personal.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
