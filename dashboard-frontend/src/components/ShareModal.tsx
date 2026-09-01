import React, { useState } from 'react';
import { X, Globe, Lock, Users, Copy, Check, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { fetchApi } from '../api/client';

interface ShareModalProps {
  recordingId: string;
  meetingTitle: string;
  initialAccess?: 'private' | 'registered' | 'public';
  initialShareToken?: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess: (newAccess: 'private' | 'registered' | 'public', newShareToken?: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  recordingId,
  meetingTitle,
  initialAccess = 'private',
  initialShareToken,
  isOpen,
  onClose,
  onUpdateSuccess,
}) => {
  const [selectedAccess, setSelectedAccess] = useState<'private' | 'registered' | 'public'>(initialAccess);
  const [shareToken, setShareToken] = useState<string | undefined>(initialShareToken);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const publicUrl = shareToken
    ? `${window.location.origin}/r/${shareToken}`
    : `${window.location.origin}/r/...`;

  const handleSave = async (accessToSave = selectedAccess) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{
        success: boolean;
        shareToken?: string;
        shareAccess: 'private' | 'registered' | 'public';
        shareUrl?: string;
      }>(`/api/recordings/${recordingId}/share`, {
        method: 'PUT',
        body: JSON.stringify({ access: accessToSave }),
      });

      setSelectedAccess(data.shareAccess);
      setShareToken(data.shareToken);
      onUpdateSuccess(data.shareAccess, data.shareToken);
    } catch (err: any) {
      setError(err.message || 'Error al actualizar configuración de compartir');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareToken) {
      handleSave('public').then(() => {
        // will update token
      });
      return;
    }
    navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAccessChange = (access: 'private' | 'registered' | 'public') => {
    setSelectedAccess(access);
    handleSave(access);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-colors">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">
                Compartir Grabación
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs sm:max-w-sm">
                {meetingTitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 text-xs">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* Access Levels Radio List */}
          <div className="space-y-2.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              ¿Quién puede acceder a este enlace?
            </label>

            {/* Option 1: Public */}
            <div
              onClick={() => !loading && handleAccessChange('public')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                selectedAccess === 'public'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    Pública (Cualquiera con el enlace)
                  </span>
                  <input
                    type="radio"
                    checked={selectedAccess === 'public'}
                    onChange={() => {}}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Cualquier persona con el enlace podrá ver el video y la transcripción, sin necesidad de tener cuenta.
                </p>
              </div>
            </div>

            {/* Option 2: Registered Only */}
            <div
              onClick={() => !loading && handleAccessChange('registered')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                selectedAccess === 'registered'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 mt-0.5">
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    Solo Usuarios Registrados
                  </span>
                  <input
                    type="radio"
                    checked={selectedAccess === 'registered'}
                    onChange={() => {}}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  Solo miembros de tu equipo con cuenta activa en RecordingBot podrán abrir la grabación.
                </p>
              </div>
            </div>

            {/* Option 3: Private */}
            <div
              onClick={() => !loading && handleAccessChange('private')}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex items-start gap-3.5 ${
                selectedAccess === 'private'
                  ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className="p-2 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                    Privada (Solo tú)
                  </span>
                  <input
                    type="radio"
                    checked={selectedAccess === 'private'}
                    onChange={() => {}}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                  El enlace compartido se desactiva. Solo tú puedes ver esta grabación desde tu panel.
                </p>
              </div>
            </div>
          </div>

          {/* Share Link Box (if shared) */}
          {selectedAccess !== 'private' && (
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Enlace para compartir
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-3.5 py-2 font-mono text-xs text-slate-800 dark:text-slate-200 truncate">
                  {publicUrl}
                </div>
                <button
                  onClick={handleCopyLink}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all active:scale-95 shadow-sm shadow-indigo-600/30 shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </div>

              {shareToken && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Enlace activo y listo para compartir
                  </span>
                  <a
                    href={`/r/${shareToken}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Abrir vista previa</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-indigo-600 mr-auto">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Guardando cambios en Google Drive...</span>
            </div>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
