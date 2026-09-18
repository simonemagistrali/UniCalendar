import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CalendarEvent } from '../../../core/types';

interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onEdit: (event: CalendarEvent) => void;
}

export function EventDetailsModal({ isOpen, onClose, event, onEdit }: EventDetailsModalProps) {
  const removeEvent = useAppStore(s => s.removeEvent);
  const courses = useAppStore(s => s.courses);
  const events = useAppStore(s => s.events);
  const setEvents = useAppStore(s => s.setEvents);

  if (!event) return null;

  const course = event.courseId ? courses.find(c => c.id === event.courseId) : null;
  
  const isSimilarEvent = (e1: CalendarEvent, e2: CalendarEvent) => {
    const d1 = new Date(e1.startTime);
    const d2 = new Date(e2.startTime);
    const sameCourseOrTitle = e1.courseId === e2.courseId && (!e1.courseId ? e1.title === e2.title : true);
    const sameDayOfWeek = d1.getDay() === d2.getDay();
    const sameTime = d1.getHours() === d2.getHours() && d1.getMinutes() === d2.getMinutes();
    return sameCourseOrTitle && sameDayOfWeek && sameTime;
  };

  const handleDelete = () => {
    const similarEvents = events.filter(e => e.id !== event.id && isSimilarEvent(e, event));
    
    if (similarEvents.length > 0) {
      const resp = window.confirm(`Vuoi eliminare anche gli altri ${similarEvents.length} eventi uguali (stessa materia, giorno e orario)?\n\nOK = Elimina tutti\nAnnulla = Elimina solo questo`);
      if (resp) {
        const idsToDelete = [event.id, ...similarEvents.map(e => e.id)];
        const nextEvents = events.filter(e => !idsToDelete.includes(e.id));
        setEvents(nextEvents);
      } else {
        removeEvent(event.id);
      }
    } else {
      if (window.confirm('Sei sicuro di voler eliminare questo evento?')) {
        removeEvent(event.id);
      }
    }
    onClose();
  };

  const getEventTypeName = (e: CalendarEvent) => {
    if (e.type === 'lesson') {
      const typeStr = e.lessonType === 'theory' ? 'Teoria' :
                      e.lessonType === 'exercise' ? 'Esercitazione' :
                      e.lessonType === 'theory_exercise' ? 'Teoria + Esercizi' :
                      e.lessonType === 'lab' ? 'Laboratorio' : 'Lezione';
      return `Lezione (${typeStr})`;
    }
    const map: Record<string, string> = {
      exam: 'Esame',
      generic: 'Generico',
      sport: 'Sport',
      travel: 'Viaggio/Spostamento',
      project_deadline: 'Progetto/Scadenza',
      other: 'Altro'
    };
    return map[e.type] || e.type;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dettagli Evento">
      <div className="event-details" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>{event.title}</h3>
          {course && <div style={{ color: 'var(--text-secondary)' }}>Corso: {course.name}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data</div>
            <div>{format(new Date(event.startTime), 'dd MMMM yyyy', { locale: it })}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Orario</div>
            <div>{format(new Date(event.startTime), 'HH:mm')} - {format(new Date(event.endTime), 'HH:mm')}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tipo</div>
            <div style={{ textTransform: 'capitalize' }}>{getEventTypeName(event)}</div>
          </div>
          {event.location && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Luogo</div>
              <div>{event.location.type === 'remote' ? 'Online' : event.location.address || 'In presenza'}</div>
            </div>
          )}
        </div>

        <div className="form-actions" style={{ marginTop: '8px' }}>
          <Button variant="danger" onClick={handleDelete}>Elimina</Button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={onClose}>Chiudi</Button>
            <Button variant="primary" onClick={() => { onClose(); onEdit(event); }}>Modifica</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
