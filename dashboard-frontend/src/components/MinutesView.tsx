import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchApi } from '../api/client';
import {
  Sparkles,
  Copy,
  Check,
  Download,
  RotateCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface MinutesViewProps {
  recordingId: string;
  initialMinutes?: string | null;
  meetingTitle?: string;
  hasTranscript?: boolean;
  readOnly?: boolean;
  onMinutesGenerated?: (minutes: string) => void;
}

export const MinutesView: React.FC<MinutesViewProps> = ({
  recordingId,
  initialMinutes,
  meetingTitle = 'Reunión',
  hasTranscript = true,
  readOnly = false,
  onMinutesGenerated,
}) => {
  const [minutes, setMinutes] = useState<string | null>(initialMinutes || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0);
  const minutesDocRef = useRef<HTMLDivElement>(null);

  const loadingSteps = [
    'Leyendo y analizando la transcripción...',
    'Identificando participantes y temas clave...',
    'Sintetizando decisiones y compromisos...',
    'Estructurando la minuta ejecutiva...',
  ];

  useEffect(() => {
    setMinutes(initialMinutes || null);
  }, [initialMinutes]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStepIndex((prev) => (prev + 1) % loadingSteps.length);
      }, 1500);
    } else {
      setLoadingStepIndex(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerateMinutes = async (force: boolean = false) => {
    if (!recordingId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const endpoint = force
        ? `/api/recordings/${recordingId}/minutes?force=true`
        : `/api/recordings/${recordingId}/minutes`;

      const res = await fetchApi<{ success: boolean; minutes: string }>(
        endpoint,
        {
          method: 'POST',
        }
      );

      if (res.success && res.minutes) {
        setMinutes(res.minutes);
        if (onMinutesGenerated) {
          onMinutesGenerated(res.minutes);
        }
      } else {
        throw new Error('No se recibió la minuta generada');
      }
    } catch (err: any) {
      setError(err.message || 'Error al generar la minuta con IA');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!minutes) return;
    try {
      if (minutesDocRef.current && typeof window.ClipboardItem !== 'undefined') {
        // Build rich HTML formatted for emails (Gmail, Outlook, etc.) & Google Docs / Word
        const docHtml = minutesDocRef.current.innerHTML;
        const styledHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">
            ${docHtml}
          </div>
        `;
        const blobHtml = new Blob([styledHtml], { type: 'text/html' });
        const blobText = new Blob([minutesDocRef.current.innerText || minutes], { type: 'text/plain' });

        const item = new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(minutes);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Rich text copy fallback to plain text:', err);
      try {
        await navigator.clipboard.writeText(minutes);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (copyErr) {
        console.error('Clipboard copy failed:', copyErr);
      }
    }
  };

  const handleDownload = () => {
    if (!minutes) return;
    const blob = new Blob([minutes], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = (meetingTitle || 'minuta').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    link.href = url;
    link.download = `${safeTitle}_minuta_ia.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // State: Currently generating
  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-8 sm:p-12 shadow-sm text-center space-y-6">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 rounded-3xl bg-indigo-500/20 dark:bg-indigo-500/30 animate-ping" />
          <div className="relative w-16 h-16 rounded-3xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-8 h-8 animate-pulse" />
          </div>
        </div>

        <div className="space-y-2 max-w-md mx-auto">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            Generando Minuta con IA
          </h3>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 transition-all duration-300">
            {loadingSteps[loadingStepIndex]}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Esto toma generalmente entre 3 y 6 segundos.
          </p>
        </div>

        <div className="w-48 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full w-2/3 rounded-full animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    );
  }

  // State: No minutes yet (Empty state)
  if (!minutes) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm space-y-6">
        <div className="max-w-md mx-auto text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-200/60 dark:border-indigo-800/60 shadow-sm">
            <Sparkles className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Minuta Inteligente con IA
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Transforma la transcripción de esta reunión en una minuta ejecutiva estructurada con resumen, acuerdos, tareas asignadas y temas clave.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Feature Highlights */}
          <div className="grid grid-cols-2 gap-2 text-left pt-2">
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Resumen Ejecutivo
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Decisiones Clave
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Tabla de Tareas
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Puntos Abiertos
              </span>
            </div>
          </div>

          {!readOnly ? (
            <div className="pt-2">
              <button
                onClick={() => handleGenerateMinutes(false)}
                disabled={!hasTranscript}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generar Minuta con IA</span>
              </button>
              {!hasTranscript && (
                <p className="text-[11px] text-amber-500 dark:text-amber-400 mt-2 font-medium">
                  ⚠️ Esta grabación no tiene transcripción disponible para analizar.
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">
              El propietario aún no ha generado la minuta con IA para esta grabación.
            </p>
          )}
        </div>
      </div>
    );
  }

  // State: Minutes rendered as Document
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-sm space-y-5 transition-colors">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-sm shadow-indigo-500/20 shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Minuta Inteligente
            </h2>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              Documento estructurado listo para compartir
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            title="Copiar minuta en formato enriquecido para correo o documento"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar</span>
              </>
            )}
          </button>

          {/* Download Markdown */}
          <button
            onClick={handleDownload}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            title="Descargar documento en Markdown (.md)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar .md</span>
          </button>

          {/* Regenerate Button (Only for owner/authenticated user) */}
          {!readOnly && (
            <button
              onClick={() => handleGenerateMinutes(true)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
              title="Regenerar minuta con el prompt actual"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Regenerar</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Rendered Markdown Document */}
      <div
        ref={minutesDocRef}
        className="prose prose-slate dark:prose-invert max-w-none text-xs sm:text-sm space-y-4 leading-relaxed max-h-[680px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node, ...props }) => (
              <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight pb-2 border-b border-slate-200 dark:border-slate-800 mt-2 mb-4" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight mt-6 mb-2.5 flex items-center gap-2 text-indigo-600 dark:text-indigo-400" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-4 mb-2" {...props} />
            ),
            p: ({ node, ...props }) => (
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed mb-3" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc list-outside pl-5 space-y-1.5 text-slate-700 dark:text-slate-300 mb-4" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal list-outside pl-5 space-y-1.5 text-slate-700 dark:text-slate-300 mb-4" {...props} />
            ),
            li: ({ node, ...props }) => (
              <li className="text-slate-700 dark:text-slate-300 leading-normal" {...props} />
            ),
            blockquote: ({ node, ...props }) => (
              <blockquote className="border-l-4 border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-r-2xl my-3 italic text-slate-600 dark:text-slate-400 text-xs" {...props} />
            ),
            table: ({ node, ...props }) => (
              <div className="overflow-x-auto my-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs" {...props} />
              </div>
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-slate-50 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th className="px-3.5 py-2.5 font-bold uppercase tracking-wider text-[11px] text-slate-600 dark:text-slate-400" {...props} />
            ),
            td: ({ node, ...props }) => (
              <td className="px-3.5 py-2.5 border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 align-top" {...props} />
            ),
            strong: ({ node, ...props }) => (
              <strong className="font-bold text-slate-900 dark:text-slate-100" {...props} />
            ),
            hr: ({ node, ...props }) => (
              <hr className="my-6 border-slate-200 dark:border-slate-800" {...props} />
            ),
          }}
        >
          {minutes}
        </ReactMarkdown>
      </div>
    </div>
  );
};
