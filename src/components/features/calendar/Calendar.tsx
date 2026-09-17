import { useState, useMemo } from "react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, subDays, addWeeks, subWeeks } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import './Calendar.css';

type ViewMode = 'month' | 'week' | 'day';

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6:00 - 21:00

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const studySessions = useAppStore(s => s.studySessions);

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
    const items: { id: string; title: string; start: Date; end: Date; color: string; type: string }[] = [];

    for (const e of events) {
      const course = e.courseId ? courses.find(c => c.id === e.courseId) : undefined;
      let color = course?.color || 'var(--accent-primary)';
      if (e.type === 'exam') color = '#d93025';
      else if (e.type === 'sport') color = '#188038';
      else if (e.type === 'travel') color = '#5f6368';
      else if (e.type === 'project_deadline') color = '#a142f4';

      items.push({
        id: e.id,
        title: e.title,
        start: new Date(e.startTime),
        end: new Date(e.endTime),
        color,
        type: e.type,
      });
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
          color: course?.color ? course.color + '88' : '#e8f0fe',
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

      {/* Body */}
      {viewMode === 'month' && <MonthView currentDate={currentDate} items={allItems} />}
      {viewMode === 'week' && <WeekView currentDate={currentDate} items={allItems} />}
      {viewMode === 'day' && <DayView currentDate={currentDate} items={allItems} />}
    </div>
  );
}

/* ─── Month View ─── */
function MonthView({ currentDate, items }: { currentDate: Date; items: { id: string; title: string; start: Date; end: Date; color: string; type: string }[] }) {
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
          {dayItems.slice(0, 3).map(it => (
            <div key={it.id} className="calendar-event" style={{ backgroundColor: it.color, color: it.type === 'buffer' || it.type === 'study' ? 'var(--text-primary)' : '#fff' }}>
              {it.title}
            </div>
          ))}
          {dayItems.length > 3 && <div className="calendar-event-more">+{dayItems.length - 3}</div>}
        </div>
      </div>
    );
    day = addDays(day, 1);
  }

  return (
    <div className="calendar-month">
      <div className="calendar-grid-header">
        {weekDays.map(w => <div key={w} className="calendar-weekday">{w}</div>)}
      </div>
      <div className="calendar-grid-body">{days}</div>
    </div>
  );
}

/* ─── Week View ─── */
function WeekView({ currentDate, items }: { currentDate: Date; items: { id: string; title: string; start: Date; end: Date; color: string; type: string }[] }) {
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
              {/* Render events */}
              {items.filter(it => isSameDay(it.start, d)).map(it => {
                const top = getTimePosition(it.start);
                const height = Math.max(getTimePosition(it.end) - top, 20);
                return (
                  <div
                    key={it.id}
                    className="timeline-event"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      backgroundColor: it.color,
                      color: it.type === 'buffer' || it.type === 'study' ? 'var(--text-primary)' : '#fff',
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
function DayView({ currentDate, items }: { currentDate: Date; items: { id: string; title: string; start: Date; end: Date; color: string; type: string }[] }) {
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
            {dayItems.map(it => {
              const top = getTimePosition(it.start);
              const height = Math.max(getTimePosition(it.end) - top, 20);
              return (
                <div
                  key={it.id}
                  className="timeline-event"
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    backgroundColor: it.color,
                    color: it.type === 'buffer' || it.type === 'study' ? 'var(--text-primary)' : '#fff',
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

/** Convert a Date to pixel position in the timeline (6:00 = 0px) */
function getTimePosition(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, (hours - 6) * 60); // 60px per hour, starting at 6:00
}
