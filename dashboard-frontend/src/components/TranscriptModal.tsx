import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Copy, Download, Check, FileText } from 'lucide-react';
import { API_BASE } from '../api/client';

interface TranscriptModalProps {
  recordingId: string | null;
  title: string;
  transcript: string | null | undefined;
  onClose: () => void;
}

export const TranscriptModal: React.FC<TranscriptModalProps> = ({
  recordingId,
  title,
  transcript,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!recordingId) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [recordingId, onClose]);

  if (!recordingId) return null;

  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    window.open(`${API_BASE}/api/recordings/${recordingId}/transcript?download=true`, '_blank');
  };

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden transition-colors"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight truncate max-w-xs sm:max-w-md">
                {title}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Transcripción y Minuta de la Reunión</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!transcript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!transcript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors shadow-sm shadow-sky-600/30 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Descargar .txt</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-3 bg-slate-50/50 dark:bg-slate-950/40 select-text">
          {transcript ? (
            transcript.split('\n').map((line, idx) => {
              if (!line.trim()) return <br key={idx} />;
              const isSpeaker = line.startsWith('[') && line.includes(']');
              return (
                <p
                  key={idx}
                  className={
                    isSpeaker
                      ? 'text-sky-700 dark:text-sky-400 font-semibold'
                      : 'text-slate-700 dark:text-slate-300 pl-4'
                  }
                >
                  {line}
                </p>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-400">
              <p>Cargando transcripción...</p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
