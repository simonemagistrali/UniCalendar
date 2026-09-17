import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, subDays, addWeeks, subWeeks, parseISO, isWithinInterval } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import './Calendar.css';

type ViewMode = 'month' | 'week' | 'day';

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  const events = useAppStore(state => state.events);
  const tasks = useAppStore(state => state.tasks);

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

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = viewMode === 'month' ? "MMMM yyyy" : viewMode === 'week' ? "'Settimana del' d MMMM" : "EEEE d MMMM yyyy";
  const days = [];
  let day = startDate;
  let formattedDate = "";

  // Filter events dynamically based on Zustand store
  const allCalendarItems = [
    ...events.map(e => ({ id: e.id, date: e.startTime, title: e.title, color: 'var(--accent-primary)' })),
    ...tasks.map(t => ({ id: t.id, date: t.deadline || t.createdAt, title: t.title, color: 'var(--accent-warning)' }))
  ];

  if (viewMode === 'month') {
    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        formattedDate = format(day, "d");
        const cloneDay = day;
        
        const dayEvents = allCalendarItems.filter(e => isSameDay(e.date, cloneDay));
        
        let dayClass = 'calendar-day';
        if (!isSameMonth(day, monthStart)) dayClass += ' other-month';
        if (isSameDay(day, new Date())) dayClass += ' today';

        days.push(
          <div className={dayClass} key={day.toISOString()}>
            <span className="calendar-day-num">{formattedDate}</span>
            <div className="calendar-events">
              {dayEvents.slice(0, 3).map(evt => (
                <div 
                  key={evt.id} 
                  className="calendar-event text-xs truncate p-1 mb-1 rounded"
                  style={{ backgroundColor: evt.color, color: 'white' }}
                >
                  {evt.title}
                </div>
              ))}
              {dayEvents.length > 3 && <div className="text-xs text-muted text-center">+{dayEvents.length - 3}</div>}
            </div>
          </div>
        );
        day = addDays(day, 1);
      }
    }
  } else {
    // Placeholder for Day/Week detailed views (would require a timeline grid)
    days.push(
      <div key="placeholder" className="p-8 text-center text-muted flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <List size={48} className="mb-4 opacity-20" />
        <p>La vista dettagliata {viewMode === 'week' ? 'settimanale' : 'giornaliera'} arriverà presto.</p>
        <p className="text-xs mt-2">Qui verranno mostrati gli slot temporali per {viewMode === 'week' ? 'tutta la settimana' : 'la giornata'}.</p>
      </div>
    );
  }

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="glass-panel calendar-container p-6 flex flex-col h-full min-h-[500px]">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-[var(--text-primary)] capitalize">
            {format(currentDate, dateFormat, { locale: it })}
          </h2>
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-1 border border-[var(--border-color)]">
            <button onClick={prev} className="p-1 hover:bg-white rounded-md transition-colors"><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 text-sm font-medium hover:bg-white rounded-md transition-colors">Oggi</button>
            <button onClick={next} className="p-1 hover:bg-white rounded-md transition-colors"><ChevronRight size={20} /></button>
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="flex bg-[var(--bg-secondary)] rounded-lg p-1 border border-[var(--border-color)]">
          {(['month', 'week', 'day'] as ViewMode[]).map(mode => (
            <button 
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === mode ? 'bg-white shadow-sm text-[var(--accent-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
            >
              {mode === 'month' ? 'Mese' : mode === 'week' ? 'Settimana' : 'Giorno'}
            </button>
          ))}
        </div>
      </div>
      
      {viewMode === 'month' ? (
        <div className="flex-1 flex flex-col">
          <div className="calendar-grid-header">
            {weekDays.map(wd => (
              <div key={wd} className="calendar-weekday">
                {wd}
              </div>
            ))}
          </div>
          <div className="calendar-grid-body flex-1">
            {days}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
           {days}
        </div>
      )}
    </div>
  );
}
