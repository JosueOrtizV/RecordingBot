import React, { useState } from 'react';
import { X, Copy, Download, Check, FileText } from 'lucide-react';
import { API_BASE } from '../api/client';

interface TranscriptModalProps {
  recordingId: string | null;
  title: string;
  transcript: string | null;
  onClose: () => void;
}

export const TranscriptModal: React.FC<TranscriptModalProps> = ({
  recordingId,
  title,
  transcript,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-100 text-base leading-tight truncate max-w-md">{title}</h2>
              <p className="text-xs text-slate-400">Transcripción de la reunión</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={!transcript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors border border-slate-700 disabled:opacity-50"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado' : 'Copiar'}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!transcript}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition-colors shadow-sm shadow-sky-600/30 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar .txt</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto font-mono text-xs leading-relaxed text-slate-300 space-y-3 bg-slate-950/40 select-text">
          {transcript ? (
            transcript.split('\n').map((line, idx) => {
              if (!line.trim()) return <br key={idx} />;
              const isSpeaker = line.startsWith('[') && line.includes(']');
              return (
                <p key={idx} className={isSpeaker ? 'text-sky-300' : 'text-slate-300 pl-4'}>
                  {line}
                </p>
              );
            })
          ) : (
            <div className="text-center py-12 text-slate-500">
              <p>Cargando transcripción...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
