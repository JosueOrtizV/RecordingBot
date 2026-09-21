import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { Recording } from '../types';
import {
  ChevronLeft,
  Disc,
  ExternalLink,
  Share2,
  Video,
  Mic,
  FileText,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Lock,
  Users,
  HardDrive,
  Info,
  Square,
  XCircle,
} from 'lucide-react';
import { TranscriptView } from '../components/TranscriptView';
import { MinutesView } from '../components/MinutesView';
import { ShareModal } from '../components/ShareModal';
import { StopRecordingModal } from '../components/StopRecordingModal';
import { TranscriptModal } from '../components/TranscriptModal';
import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const RecordingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [stopModalOpen, setStopModalOpen] = useState(false);
  const [transcriptModalOpen, setTranscriptModalOpen] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'media' | 'transcript' | 'minutes'>('media');
  const [rightColumnTab, setRightColumnTab] = useState<'transcript' | 'minutes'>('minutes');

  const loadRecording = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApi<{ recording: Recording }>(`/api/recordings/${id}`);
      setRecording(data.recording);
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar la grabación');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecording();
  }, [id]);

  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '0 min';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm font-medium">Cargando grabación y transcripción...</p>
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-3xl bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {error || 'Grabación no encontrada'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          El registro solicitado no existe o no cuentas con los permisos necesarios para consultarlo.
        </p>
        <button
          onClick={() => navigate('/recordings')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Volver al historial</span>
        </button>
      </div>
    );
  }

  const recordingDate = new Date(recording.created_at);
  const isVideo = recording.recording_mode === 'video';
  const isAudio = recording.recording_mode === 'audio';
  const driveFileId =
    recording.drive_file_id ||
    (recording.drive_url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      recording.drive_url?.match(/[?&]id=([a-zA-Z0-9_-]+)/))?.[1];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/recordings"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Volver a Grabaciones</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              {recording.meeting_title || 'Reunión sin título'}
            </h1>

            {/* Mode Badge */}
            <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
              {isVideo ? (
                <>
                  <Video className="w-3.5 h-3.5 text-sky-500" />
                  <span>Video MP4</span>
                </>
              ) : isAudio ? (
                <>
                  <Mic className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Audio MP3</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Solo Minuta</span>
                </>
              )}
            </span>

            {/* Status Badges */}
            {recording.status === 'completed' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" />
                Completada
              </span>
            )}
            {recording.status === 'recording' && (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                Grabando en Vivo
              </span>
            )}
            {recording.status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                En Cola
              </span>
            )}
            {recording.status === 'cancelled' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                <XCircle className="w-3 h-3 text-slate-400" />
                Cancelada
              </span>
            )}
            {recording.status === 'failed' && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <AlertCircle className="w-3 h-3" />
                Fallida
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium pt-0.5">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              {format(recordingDate, "d 'de' MMMM, yyyy", { locale: es })}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {format(recordingDate, 'HH:mm')} hrs ({formatDuration(recording.duration_seconds)})
            </span>
            {recording.meeting_url && (
              <>
                <span>•</span>
                <a
                  href={recording.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 font-mono"
                >
                  <span>Google Meet</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </>
            )}
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Stop / Cancel Button for active or pending recording */}
          {(recording.status === 'recording' || recording.status === 'pending') && (
            <button
              onClick={() => setStopModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition-all active:scale-95 shadow-md shadow-rose-500/20 cursor-pointer"
              title="Detener o cancelar grabación"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Detener Grabación</span>
            </button>
          )}

          {/* Share Button */}
          <button
            onClick={() => setShareModalOpen(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-xs transition-all active:scale-95 border shadow-sm ${
              recording.share_access && recording.share_access !== 'private'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            {recording.share_access === 'public' ? (
              <Globe className="w-4 h-4 text-emerald-500" />
            ) : recording.share_access === 'registered' ? (
              <Users className="w-4 h-4 text-sky-500" />
            ) : (
              <Share2 className="w-4 h-4 text-indigo-500" />
            )}
            <span>
              {recording.share_access === 'public'
                ? 'Compartida (Pública)'
                : recording.share_access === 'registered'
                ? 'Compartida (Equipo)'
                : 'Compartir'}
            </span>
          </button>

          {/* Open in Drive Button */}
          {recording.drive_url && (
            <a
              href={recording.drive_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all active:scale-95 shadow-sm shadow-emerald-600/20"
            >
              <HardDrive className="w-4 h-4" />
              <span>Ver en Drive</span>
            </a>
          )}
        </div>
      </div>

      {/* Cancelled Notice */}
      {recording.status === 'cancelled' && (
        <div className="p-4 sm:p-5 rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center gap-3 text-slate-700 dark:text-slate-300 text-xs">
          <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-500">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Grabación Cancelada
            </p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">
              Esta reunión fue cancelada antes de finalizar. No se generaron archivos de grabación ni se subió contenido a Google Drive.
            </p>
          </div>
        </div>
      )}

      {/* Mobile Tab Switcher */}
      <div className="flex lg:hidden items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
        <button
          onClick={() => setActiveMobileTab('media')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'media'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>Reproductor</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('minutes')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'minutes'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
          <span>Minuta IA</span>
        </button>
        <button
          onClick={() => setActiveMobileTab('transcript')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeMobileTab === 'transcript'
              ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Transcripción</span>
        </button>
      </div>

      {/* Main 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Player + Metadata (Visible on desktop or when mobileTab === 'media') */}
        <div className={`lg:col-span-6 space-y-6 ${activeMobileTab === 'media' ? 'block' : 'hidden lg:block'}`}>
          
          {/* Media Player Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 transition-colors overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                {isVideo ? <Video className="w-4 h-4 text-sky-500" /> : <Mic className="w-4 h-4 text-emerald-500" />}
                {isVideo ? 'Reproductor de Video' : isAudio ? 'Reproductor de Audio' : 'Grabación en Drive'}
              </h3>

              {driveFileId && (
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  ID: {driveFileId.substring(0, 10)}...
                </span>
              )}
            </div>

            {/* Google Drive Video Player Iframe / Audio Player / Placeholder */}
            {driveFileId ? (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
                <iframe
                  src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                  title={recording.meeting_title}
                  className="w-full h-full border-0"
                  allow="autoplay; encrypted-media; fullscreen"
                />
              </div>
            ) : recording.drive_url ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
                <HardDrive className="w-8 h-8 text-emerald-500 mx-auto" />
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Archivo alojado en Google Drive</p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Puedes reproducir o descargar el archivo directamente desde tu cuenta de Google.
                  </p>
                </div>
                <a
                  href={recording.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir en Google Drive</span>
                </a>
              </div>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <Disc className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Esta reunión fue grabada en modo solo minuta de texto.
                </p>
              </div>
            )}
          </div>

          {/* Meeting Details Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 transition-colors">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-500" />
              Detalles de la Grabación
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Duración Total
                </div>
                <div className="text-sm font-extrabold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                  {formatDuration(recording.duration_seconds)}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Modo de Grabación
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5 capitalize">
                  {recording.recording_mode === 'video' ? 'Video y Minuta' : recording.recording_mode === 'audio' ? 'Audio y Minuta' : 'Solo Minuta'}
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Hora de Inicio
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 font-mono mt-0.5">
                  {format(recordingDate, 'HH:mm')} hrs
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Privacidad / Acceso
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-1.5">
                  {recording.share_access === 'public' ? (
                    <>
                      <Globe className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Pública con enlace</span>
                    </>
                  ) : recording.share_access === 'registered' ? (
                    <>
                      <Users className="w-3.5 h-3.5 text-sky-500" />
                      <span>Solo registrados</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-slate-400" />
                      <span>Privada</span>
                    </>
                  )}
                </div>
              </div>

              {/* Shared Team Meeting Indicator */}
              {recording.shared_with && recording.shared_with.length > 1 && (
                <div className="col-span-2 mt-1 p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950 dark:text-indigo-200">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-indigo-500" />
                      Reunión compartida con el equipo ({recording.shared_with.length})
                    </span>
                    {recording.owner_name && (
                      <span className="text-[10px] font-normal text-indigo-600 dark:text-indigo-400">
                        Drive de {recording.owner_name.replace(/^Ing\.\s+/i, '')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {recording.shared_with.map((member) => (
                      <span
                        key={member.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-colors ${
                          member.is_drive_owner
                            ? 'bg-indigo-100/90 dark:bg-indigo-900/60 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 font-bold'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                        title={member.is_drive_owner ? `Archivo guardado en el Drive de ${member.name}` : member.email}
                      >
                        {member.name || member.email}
                        {member.is_drive_owner && (
                          <HardDrive className="w-3 h-3 text-indigo-600 dark:text-indigo-400 ml-0.5" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Minutes & Transcript Views with Tabs */}
        <div className={`lg:col-span-6 space-y-4 ${activeMobileTab === 'media' ? 'hidden lg:block' : 'block'}`}>
          
          {/* Desktop Tab Switcher */}
          <div className="hidden lg:flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 w-fit">
            <button
              onClick={() => setRightColumnTab('minutes')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                rightColumnTab === 'minutes'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              <span>Minuta Inteligente IA</span>
              {recording.ai_minutes_text && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Minuta disponible" />
              )}
            </button>
            <button
              onClick={() => setRightColumnTab('transcript')}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
                rightColumnTab === 'transcript'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Transcripción Completa</span>
            </button>
          </div>

          {/* Tab Content */}
          {/* On desktop: show active rightColumnTab; on mobile: show activeMobileTab */}
          <div className="w-full">
            {(rightColumnTab === 'minutes' || activeMobileTab === 'minutes') && activeMobileTab !== 'transcript' ? (
              <MinutesView
                recordingId={recording.id}
                initialMinutes={recording.ai_minutes_text}
                meetingTitle={recording.meeting_title}
                hasTranscript={!!(recording.transcript_text && recording.transcript_text.trim().length > 0)}
                onMinutesGenerated={(newMinutes) => {
                  setRecording((prev) => (prev ? { ...prev, ai_minutes_text: newMinutes } : prev));
                }}
              />
            ) : (
              <TranscriptView
                transcript={recording.transcript_text}
                meetingTitle={recording.meeting_title}
                recordingId={recording.id}
                onOpenModal={() => setTranscriptModalOpen(true)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        recordingId={recording.id}
        meetingTitle={recording.meeting_title}
        initialAccess={recording.share_access || 'private'}
        initialShareToken={recording.share_token}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onUpdateSuccess={(newAccess, newShareToken) => {
          setRecording((prev) =>
            prev ? { ...prev, share_access: newAccess, share_token: newShareToken } : prev
          );
        }}
      />

      {/* Stop Recording Modal */}
      <StopRecordingModal
        recordingId={recording.id}
        meetingTitle={recording.meeting_title}
        isOpen={stopModalOpen}
        onClose={() => setStopModalOpen(false)}
        onStopped={(save) => {
          setRecording((prev) =>
            prev ? { ...prev, status: save ? 'completed' : 'cancelled' } : prev
          );
        }}
      />

      {/* Transcript Modal (Dashboard-style) */}
      {transcriptModalOpen && (
        <TranscriptModal
          recordingId={recording.id}
          title={recording.meeting_title}
          transcript={recording.transcript_text || null}
          onClose={() => setTranscriptModalOpen(false)}
        />
      )}
    </div>
  );
};
