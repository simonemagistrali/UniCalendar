import React, { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, parseISO } from 'date-fns';
import { it } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Calendar.css';

const mockEvents = [
  { id: '1', date: new Date().toISOString(), title: 'Analisi I (Th)', type: 'lesson', color: 'var(--accent-primary)' },
  { id: '2', date: new Date().toISOString(), title: 'Sistemazione Appunti', type: 'study', color: 'var(--accent-warning)' },
  { id: '3', date: addDays(new Date(), 2).toISOString(), title: 'Esame Fisica', type: 'exam', color: 'var(--accent-danger)' },
];

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = "MMMM yyyy";
  const days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, "d");
      const cloneDay = day;
      
      const dayEvents = mockEvents.filter(e => isSameDay(parseISO(e.date), cloneDay));
      
      let dayClass = 'calendar-day';
      if (!isSameMonth(day, monthStart)) dayClass += ' other-month';
      if (isSameDay(day, new Date())) dayClass += ' today';

      days.push(
        <div className={dayClass} key={day.toISOString()}>
          <span className="calendar-day-num">{formattedDate}</span>
          <div className="calendar-events">
            {dayEvents.map(evt => (
              <div 
                key={evt.id} 
                className="calendar-event"
                style={{ backgroundColor: evt.color }}
              >
                {evt.title}
              </div>
            ))}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
  }

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="glass-panel calendar-container p-6">
      <div className="calendar-header">
        <h2 className="calendar-title text-gradient">
          {format(currentDate, dateFormat, { locale: it })}
        </h2>
        <div className="calendar-nav">
          <button onClick={prevMonth} className="calendar-nav-btn"><ChevronLeft /></button>
          <button onClick={nextMonth} className="calendar-nav-btn"><ChevronRight /></button>
        </div>
      </div>
      
      <div className="calendar-grid-header">
        {weekDays.map(wd => (
          <div key={wd} className="calendar-weekday">
            {wd}
          </div>
        ))}
      </div>
      <div className="calendar-grid-body">
        {days}
      </div>
    </div>
  );
}
