import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { fetchApi } from '../api/client';
import { ScheduledMeeting } from '../types';
import { showToast } from '../utils/swal';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  Video,
  Check,
  Ban,
  ExternalLink,
  Loader2,
  X,
  Bot,
  CalendarDays,
  List,
  Sparkles,
  Layers,
  CalendarCheck,
  ArrowLeft,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
  isSameMonth,
  startOfMonth,
  endOfMonth,
  differenceInMinutes,
  addDays,
  subDays,
  isSameWeek,
} from 'date-fns';
import { es } from 'date-fns/locale';

type ViewMode = 'week' | 'month' | 'agenda';
type AgendaFilter = 'today' | 'week' | 'month' | 'all';

interface PositionedMeeting {
  meeting: ScheduledMeeting;
  start: Date;
  end: Date;
  topPx: number;
  heightPx: number;
  columnIndex: number;
  totalColumns: number;
}

function layoutDayMeetings(
  dayMeetings: ScheduledMeeting[],
  baseHour = 7,
  pxPerHour = 72
): PositionedMeeting[] {
  if (dayMeetings.length === 0) return [];

  const items = dayMeetings.map((m) => {
    const start = new Date(m.start_time);
    const end = new Date(m.end_time);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const durationMins = Math.max(differenceInMinutes(end, start), 25);
    const offsetHours = Math.max(startHour - baseHour, 0);
    const topPx = offsetHours * pxPerHour;
    const heightPx = Math.max((durationMins / 60) * pxPerHour - 3, 26);
    return {
      meeting: m,
      start,
      end,
      topPx,
      heightPx,
      columnIndex: 0,
      totalColumns: 1,
    };
  });

  items.sort((a, b) => {
    if (a.start.getTime() !== b.start.getTime()) {
      return a.start.getTime() - b.start.getTime();
    }
    return (
      b.end.getTime() - b.start.getTime() - (a.end.getTime() - a.start.getTime())
    );
  });

  const clusters: (typeof items)[] = [];
  let currentCluster: typeof items = [];
  let clusterEnd: Date | null = null;

  for (const item of items) {
    if (!clusterEnd || item.start < clusterEnd) {
      currentCluster.push(item);
      if (!clusterEnd || item.end > clusterEnd) {
        clusterEnd = item.end;
      }
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.end;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const result: PositionedMeeting[] = [];

  for (const cluster of clusters) {
    const columns: (typeof items)[] = [];

    for (const item of cluster) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        if (item.start >= lastInCol.end) {
          columns[c].push(item);
          item.columnIndex = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        item.columnIndex = columns.length;
        columns.push([item]);
      }
    }

    const totalCols = columns.length;
    for (const item of cluster) {
      item.totalColumns = totalCols;
      result.push(item);
    }
  }

  return result;
}

export const CalendarPage: React.FC = () => {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [agendaFilter, setAgendaFilter] = useState<AgendaFilter>('week');
  const [selectedMeeting, setSelectedMeeting] = useState<ScheduledMeeting | null>(null);
  const [modalMode, setModalMode] = useState<'details' | 'scope_choice'>('details');

  // Close modal on Escape key & lock body scroll
  useEffect(() => {
    if (!selectedMeeting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedMeeting(null);
        setModalMode('details');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedMeeting]);

  const navigate = useNavigate();

  const deduplicateMeetings = (list: ScheduledMeeting[]): ScheduledMeeting[] => {
    const seen = new Set<string>();
    return list.filter((m) => {
      const key = m.id || `${m.calendar_event_id}_${m.start_time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const loadMeetings = async () => {
    try {
      const data = await fetchApi<{ meetings: ScheduledMeeting[] }>('/api/calendar/upcoming');
      setMeetings(deduplicateMeetings(data.meetings || []));
    } catch (err) {
      console.warn('Error loading calendar meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await fetchApi<{ success: boolean; meetings: ScheduledMeeting[] }>('/api/calendar/refresh', {
        method: 'POST',
      });
      const unique = deduplicateMeetings(data.meetings || []);
      setMeetings(unique);
      showToast.success('Calendario sincronizado', `${unique.length} reuniones actualizadas.`);
    } catch (err: any) {
      showToast.error('Error al sincronizar calendario', err.message || 'No se pudo conectar con Google Calendar.');
    } finally {
      setRefreshing(false);
    }
  };

  const openMeetingDetails = (meeting: ScheduledMeeting) => {
    setSelectedMeeting(meeting);
    setModalMode('details');
  };

  const openMeetingScopeChoice = (meeting: ScheduledMeeting) => {
    setSelectedMeeting(meeting);
    setModalMode('scope_choice');
  };

  const executeToggle = async (meeting: ScheduledMeeting, willRecord: boolean, scope: 'single' | 'series') => {
    try {
      await fetchApi(`/api/calendar/toggle-record/${meeting.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          willRecord,
          scope,
          matchType: 'title_contains',
          matchValue: meeting.title,
        }),
      });
      // Refresh meetings to update all affected series events
      await loadMeetings();
      if (selectedMeeting && selectedMeeting.id === meeting.id) {
        setSelectedMeeting({ ...selectedMeeting, will_record: willRecord });
      }
      setModalMode('details');
      setSelectedMeeting(null);
      showToast.success(
        willRecord ? 'Grabación activada' : 'Grabación pausada',
        scope === 'series'
          ? (willRecord ? 'El bot asistirá a todos los eventos de esta serie.' : 'Toda la serie ha sido excluida del bot.')
          : (willRecord ? 'El bot asistirá a esta reunión.' : 'Esta reunión ha sido excluida del bot.')
      );
    } catch (err: any) {
      showToast.error('Error al actualizar regla', err.message);
    }
  };

  // Date Navigation
  const handlePrev = () => {
    if (viewMode === 'week') {
      setCurrentDate((prev) => subWeeks(prev, 1));
    } else if (viewMode === 'month') {
      setCurrentDate((prev) => subMonths(prev, 1));
    } else {
      if (agendaFilter === 'today') {
        setCurrentDate((prev) => subDays(prev, 1));
      } else if (agendaFilter === 'week') {
        setCurrentDate((prev) => subWeeks(prev, 1));
      } else if (agendaFilter === 'month') {
        setCurrentDate((prev) => subMonths(prev, 1));
      }
    }
  };

  const handleNext = () => {
    if (viewMode === 'week') {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else if (viewMode === 'month') {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      if (agendaFilter === 'today') {
        setCurrentDate((prev) => addDays(prev, 1));
      } else if (agendaFilter === 'week') {
        setCurrentDate((prev) => addWeeks(prev, 1));
      } else if (agendaFilter === 'month') {
        setCurrentDate((prev) => addMonths(prev, 1));
      }
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Week View Days (Sunday to Saturday)
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Month View Days
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Dynamic visible meetings for today
  const visibleTodayMeetings = useMemo(() => {
    return meetings.filter((m) => isSameDay(new Date(m.start_time), currentDate));
  }, [meetings, currentDate]);

  // Dynamic visible meetings for current visible week
  const visibleWeekMeetings = useMemo(() => {
    if (weekDays.length < 7) return [];
    const weekStart = weekDays[0];
    const weekEnd = new Date(weekDays[6].getTime() + 86400000 - 1);
    return meetings.filter((m) => {
      const d = new Date(m.start_time);
      return d >= weekStart && d <= weekEnd;
    });
  }, [meetings, weekDays]);

  // Dynamic visible meetings for current visible month
  const visibleMonthMeetings = useMemo(() => {
    return meetings.filter((m) => isSameMonth(new Date(m.start_time), currentDate));
  }, [meetings, currentDate]);

  // Filtered agenda meetings
  const filteredAgendaMeetings = useMemo(() => {
    if (agendaFilter === 'today') {
      return meetings.filter((m) => isSameDay(new Date(m.start_time), currentDate));
    }
    if (agendaFilter === 'week') {
      if (weekDays.length < 7) return [];
      const weekStart = weekDays[0];
      const weekEnd = new Date(weekDays[6].getTime() + 86400000 - 1);
      return meetings.filter((m) => {
        const d = new Date(m.start_time);
        return d >= weekStart && d <= weekEnd;
      });
    }
    if (agendaFilter === 'month') {
      return meetings.filter((m) => isSameMonth(new Date(m.start_time), currentDate));
    }
    // 'all'
    return meetings;
  }, [meetings, agendaFilter, weekDays, currentDate]);

  // Group filtered agenda meetings by day with week and month metadata
  const groupedAgendaMeetings = useMemo(() => {
    const today = new Date();
    const groups: {
      [key: string]: {
        date: Date;
        isToday: boolean;
        monthKey: string;
        monthLabel: string;
        weekKey: string;
        weekLabel: string;
        isCurrentWeek: boolean;
        items: ScheduledMeeting[];
      };
    } = {};

    for (const m of filteredAgendaMeetings) {
      const d = new Date(m.start_time);
      const key = format(d, 'yyyy-MM-dd');

      if (!groups[key]) {
        const wStart = startOfWeek(d, { weekStartsOn: 0 });
        const wEnd = endOfWeek(d, { weekStartsOn: 0 });
        const weekLabel = `Semana del ${format(wStart, "d 'de' MMMM", { locale: es })} al ${format(wEnd, "d 'de' MMMM", { locale: es })}`;
        const isCurrentWeek = isSameWeek(d, today, { weekStartsOn: 0 });

        groups[key] = {
          date: d,
          isToday: isToday(d),
          monthKey: format(d, 'yyyy-MM'),
          monthLabel: format(d, 'MMMM yyyy', { locale: es }),
          weekKey: `${format(d, 'yyyy')}-W${format(wStart, 'yyyy-MM-dd')}`,
          weekLabel,
          isCurrentWeek,
          items: [],
        };
      }
      groups[key].items.push(m);
    }
    return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [filteredAgendaMeetings]);

  // Week title display (e.g. "30 de agosto – 5 de septiembre 2026" or "10 – 16 de agosto 2026")
  const weekRangeTitle = useMemo(() => {
    if (weekDays.length < 7) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    if (isSameMonth(start, end)) {
      return `${format(start, 'd', { locale: es })} – ${format(end, "d 'de' MMMM yyyy", { locale: es })}`;
    }
    if (start.getFullYear() === end.getFullYear()) {
      return `${format(start, "d 'de' MMMM", { locale: es })} – ${format(end, "d 'de' MMMM yyyy", { locale: es })}`;
    }
    return `${format(start, "d 'de' MMMM yyyy", { locale: es })} – ${format(end, "d 'de' MMMM yyyy", { locale: es })}`;
  }, [weekDays]);

  // Base hour 07:00 to 22:00 (16 hours, 7 AM to 10 PM)
  const baseHour = 7;
  const pxPerHour = 72;
  const hours = Array.from({ length: 16 }, (_, i) => i + baseHour);

  // Get meetings for a specific day
  const getMeetingsForDay = (day: Date) => {
    return meetings.filter((m) => isSameDay(new Date(m.start_time), day));
  };

  // Current time indicator calculation
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;
  const nowTopPx = Math.max(nowHour - baseHour, 0) * pxPerHour;

  return (
    <div className="space-y-4 max-w-7xl mx-auto flex flex-col h-full min-h-[85vh]">
      {/* Top Header & Controls */}
      <div className="bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 rounded-3xl shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
        {/* Left: Title & Month display */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <div className="p-3 rounded-2xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <CalendarIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100 capitalize tracking-tight">
              {viewMode === 'week' || (viewMode === 'agenda' && agendaFilter === 'week')
                ? weekRangeTitle
                : viewMode === 'agenda' && agendaFilter === 'today'
                ? isToday(currentDate)
                  ? 'Hoy, ' + format(currentDate, "d 'de' MMMM", { locale: es })
                  : format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es })
                : viewMode === 'agenda' && agendaFilter === 'all'
                ? 'Todas las Reuniones'
                : format(currentDate, 'MMMM yyyy', { locale: es })}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {viewMode === 'week' && (
                <>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {visibleWeekMeetings.length} {visibleWeekMeetings.length === 1 ? 'reunión detectada' : 'reuniones detectadas'}
                  </span>{' '}
                  en esta semana
                </>
              )}
              {viewMode === 'month' && (
                <>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {visibleMonthMeetings.length} {visibleMonthMeetings.length === 1 ? 'reunión detectada' : 'reuniones detectadas'}
                  </span>{' '}
                  en {format(currentDate, 'MMMM', { locale: es })}
                </>
              )}
              {viewMode === 'agenda' && (
                <>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {filteredAgendaMeetings.length} {filteredAgendaMeetings.length === 1 ? 'reunión' : 'reuniones'}
                  </span>{' '}
                  {agendaFilter === 'today'
                    ? 'para este día'
                    : agendaFilter === 'week'
                    ? 'en esta semana'
                    : agendaFilter === 'month'
                    ? 'en este mes'
                    : 'en total'}
                </>
              )}
            </p>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:ml-4 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60">
            <button
              onClick={handlePrev}
              className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title="Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              Hoy
            </button>
            <button
              onClick={handleNext}
              className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors"
              title="Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: View Switcher & Sync Button */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/60 text-xs font-semibold">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Semana</span>
            </button>

            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Mes</span>
            </button>

            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 ${
                viewMode === 'agenda'
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          {/* Sync Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-2xl text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Sincronizando...' : 'Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* Main Calendar Container */}
      <div className="flex-1 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden flex flex-col transition-colors min-h-[600px]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400 py-24">
            <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
            <p className="text-xs font-medium">Cargando eventos de Google Calendar...</p>
          </div>
        ) : (
          <>
            {/* WEEK VIEW (Google Calendar Grid) */}
            {viewMode === 'week' && (
              <div className="flex-1 flex flex-col overflow-x-auto">
                {/* Week Day Header */}
                <div className="grid grid-cols-8 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-center sticky top-0 z-20 min-w-[700px]">
                  {/* Time column header */}
                  <div className="p-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 border-r border-slate-200/80 dark:border-slate-800 flex items-center justify-center">
                    GMT-6
                  </div>

                  {weekDays.map((day) => {
                    const today = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        className={`p-3 border-r border-slate-200/80 dark:border-slate-800 last:border-r-0 ${
                          today ? 'bg-sky-500/5' : ''
                        }`}
                      >
                        <p className="text-[11px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                          {format(day, 'EEE', { locale: es })}
                        </p>
                        <p
                          className={`text-base font-extrabold mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full ${
                            today
                              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {format(day, 'd')}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Week Time Grid */}
                <div className="flex-1 overflow-y-auto min-w-[760px] relative max-h-[70vh]">
                  <div className="grid grid-cols-8 relative">
                    {/* Time labels column */}
                    <div className="border-r border-slate-200/80 dark:border-slate-800 select-none bg-slate-50/40 dark:bg-slate-950/30 relative">
                      {hours.map((hour) => (
                        <div
                          key={hour}
                          style={{ height: `${pxPerHour}px` }}
                          className="border-b border-slate-200/60 dark:border-slate-800/60 relative"
                        >
                          <span className="absolute -top-2.5 right-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 select-none">
                            {hour.toString().padStart(2, '0')}:00
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Day Columns */}
                    {weekDays.map((day) => {
                      const dayMeetings = getMeetingsForDay(day);
                      const today = isToday(day);
                      const positionedItems = layoutDayMeetings(dayMeetings, baseHour, pxPerHour);

                      return (
                        <div
                          key={day.toISOString()}
                          className={`relative border-r border-slate-200/80 dark:border-slate-800 last:border-r-0 ${
                            today ? 'bg-sky-500/[0.02]' : ''
                          }`}
                        >
                          {/* Hour grid lines */}
                          {hours.map((hour) => (
                            <div
                              key={hour}
                              style={{ height: `${pxPerHour}px` }}
                              className="border-b border-slate-200/60 dark:border-slate-800/60"
                            />
                          ))}

                          {/* Current time horizontal indicator */}
                          {today && nowHour >= baseHour && nowHour <= baseHour + hours.length && (
                            <div
                              style={{ top: `${nowTopPx}px` }}
                              className="absolute left-0 right-0 z-15 pointer-events-none flex items-center"
                            >
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1.5 shadow-sm"></div>
                              <div className="flex-1 h-[2px] bg-rose-500/80"></div>
                            </div>
                          )}

                          {/* Side-by-side non-overlapping meeting cards */}
                          {positionedItems.map((item) => {
                            const widthPercent = 100 / item.totalColumns;
                            const leftPercent = (item.columnIndex / item.totalColumns) * 100;

                            return (
                              <div
                                key={item.meeting.id}
                                onClick={() => openMeetingDetails(item.meeting)}
                                style={{
                                  top: `${item.topPx}px`,
                                  height: `${item.heightPx}px`,
                                  left: `calc(${leftPercent}% + 2px)`,
                                  width: `calc(${widthPercent}% - 4px)`,
                                }}
                                className={`absolute rounded-xl p-1.5 sm:p-2 cursor-pointer transition-all hover:scale-[1.01] hover:z-20 shadow-sm border text-xs overflow-hidden flex flex-col justify-between ${
                                  item.meeting.will_record
                                    ? 'bg-sky-500/15 hover:bg-sky-500/25 border-sky-500/40 text-sky-950 dark:text-sky-200'
                                    : 'bg-slate-200/80 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                <div className="leading-tight overflow-hidden">
                                  <div className="flex items-center gap-1 font-bold truncate">
                                    {item.meeting.will_record ? (
                                      <Bot className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                                    ) : (
                                      <Ban className="w-3 h-3 text-slate-500 shrink-0" />
                                    )}
                                    <span className="truncate">{item.meeting.title}</span>
                                  </div>
                                  <p className="text-[10px] opacity-80 mt-0.5 font-mono truncate">
                                    {format(item.start, 'HH:mm')} - {format(item.end, 'HH:mm')}
                                  </p>
                                </div>

                                {item.heightPx > 42 && item.totalColumns <= 2 && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider opacity-75 truncate">
                                    {item.meeting.will_record ? 'Grabará' : 'Pausado'}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* MONTH VIEW */}
            {viewMode === 'month' && (
              <div className="flex-1 flex flex-col">
                {/* Month Day Headers */}
                <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-center font-bold text-[11px] text-slate-500 dark:text-slate-400 py-3">
                  <span>DOM</span>
                  <span>LUN</span>
                  <span>MAR</span>
                  <span>MIÉ</span>
                  <span>JUE</span>
                  <span>VIE</span>
                  <span>SÁB</span>
                </div>

                {/* Month Days Matrix */}
                <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-slate-200/70 dark:divide-slate-800/70 border-b border-slate-200 dark:border-slate-800">
                  {monthDays.map((day) => {
                    const dayMeetings = getMeetingsForDay(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const today = isToday(day);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[100px] p-2 transition-colors flex flex-col justify-between ${
                          isCurrentMonth
                            ? 'bg-white dark:bg-slate-900/60'
                            : 'bg-slate-50/50 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600'
                        } ${today ? 'ring-1 ring-inset ring-sky-500 bg-sky-500/[0.03]' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                              today
                                ? 'bg-sky-600 text-white font-extrabold'
                                : isCurrentMonth
                                ? 'text-slate-800 dark:text-slate-200'
                                : 'text-slate-400 dark:text-slate-600'
                            }`}
                          >
                            {format(day, 'd')}
                          </span>

                          {dayMeetings.length > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                              {dayMeetings.length}
                            </span>
                          )}
                        </div>

                        {/* Event Pills */}
                        <div className="space-y-1 mt-1 overflow-y-auto max-h-[80px]">
                          {dayMeetings.map((meeting) => (
                            <button
                              key={meeting.id}
                              onClick={() => openMeetingDetails(meeting)}
                              className={`w-full text-left px-2 py-1 rounded-lg text-[10px] font-medium truncate flex items-center gap-1 transition-all ${
                                meeting.will_record
                                  ? 'bg-sky-500/15 text-sky-800 dark:text-sky-300 hover:bg-sky-500/25'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0"></span>
                              <span className="truncate">{meeting.title}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AGENDA / LIST VIEW */}
            {viewMode === 'agenda' && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Agenda Filter Tabs */}
                <div className="p-4 sm:px-6 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/60 backdrop-blur-md flex items-center justify-between gap-3 flex-wrap shrink-0">
                  <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl text-xs font-semibold">
                    <button
                      onClick={() => setAgendaFilter('today')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        agendaFilter === 'today'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Hoy ({visibleTodayMeetings.length})
                    </button>
                    <button
                      onClick={() => setAgendaFilter('week')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        agendaFilter === 'week'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Esta Semana ({visibleWeekMeetings.length})
                    </button>
                    <button
                      onClick={() => setAgendaFilter('month')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        agendaFilter === 'month'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Este Mes ({visibleMonthMeetings.length})
                    </button>
                    <button
                      onClick={() => setAgendaFilter('all')}
                      className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                        agendaFilter === 'all'
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                      }`}
                    >
                      Todas ({meetings.length})
                    </button>
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    Mostrando {filteredAgendaMeetings.length} {filteredAgendaMeetings.length === 1 ? 'reunión' : 'reuniones'}
                  </span>
                </div>

                {/* Grouped Day Sections - Note: pt-0 and flush sticky headers so NO gap exists when scrolling! */}
                <div className="flex-1 p-4 sm:px-6 pt-0 space-y-6 overflow-y-auto max-h-[72vh]">
                  {groupedAgendaMeetings.length === 0 ? (
                    <div className="text-center py-16 text-slate-500">
                      <p>No hay reuniones en el rango seleccionado.</p>
                    </div>
                  ) : (
                    groupedAgendaMeetings.map((group, groupIdx) => {
                      const prevGroup = groupIdx > 0 ? groupedAgendaMeetings[groupIdx - 1] : null;
                      const showMonthHeader = agendaFilter === 'all' && (!prevGroup || prevGroup.monthKey !== group.monthKey);
                      const showWeekHeader =
                        (agendaFilter === 'all' || agendaFilter === 'month') &&
                        (!prevGroup || prevGroup.weekKey !== group.weekKey);

                      return (
                        <div key={group.date.toISOString()} className="space-y-3">
                          {/* Month Header Banner (when in 'all') */}
                          {showMonthHeader && (
                            <div className="pt-4 first:pt-2 pb-1">
                              <div className="flex items-center gap-3">
                                <span className="px-3.5 py-1.5 rounded-2xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-black text-xs uppercase tracking-wider flex items-center gap-2 border border-indigo-500/20 shadow-xs">
                                  <CalendarDays className="w-4 h-4 text-indigo-500" />
                                  <span>{group.monthLabel}</span>
                                </span>
                                <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/20 to-transparent"></div>
                              </div>
                            </div>
                          )}

                          {/* Week Header Indicator (when in 'all' or 'month') */}
                          {showWeekHeader && (
                            <div className="flex items-center gap-2.5 pt-2 pb-1">
                              <span
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border transition-all ${
                                  group.isCurrentWeek
                                    ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 font-extrabold shadow-xs'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <Layers className="w-3.5 h-3.5 text-sky-500" />
                                <span>{group.weekLabel}</span>
                                {group.isCurrentWeek && (
                                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sky-500 text-white text-[9px] font-black uppercase tracking-tight">
                                    Esta Semana
                                  </span>
                                )}
                              </span>
                              <div className="flex-1 h-px bg-slate-200/70 dark:bg-slate-800/70"></div>
                            </div>
                          )}

                          {/* Day Header Divider - Sticky directly at top-0 with NO GAP */}
                          <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md py-2.5 z-20 border-b border-slate-100 dark:border-slate-800/80 -mx-4 sm:-mx-6 px-4 sm:px-6 flex items-center justify-between gap-2 shadow-xs">
                            <span
                              className={`px-3 py-1 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                                group.isToday
                                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25 ring-2 ring-sky-400/30'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60'
                              }`}
                            >
                              <CalendarIcon className="w-3.5 h-3.5" />
                              <span>{format(group.date, "EEEE, d 'de' MMMM", { locale: es })}</span>
                              {group.isToday && (
                                <span className="ml-1 px-1.5 py-0.5 rounded-md bg-white text-sky-700 text-[9px] font-black tracking-tight">
                                  HOY
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] text-slate-400 font-semibold shrink-0">
                              {group.items.length} {group.items.length === 1 ? 'reunión' : 'reuniones'}
                            </span>
                          </div>

                          {/* Meeting Cards in this Day */}
                          <div className="space-y-2.5">
                            {group.items.map((meeting) => {
                              const start = new Date(meeting.start_time);
                              const end = new Date(meeting.end_time);

                              return (
                                <div
                                  key={meeting.id}
                                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                    group.isToday
                                      ? 'bg-sky-500/[0.03] border-sky-500/30 hover:border-sky-500/50 shadow-xs'
                                      : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                                  }`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                                        {meeting.title}
                                      </h3>

                                      {/* Sleek Tooltip for Excluded Reason */}
                                      {meeting.block_reason && (
                                        <div className="relative group/tooltip inline-flex items-center">
                                          <span
                                            title={meeting.block_reason}
                                            className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] flex items-center gap-1 font-semibold cursor-help"
                                          >
                                            <Ban className="w-3 h-3 text-rose-500" />
                                            <span>Excluido</span>
                                          </span>

                                          {/* Floating Hover Tooltip */}
                                          <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover/tooltip:flex flex-col z-30 pointer-events-none">
                                            <div className="bg-slate-900 text-white text-[11px] font-medium py-1 px-2.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700">
                                              {meeting.block_reason}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                      </span>
                                      <span>•</span>
                                      <a
                                        href={meeting.meet_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sky-600 dark:text-sky-400 hover:underline font-mono text-[11px] flex items-center gap-1"
                                      >
                                        {meeting.meet_url}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2.5 shrink-0">
                                    <button
                                      onClick={() => openMeetingScopeChoice(meeting)}
                                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                                        meeting.will_record
                                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                      }`}
                                    >
                                      {meeting.will_record ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                                          <span>Bot Activo</span>
                                        </>
                                      ) : (
                                        <>
                                          <Ban className="w-3.5 h-3.5 text-slate-400" />
                                          <span>Pausado</span>
                                        </>
                                      )}
                                    </button>

                                    <button
                                      onClick={() =>
                                        navigate(
                                          `/join?url=${encodeURIComponent(meeting.meet_url)}&title=${encodeURIComponent(
                                            meeting.title
                                          )}`
                                        )
                                      }
                                      title="Entrar ahora mismo con el bot"
                                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                                    >
                                      <Video className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Unified Meeting Modal (Details & Scope Switcher) */}
      {selectedMeeting &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => {
              setSelectedMeeting(null);
              setModalMode('details');
            }}
          >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            {modalMode === 'details' ? (
              <>
                {/* Details Header */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Detalles de Reunión</span>
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                      {selectedMeeting.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMeeting(null);
                      setModalMode('details');
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Time & Link Details */}
                <div className="space-y-3 text-xs">
                  <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                    <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {format(new Date(selectedMeeting.start_time), "EEEE, d 'de' MMMM", { locale: es })}
                      </p>
                      <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                        {format(new Date(selectedMeeting.start_time), 'HH:mm')} - {format(new Date(selectedMeeting.end_time), 'HH:mm')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/50 border border-slate-200/80 dark:border-slate-800">
                    <div className="truncate mr-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Enlace de Google Meet
                      </p>
                      <p className="font-mono text-slate-700 dark:text-slate-300 truncate text-[11px] mt-0.5">
                        {selectedMeeting.meet_url}
                      </p>
                    </div>
                    <a
                      href={selectedMeeting.meet_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-colors shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => setModalMode('scope_choice')}
                    className={`flex-1 py-3 px-4 rounded-2xl text-xs font-semibold transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                      selectedMeeting.will_record
                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                    }`}
                  >
                    {selectedMeeting.will_record ? (
                      <>
                        <Ban className="w-4 h-4" />
                        <span>Pausar Grabación</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Activar Bot</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedMeeting(null);
                      navigate(
                        `/join?url=${encodeURIComponent(selectedMeeting.meet_url)}&title=${encodeURIComponent(
                          selectedMeeting.title
                        )}`
                      );
                    }}
                    className="py-3 px-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>Entrar Ahora</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Scope Choice View */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        !selectedMeeting.will_record
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {!selectedMeeting.will_record ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Ban className="w-3.5 h-3.5" />
                      )}
                      <span>{!selectedMeeting.will_record ? 'Activar Grabación' : 'Pausar Grabación'}</span>
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                      {selectedMeeting.title}
                    </h2>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedMeeting(null);
                      setModalMode('details');
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {!selectedMeeting.will_record
                    ? '¿Deseas activar la grabación solo para esta reunión o para todas las repeticiones?'
                    : '¿Deseas pausar la grabación solo para esta reunión o excluir todas las repeticiones de esta serie?'}
                </p>

                <div className="space-y-3">
                  {/* Option 1: Solo este evento */}
                  <button
                    onClick={() => executeToggle(selectedMeeting, !selectedMeeting.will_record, 'single')}
                    className="w-full text-left p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-950/50 hover:bg-sky-500/5 hover:border-sky-500/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 group-hover:text-sky-500 group-hover:border-sky-500/30 shrink-0">
                        <CalendarCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          Solo este evento
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Aplica únicamente para la reunión del{' '}
                          {format(new Date(selectedMeeting.start_time), "d 'de' MMMM", { locale: es })}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Todas las repeticiones (Serie completa) */}
                  <button
                    onClick={() => executeToggle(selectedMeeting, !selectedMeeting.will_record, 'series')}
                    className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer group ${
                      !selectedMeeting.will_record
                        ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2.5 rounded-xl bg-white dark:bg-slate-800 border shrink-0 ${
                          !selectedMeeting.will_record
                            ? 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'border-rose-500/30 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <h4
                          className={`text-xs font-bold ${
                            !selectedMeeting.will_record
                              ? 'text-emerald-950 dark:text-emerald-200'
                              : 'text-rose-950 dark:text-rose-200'
                          }`}
                        >
                          {!selectedMeeting.will_record
                            ? 'Todas las repeticiones (Quitar regla de exclusión)'
                            : 'Todas las repeticiones (Excluir serie)'}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {!selectedMeeting.will_record
                            ? 'Elimina la regla de bloqueo y reactiva todas las reuniones con este título'
                            : 'Agrega una regla a "Reuniones Excluidas" (Configuración) para pausar todas las fechas'}
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="pt-2 flex justify-between items-center">
                  <button
                    onClick={() => setModalMode('details')}
                    className="px-3 py-2 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Volver a detalles</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedMeeting(null);
                      setModalMode('details');
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
