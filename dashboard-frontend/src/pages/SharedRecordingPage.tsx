import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { Recording } from '../types';
import {
  Disc,
  Video,
  Mic,
  FileText,
  Clock,
  Calendar,
  AlertCircle,
  Loader2,
  Lock,
  Sun,
  Moon,
  ShieldCheck,
  UserCheck,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { TranscriptView } from '../components/TranscriptView';
import { MinutesView } from '../components/MinutesView';
import { useTheme } from '../context/ThemeContext';
import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const SharedRecordingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { theme, toggleTheme } = useTheme();

  const [recording, setRecording] = useState<Recording | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'media' | 'transcript' | 'minutes'>('media');
  const [rightColumnTab, setRightColumnTab] = useState<'transcript' | 'minutes'>('minutes');

  // Media Player State & Refs
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const mediaContainerRef = useRef<HTMLDivElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playerViewMode, setPlayerViewMode] = useState<'native' | 'drive'>('native');
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  const handleSeek = (seconds: number) => {
    if (playerViewMode !== 'native') {
      setPlayerViewMode('native');
    }

    if (mediaRef.current) {
      mediaRef.current.currentTime = seconds;
      mediaRef.current.play().catch(() => {});
    }

    if (window.innerWidth < 1024) {
      setActiveMobileTab('media');
    }

    setTimeout(() => {
      mediaContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (mediaRef.current) {
      mediaRef.current.playbackRate = speed;
    }
  };

  const loadSharedRecording = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    setRequiresAuth(false);
    try {
      const data = await fetchApi<{ recording: Recording }>(`/api/shared/${token}`);
      setRecording(data.recording);
    } catch (err: any) {
      if (
        err.status === 401 ||
        err.data?.requiresAuth ||
        err.message?.toLowerCase().includes('registrados') ||
        err.message?.toLowerCase().includes('autenticado') ||
        err.message?.toLowerCase().includes('sesión') ||
        err.message?.toLowerCase().includes('expirado')
      ) {
        setRequiresAuth(true);
      } else {
        setError(err.message || 'Grabación no encontrada o enlace privado.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSharedRecording();
  }, [token]);

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

  const driveFileId = recording
    ? recording.drive_file_id ||
      (recording.drive_url?.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
        recording.drive_url?.match(/[?&]id=([a-zA-Z0-9_-]+)/))?.[1]
    : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Standalone Public Navigation Bar */}
      <header className="h-16 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-600/30">
            <Disc className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white">
              Recording<span className="text-indigo-600 dark:text-indigo-400">Bot</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              · Grabación Compartida
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Cambiar tema"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-500" />}
          </button>

          {/* Login or Dashboard link */}
          <Link
            to="/login"
            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm shadow-indigo-600/20"
          >
            Acceder al Panel
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        {loading ? (
          <div className="py-28 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm font-medium">Cargando grabación compartida...</p>
          </div>
        ) : requiresAuth ? (
          <div className="max-w-md mx-auto py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-200/60 dark:border-indigo-800">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Acceso Restringido a Usuarios Registrados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              El anfitrión configuró esta grabación para que solo miembros con cuenta registrada en RecordingBot puedan consultarla.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all"
            >
              <UserCheck className="w-4 h-4" />
              <span>Iniciar Sesión para Ver</span>
            </Link>
          </div>
        ) : error || !recording ? (
          <div className="max-w-md mx-auto py-20 text-center space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-rose-50 dark:bg-rose-950/60 text-rose-500 flex items-center justify-center mx-auto border border-rose-200 dark:border-rose-800">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {error || 'Grabación no disponible'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Este enlace no es válido, ha sido revocado por el anfitrión o la grabación fue eliminada.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header Title & Metadata */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors">
              <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" />
                      Enlace Verificado
                    </span>
                    {recording.owner_name && (
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        Organizado por <strong className="text-slate-700 dark:text-slate-300">{recording.owner_name}</strong>
                      </span>
                    )}
                  </div>

                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                    {recording.meeting_title || 'Reunión sin título'}
                  </h1>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium pt-1">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                      {format(new Date(recording.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {formatDuration(recording.duration_seconds)}
                    </span>
                  </div>
                </div>

                {/* Mode Badge */}
                <div className="self-start md:self-auto">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                    {recording.recording_mode === 'video' ? (
                      <>
                        <Video className="w-3.5 h-3.5 text-sky-500" />
                        <span>Video MP4</span>
                      </>
                    ) : recording.recording_mode === 'audio' ? (
                      <>
                        <Mic className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Audio MP3</span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Minuta de Texto</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

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

              {/* 2-Column Responsive Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Player Column */}
                <div className={`lg:col-span-6 space-y-6 ${activeMobileTab === 'media' ? 'block' : 'hidden lg:block'}`}>
                  {/* Media Player Card */}
                  <div
                    ref={mediaContainerRef}
                    className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm space-y-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                        {recording.recording_mode === 'video' ? <Video className="w-4 h-4 text-sky-500" /> : <Mic className="w-4 h-4 text-emerald-500" />}
                        Reproductor de la Grabación
                      </h3>

                      {driveFileId && (
                        <button
                          type="button"
                          onClick={() => setPlayerViewMode(playerViewMode === 'native' ? 'drive' : 'native')}
                          className="text-[11px] font-semibold px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                        >
                          {playerViewMode === 'native' ? 'Vista Drive' : 'Reproductor Sincronizado'}
                        </button>
                      )}
                    </div>

                    {driveFileId ? (
                      playerViewMode === 'native' ? (
                        recording.recording_mode === 'video' ? (
                          <div className="space-y-3">
                            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner">
                              <video
                                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                                src={`/api/recordings/${recording.id}/stream?token=${recording.share_token || ''}`}
                                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                controls
                                playsInline
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="flex items-center justify-between text-xs px-1">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (mediaRef.current) {
                                      mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                  title="Retroceder 10 segundos"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>-10s</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (mediaRef.current) {
                                      mediaRef.current.currentTime = mediaRef.current.currentTime + 10;
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                                  title="Adelantar 10 segundos"
                                >
                                  <RotateCw className="w-3 h-3" />
                                  <span>+10s</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
                                {[1, 1.25, 1.5, 2].map((speed) => (
                                  <button
                                    key={speed}
                                    type="button"
                                    onClick={() => handleSpeedChange(speed)}
                                    className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                      playbackRate === speed
                                        ? 'bg-indigo-600 text-white shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                  >
                                    {speed}x
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 text-white flex flex-col items-center justify-center space-y-4 shadow-inner">
                              <div className="relative">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                                  <Mic className="w-7 h-7" />
                                </div>
                                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-500 text-slate-950 uppercase tracking-wider">
                                  MP3
                                </span>
                              </div>

                              <div className="text-center max-w-sm">
                                <p className="font-extrabold text-sm text-slate-100 truncate">
                                  {recording.meeting_title || 'Audio de la reunión'}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Haz clic en cualquier minuto de la transcripción para saltar a ese audio.
                                </p>
                              </div>

                              <audio
                                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                                src={`/api/recordings/${recording.id}/stream?token=${recording.share_token || ''}`}
                                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                                controls
                                className="w-full max-w-md accent-indigo-500"
                              />

                              <div className="flex items-center gap-2 pt-1 flex-wrap justify-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (mediaRef.current) {
                                      mediaRef.current.currentTime = Math.max(0, mediaRef.current.currentTime - 10);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95 cursor-pointer"
                                  title="Retroceder 10 segundos"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>-10s</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (mediaRef.current) {
                                      mediaRef.current.currentTime = mediaRef.current.currentTime + 10;
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all active:scale-95 cursor-pointer"
                                  title="Adelantar 10 segundos"
                                >
                                  <RotateCw className="w-3 h-3" />
                                  <span>+10s</span>
                                </button>

                                <div className="flex items-center gap-1 ml-2 bg-slate-800/80 p-0.5 rounded-xl border border-slate-700/80">
                                  {[1, 1.25, 1.5, 2].map((speed) => (
                                    <button
                                      key={speed}
                                      type="button"
                                      onClick={() => handleSpeedChange(speed)}
                                      className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                                        playbackRate === speed
                                          ? 'bg-indigo-600 text-white'
                                          : 'text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {speed}x
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner">
                          <iframe
                            src={`https://drive.google.com/file/d/${driveFileId}/preview`}
                            title={recording.meeting_title}
                            className="w-full h-full border-0"
                            allow="autoplay; encrypted-media; fullscreen"
                          />
                        </div>
                      )
                    ) : (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                        <Disc className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Esta reunión fue registrada en modo minuta de texto.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Minutes & Transcript Column */}
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
                  <div className="w-full">
                    {(rightColumnTab === 'minutes' || activeMobileTab === 'minutes') && activeMobileTab !== 'transcript' ? (
                      <MinutesView
                        recordingId={recording.id}
                        initialMinutes={recording.ai_minutes_text}
                        meetingTitle={recording.meeting_title}
                        hasTranscript={!!(recording.transcript_text && recording.transcript_text.trim().length > 0)}
                        readOnly={true}
                      />
                    ) : (
                      <TranscriptView
                        transcript={recording.transcript_text}
                        meetingTitle={recording.meeting_title}
                        recordingId={recording.id}
                        startedAt={recording.started_at}
                        startedAtLocal={recording.started_at_local}
                        durationSeconds={recording.duration_seconds}
                        onSeek={handleSeek}
                        currentTime={currentTime}
                      />
                    )}
                  </div>
                </div>
            </div>
          </div>
        )}
      </main>

      {/* Simple Clean Footer */}
      <footer className="py-6 border-t border-slate-200/60 dark:border-slate-800/80 text-center text-xs text-slate-400 dark:text-slate-600">
        <p>RecordingBot · Grabaciones y Minutas Inteligentes</p>
      </footer>
    </div>
  );
};
