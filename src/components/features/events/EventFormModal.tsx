import { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { TaskManager } from '../../../core/TaskManager';
import type { CalendarEvent, EventType, LocationType, LessonType } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded?: (event: CalendarEvent) => void;
}

export function EventFormModal({ isOpen, onClose, onEventAdded }: EventFormModalProps) {
  const addEvent = useAppStore(s => s.addEvent);
  const addTasks = useAppStore(s => s.addTasks);
  const courses = useAppStore(s => s.courses);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('lesson');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('theory');
  const [locationType, setLocationType] = useState<LocationType>('in_person');
  const [address, setAddress] = useState('');

  // Sport fields
  const [sportType, setSportType] = useState('');

  // Project/Deadline fields
  const [projectTotalHours, setProjectTotalHours] = useState('10');
  const [projectFrequency, setProjectFrequency] = useState('3');
  const [projectImportance, setProjectImportance] = useState('5');

  // Travel fields
  const [isTravelStudyTime, setIsTravelStudyTime] = useState(false);

  const resetForm = () => {
    setTitle(''); setDate(''); setStartTime(''); setEndTime('');
    setCourseId(''); setLessonType('theory'); setLocationType('in_person');
    setAddress(''); setSportType(''); setProjectTotalHours('10');
    setProjectFrequency('3'); setProjectImportance('5'); setIsTravelStudyTime(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !startTime || !endTime) return;

    const start = new Date(`${date}T${startTime}`).toISOString();
    const end = new Date(`${date}T${endTime}`).toISOString();

    const event = {
      id: uuidv4(),
      title,
      type,
      startTime: start,
      endTime: end,
      courseId: courseId || undefined,
      lessonType: type === 'lesson' ? lessonType : undefined,
      location: { type: locationType, address: locationType === 'in_person' ? address : undefined },
      isDone: false,
      postponedCount: 0,
      // Type-specific
      sportType: type === 'sport' ? sportType : undefined,
      isTravelStudyTime: type === 'travel' ? isTravelStudyTime : undefined,
      projectTotalHours: type === 'project_deadline' ? parseFloat(projectTotalHours) : undefined,
      projectScheduleFrequencyDays: type === 'project_deadline' ? parseInt(projectFrequency) : undefined,
      projectImportance: type === 'project_deadline' ? parseInt(projectImportance) : undefined,
    };

    addEvent(event);
    if (onEventAdded) onEventAdded(event);

    // Auto-generate project tasks
    if (type === 'project_deadline') {
      const course = courses.find(c => c.id === courseId);
      const projectTasks = TaskManager.generateProjectTasks(event, course);
      if (projectTasks.length > 0) addTasks(projectTasks);
    }

    resetForm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuovo Evento">
      <form onSubmit={handleSubmit} className="event-form">

        <div className="form-field">
          <label>Titolo</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Es: Lezione Analisi I" required />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Tipo Evento</label>
            <select value={type} onChange={e => setType(e.target.value as EventType)}>
              <option value="lesson">Lezione</option>
              <option value="exam">Esame</option>
              <option value="generic">Generico</option>
              <option value="sport">Sport</option>
              <option value="travel">Viaggio/Spostamento</option>
              <option value="project_deadline">Progetto/Scadenza</option>
            </select>
          </div>
          <div className="form-field">
            <label>Posizione</label>
            <select value={locationType} onChange={e => setLocationType(e.target.value as LocationType)}>
              <option value="in_person">In Presenza</option>
              <option value="remote">Remoto</option>
            </select>
          </div>
        </div>

        {locationType === 'in_person' && (
          <div className="form-field">
            <label>Indirizzo / Luogo</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Es: Aula Magna, Politecnico" />
          </div>
        )}

        {/* Lesson-specific */}
        {type === 'lesson' && (
          <div className="form-row">
            <div className="form-field">
              <label>Corso</label>
              <select value={courseId} onChange={e => setCourseId(e.target.value)}>
                <option value="">-- Seleziona --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Tipo Lezione</label>
              <select value={lessonType} onChange={e => setLessonType(e.target.value as LessonType)}>
                <option value="theory">Teoria</option>
                <option value="exercise">Esercitazione</option>
                <option value="theory_exercise">Teoria + Esercizi</option>
                <option value="lab">Laboratorio</option>
              </select>
            </div>
          </div>
        )}

        {/* Exam-specific */}
        {type === 'exam' && (
          <div className="form-field">
            <label>Corso</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="">-- Seleziona --</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        {/* Sport-specific */}
        {type === 'sport' && (
          <div className="form-field">
            <label>Tipo Sport</label>
            <input type="text" value={sportType} onChange={e => setSportType(e.target.value)} placeholder="Es: Corsa, Palestra, Nuoto" />
          </div>
        )}

        {/* Travel-specific */}
        {type === 'travel' && (
          <div className="form-field">
            <label className="form-checkbox">
              <input type="checkbox" checked={isTravelStudyTime} onChange={e => setIsTravelStudyTime(e.target.checked)} />
              Tempo di viaggio utilizzabile per studio
            </label>
          </div>
        )}

        {/* Project/Deadline-specific */}
        {type === 'project_deadline' && (
          <>
            <div className="form-field">
              <label>Corso (opzionale)</label>
              <select value={courseId} onChange={e => setCourseId(e.target.value)}>
                <option value="">-- Nessuno --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-row form-row-3">
              <div className="form-field">
                <label>Ore totali stimate</label>
                <input type="number" value={projectTotalHours} onChange={e => setProjectTotalHours(e.target.value)} min="1" />
              </div>
              <div className="form-field">
                <label>Frequenza (giorni)</label>
                <input type="number" value={projectFrequency} onChange={e => setProjectFrequency(e.target.value)} min="1" />
              </div>
              <div className="form-field">
                <label>Importanza (1-10)</label>
                <input type="number" value={projectImportance} onChange={e => setProjectImportance(e.target.value)} min="1" max="10" />
              </div>
            </div>
          </>
        )}

        {/* Date/Time */}
        <div className="form-row form-row-3">
          <div className="form-field">
            <label>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Inizio</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
          </div>
          <div className="form-field">
            <label>Fine</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} required />
          </div>
        </div>

        <div className="form-actions">
          <Button variant="ghost" onClick={onClose} type="button">Annulla</Button>
          <Button variant="primary" type="submit">Salva Evento</Button>
        </div>
      </form>
    </Modal>
  );
}
