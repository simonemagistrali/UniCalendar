import { useState, useMemo, useEffect } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { TravelManager } from '../../../core/TravelManager';
import { MealManager } from '../../../core/MealManager';
import { fetchGoogleCalendarEvents } from '../../../core/googleCalendar';
import { EventDetailsModal } from '../events/EventDetailsModal';
import { EventFormModal } from '../events/EventFormModal';
import './Calendar.css';

type ViewMode = 'month' | 'week' | 'day';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 - 21:00

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem('calendarView') as ViewMode) || 'month';
  });
  
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('calendarView', viewMode);
  }, [viewMode]);

  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const studySessions = useAppStore(s => s.studySessions);
  const preferences = useAppStore(s => s.preferences);
  const addEvents = useAppStore(s => s.addEvents);

  const [isSyncing, setIsSyncing] = useState(false);

  const handleGoogleSync = async () => {
    setIsSyncing(true);
    try {
      // Chiama l'API reale di Google tramite l'autenticazione Firebase
      const realEvents = await fetchGoogleCalendarEvents();
      if (realEvents.length > 0) {
        addEvents(realEvents as any[]);
        // Opzionale: richiamare syncAndSchedule dello store per ripianificare in base ai nuovi eventi
      }
    } catch (error) {
      console.error("Sincronizzazione Google fallita:", error);
      alert("Errore durante la sincronizzazione con Google Calendar. Assicurati che le API siano abilitate su Firebase.");
    } finally {
      setIsSyncing(false);
    }
  };

  const next = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };
  const prev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  // Merge events + study sessions for display
  const allItems = useMemo(() => {
    const items: { id: string; title: string; start: Date; end: Date; color: string; type: string; isTravelStudyTime?: boolean }[] = [];

    const computedTravelEvents = TravelManager.generateTravelEvents(events, preferences);
    // Generate meal events for the current viewed month/week/day window (+/- some buffer)
    const viewStartDate = subDays(currentDate, 14);
    const computedMealEvents = MealManager.generateMealEvents(preferences, viewStartDate, 45);
    const allEvents = [...events, ...computedTravelEvents, ...computedMealEvents];

    for (const e of allEvents) {
      const course = e.courseId ? courses.find(c => c.id === e.courseId) : undefined;
      let color = course?.color || 'var(--accent-primary)';
      if (e.type === 'exam') color = '#d93025';
      else if (e.type === 'sport') color = '#188038';
      else if (e.type === 'travel') color = '#5f6368';
      else if (e.type === 'project_deadline') color = '#a142f4';
      else if (e.type === 'meal') color = '#f09300'; // Orange for lunch break

      items.push({
        id: e.id,
        title: e.title,
        start: new Date(e.startTime),
        end: new Date(e.endTime),
        color,
        type: e.type,
        isTravelStudyTime: e.isTravelStudyTime,
      });
    }

    for (const t of tasks) {
      if (t.deadline) {
        const course = t.courseId ? courses.find(c => c.id === t.courseId) : undefined;
        items.push({
          id: `deadline-${t.id}`,
          title: `Scadenza: ${t.title}`,
          start: new Date(t.deadline),
          end: new Date(new Date(t.deadline).getTime() + 30 * 60000), // 30 min duration for display
          color: '#d93025', // Red color for deadline
          type: 'deadline',
        });
      }
    }

    for (const s of studySessions) {
      if (s.isBuffer) {
        items.push({
          id: s.id,
          title: '☕ Pausa',
          start: new Date(s.startTime),
          end: new Date(s.endTime),
          color: '#dadce0',
          type: 'buffer',
        });
      } else {
        const task = tasks.find(t => t.id === s.taskId);
        const course = task?.courseId ? courses.find(c => c.id === task.courseId) : undefined;
        items.push({
          id: s.id,
          title: task?.title || 'Studio',
          start: new Date(s.startTime),
          end: new Date(s.endTime),
          color: course?.color ? course.color + 'aa' : '#c2e7ff', // slightly more opaque
          type: 'study',
        });
      }
    }

    return items;
  }, [events, studySessions, tasks, courses]);

  const dateFormat = viewMode === 'month'
    ? "MMMM yyyy"
    : viewMode === 'week'
    ? "'Settimana del' d MMMM"
    : "EEEE d MMMM yyyy";

  const handleEventClick = (id: string) => {
    // Only handle actual events (not tasks/deadlines/study sessions for now)
    if (events.some(e => e.id === id)) {
      setSelectedEventId(id);
      setIsDetailsOpen(true);
    }
  };

  const selectedEvent = events.find(e => e.id === selectedEventId) || null;

  return (
    <div className="calendar-container">
      {/* Header */}
      <div className="calendar-header">
        <div className="calendar-header-left">
          <h2 className="calendar-title">{format(currentDate, dateFormat, { locale: it })}</h2>
          <div className="calendar-nav">
            <button onClick={prev} className="calendar-nav-btn"><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="calendar-today-btn">Oggi</button>
            <button onClick={next} className="calendar-nav-btn"><ChevronRight size={20} /></button>
          </div>
        </div>
        <div className="calendar-header-right" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button 
            className="calendar-sync-btn"
            onClick={handleGoogleSync}
            disabled={isSyncing}
            title="Scarica eventi da Google Calendar"
          >
            <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
            {isSyncing ? 'Sincronizzazione...' : 'Sincronizza Google'}
          </button>
          <div className="calendar-view-toggle">
            {(['month', 'week', 'day'] as ViewMode[]).map(m => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`calendar-view-btn ${viewMode === m ? 'active' : ''}`}
              >
                {m === 'month' ? 'Mese' : m === 'week' ? 'Settimana' : 'Giorno'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      {viewMode === 'month' && <MonthView currentDate={currentDate} items={allItems} onEventClick={handleEventClick} />}
      {viewMode === 'week' && <WeekView currentDate={currentDate} items={allItems} onEventClick={handleEventClick} />}
      {viewMode === 'day' && <DayView currentDate={currentDate} items={allItems} onEventClick={handleEventClick} />}

      <EventDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        event={selectedEvent}
        onEdit={() => setIsFormOpen(true)}
      />

      <EventFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        initialEvent={selectedEvent}
      />
    </div>
  );
}

/* ─── Month View ─── */
function MonthView({ currentDate, items, onEventClick }: { currentDate: Date; items: { id: string; title: string; start: Date; end: Date; color: string; type: string }[]; onEventClick: (id: string) => void }) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const days: React.ReactNode[] = [];
  let day = gridStart;

  while (day <= gridEnd) {
    const d = day;
    const dayItems = items.filter(it => isSameDay(it.start, d));
    let cls = 'calendar-day';
    if (!isSameMonth(d, monthStart)) cls += ' other-month';
    if (isSameDay(d, new Date())) cls += ' today';

    days.push(
      <div className={cls} key={d.toISOString()}>
        <span className="calendar-day-num">{format(d, 'd')}</span>
        <div className="calendar-events">
          {dayItems.slice(0, 4).map(it => (
            <div key={it.id} className="calendar-event" title={it.title} onClick={() => onEventClick(it.id)} style={{ cursor: 'pointer' }}>
              <span
                className="calendar-event-dot"
                style={{
                  backgroundColor: it.type === 'study' || it.type === 'buffer' ? (it.type === 'buffer' ? '#dadce0' : it.color) : it.color,
                  borderColor: it.color,
                  borderWidth: it.type === 'study' || it.type === 'buffer' ? '0' : '0',
                  borderStyle: 'solid'
                }}
              />
              <span className="calendar-event-text">{it.title}</span>
            </div>
          ))}
          {dayItems.length > 4 && <div className="calendar-event-more">+{dayItems.length - 4} altri</div>}
        </div>
      </div>
    );
    day = addDays(day, 1);
  }

  return (
    <div className="calendar-month">
      {weekDays.map(w => <div key={w} className="calendar-weekday">{w}</div>)}
      {days}
    </div>
  );
}

/* ─── Week View ─── */
function WeekView({ currentDate, items, onEventClick }: { currentDate: Date; items: { id: string; title: string; start: Date; end: Date; color: string; type: string }[]; onEventClick: (id: string) => void }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="calendar-timeline">
      <div className="timeline-header">
        <div className="timeline-gutter" />
        {weekDays.map(d => (
          <div key={d.toISOString()} className={`timeline-day-header ${isSameDay(d, new Date()) ? 'today' : ''}`}>
            <span className="timeline-day-name">{format(d, 'EEE', { locale: it })}</span>
            <span className={`timeline-day-num ${isSameDay(d, new Date()) ? 'today-num' : ''}`}>{format(d, 'd')}</span>
          </div>
        ))}
      </div>
      <div className="timeline-body">
        <div className="timeline-hours">
          {HOURS.map(h => (
            <div key={h} className="timeline-hour-label">{`${h}:00`}</div>
          ))}
        </div>
        <div className="timeline-grid">
          {weekDays.map(d => (
            <div key={d.toISOString()} className="timeline-column">
              {HOURS.map(h => <div key={h} className="timeline-cell" />)}
              {/* Render current time indicator */}
              <CurrentTimeIndicator date={d} />
              {/* Render events */}
              {calculateEventPositions(items.filter(it => isSameDay(it.start, d))).map(it => {
                const top = getTimePosition(it.start);
                const height = Math.max(0, getTimePosition(it.end) - top - 1);
                return (
                  <div
                    key={it.id}
                    className="timeline-event"
                    onClick={() => onEventClick(it.id)}
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      left: it._left,
                      width: it._width,
                      backgroundColor: it.type === 'meal' ? `${it.color}33` : it.color,
                      border: it.type === 'meal' ? `1px dashed ${it.color}` : 'none',
                      backgroundImage: it.isTravelStudyTime ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' : undefined,
                      color: it.type === 'buffer' || it.type === 'study' || it.type === 'meal' ? 'var(--text-primary)' : '#fff',
                      cursor: 'pointer'
                    }}
                    title={it.title}
                  >
                    <span className="timeline-event-title">{it.title}</span>
                    <span className="timeline-event-time">
                      {format(it.start, 'HH:mm')} - {format(it.end, 'HH:mm')}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Day View ─── */
function DayView({ currentDate, items, onEventClick }: { currentDate: Date; items: { id: string; title: string; start: Date; end: Date; color: string; type: string; isTravelStudyTime?: boolean }[]; onEventClick: (id: string) => void }) {
  const dayItems = items.filter(it => isSameDay(it.start, currentDate));

  return (
    <div className="calendar-timeline calendar-day-view">
      <div className="timeline-body">
        <div className="timeline-hours">
          {HOURS.map(h => (
            <div key={h} className="timeline-hour-label">{`${h}:00`}</div>
          ))}
        </div>
        <div className="timeline-grid">
          <div className="timeline-column timeline-single-col">
            {HOURS.map(h => <div key={h} className="timeline-cell" />)}
            <CurrentTimeIndicator date={currentDate} />
            {calculateEventPositions(dayItems).map(it => {
              const top = getTimePosition(it.start);
              const height = Math.max(0, getTimePosition(it.end) - top - 1);
              return (
                <div
                  key={it.id}
                  className="timeline-event"
                  onClick={() => onEventClick(it.id)}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: it._left,
                    width: it._width,
                    backgroundColor: it.type === 'meal' ? `${it.color}33` : it.color,
                    border: it.type === 'meal' ? `1px dashed ${it.color}` : 'none',
                    backgroundImage: it.isTravelStudyTime ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)' : undefined,
                    color: it.type === 'buffer' || it.type === 'study' || it.type === 'meal' ? 'var(--text-primary)' : '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <span className="timeline-event-title">{it.title}</span>
                  <span className="timeline-event-time">
                    {format(it.start, 'HH:mm')} - {format(it.end, 'HH:mm')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator({ date }: { date: Date }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!isSameDay(date, new Date())) return;
    
    const interval = setInterval(() => {
      setNow(new Date());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [date]);

  if (!isSameDay(date, now)) return null;

  const top = getTimePosition(now);
  
  // Hide if outside the rendered hours (6:00 to 22:00)
  if (top < 0 || top > 16 * 60) return null; 

  return (
    <div className="current-time-indicator" style={{ top: `${top}px` }}>
      <div className="current-time-indicator-dot" />
    </div>
  );
}

/** Convert a Date to pixel position in the timeline (6:00 = 0px) */
function getTimePosition(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, (hours - 6) * 60); // 60px per hour, starting at 6:00
}

/** Calculates left and width for events to avoid overlapping visually */
function calculateEventPositions(dayItems: any[]) {
  const sorted = [...dayItems].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  const clusters: any[][] = [];
  let currentCluster: any[] = [];
  let clusterMaxEnd = 0;
  
  for (const item of sorted) {
    if (currentCluster.length > 0 && item.start.getTime() >= clusterMaxEnd) {
      clusters.push(currentCluster);
      currentCluster = [];
      clusterMaxEnd = 0;
    }
    currentCluster.push(item);
    clusterMaxEnd = Math.max(clusterMaxEnd, item.end.getTime());
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }
  
  const positionedItems = [];
  for (const cluster of clusters) {
    const columns: any[][] = [];
    for (const item of cluster) {
      let placed = false;
      for (const col of columns) {
        const lastInCol = col[col.length - 1];
        if (item.start.getTime() >= lastInCol.end.getTime()) {
          col.push(item);
          item._col = columns.indexOf(col);
          placed = true;
          break;
        }
      }
      if (!placed) {
        item._col = columns.length;
        columns.push([item]);
      }
    }
    
    const colCount = columns.length;
    for (const item of cluster) {
      positionedItems.push({
        ...item,
        _left: `calc(${(item._col / colCount) * 100}% + 2px)`,
        _width: `calc(${100 / colCount}% - 4px)`
      });
    }
  }
  
  return positionedItems;
}
