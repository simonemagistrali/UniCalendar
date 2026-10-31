import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import type { CalendarEvent } from '../../../core/types';
import { getLessonTracks, isLessonTrackDone } from '../../../core/LessonProgressEngine';
import { CheckCircle2, Circle } from 'lucide-react';

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
  const tasks = useAppStore(s => s.tasks);
  const setEvents = useAppStore(s => s.setEvents);
  const setLessonTrackDone = useAppStore(s => s.setLessonTrackDone);

  if (!event) return null;

  const liveEvent = events.find(e => e.id === event.id) || event;
  const course = liveEvent.courseId ? courses.find(c => c.id === liveEvent.courseId) : null;
  const courseTasks = course ? tasks.filter(t => t.courseId === course.id && !t.isPhantom) : [];
  const tracks = course && liveEvent.type === 'lesson' ? getLessonTracks(liveEvent, course) : null;
  const theoryDone = tracks?.hasTheory ? isLessonTrackDone(liveEvent, 'theory', courseTasks).done : false;
  const exDone = tracks?.hasExercise ? isLessonTrackDone(liveEvent, 'exercise', courseTasks).done : false;
  
  const isSimilarEvent = (e1: CalendarEvent, e2: CalendarEvent) => {
    const d1 = new Date(e1.startTime);
    const d2 = new Date(e2.startTime);
    const sameCourseOrTitle = e1.courseId === e2.courseId && (!e1.courseId ? e1.title === e2.title : true);
    const sameDayOfWeek = d1.getDay() === d2.getDay();
    const sameTime = d1.getHours() === d2.getHours() && d1.getMinutes() === d2.getMinutes();
    return sameCourseOrTitle && sameDayOfWeek && sameTime;
  };

  const handleDelete = () => {
    const similarEvents = events.filter(e => e.id !== liveEvent.id && isSimilarEvent(e, liveEvent));
    
    if (similarEvents.length > 0) {
      const resp = window.confirm(`Vuoi eliminare anche gli altri ${similarEvents.length} eventi uguali (stessa materia, giorno e orario)?\n\nOK = Elimina tutti\nAnnulla = Elimina solo questo`);
      if (resp) {
        const idsToDelete = [liveEvent.id, ...similarEvents.map(e => e.id)];
        const nextEvents = events.filter(e => !idsToDelete.includes(e.id));
        useAppStore.getState().saveSnapshot();
        setEvents(nextEvents);
      } else {
        removeEvent(liveEvent.id);
      }
    } else {
      if (window.confirm('Sei sicuro di voler eliminare questo evento?')) {
        removeEvent(liveEvent.id);
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
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem' }}>{liveEvent.title}</h3>
          {course && <div style={{ color: 'var(--text-secondary)' }}>Corso: {course.name}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Data</div>
            <div>{format(new Date(liveEvent.startTime), 'dd MMMM yyyy', { locale: it })}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Orario</div>
            <div>{format(new Date(liveEvent.startTime), 'HH:mm')} - {format(new Date(liveEvent.endTime), 'HH:mm')}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Tipo</div>
            <div style={{ textTransform: 'capitalize' }}>{getEventTypeName(liveEvent)}</div>
          </div>
          {liveEvent.location && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Luogo</div>
              <div>{liveEvent.location.type === 'remote' ? 'Online' : liveEvent.location.address || 'In presenza'}</div>
            </div>
          )}
          {liveEvent.lecturer && (
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Docente</div>
              <div>{liveEvent.lecturer}</div>
            </div>
          )}
        </div>

        {/* Avanzamento 1-Tap (Appunti / Esercizi) */}
        {tracks && (tracks.hasTheory || tracks.hasExercise) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Avanzamento Studio Lezione:</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tracks.hasTheory && (
                <button
                  type="button"
                  onClick={() => setLessonTrackDone(liveEvent.id, 'theory', !theoryDone)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: theoryDone ? '1px solid rgba(24,128,56,0.4)' : '1px solid var(--border-color)',
                    background: theoryDone ? 'rgba(24,128,56,0.14)' : 'var(--bg-primary)',
                    color: theoryDone ? '#188038' : 'var(--text-primary)',
                  }}
                >
                  {theoryDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  {theoryDone ? 'Appunti sistemati' : 'Segna appunti fatti'}
                </button>
              )}
              {tracks.hasExercise && (
                <button
                  type="button"
                  onClick={() => setLessonTrackDone(liveEvent.id, 'exercise', !exDone)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: exDone ? '1px solid rgba(24,128,56,0.4)' : '1px solid var(--border-color)',
                    background: exDone ? 'rgba(24,128,56,0.14)' : 'var(--bg-primary)',
                    color: exDone ? '#188038' : 'var(--text-primary)',
                  }}
                >
                  {exDone ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                  {exDone ? 'Esercitazione fatta' : 'Segna esercizi fatti'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Syllabus / AI Notes Info */}
        {(liveEvent.topic || liveEvent.notes || (liveEvent.readings && liveEvent.readings.length > 0)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            {liveEvent.topic && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Argomento Lezione:</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{liveEvent.topic}</div>
              </div>
            )}
            {liveEvent.notes && (
              <div style={{ marginTop: '2px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Riferimenti / Capitoli:</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '2px' }}>{liveEvent.notes}</div>
              </div>
            )}
            {liveEvent.readings && liveEvent.readings.length > 0 && (
              <div style={{ marginTop: '4px' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Materiali e Link:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {liveEvent.readings.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '0.82rem', color: 'var(--primary)', textDecoration: 'underline', wordBreak: 'break-all' }}
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="form-actions" style={{ marginTop: '8px' }}>
          <Button variant="danger" onClick={handleDelete}>Elimina</Button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="ghost" onClick={onClose}>Chiudi</Button>
            <Button variant="primary" onClick={() => { onClose(); onEdit(liveEvent); }}>Modifica</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
