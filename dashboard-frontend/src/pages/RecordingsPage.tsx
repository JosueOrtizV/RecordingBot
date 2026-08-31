import React, { useEffect, useState } from 'react';
import { fetchApi } from '../api/client';
import { Recording } from '../types';
import { Disc, FileText, ExternalLink, Trash2, Video, Mic, CheckCircle2, AlertCircle, Loader2, Clock, Calendar } from 'lucide-react';
import { TranscriptModal } from '../components/TranscriptModal';

export const RecordingsPage: React.FC = () => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Transcript modal state
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [selectedTranscript, setSelectedTranscript] = useState<string | null>(null);

  const loadRecordings = async (pageNumber = 1) => {
    setLoading(true);
    try {
      const data = await fetchApi<{
        recordings: Recording[];
        pagination: { totalPages: number; page: number };
      }>(`/api/recordings?page=${pageNumber}&limit=15`);

      setRecordings(data.recordings || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setPage(pageNumber);
    } catch (err) {
      console.warn('Error loading recordings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings(1);
  }, []);

  const openTranscript = async (id: string, title: string) => {
    setSelectedRecordingId(id);
    setSelectedTitle(title);
    setSelectedTranscript(null);
    try {
      const data = await fetchApi<{ transcript: string }>(`/api/recordings/${id}/transcript`);
      setSelectedTranscript(data.transcript);
    } catch (err: any) {
      setSelectedTranscript('No se pudo cargar la transcripción: ' + err.message);
    }
  };

  const deleteRecording = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro del historial? (El archivo en Google Drive se conservará)')) {
      return;
    }

    try {
      await fetchApi(`/api/recordings/${id}`, { method: 'DELETE' });
      setRecordings(recordings.filter((r) => r.id !== id));
    } catch (err: any) {
      alert('Error al eliminar: ' + err.message);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2.5 tracking-tight">
          <Disc className="w-6 h-6 text-indigo-500" />
          Historial de Grabaciones
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Lista de todas tus llamadas grabadas. Los archivos y minutas residen directamente en tu cuenta de Google Drive.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4 transition-colors">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            <p className="text-xs">Cargando tus grabaciones...</p>
          </div>
        ) : recordings.length === 0 ? (
          <div className="py-16 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
            <Disc className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No hay grabaciones registradas</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Cuando el bot asista a tus llamadas, los enlaces a Google Drive y las transcripciones con IA aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th className="pb-3 font-bold">Reunión</th>
                  <th className="pb-3 font-bold">Fecha y Hora</th>
                  <th className="pb-3 font-bold">Duración</th>
                  <th className="pb-3 font-bold">Modo</th>
                  <th className="pb-3 font-bold">Estado</th>
                  <th className="pb-3 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                {recordings.map((rec) => {
                  const date = new Date(rec.created_at);

                  return (
                    <tr key={rec.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-4 pr-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 max-w-[240px] truncate">
                          {rec.meeting_title || 'Reunión sin título'}
                        </div>
                        {rec.meeting_url && (
                          <a
                            href={rec.meeting_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] font-mono text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1 truncate max-w-[240px] mt-0.5 group"
                            title={`Abrir Google Meet: ${rec.meeting_url}`}
                          >
                            <span className="truncate">{rec.meeting_url}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </a>
                        )}
                      </td>

                      <td className="py-4 pr-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <span className="text-slate-400 dark:text-slate-500 block text-[11px] font-mono pl-4.5">
                          {date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>

                      <td className="py-4 pr-4 text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{formatDuration(rec.duration_seconds)}</span>
                        </div>
                      </td>

                      <td className="py-4 pr-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl font-medium">
                          {rec.recording_mode === 'video' ? (
                            <>
                              <Video className="w-3.5 h-3.5 text-sky-500" />
                              <span>Video</span>
                            </>
                          ) : rec.recording_mode === 'audio' ? (
                            <>
                              <Mic className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Audio</span>
                            </>
                          ) : (
                            <>
                              <FileText className="w-3.5 h-3.5 text-indigo-500" />
                              <span>Texto</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td className="py-4 pr-4 whitespace-nowrap">
                        {rec.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            Completada
                          </span>
                        ) : rec.status === 'recording' ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-semibold animate-pulse">
                            En Curso
                          </span>
                        ) : rec.status === 'failed' ? (
                          <span
                            title={rec.error_message || 'Error desconocido'}
                            className="inline-flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-full font-semibold cursor-help"
                          >
                            <AlertCircle className="w-3 h-3" />
                            Fallida
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                            Pendiente
                          </span>
                        )}
                      </td>

                      <td className="py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {rec.has_transcript && (
                            <button
                              onClick={() => openTranscript(rec.id, rec.meeting_title)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-semibold text-[11px] transition-colors border border-sky-500/20"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Transcripción</span>
                            </button>
                          )}

                          {rec.drive_url && (
                            <a
                              href={rec.drive_url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] transition-colors border border-emerald-500/20"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Drive</span>
                            </a>
                          )}

                          <button
                            onClick={() => deleteRecording(rec.id)}
                            title="Eliminar registro"
                            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-200/80 dark:border-slate-800 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Página {page} de {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadRecordings(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => loadRecordings(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transcript Modal */}
      <TranscriptModal
        recordingId={selectedRecordingId}
        title={selectedTitle}
        transcript={selectedTranscript}
        onClose={() => setSelectedRecordingId(null)}
      />
    </div>
  );
};
