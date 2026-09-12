import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Recording } from '../types';
import {
  ChevronDown,
  ExternalLink,
  Video,
  Mic,
  FileText,
  Clock,
  Calendar,
  Eye,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Square,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RecordingCardMobileProps {
  recording: Recording;
  onStop?: (recording: { id: string; title: string }) => void;
  onDelete?: (id: string) => void;
  showDelete?: boolean;
}

export const RecordingCardMobile: React.FC<RecordingCardMobileProps> = ({
  recording,
  onStop,
  onDelete,
  showDelete = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const date = new Date(recording.created_at);

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0s';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs overflow-hidden transition-all duration-200">
      {/* Card Header (clickable to toggle expansion) */}
      <div
        onClick={() => setExpanded(!expanded)}
        className="p-3.5 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors select-none"
      >
        {/* Top row: Title + Status Badge */}
        <div className="flex items-start justify-between gap-2.5">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug line-clamp-2">
            {recording.meeting_title || 'Reunión sin título'}
          </h3>

          {/* Status Badge */}
          <div className="shrink-0 pt-0.5">
            {recording.status === 'completed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Completada</span>
              </span>
            ) : recording.status === 'recording' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                <span>En Curso</span>
              </span>
            ) : recording.status === 'failed' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3 h-3 text-rose-500" />
                <span>Fallida</span>
              </span>
            ) : recording.status === 'cancelled' ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-full">
                <XCircle className="w-3 h-3 text-slate-400" />
                <span>Cancelada</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                <span>Pendiente</span>
              </span>
            )}
          </div>
        </div>

        {/* Bottom row: Summary info + Quick "Ver completa" link + Chevron */}
        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
              {format(date, 'd MMM', { locale: es })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
              {formatDuration(recording.duration_seconds)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Direct link to view complete recording */}
            <Link
              to={`/recordings/${recording.id}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold border border-sky-500/20 transition-colors"
              title="Ver grabación completa"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver completa</span>
            </Link>

            {/* Chevron toggle button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              aria-label={expanded ? 'Colapsar detalles' : 'Desplegar detalles'}
              className={`p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-200 ${
                expanded ? 'rotate-180 text-sky-600 dark:text-sky-400' : ''
              }`}
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Details Section (Key-Value structure like reference photo) */}
      {expanded && (
        <div className="px-3.5 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 text-xs space-y-2.5 animate-in fade-in duration-150">
          {/* Key-Value Fields Grid */}
          <div className="space-y-2 pt-2 divide-y divide-slate-200/50 dark:divide-slate-800/60">
            {/* Fecha y Hora completa */}
            <div className="flex items-center justify-between gap-3 pt-1.5 first:pt-0">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Fecha y hora</span>
              <span className="text-slate-800 dark:text-slate-200 font-semibold text-right">
                {format(date, "EEEE, d 'de' MMMM", { locale: es })}, {format(date, 'HH:mm')} hrs
              </span>
            </div>

            {/* Duración */}
            <div className="flex items-center justify-between gap-3 pt-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Duración</span>
              <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold">
                {formatDuration(recording.duration_seconds)}
              </span>
            </div>

            {/* Modo de Grabación */}
            <div className="flex items-center justify-between gap-3 pt-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Formato</span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                {recording.recording_mode === 'video' ? (
                  <>
                    <Video className="w-3.5 h-3.5 text-sky-500" />
                    <span>Video (.mp4)</span>
                  </>
                ) : recording.recording_mode === 'audio' ? (
                  <>
                    <Mic className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Audio (.mp3)</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Solo Minuta</span>
                  </>
                )}
              </span>
            </div>

            {/* Transcripción */}
            <div className="flex items-center justify-between gap-3 pt-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Transcripción</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {recording.has_transcript || recording.transcript_text ? (
                  <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Disponible</span>
                  </span>
                ) : (
                  <span className="text-slate-400">No disponible</span>
                )}
              </span>
            </div>

            {/* Google Meet Link */}
            {recording.meeting_url && (
              <div className="flex items-center justify-between gap-3 pt-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Google Meet</span>
                <a
                  href={recording.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-sky-600 dark:text-sky-400 hover:underline font-mono text-[11px] truncate max-w-[190px] inline-flex items-center gap-1"
                  title={recording.meeting_url}
                >
                  <span className="truncate">{recording.meeting_url.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}

            {/* Google Drive Link */}
            {recording.drive_url && (
              <div className="flex items-center justify-between gap-3 pt-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Google Drive</span>
                <a
                  href={recording.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <span>Ver archivo en Drive</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
              </div>
            )}

            {/* Error or cancellation notice */}
            {recording.error_message && (
              <div className="pt-2 text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20 p-2 rounded-xl border border-rose-200/50 dark:border-rose-900/30">
                <span className="font-bold block">Detalle de estado:</span>
                <span>{recording.error_message}</span>
              </div>
            )}
          </div>

          {/* Action Buttons Bar */}
          <div className="pt-2 flex items-center justify-end gap-2 flex-wrap">
            {/* Stop recording button if active */}
            {(recording.status === 'recording' || recording.status === 'pending') && onStop && (
              <button
                type="button"
                onClick={() => onStop({ id: recording.id, title: recording.meeting_title || 'Reunión' })}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/20 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Detener</span>
              </button>
            )}

            {/* Open in Drive button */}
            {recording.drive_url && (
              <a
                href={recording.drive_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold text-xs transition-colors flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Drive</span>
              </a>
            )}

            {/* Delete button */}
            {showDelete && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(recording.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
                title="Eliminar del historial"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* View Full Recording Page button */}
            <button
              type="button"
              onClick={() => navigate(`/recordings/${recording.id}`)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-xs shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ver grabación</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
