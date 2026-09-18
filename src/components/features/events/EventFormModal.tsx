import { useState, useEffect } from 'react';
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
  initialEvent?: CalendarEvent | null;
}

export function EventFormModal({ isOpen, onClose, onEventAdded, initialEvent }: EventFormModalProps) {
  const addEvent = useAppStore(s => s.addEvent);
  const updateEvent = useAppStore(s => s.updateEvent);
  const setEvents = useAppStore(s => s.setEvents);
  const events = useAppStore(s => s.events);
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

  // Lesson overrides
  const [overrideNotesRevision, setOverrideNotesRevision] = useState<boolean | null>(null);
  const [overrideExercises, setOverrideExercises] = useState<boolean | null>(null);

  useEffect(() => {
    if (initialEvent && isOpen) {
      setTitle(initialEvent.title);
      setType(initialEvent.type);
      setDate(initialEvent.startTime.split('T')[0]);
      setStartTime(new Date(initialEvent.startTime).toTimeString().substring(0, 5));
      setEndTime(new Date(initialEvent.endTime).toTimeString().substring(0, 5));
      setCourseId(initialEvent.courseId || '');
      setLessonType(initialEvent.lessonType || 'theory');
      if (initialEvent.location) {
        setLocationType(initialEvent.location.type);
        setAddress(initialEvent.location.address || '');
      }
      setSportType(initialEvent.sportType || '');
      setProjectTotalHours(initialEvent.projectTotalHours?.toString() || '10');
      setProjectFrequency(initialEvent.projectScheduleFrequencyDays?.toString() || '3');
      setProjectImportance(initialEvent.projectImportance?.toString() || '5');
      setIsTravelStudyTime(initialEvent.isTravelStudyTime || false);
      setOverrideNotesRevision(initialEvent.studyPreferencesOverride?.requiresNotesRevision ?? null);
      setOverrideExercises(initialEvent.studyPreferencesOverride?.requiresExercises ?? null);
    } else if (isOpen && !initialEvent) {
      resetForm();
    }
  }, [initialEvent, isOpen]);

  const resetForm = () => {
    setTitle(''); setDate(''); setStartTime(''); setEndTime('');
    setCourseId(''); setLessonType('theory'); setLocationType('in_person');
    setAddress(''); setSportType(''); setProjectTotalHours('10');
    setProjectFrequency('3'); setProjectImportance('5'); setIsTravelStudyTime(false);
    setOverrideNotesRevision(null); setOverrideExercises(null);
  };

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
    if (!title || !date || !startTime || !endTime) return;

    const start = new Date(`${date}T${startTime}`).toISOString();
    const end = new Date(`${date}T${endTime}`).toISOString();

    const eventData = {
      title,
      type,
      startTime: start,
      endTime: end,
      courseId: courseId || undefined,
      lessonType: type === 'lesson' ? lessonType : undefined,
      location: { type: locationType, address: locationType === 'in_person' ? address : undefined },
      isDone: initialEvent ? initialEvent.isDone : false,
      postponedCount: initialEvent ? initialEvent.postponedCount : 0,
      sportType: type === 'sport' ? sportType : undefined,
      isTravelStudyTime: type === 'travel' ? isTravelStudyTime : undefined,
      projectTotalHours: type === 'project_deadline' ? parseFloat(projectTotalHours) : undefined,
      projectScheduleFrequencyDays: type === 'project_deadline' ? parseInt(projectFrequency) : undefined,
      projectImportance: type === 'project_deadline' ? parseInt(projectImportance) : undefined,
    };

    const selectedCourse = courses.find(c => c.id === courseId);
    if (type === 'lesson' && (lessonType === 'exercise' || lessonType === 'lab') && selectedCourse && (overrideNotesRevision !== null || overrideExercises !== null)) {
      (eventData as any).studyPreferencesOverride = {
        requiresNotesRevision: overrideNotesRevision !== null ? overrideNotesRevision : selectedCourse.defaultStudyPreferences.requiresNotesRevision,
        requiresExercises: overrideExercises !== null ? overrideExercises : selectedCourse.defaultStudyPreferences.requiresExercises,
      };
    } else if (initialEvent?.studyPreferencesOverride && (type !== 'lesson' || (lessonType !== 'exercise' && lessonType !== 'lab'))) {
       // if we changed type, clear the override
       (eventData as any).studyPreferencesOverride = undefined;
    }

    if (initialEvent) {
      // Editing
      const similarEvents = events.filter(e => e.id !== initialEvent.id && isSimilarEvent(e, initialEvent));
      
      let updateAll = false;
      if (similarEvents.length > 0) {
        updateAll = window.confirm(`Hai modificato un evento ricorrente.\nVuoi applicare queste modifiche anche agli altri ${similarEvents.length} eventi uguali (stessa materia, giorno della settimana e orario)?\n\nOK = Modifica tutti\nAnnulla = Solo questo evento`);
      }

      if (updateAll) {
        const idsToUpdate = [initialEvent.id, ...similarEvents.map(e => e.id)];
        const updatedEvents = events.map(e => {
          if (idsToUpdate.includes(e.id)) {
            const eStart = new Date(e.startTime);
            const eEnd = new Date(e.endTime);
            // Manteniamo la data dell'evento originale, modifichiamo solo l'orario e altri campi
            const newStart = new Date(eStart);
            newStart.setHours(parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]));
            const newEnd = new Date(eEnd);
            newEnd.setHours(parseInt(endTime.split(':')[0]), parseInt(endTime.split(':')[1]));
            
            return {
              ...e,
              ...eventData,
              startTime: newStart.toISOString(),
              endTime: newEnd.toISOString()
            };
          }
          return e;
        });
        setEvents(updatedEvents);
      } else {
        updateEvent(initialEvent.id, eventData);
      }
    } else {
      // Creating
      const newEvent = { id: uuidv4(), ...eventData };
      addEvent(newEvent);
      if (onEventAdded) onEventAdded(newEvent);

      // Auto-generate project tasks
      if (type === 'project_deadline') {
        const course = courses.find(c => c.id === courseId);
        const projectTasks = TaskManager.generateProjectTasks(newEvent, course);
        if (projectTasks.length > 0) addTasks(projectTasks);
      }
    }

    resetForm();
    onClose();
  };

  const selectedCourseUI = courses.find(c => c.id === courseId);
  const showOverrides = type === 'lesson' && (lessonType === 'exercise' || lessonType === 'lab') && selectedCourseUI;
  const currentNotesRevision = overrideNotesRevision !== null ? overrideNotesRevision : (selectedCourseUI?.defaultStudyPreferences.requiresNotesRevision ?? true);
  const currentExercises = overrideExercises !== null ? overrideExercises : (selectedCourseUI?.defaultStudyPreferences.requiresExercises ?? false);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialEvent ? "Modifica Evento" : "Nuovo Evento"}>
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

        {showOverrides && (
          <div className="form-field" style={{ marginTop: '10px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '6px' }}>
            <label style={{ marginBottom: '8px', fontWeight: '500' }}>Generazione Task per questa sessione:</label>
            <label className="form-checkbox" style={{ marginBottom: '4px' }}>
              <input 
                type="checkbox" 
                checked={currentNotesRevision} 
                onChange={e => setOverrideNotesRevision(e.target.checked)} 
              />
              Sistemazione appunti
            </label>
            <label className="form-checkbox">
              <input 
                type="checkbox" 
                checked={currentExercises} 
                onChange={e => setOverrideExercises(e.target.checked)} 
              />
              Svolgimento esercizi
            </label>
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
