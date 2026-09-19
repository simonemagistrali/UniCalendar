import { useState, useEffect } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import type { CalendarEvent } from '../../../core/types';

interface TravelEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentEvent: CalendarEvent | null;
  direction: 'in' | 'out' | null;
  currentTravelStart: Date | null;
  currentTravelEnd: Date | null;
}

export function TravelEditModal({ isOpen, onClose, parentEvent, direction, currentTravelStart, currentTravelEnd }: TravelEditModalProps) {
  const updateEvent = useAppStore(s => s.updateEvent);
  const setEvents = useAppStore(s => s.setEvents);
  const events = useAppStore(s => s.events);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  useEffect(() => {
    if (isOpen && currentTravelStart && currentTravelEnd) {
      setStartTime(currentTravelStart.toTimeString().substring(0, 5));
      setEndTime(currentTravelEnd.toTimeString().substring(0, 5));
    }
  }, [isOpen, currentTravelStart, currentTravelEnd]);

  const isSimilarEvent = (e1: CalendarEvent, e2: CalendarEvent) => {
    const d1 = new Date(e1.startTime);
    const d2 = new Date(e2.startTime);
    const sameCourseOrTitle = e1.courseId === e2.courseId && (!e1.courseId ? e1.title === e2.title : true);
    const sameDayOfWeek = d1.getDay() === d2.getDay();
    const sameTime = d1.getHours() === d2.getHours() && d1.getMinutes() === d2.getMinutes();
    return sameCourseOrTitle && sameDayOfWeek && sameTime;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentEvent || !direction || !currentTravelStart) return;

    // We only change the time portion of the date for the travel
    const travelDateStr = currentTravelStart.toISOString().split('T')[0];
    const newTravelStart = new Date(`${travelDateStr}T${startTime}`);
    const newTravelEnd = new Date(`${travelDateStr}T${endTime}`);
    
    // Parent event boundaries to calculate offsets
    const parentStart = new Date(parentEvent.startTime);
    const parentEnd = new Date(parentEvent.endTime);

    const eventUpdates: Partial<CalendarEvent> = {};

    if (direction === 'in') {
      // Offset before parent start
      const startOffsetMins = Math.round((parentStart.getTime() - newTravelStart.getTime()) / 60000);
      const endOffsetMins = Math.round((parentStart.getTime() - newTravelEnd.getTime()) / 60000);
      eventUpdates.travelInStartOffset = startOffsetMins;
      eventUpdates.travelInEndOffset = endOffsetMins;
    } else {
      // Offset after parent end
      const startOffsetMins = Math.round((newTravelStart.getTime() - parentEnd.getTime()) / 60000);
      const endOffsetMins = Math.round((newTravelEnd.getTime() - parentEnd.getTime()) / 60000);
      eventUpdates.travelOutStartOffset = startOffsetMins;
      eventUpdates.travelOutEndOffset = endOffsetMins;
    }

    const similarEvents = events.filter(e => e.id !== parentEvent.id && isSimilarEvent(e, parentEvent));
      
    let updateAll = false;
    if (similarEvents.length > 0) {
      updateAll = window.confirm(`Vuoi applicare queste modifiche anche ai viaggi degli altri ${similarEvents.length} eventi uguali (stessa materia, giorno della settimana e orario)?\n\nOK = Modifica tutti i simili\nAnnulla = Solo questo viaggio`);
    }

    if (updateAll) {
      const idsToUpdate = [parentEvent.id, ...similarEvents.map(e => e.id)];
      const updatedEvents = events.map(e => {
        if (idsToUpdate.includes(e.id)) {
          return { ...e, ...eventUpdates };
        }
        return e;
      });
      setEvents(updatedEvents);
    } else {
      updateEvent(parentEvent.id, eventUpdates);
    }

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Modifica Viaggio">
      <form onSubmit={handleSubmit} className="event-form">
        <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>
          Modifica gli orari di questo spostamento. Le modifiche sono calcolate rispetto all'inizio e fine della lezione.
        </p>

        <div className="form-row">
          <div className="form-field">
            <label>Inizio Viaggio</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Fine Viaggio</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
          </div>
        </div>

        <div className="form-actions">
          <Button variant="ghost" onClick={onClose} type="button">Annulla</Button>
          <Button variant="primary" type="submit">Salva Modifiche</Button>
        </div>
      </form>
    </Modal>
  );
}
