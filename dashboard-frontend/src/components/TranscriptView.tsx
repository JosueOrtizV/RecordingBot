import React, { useState, useMemo } from 'react';
import { Search, Copy, Download, Check, FileText, Users, MessageSquare, X, Maximize2, Play } from 'lucide-react';
import { TranscriptModal } from './TranscriptModal';

interface TranscriptViewProps {
  transcript: string | null | undefined;
  meetingTitle?: string;
  recordingId?: string;
  startedAt?: string;
  startedAtLocal?: string;
  durationSeconds?: number;
  onOpenModal?: () => void;
  onSeek?: (seconds: number) => void;
  currentTime?: number;
}

interface SpeakerBlock {
  id: string;
  speaker: string;
  timestamp?: string;
  relativeSeconds?: number;
  relativeTimeStr?: string;
  text: string;
  raw: string;
}

function parseTimestampToSeconds(ts?: string): number {
  if (!ts) return 0;
  const parts = ts.trim().split(':').map(Number);
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  } else if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 0;
}

function formatRelativeTime(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getLocalStartTimeFromIso(isoString?: string): string {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Mexico_City',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch (e) {
    return '';
  }
}

const SPEAKER_PALETTES = [
  {
    avatarBg: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800',
    badge: 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60',
    bubble: 'hover:border-indigo-300/80 dark:hover:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  {
    avatarBg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800',
    badge: 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60',
    bubble: 'hover:border-emerald-300/80 dark:hover:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  {
    avatarBg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200/80 dark:border-amber-800',
    badge: 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60',
    bubble: 'hover:border-amber-300/80 dark:hover:border-amber-800',
    dot: 'bg-amber-500',
  },
  {
    avatarBg: 'bg-sky-100 dark:bg-sky-950/80 text-sky-700 dark:text-sky-300 border-sky-200/80 dark:border-sky-800',
    badge: 'bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/60',
    bubble: 'hover:border-sky-300/80 dark:hover:border-sky-800',
    dot: 'bg-sky-500',
  },
  {
    avatarBg: 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-200/80 dark:border-rose-800',
    badge: 'bg-rose-50 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60',
    bubble: 'hover:border-rose-300/80 dark:hover:border-rose-800',
    dot: 'bg-rose-500',
  },
  {
    avatarBg: 'bg-violet-100 dark:bg-violet-950/80 text-violet-700 dark:text-violet-300 border-violet-200/80 dark:border-violet-800',
    badge: 'bg-violet-50 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200/60 dark:border-violet-800/60',
    bubble: 'hover:border-violet-300/80 dark:hover:border-violet-800',
    dot: 'bg-violet-500',
  },
  {
    avatarBg: 'bg-cyan-100 dark:bg-cyan-950/80 text-cyan-700 dark:text-cyan-300 border-cyan-200/80 dark:border-cyan-800',
    badge: 'bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border-cyan-200/60 dark:border-cyan-800/60',
    bubble: 'hover:border-cyan-300/80 dark:hover:border-cyan-800',
    dot: 'bg-cyan-500',
  },
  {
    avatarBg: 'bg-orange-100 dark:bg-orange-950/80 text-orange-700 dark:text-orange-300 border-orange-200/80 dark:border-orange-800',
    badge: 'bg-orange-50 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200/60 dark:border-orange-800/60',
    bubble: 'hover:border-orange-300/80 dark:hover:border-orange-800',
    dot: 'bg-orange-500',
  },
];

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  transcript,
  meetingTitle,
  recordingId,
  startedAt,
  startedAtLocal,
  durationSeconds,
  onOpenModal,
  onSeek,
  currentTime,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('all');
  const [copied, setCopied] = useState(false);

  // Compute base start time for relative offset calculation (format HH:MM:SS in Mexico City)
  const baseStartTimeStr = useMemo(() => {
    return startedAtLocal || getLocalStartTimeFromIso(startedAt);
  }, [startedAtLocal, startedAt]);

  // Parse raw text into structured speaker blocks
  const { blocks, speakers, totalWords } = useMemo(() => {
    if (!transcript) return { blocks: [], speakers: [], totalWords: 0 };

    const lines = transcript.split('\n');
    const parsedBlocks: SpeakerBlock[] = [];
    const speakerSet = new Set<string>();
    let currentSpeaker = 'Participante';
    let currentTimestamp: string | undefined;
    let currentTextLines: string[] = [];
    let blockCount = 0;

    const commitBlock = () => {
      if (currentTextLines.length > 0) {
        const text = currentTextLines.join(' ').trim();
        if (text) {
          let relSeconds: number | undefined;
          let relTimeStr: string | undefined;

          if (currentTimestamp) {
            const capSec = parseTimestampToSeconds(currentTimestamp);
            const isShortRelFormat = /^(\d{1,2}:\d{2})$/.test(currentTimestamp.trim());

            if (isShortRelFormat || (capSec < 14400 && (!baseStartTimeStr || parseTimestampToSeconds(baseStartTimeStr) > 28800))) {
              relSeconds = capSec;
              relTimeStr = formatRelativeTime(capSec);
            } else if (baseStartTimeStr) {
              const baseSec = parseTimestampToSeconds(baseStartTimeStr);
              let diff = capSec - baseSec;
              if (diff < 0 && diff > -180) {
                diff = 0;
              } else if (diff < 0) {
                diff += 86400; // Midnight rollover
              }
              relSeconds = diff;
              relTimeStr = formatRelativeTime(diff);
            }
          }

          parsedBlocks.push({
            id: `block-${blockCount++}`,
            speaker: currentSpeaker,
            timestamp: currentTimestamp,
            relativeSeconds: relSeconds,
            relativeTimeStr: relTimeStr,
            text,
            raw: text,
          });
          speakerSet.add(currentSpeaker);
        }
        currentTextLines = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i];
      const line = rawLine.trim();
      if (!line) continue;

      // Skip header divider lines like "========" or "TRANSCRIPCIÓN:"
      if (line.startsWith('===') || line.startsWith('---') || line.startsWith('TRANSCRIPCIÓN') || line.startsWith('FECHA:')) {
        continue;
      }

      // Pattern 1: [14:15:02] Josué Ortiz: Hola a todos OR [54:17] (12:02:04) Josué Ortiz: Hola
      const match1 = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\](?:\s*\((.*?)\))?\s*(.*?):\s*(.*)$/);
      if (match1) {
        commitBlock();
        const timeA = match1[1];
        const timeB = match1[2];
        currentTimestamp = timeB || timeA;
        currentSpeaker = match1[3].trim() || 'Participante';
        currentTextLines.push(match1[4]);
        continue;
      }

      // Pattern 2: [Josué Ortiz] 00:15:02 or [Josué Ortiz]
      const match2 = line.match(/^\[(.*?)\](?:\s*(\d{1,2}:\d{2}(?::\d{2})?))?/);
      if (match2 && match2[1].length < 40 && !match2[1].includes('.')) {
        commitBlock();
        currentSpeaker = match2[1].trim() || 'Participante';
        currentTimestamp = match2[2] || undefined;
        // The rest of this line or following lines
        const remainder = line.substring(match2[0].length).trim();
        if (remainder) {
          currentTextLines.push(remainder);
        }
        continue;
      }

      // Pattern 3: Speaker Name: Text (without brackets)
      const match3 = line.match(/^([A-ZÁÉÍÓÚÑa-záéíóúñ\s.]+?):\s+(.+)$/);
      if (match3 && match3[1].length < 35 && !match3[1].includes('http') && !match3[1].includes('Nota')) {
        commitBlock();
        currentSpeaker = match3[1].trim();
        currentTimestamp = undefined;
        currentTextLines.push(match3[2]);
        continue;
      }

      // Otherwise continuation of previous block
      currentTextLines.push(line);
    }

    commitBlock();

    // Calculate word count
    const words = parsedBlocks.reduce((acc, b) => acc + b.text.split(/\s+/).filter(Boolean).length, 0);

    return {
      blocks: parsedBlocks,
      speakers: Array.from(speakerSet),
      totalWords: words,
    };
  }, [transcript, baseStartTimeStr, durationSeconds]);

  // Assign speaker palette map
  const speakerColorMap = useMemo(() => {
    const map = new Map<string, typeof SPEAKER_PALETTES[0]>();
    speakers.forEach((s, idx) => {
      map.set(s, SPEAKER_PALETTES[idx % SPEAKER_PALETTES.length]);
    });
    return map;
  }, [speakers]);

  // Filtered blocks based on search and speaker filter
  const filteredBlocks = useMemo(() => {
    return blocks.filter((b) => {
      const matchesSearch =
        searchQuery.trim() === '' ||
        b.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.speaker.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSpeaker = selectedSpeaker === 'all' || b.speaker === selectedSpeaker;

      return matchesSearch && matchesSpeaker;
    });
  }, [blocks, searchQuery, selectedSpeaker]);

  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!transcript) return;
    const safeTitle = (meetingTitle || 'transcripcion').replace(/[^a-zA-Z0-9_-]/g, '_');
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeTitle}_minuta.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return (name[0] || 'P').toUpperCase();
  };

  if (!transcript || transcript.trim().length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">Sin transcripción disponible</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          Esta reunión no cuenta con transcripción registrada o el bot estuvo en modo sin captura de texto.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col h-full space-y-4 transition-colors">
      {/* Header with Stats & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Transcripción y Diálogo
          </h2>
          <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 mt-1 font-medium">
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {speakers.length} {speakers.length === 1 ? 'participante' : 'participantes'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              {totalWords.toLocaleString()} palabras
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Small icon-only button to open modal as in dashboard */}
          <button
            onClick={() => (onOpenModal ? onOpenModal() : setIsModalOpen(true))}
            className="p-1.5 sm:p-2 rounded-xl bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 transition-all active:scale-95 border border-sky-200/80 dark:border-sky-800/80 cursor-pointer shadow-2xs"
            title="Abrir transcripción en ventana modal"
          >
            <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-95 border border-slate-200/60 dark:border-slate-700/60 cursor-pointer"
            title="Copiar texto completo"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all active:scale-95 shadow-sm shadow-indigo-600/30 cursor-pointer"
            title="Descargar minuta en archivo de texto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar .txt</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search Input & Speaker Filter Chips */}
      <div className="space-y-2.5">
        <div className="relative w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar palabras clave en la transcripción..."
            className="w-full pl-8 pr-8 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Speaker filter chips if multiple speakers */}
        {speakers.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedSpeaker('all')}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shrink-0 ${
                selectedSpeaker === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({blocks.length})
            </button>
            {speakers.map((speaker) => {
              const pal = speakerColorMap.get(speaker) || SPEAKER_PALETTES[0];
              const count = blocks.filter((b) => b.speaker === speaker).length;
              return (
                <button
                  key={speaker}
                  onClick={() => setSelectedSpeaker(speaker === selectedSpeaker ? 'all' : speaker)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all shrink-0 border ${
                    selectedSpeaker === speaker
                      ? 'bg-white dark:bg-slate-800 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : `${pal.badge} hover:opacity-80`
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${pal.dot}`} />
                  <span className="truncate max-w-[120px]">{speaker}</span>
                  <span className="text-[10px] opacity-70">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Transcript Utterances List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[600px] min-h-[300px]">
        {filteredBlocks.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
            <Search className="w-6 h-6 mx-auto opacity-50" />
            <p className="text-xs font-medium">No se encontraron frases que coincidan con la búsqueda.</p>
          </div>
        ) : (
          filteredBlocks.map((block, idx) => {
            const pal = speakerColorMap.get(block.speaker) || SPEAKER_PALETTES[0];
            const nextBlock = filteredBlocks[idx + 1];
            const isActive =
              typeof currentTime === 'number' &&
              typeof block.relativeSeconds === 'number' &&
              currentTime >= block.relativeSeconds &&
              (nextBlock && typeof nextBlock.relativeSeconds === 'number'
                ? currentTime < nextBlock.relativeSeconds
                : currentTime < block.relativeSeconds + 45);

            return (
              <div
                key={block.id}
                id={block.id}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${pal.bubble} ${
                  isActive
                    ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700/80 shadow-xs ring-1 ring-indigo-500/20'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/80'
                }`}
              >
                {/* Speaker Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-extrabold text-[11px] border shrink-0 ${pal.avatarBg}`}
                      title={block.speaker}
                    >
                      {getInitials(block.speaker)}
                    </div>
                    <span className="font-bold text-xs text-slate-900 dark:text-slate-100">
                      {block.speaker}
                    </span>
                    {isActive && (
                      <span className="flex h-2 w-2 relative" title="Reproduciendo este momento">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                      </span>
                    )}
                  </div>

                  {/* Timestamps & Quick Seek Chip */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {block.relativeTimeStr ? (
                      <button
                        type="button"
                        onClick={() => onSeek && typeof block.relativeSeconds === 'number' && onSeek(block.relativeSeconds)}
                        className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:hover:bg-indigo-900/90 text-indigo-600 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800 transition-all cursor-pointer group shadow-2xs active:scale-95"
                        title={`Saltar al minuto ${block.relativeTimeStr} en el audio/video (${block.timestamp || ''})`}
                      >
                        <Play className="w-2.5 h-2.5 fill-current text-indigo-500 group-hover:scale-110 transition-transform" />
                        <span>{block.relativeTimeStr}</span>
                      </button>
                    ) : null}

                    {block.timestamp && (
                      <span
                        className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700/60"
                        title="Hora registrada"
                      >
                        {block.timestamp}
                      </span>
                    )}
                  </div>
                </div>

                {/* Speaker Message Text */}
                <p className="text-xs sm:text-[13px] leading-relaxed text-slate-700 dark:text-slate-300 pl-9">
                  {block.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Transcript Modal (Dashboard-style fallback) */}
      {isModalOpen && !onOpenModal && (
        <TranscriptModal
          recordingId={recordingId || 'view'}
          title={meetingTitle || 'Transcripción'}
          transcript={transcript || null}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};
