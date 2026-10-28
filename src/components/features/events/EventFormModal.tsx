import { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  GraduationCap,
  HelpCircle,
  FolderKanban,
  Dumbbell,
  Train,
  Calendar,
  MapPin,
  Video,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Repeat,
  FileText,
  Check,
} from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { TaskManager } from '../../../core/TaskManager';
import { findCourseForTitle } from '../../../core/courseNames';
import type { CalendarEvent, EventType, LocationType, LessonType } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventAdded?: (event: CalendarEvent) => void;
  initialEvent?: CalendarEvent | null;
}

const EVENT_TYPE_META: {
  type: EventType;
  label: string;
  shortLabel: string;
  color: string;
  bg: string;
  placeholder: string;
  defaultMinutes: number;
  icon: typeof BookOpen;
}[] = [
  {
    type: 'lesson',
    label: 'Lezione',
    shortLabel: 'Lezione',
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.1)',
    placeholder: 'Es: Analisi Matematica 1',
    defaultMinutes: 120,
    icon: BookOpen,
  },
  {
    type: 'exam',
    label: 'Esame / Parziale',
    shortLabel: 'Esame',
    color: '#dc2626',
    bg: 'rgba(220, 38, 38, 0.1)',
    placeholder: 'Es: Appello di Fisica 1',
    defaultMinutes: 120,
    icon: GraduationCap,
  },
  {
    type: 'quiz',
    label: 'Quiz / Test',
    shortLabel: 'Quiz',
    color: '#ea580c',
    bg: 'rgba(234, 88, 12, 0.1)',
    placeholder: 'Es: Quiz intermedio Chimica',
    defaultMinutes: 60,
    icon: HelpCircle,
  },
  {
    type: 'project_deadline',
    label: 'Progetto / Consegna',
    shortLabel: 'Progetto',
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.1)',
    placeholder: 'Es: Consegna Progetto Software Engineering',
    defaultMinutes: 60,
    icon: FolderKanban,
  },
  {
    type: 'sport',
    label: 'Sport / Allenamento',
    shortLabel: 'Sport',
    color: '#16a34a',
    bg: 'rgba(22, 163, 74, 0.1)',
    placeholder: 'Es: Palestra, Corsa, Nuoto',
    defaultMinutes: 90,
    icon: Dumbbell,
  },
  {
    type: 'travel',
    label: 'Viaggio / Spostamento',
    shortLabel: 'Viaggio',
    color: '#0891b2',
    bg: 'rgba(8, 145, 178, 0.1)',
    placeholder: 'Es: Treno per il Politecnico',
    defaultMinutes: 60,
    icon: Train,
  },
  {
    type: 'generic',
    label: 'Evento Generico',
    shortLabel: 'Altro',
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.1)',
    placeholder: 'Es: Ricevimento docente, Visita medica...',
    defaultMinutes: 60,
    icon: Calendar,
  },
];

const LESSON_TYPE_OPTIONS: {
  value: LessonType;
  label: string;
  hint: string;
}[] = [
  {
    value: 'theory',
    label: 'Teoria',
    hint: 'Genera: Seguire lezione + Sistemare appunti',
  },
  {
    value: 'exercise',
    label: 'Esercitazione',
    hint: 'Genera: Seguire lezione + Svolgere esercizi',
  },
  {
    value: 'theory_exercise',
    label: 'Teoria + Eserc.',
    hint: 'Genera: Seguire lezione + Appunti + Esercizi',
  },
  {
    value: 'lab',
    label: 'Laboratorio',
    hint: 'Genera: Seguire laboratorio + Esercizi pratici',
  },
];

const DURATION_PRESETS = [
  { label: '45m', minutes: 45 },
  { label: '1h', minutes: 60 },
  { label: '1h 30m', minutes: 90 },
  { label: '2h', minutes: 120 },
  { label: '3h', minutes: 180 },
  { label: '4h', minutes: 240 },
];

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTimeMinutes(timeStr: string): number | null {
  if (!timeStr || !timeStr.includes(':')) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToTimeString(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getDefaultTimes(defaultDurationMin = 120): { date: string; startTime: string; endTime: string } {
  const now = new Date();
  const nextHour = Math.min(20, Math.max(8, now.getHours() + 1));
  const startMin = nextHour * 60;
  const endMin = Math.min(23 * 60 + 30, startMin + defaultDurationMin);
  return {
    date: formatLocalDate(now),
    startTime: minutesToTimeString(startMin),
    endTime: minutesToTimeString(endMin),
  };
}

export function EventFormModal({ isOpen, onClose, onEventAdded, initialEvent }: EventFormModalProps) {
  const addEvent = useAppStore(s => s.addEvent);
  const updateEvent = useAppStore(s => s.updateEvent);
  const setEvents = useAppStore(s => s.setEvents);
  const events = useAppStore(s => s.events);
  const addTasks = useAppStore(s => s.addTasks);
  const courses = useAppStore(s => s.courses);

  const [title, setTitle] = useState('');
  const [isAutoTitle, setIsAutoTitle] = useState(true);
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
  const [overrideExercises, setOverrideExercises] = useState<boolean | null>(null);

  // Progressive disclosure: Extra details & recurrence
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [topic, setTopic] = useState('');
  const [notes, setNotes] = useState('');
  const [repeatWeeks, setRepeatWeeks] = useState<number>(1);

  const buildSuggestedTitle = (evType: EventType, cId: string): string => {
    const course = courses.find(c => c.id === cId);
    if (!course) return '';
    switch (evType) {
      case 'lesson':
        return course.name;
      case 'exam':
        return `Esame: ${course.name}`;
      case 'quiz':
        return `Quiz: ${course.name}`;
      case 'project_deadline':
        return `Consegna Progetto: ${course.name}`;
      default:
        return course.name;
    }
  };

  const resetForm = () => {
    const defaults = getDefaultTimes(120);
    setTitle('');
    setIsAutoTitle(true);
    setType('lesson');
    setDate(defaults.date);
    setStartTime(defaults.startTime);
    setEndTime(defaults.endTime);
    setCourseId('');
    setLessonType('theory');
    setLocationType('in_person');
    setAddress('');
    setSportType('');
    setProjectTotalHours('10');
    setProjectFrequency('3');
    setProjectImportance('5');
    setIsTravelStudyTime(false);
    setOverrideExercises(null);
    setShowAdvanced(false);
    setTopic('');
    setNotes('');
    setRepeatWeeks(1);
  };

  useEffect(() => {
    if (initialEvent && isOpen) {
      setTitle(initialEvent.title);
      setIsAutoTitle(false);
      setType(initialEvent.type);
      setDate(initialEvent.startTime.split('T')[0]);
      setStartTime(new Date(initialEvent.startTime).toTimeString().substring(0, 5));
      setEndTime(new Date(initialEvent.endTime).toTimeString().substring(0, 5));
      setCourseId(initialEvent.courseId || '');
      setLessonType(initialEvent.lessonType || 'theory');
      if (initialEvent.location) {
        setLocationType(initialEvent.location.type);
        setAddress(initialEvent.location.address || '');
      } else {
        setLocationType('in_person');
        setAddress('');
      }
      setSportType(initialEvent.sportType || '');
      setProjectTotalHours(initialEvent.projectTotalHours?.toString() || '10');
      setProjectFrequency(initialEvent.projectScheduleFrequencyDays?.toString() || '3');
      setProjectImportance(initialEvent.projectImportance?.toString() || '5');
      setIsTravelStudyTime(initialEvent.isTravelStudyTime || false);
      setOverrideExercises(initialEvent.studyPreferencesOverride?.requiresExercises ?? null);
      setTopic(initialEvent.topic || '');
      setNotes(initialEvent.notes || '');
      setShowAdvanced(Boolean(initialEvent.topic || initialEvent.notes));
      setRepeatWeeks(1);
    } else if (isOpen && !initialEvent) {
      resetForm();
    }
  }, [initialEvent, isOpen]);

  // Calculate current duration in minutes
  const currentDurationMinutes = useMemo(() => {
    const s = parseTimeMinutes(startTime);
    const e = parseTimeMinutes(endTime);
    if (s === null || e === null || e <= s) return null;
    return e - s;
  }, [startTime, endTime]);

  const handleTypeSelect = (newType: EventType) => {
    const meta = EVENT_TYPE_META.find(m => m.type === newType);
    setType(newType);

    // Adjust duration to the category's natural default if creating a new event
    if (!initialEvent && meta) {
      const s = parseTimeMinutes(startTime);
      if (s !== null) {
        setEndTime(minutesToTimeString(s + meta.defaultMinutes));
      }
    }

    // Update auto-title if applicable
    if ((isAutoTitle || !title.trim()) && courseId) {
      const suggested = buildSuggestedTitle(newType, courseId);
      if (suggested) {
        setTitle(suggested);
        setIsAutoTitle(true);
      }
    }
  };

  const handleCourseSelect = (newCourseId: string) => {
    setCourseId(newCourseId);
    if (!newCourseId) return;

    if (isAutoTitle || !title.trim()) {
      const suggested = buildSuggestedTitle(type, newCourseId);
      if (suggested) {
        setTitle(suggested);
        setIsAutoTitle(true);
      }
    }
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    setIsAutoTitle(false);

    // Smart course recognition from typed title if no course is selected yet
    if (!courseId && val.trim().length >= 3 && (type === 'lesson' || type === 'exam' || type === 'quiz' || type === 'project_deadline')) {
      const matched = findCourseForTitle(val, courses);
      if (matched) {
        setCourseId(matched.id);
      }
    }
  };

  const handleStartTimeChange = (newStart: string) => {
    const prevDuration = currentDurationMinutes ?? 120;
    setStartTime(newStart);
    const newStartMin = parseTimeMinutes(newStart);
    if (newStartMin !== null) {
      setEndTime(minutesToTimeString(newStartMin + prevDuration));
    }
  };

  const handleDurationPreset = (minutes: number) => {
    const s = parseTimeMinutes(startTime) ?? 9 * 60;
    if (!startTime) setStartTime('09:00');
    setEndTime(minutesToTimeString(s + minutes));
  };

  const handleDatePreset = (offsetDays: number, nextMonday = false) => {
    const base = new Date();
    if (nextMonday) {
      const day = base.getDay();
      const diff = day === 0 ? 1 : 8 - day;
      base.setDate(base.getDate() + diff);
    } else {
      base.setDate(base.getDate() + offsetDays);
    }
    setDate(formatLocalDate(base));
  };

  const formattedDateLabel = useMemo(() => {
    if (!date) return '';
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('it-IT', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    });
  }, [date]);

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
    if (!title.trim() || !date || !startTime || !endTime) return;

    const start = new Date(`${date}T${startTime}`).toISOString();
    const end = new Date(`${date}T${endTime}`).toISOString();

    const showCourseField = type === 'lesson' || type === 'exam' || type === 'quiz' || type === 'project_deadline';

    const eventData: Omit<CalendarEvent, 'id'> = {
      title: title.trim(),
      type,
      startTime: start,
      endTime: end,
      courseId: showCourseField && courseId ? courseId : undefined,
      lessonType: type === 'lesson' ? lessonType : undefined,
      location: { type: locationType, address: locationType === 'in_person' && address.trim() ? address.trim() : undefined },
      isDone: initialEvent ? initialEvent.isDone : false,
      sportType: type === 'sport' && sportType.trim() ? sportType.trim() : undefined,
      isTravelStudyTime: type === 'travel' ? isTravelStudyTime : undefined,
      projectTotalHours: type === 'project_deadline' ? parseFloat(projectTotalHours) : undefined,
      projectScheduleFrequencyDays: type === 'project_deadline' ? parseInt(projectFrequency) : undefined,
      projectImportance: type === 'project_deadline' ? parseInt(projectImportance) : undefined,
      topic: topic.trim() ? topic.trim() : undefined,
      notes: notes.trim() ? notes.trim() : undefined,
      rrule: repeatWeeks > 1 ? 'weekly' : initialEvent?.rrule,
    };

    const selectedCourse = courses.find(c => c.id === courseId);
    if (type === 'lesson' && (lessonType === 'exercise' || lessonType === 'lab') && selectedCourse && overrideExercises === false) {
      eventData.studyPreferencesOverride = {
        requiresNotesRevision: false,
        requiresExercises: false,
      };
    } else if (initialEvent?.studyPreferencesOverride) {
      eventData.studyPreferencesOverride = undefined;
    }

    if (initialEvent) {
      // Editing existing event
      const similarEvents = events.filter(ev => ev.id !== initialEvent.id && isSimilarEvent(ev, initialEvent));

      let updateAll = false;
      if (similarEvents.length > 0) {
        updateAll = window.confirm(
          `Hai modificato un evento ricorrente.\nVuoi applicare queste modifiche anche agli altri ${similarEvents.length} eventi uguali (stessa materia, giorno della settimana e orario)?\n\nOK = Modifica tutti\nAnnulla = Solo questo evento`
        );
      }

      if (updateAll) {
        const idsToUpdate = [initialEvent.id, ...similarEvents.map(ev => ev.id)];
        const updatedEvents = events.map(ev => {
          if (idsToUpdate.includes(ev.id)) {
            const eStart = new Date(ev.startTime);
            const eEnd = new Date(ev.endTime);
            const newStart = new Date(eStart);
            newStart.setHours(parseInt(startTime.split(':')[0]), parseInt(startTime.split(':')[1]));
            const newEnd = new Date(eEnd);
            newEnd.setHours(parseInt(endTime.split(':')[0]), parseInt(endTime.split(':')[1]));

            return {
              ...ev,
              ...eventData,
              startTime: newStart.toISOString(),
              endTime: newEnd.toISOString(),
            };
          }
          return ev;
        });
        useAppStore.getState().saveSnapshot();
        setEvents(updatedEvents);
      } else {
        updateEvent(initialEvent.id, eventData);
      }
    } else {
      // Creating new event (and optional weekly repetitions)
      const totalInstances = Math.max(1, repeatWeeks);
      for (let w = 0; w < totalInstances; w++) {
        const instanceStart = new Date(`${date}T${startTime}`);
        const instanceEnd = new Date(`${date}T${endTime}`);
        if (w > 0) {
          instanceStart.setDate(instanceStart.getDate() + w * 7);
          instanceEnd.setDate(instanceEnd.getDate() + w * 7);
        }

        const newEvent: CalendarEvent = {
          id: uuidv4(),
          ...eventData,
          startTime: instanceStart.toISOString(),
          endTime: instanceEnd.toISOString(),
        };
        addEvent(newEvent);
        if (w === 0 && onEventAdded) {
          onEventAdded(newEvent);
        }

        if (type === 'project_deadline' && w === 0) {
          const projectTasks = TaskManager.generateProjectTasks(newEvent);
          if (projectTasks.length > 0) addTasks(projectTasks);
        }
      }
    }

    resetForm();
    onClose();
  };

  const activeMeta = EVENT_TYPE_META.find(m => m.type === type) || EVENT_TYPE_META[0];
  const selectedCourseUI = courses.find(c => c.id === courseId);
  const accentColor = selectedCourseUI?.color || activeMeta.color;
  const showCourseSelector = type === 'lesson' || type === 'exam' || type === 'quiz' || type === 'project_deadline';
  const showOverrides = type === 'lesson' && (lessonType === 'exercise' || lessonType === 'lab') && selectedCourseUI;
  const currentExercises = overrideExercises !== null ? overrideExercises : true;
  const activeLessonMeta = LESSON_TYPE_OPTIONS.find(l => l.value === lessonType);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialEvent ? 'Modifica Evento' : 'Nuovo Evento'}>
      <form onSubmit={handleSubmit} className="event-form-modern">
        {/* 1. Selettore visivo Tipo Evento (Pills con icone) */}
        <div className="efm-section">
          <div className="efm-type-grid" role="radiogroup" aria-label="Tipo di evento">
            {EVENT_TYPE_META.map(item => {
              const Icon = item.icon;
              const isSelected = type === item.type;
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleTypeSelect(item.type)}
                  className={`efm-type-pill ${isSelected ? 'active' : ''}`}
                  style={
                    isSelected
                      ? {
                          borderColor: item.color,
                          backgroundColor: item.bg,
                          color: item.color,
                        }
                      : undefined
                  }
                >
                  <Icon size={16} />
                  <span>{item.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Selettore rapido Corso (Pills colorate con 1 click) */}
        {showCourseSelector && courses.length > 0 && (
          <div className="efm-section">
            <div className="efm-label-row">
              <span className="efm-section-label">
                Materia / Corso {type === 'project_deadline' ? '(opzionale)' : ''}
              </span>
              {selectedCourseUI && (
                <button
                  type="button"
                  className="efm-clear-link"
                  onClick={() => setCourseId('')}
                >
                  Deseleziona
                </button>
              )}
            </div>
            <div className="efm-course-chips">
              {courses.map(c => {
                const isSelected = courseId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCourseSelect(isSelected ? '' : c.id)}
                    className={`efm-course-chip ${isSelected ? 'active' : ''}`}
                    style={
                      isSelected
                        ? {
                            borderColor: c.color,
                            backgroundColor: `${c.color}18`,
                          }
                        : undefined
                    }
                  >
                    <span className="efm-course-dot" style={{ backgroundColor: c.color }} />
                    <span className="efm-course-chip-name">{c.name}</span>
                    {isSelected && <Check size={13} style={{ color: c.color, flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Hero Title Input con barra colore dinamica */}
        <div className="efm-hero-title-wrap" style={{ borderLeftColor: accentColor }}>
          <input
            type="text"
            className="efm-hero-title-input"
            value={title}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder={activeMeta.placeholder}
            required
            autoFocus={!initialEvent}
          />
          {selectedCourseUI && (
            <span
              className="efm-title-course-badge"
              style={{ backgroundColor: `${selectedCourseUI.color}20`, color: selectedCourseUI.color }}
            >
              {selectedCourseUI.name}
            </span>
          )}
        </div>

        {/* 4. Sezione Data & Orario Intelligente */}
        <div className="efm-card-block">
          <div className="efm-label-row">
            <span className="efm-section-label">
              <Clock size={14} /> Quando
            </span>
            {formattedDateLabel && (
              <span className="efm-date-human-badge">{formattedDateLabel}</span>
            )}
          </div>

          {/* Preset rapidi per la data */}
          <div className="efm-quick-chips">
            <button
              type="button"
              className={`efm-quick-chip ${date === formatLocalDate(new Date()) ? 'active' : ''}`}
              onClick={() => handleDatePreset(0)}
            >
              Oggi
            </button>
            <button
              type="button"
              className="efm-quick-chip"
              onClick={() => handleDatePreset(1)}
            >
              Domani
            </button>
            <button
              type="button"
              className="efm-quick-chip"
              onClick={() => handleDatePreset(0, true)}
            >
              Lun prossimo
            </button>
            <button
              type="button"
              className="efm-quick-chip"
              onClick={() => handleDatePreset(7)}
            >
              +1 sett
            </button>
          </div>

          {/* Input Data, Inizio, Fine */}
          <div className="efm-datetime-grid">
            <div className="efm-input-group">
              <label>Data</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>
            <div className="efm-input-group">
              <label>Inizio</label>
              <input
                type="time"
                value={startTime}
                onChange={e => handleStartTimeChange(e.target.value)}
                required
              />
            </div>
            <div className="efm-input-group">
              <label>Fine</label>
              <input
                type="time"
                value={endTime}
                onChange={e => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Preset rapidi di durata */}
          <div className="efm-duration-row">
            <span className="efm-duration-label">Durata rapida:</span>
            <div className="efm-duration-chips">
              {DURATION_PRESETS.map(p => (
                <button
                  key={p.minutes}
                  type="button"
                  onClick={() => handleDurationPreset(p.minutes)}
                  className={`efm-duration-chip ${currentDurationMinutes === p.minutes ? 'active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Opzioni specifiche per Lezione */}
        {type === 'lesson' && (
          <div className="efm-card-block">
            <span className="efm-section-label">Tipologia di lezione</span>
            <div className="efm-segmented-grid">
              {LESSON_TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setLessonType(opt.value)}
                  className={`efm-segment-btn ${lessonType === opt.value ? 'active' : ''}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {activeLessonMeta && (
              <div className="efm-smart-hint">
                <Sparkles size={14} />
                <span>{activeLessonMeta.hint}</span>
              </div>
            )}

            {showOverrides && (
              <label className="efm-checkbox-row">
                <input
                  type="checkbox"
                  checked={currentExercises}
                  onChange={e => setOverrideExercises(e.target.checked)}
                />
                <span>Genera task "Svolgimento esercizi" per questa sessione</span>
              </label>
            )}
          </div>
        )}

        {/* Opzioni specifiche per Sport */}
        {type === 'sport' && (
          <div className="efm-card-block">
            <div className="efm-input-group">
              <label>Attività sportiva</label>
              <input
                type="text"
                value={sportType}
                onChange={e => setSportType(e.target.value)}
                placeholder="Es: Palestra, Corsa, Nuoto, Calcetto..."
              />
            </div>
          </div>
        )}

        {/* Opzioni specifiche per Viaggio */}
        {type === 'travel' && (
          <div className="efm-card-block">
            <label className="efm-checkbox-row">
              <input
                type="checkbox"
                checked={isTravelStudyTime}
                onChange={e => setIsTravelStudyTime(e.target.checked)}
              />
              <span>
                <strong>Tempo sfruttabile per lo studio</strong> (es. ripasso flashcard o teoria in treno)
              </span>
            </label>
          </div>
        )}

        {/* Opzioni specifiche per Progetto / Consegna */}
        {type === 'project_deadline' && (
          <div className="efm-card-block">
            <span className="efm-section-label">Pianificazione automatica Progetto</span>
            <div className="efm-datetime-grid">
              <div className="efm-input-group">
                <label>Ore totali stimate</label>
                <input
                  type="number"
                  value={projectTotalHours}
                  onChange={e => setProjectTotalHours(e.target.value)}
                  min="1"
                />
              </div>
              <div className="efm-input-group">
                <label>Ogni quanti giorni</label>
                <input
                  type="number"
                  value={projectFrequency}
                  onChange={e => setProjectFrequency(e.target.value)}
                  min="1"
                />
              </div>
              <div className="efm-input-group">
                <label>Priorità (1-10)</label>
                <input
                  type="number"
                  value={projectImportance}
                  onChange={e => setProjectImportance(e.target.value)}
                  min="1"
                  max="10"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. Posizione / Modalità (Segmented Toggle + Aula inline) */}
        <div className="efm-location-row">
          <div className="efm-location-toggle">
            <button
              type="button"
              onClick={() => setLocationType('in_person')}
              className={`efm-loc-btn ${locationType === 'in_person' ? 'active' : ''}`}
            >
              <MapPin size={14} /> In presenza
            </button>
            <button
              type="button"
              onClick={() => setLocationType('remote')}
              className={`efm-loc-btn ${locationType === 'remote' ? 'active' : ''}`}
            >
              <Video size={14} /> Remoto
            </button>
          </div>

          {locationType === 'in_person' && (
            <input
              type="text"
              className="efm-location-input"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Aula, edificio o indirizzo (opzionale)"
            />
          )}
        </div>

        {/* 7. Progressive Disclosure: Ripetizione settimanale, Argomento e Note */}
        <div className="efm-advanced-wrapper">
          <button
            type="button"
            className="efm-advanced-toggle"
            onClick={() => setShowAdvanced(v => !v)}
          >
            <span>
              <FileText size={14} />
              {initialEvent
                ? 'Argomento e Note'
                : 'Opzioni avanzate (Ripetizione settimanale, Argomento, Note)'}
            </span>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showAdvanced && (
            <div className="efm-advanced-body">
              {!initialEvent && (
                <div className="efm-input-group">
                  <label>
                    <Repeat size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Ripetizione settimanale
                  </label>
                  <select
                    value={repeatWeeks}
                    onChange={e => setRepeatWeeks(Number(e.target.value))}
                  >
                    <option value={1}>Non ripetere (solo in questa data)</option>
                    <option value={4}>Ogni settimana per 4 settimane</option>
                    <option value={8}>Ogni settimana per 8 settimane</option>
                    <option value={12}>Ogni settimana per 12 settimane (Semestre)</option>
                    <option value={14}>Ogni settimana per 14 settimane</option>
                  </select>
                </div>
              )}

              <div className="efm-input-group">
                <label>Argomento della sessione (opzionale)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Es: Integrali definiti, Teorema di Bayes..."
                />
              </div>

              <div className="efm-input-group">
                <label>Note o materiale di riferimento</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Capitoli del libro, link alle slide o promemoria..."
                />
              </div>
            </div>
          )}
        </div>

        {/* 8. Footer Azioni */}
        <div className="efm-footer">
          <Button variant="ghost" onClick={onClose} type="button">
            Annulla
          </Button>
          <Button variant="primary" type="submit">
            {initialEvent
              ? 'Salva Modifiche'
              : repeatWeeks > 1
              ? `Crea ${repeatWeeks} Eventi`
              : 'Crea Evento'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
