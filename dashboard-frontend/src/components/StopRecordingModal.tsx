import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Square, CloudUpload, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { fetchApi } from '../api/client';

interface StopRecordingModalProps {
  recordingId: string;
  meetingTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onStopped: (save: boolean) => void;
}

export const StopRecordingModal: React.FC<StopRecordingModalProps> = ({
  recordingId,
  meetingTitle,
  isOpen,
  onClose,
  onStopped,
}) => {
  const [loading, setLoading] = useState(false);
  const [actionType, setActionType] = useState<'save' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStop = async (save: boolean) => {
    setLoading(true);
    setActionType(save ? 'save' : 'discard');
    setError(null);
    try {
      await fetchApi<{ success: boolean; message: string }>(
        `/api/bot/recordings/${recordingId}/stop`,
        {
          method: 'POST',
          body: JSON.stringify({ save }),
        }
      );
      onStopped(save);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al detener la reunión.');
    } finally {
      setLoading(false);
      setActionType(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={loading ? undefined : onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-7 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <Square className="w-6 h-6 fill-current" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              ¿Detener grabación en vivo?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 font-medium">
              {meetingTitle || 'Reunión en Curso'}
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          El bot saldrá de la reunión de inmediato. ¿Deseas guardar lo que se ha grabado hasta este momento o prefieres descartarlo?
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-3 mb-6">
          {/* Option 1: Guardar y Salir */}
          <button
            onClick={() => handleStop(true)}
            disabled={loading}
            className="w-full text-left p-4 rounded-2xl border-2 border-indigo-500/30 hover:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all flex items-start gap-3.5 group disabled:opacity-50 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              {loading && actionType === 'save' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CloudUpload className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Guardar y Salir
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Sube el progreso grabado a tu Google Drive, guarda la transcripción y genera la minuta con IA.
              </p>
            </div>
          </button>

          {/* Option 2: Descartar y Salir */}
          <button
            onClick={() => handleStop(false)}
            disabled={loading}
            className="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-rose-500/50 hover:bg-rose-50/30 dark:hover:bg-rose-950/20 transition-all flex items-start gap-3.5 group disabled:opacity-50 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              {loading && actionType === 'discard' ? (
                <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
              ) : (
                <Trash2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Descartar y Cancelar
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Descarta la grabación sin subir nada a Drive. Quedará registrada como <strong className="text-rose-600 dark:text-rose-400">Cancelada</strong> sin archivos.
              </p>
            </div>
          </button>
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            Continuar grabando
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
