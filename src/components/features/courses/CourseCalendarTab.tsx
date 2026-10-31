import { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Check, X, CalendarCheck, CalendarPlus, BookOpen, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../../store/useAppStore';
import type { Course, CoursePlanLesson, LessonType, CalendarEvent } from '../../../core/types';
import { createEventFromPlanLesson } from '../../../core/CourseKnowledge';
import { localDateKey, localTime } from '../../../core/lessonLink';
import { getLessonTracks, isLessonTrackDone } from '../../../core/LessonProgressEngine';
import { useInfoPatch, fmtDate } from './courseHooks';

interface Draft {
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  lessonType: LessonType;
  room: string;
  lecturer: string;
  chapters: string;
  links: string;
  coursePart: string;
  cancelled: boolean;
}

const emptyDraft: Draft = {
  date: '',
  startTime: '09:00',
  endTime: '11:00',
  topic: '',
  lessonType: 'theory',
  room: '',
  lecturer: '',
  chapters: '',
  links: '',
  coursePart: '',
  cancelled: false,
};

const TYPE_LABELS: Record<LessonType, string> = {
  theory: 'Teoria',
  exercise: 'Esercitazione',
  theory_exercise: 'Teoria ed Esercizi',
  lab: 'Laboratorio',
};

const TYPE_BADGE: Record<LessonType, string> = {
  theory: 'blue',
  exercise: 'orange',
  theory_exercise: 'purple',
  lab: 'purple',
};

export function CourseCalendarTab({ course }: { course: Course }) {
  const patch = useInfoPatch(course);
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const addEvent = useAppStore(s => s.addEvent);
  const setLessonTrackDone = useAppStore(s => s.setLessonTrackDone);

  const plan = [...(course.info?.lessonPlan ?? [])].sort((a, b) => {
    const keyA = `${a.date} ${a.startTime || '00:00'}`;
    const keyB = `${b.date} ${b.startTime || '00:00'}`;
    return keyA.localeCompare(keyB);
  });

  // Trova le lezioni a calendario generale per questa materia
  const existingCourseEvents = useMemo(() => {
    return events
      .filter(
        e =>
          e.type === 'lesson' &&
          (e.courseId === course.id ||
            (!e.courseId && e.title && course.name && e.title.toLowerCase().includes(course.name.toLowerCase())))
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [events, course.id, course.name]);

  const courseTasks = useMemo(
    () => tasks.filter(t => t.courseId === course.id && !t.isPhantom),
    [tasks, course.id]
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const eventById = new Map(events.map(e => [e.id, e]));

  const save = (items: CoursePlanLesson[]) => {
    patch({
      lessonPlan: [...items].sort((a, b) => {
        const keyA = `${a.date} ${a.startTime || '00:00'}`;
        const keyB = `${b.date} ${b.startTime || '00:00'}`;
        return keyA.localeCompare(keyB);
      }),
    });
  };

  const openNew = () => {
    setDraft({ ...emptyDraft, date: new Date().toISOString().substring(0, 10) });
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (l: CoursePlanLesson) => {
    setDraft({
      date: l.date,
      startTime: l.startTime ?? '09:00',
      endTime: l.endTime ?? '11:00',
      topic: l.topic,
      lessonType: l.lessonType,
      room: l.room ?? '',
      lecturer: l.lecturer ?? '',
      chapters: l.chapters ?? '',
      links: (l.links ?? []).join('\n'),
      coursePart: l.coursePart ?? '',
      cancelled: !!l.cancelled,
    });
    setEditingId(l.id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const submit = () => {
    if (!draft.date) return;
    const linksList = draft.links
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const base: Omit<CoursePlanLesson, 'id'> = {
      date: draft.date,
      startTime: draft.startTime || undefined,
      endTime: draft.endTime || undefined,
      topic: draft.topic.trim(),
      lessonType: draft.lessonType,
      room: draft.room.trim() || undefined,
      lecturer: draft.lecturer.trim() || undefined,
      chapters: draft.chapters.trim() || undefined,
      links: linksList.length > 0 ? linksList : undefined,
      coursePart: draft.coursePart.trim() || undefined,
      cancelled: draft.cancelled || undefined,
    };

    if (editingId) {
      save(plan.map(l => (l.id === editingId ? { ...l, ...base } : l)));
    } else {
      save([...plan, { id: uuidv4(), ...base }]);
    }
    closeForm();
  };

  const remove = (l: CoursePlanLesson) => {
    save(plan.filter(x => x.id !== l.id));
  };

  const pushToGeneralCalendar = (l: CoursePlanLesson) => {
    const ev = createEventFromPlanLesson(l, course);
    addEvent(ev);
    save(plan.map(x => (x.id === l.id ? { ...x, eventId: ev.id } : x)));
    useAppStore.getState().syncAndSchedule();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cp-toolbar">
        <h4 className="cp-section-title" style={{ flex: 1 }}>Calendario lezioni della materia</h4>
        <button className="btn btn-secondary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Aggiungi Lezione
        </button>
      </div>

      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        Questo è il calendario didattico specifico di <strong>{course.name}</strong> (con argomenti, tipologia, aula e riferimenti bibliografici).
        Puoi sincronizzare ogni lezione col calendario generale quando vuoi.
      </div>

      {formOpen && (
        <div className="cp-form">
          <div className="cp-row">
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Data</label>
              <input
                className="cp-input"
                type="date"
                value={draft.date}
                onChange={e => setDraft({ ...draft, date: e.target.value })}
              />
            </div>
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Inizio</label>
              <input
                className="cp-input"
                type="time"
                value={draft.startTime}
                onChange={e => setDraft({ ...draft, startTime: e.target.value })}
              />
            </div>
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Fine</label>
              <input
                className="cp-input"
                type="time"
                value={draft.endTime}
                onChange={e => setDraft({ ...draft, endTime: e.target.value })}
              />
            </div>
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Tipo Lezione</label>
              <select
                className="cp-select"
                value={draft.lessonType}
                onChange={e => setDraft({ ...draft, lessonType: e.target.value as LessonType })}
              >
                <option value="theory">Teoria</option>
                <option value="exercise">Esercitazione</option>
                <option value="theory_exercise">Teoria ed Esercizi</option>
                <option value="lab">Laboratorio</option>
              </select>
            </div>
          </div>

          <div className="cp-field">
            <label>Argomento / Titolo della lezione</label>
            <input
              className="cp-input"
              value={draft.topic}
              onChange={e => setDraft({ ...draft, topic: e.target.value })}
              placeholder="Es. Introduzione agli algoritmi genetici"
            />
          </div>

          <div className="cp-row">
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Aula</label>
              <input
                className="cp-input"
                value={draft.room}
                onChange={e => setDraft({ ...draft, room: e.target.value })}
                placeholder="Es. 3.0.1, Alfa..."
              />
            </div>
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Docente / Esercitatore</label>
              <input
                className="cp-input"
                value={draft.lecturer}
                onChange={e => setDraft({ ...draft, lecturer: e.target.value })}
                placeholder="Es. Prof. Rossi"
              />
            </div>
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Modulo / Parte</label>
              <input
                className="cp-input"
                value={draft.coursePart}
                onChange={e => setDraft({ ...draft, coursePart: e.target.value })}
                placeholder="Es. Modulo 2"
              />
            </div>
          </div>

          <div className="cp-field">
            <label>Capitoli / Sezioni del libro di testo</label>
            <input
              className="cp-input"
              value={draft.chapters}
              onChange={e => setDraft({ ...draft, chapters: e.target.value })}
              placeholder="Es. Cap. 4 paragrafi 4.1 - 4.3"
            />
          </div>

          <div className="cp-field">
            <label>Link o riferimenti materiali (uno per riga)</label>
            <textarea
              className="cp-textarea"
              style={{ minHeight: 60 }}
              value={draft.links}
              onChange={e => setDraft({ ...draft, links: e.target.value })}
              placeholder="https://..."
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={draft.cancelled}
              onChange={e => setDraft({ ...draft, cancelled: e.target.checked })}
              style={{ accentColor: '#a855f7' }}
            />
            <span>Lezione sospesa / Vacanza / Nessuna lezione</span>
          </label>

          <div className="cp-toolbar">
            <button className="btn btn-primary" onClick={submit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={15} /> {editingId ? 'Aggiorna' : 'Aggiungi'}
            </button>
            <button className="btn btn-ghost" onClick={closeForm} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={15} /> Annulla
            </button>
          </div>
        </div>
      )}

      {plan.length === 0 && existingCourseEvents.length === 0 && !formOpen && (
        <div className="cp-empty">
          Nessuna lezione memorizzata per questo corso. Importa il calendario (.ics) o carica il programma con l'AI, oppure inseriscile manualmente.
        </div>
      )}

      {plan.length === 0 && existingCourseEvents.length > 0 && !formOpen && (
        <div className="cp-card" style={{ background: 'rgba(59, 130, 246, 0.06)', borderColor: 'rgba(59, 130, 246, 0.25)' }}>
          <div className="cp-card-body" style={{ fontSize: '0.82rem' }}>
            <strong>Stai vedendo le {existingCourseEvents.length} lezioni dal tuo calendario generale.</strong>{' '}
            Puoi spuntare direttamente qui sotto <em>Appunti</em> ed <em>Esercizi</em> man mano che avanzi, oppure cliccare in alto su <strong>"Importa con AI"</strong> per abbinare argomenti e capitoli a queste date senza alterare il calendario.
          </div>
        </div>
      )}

      {/* Se non c'è un lessonPlan separato ma ci sono eventi nel calendario, mostriamo direttamente gli eventi con 1-tap toggle */}
      {plan.length === 0 && existingCourseEvents.map((ev, idx) => {
        const tracks = getLessonTracks(ev, course);
        const theoryDone = tracks.hasTheory ? isLessonTrackDone(ev, 'theory', courseTasks).done : false;
        const exDone = tracks.hasExercise ? isLessonTrackDone(ev, 'exercise', courseTasks).done : false;
        const isPast = new Date(ev.endTime).getTime() <= Date.now();
        const lt: LessonType = ev.lessonType || (tracks.hasExercise && !tracks.hasTheory ? 'exercise' : 'theory');

        return (
          <div key={ev.id} className="cp-card" style={{ opacity: !isPast ? 0.85 : 1 }}>
            <div className="cp-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>#{idx + 1}</span>
                <span className="cp-card-title">{fmtDate(localDateKey(ev.startTime))}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {localTime(ev.startTime)} - {localTime(ev.endTime)}
                </span>
                <span className={`cp-badge ${TYPE_BADGE[lt]}`}>
                  {TYPE_LABELS[lt]}
                </span>
                {ev.location?.address && <span className="cp-badge gray">{ev.location.address}</span>}
                {!isPast && <span className="cp-badge gray">Futura</span>}
              </div>

              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: 2 }}>
                {ev.topic || ev.title}
              </div>

              {ev.notes && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <BookOpen size={13} style={{ color: '#a855f7' }} />
                  <span>{ev.notes}</span>
                </div>
              )}

              {/* 1-Tap Toggles per Teoria / Esercizi */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                {tracks.hasTheory && (
                  <button
                    type="button"
                    onClick={() => setLessonTrackDone(ev.id, 'theory', !theoryDone)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: theoryDone ? '1px solid rgba(24,128,56,0.4)' : '1px solid var(--border-color)',
                      background: theoryDone ? 'rgba(24,128,56,0.14)' : 'var(--bg-secondary)',
                      color: theoryDone ? '#188038' : 'var(--text-secondary)',
                    }}
                  >
                    {theoryDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    {theoryDone ? 'Appunti sistemati' : 'Segna appunti fatti'}
                  </button>
                )}
                {tracks.hasExercise && (
                  <button
                    type="button"
                    onClick={() => setLessonTrackDone(ev.id, 'exercise', !exDone)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: exDone ? '1px solid rgba(24,128,56,0.4)' : '1px solid var(--border-color)',
                      background: exDone ? 'rgba(24,128,56,0.14)' : 'var(--bg-secondary)',
                      color: exDone ? '#188038' : 'var(--text-secondary)',
                    }}
                  >
                    {exDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                    {exDone ? 'Esercitazione fatta' : 'Segna esercizi fatti'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {plan.map(l => {
        const linkedEvent: CalendarEvent | undefined =
          (l.eventId ? eventById.get(l.eventId) : undefined) ||
          existingCourseEvents.find(e => localDateKey(e.startTime) === l.date);
        const inCalendar = !!linkedEvent;
        const tracks = linkedEvent ? getLessonTracks(linkedEvent, course) : {
          hasTheory: l.lessonType !== 'exercise' && l.lessonType !== 'lab',
          hasExercise: l.lessonType === 'exercise' || l.lessonType === 'lab' || l.lessonType === 'theory_exercise',
        };
        const theoryDone = linkedEvent && tracks.hasTheory ? isLessonTrackDone(linkedEvent, 'theory', courseTasks).done : false;
        const exDone = linkedEvent && tracks.hasExercise ? isLessonTrackDone(linkedEvent, 'exercise', courseTasks).done : false;

        return (
          <div key={l.id} className={`cp-card ${l.cancelled ? 'cancelled' : ''}`}>
            <div className="cp-card-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="cp-card-title">{fmtDate(l.date)}</span>
                {l.startTime && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {l.startTime}{l.endTime ? ` - ${l.endTime}` : ''}
                  </span>
                )}
                <span className={`cp-badge ${TYPE_BADGE[l.lessonType]}`}>
                  {TYPE_LABELS[l.lessonType]}
                </span>
                {l.room && <span className="cp-badge gray">Aula {l.room}</span>}
                {l.coursePart && <span className="cp-badge purple">{l.coursePart}</span>}
                {l.cancelled && <span className="cp-badge red">Sospesa</span>}
                {inCalendar && (
                  <span className="cp-badge green" title="Sincronizzato sul calendario generale">
                    <CalendarCheck size={11} /> Nel Calendario
                  </span>
                )}
              </div>

              <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', marginTop: 2 }}>
                {l.topic || <em style={{ color: 'var(--text-secondary)' }}>(Nessun argomento specificato)</em>}
              </div>

              {l.chapters && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <BookOpen size={13} style={{ color: '#a855f7' }} />
                  <span>{l.chapters}</span>
                </div>
              )}

              {l.lecturer && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Docente: {l.lecturer}
                </div>
              )}

              {l.links && l.links.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                  {l.links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.74rem', color: 'var(--primary)', textDecoration: 'none' }}
                    >
                      <ExternalLink size={12} /> Materiale
                    </a>
                  ))}
                </div>
              )}

              {linkedEvent && !l.cancelled && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                  {tracks.hasTheory && (
                    <button
                      type="button"
                      onClick={() => setLessonTrackDone(linkedEvent.id, 'theory', !theoryDone)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: theoryDone ? '1px solid rgba(24,128,56,0.4)' : '1px solid var(--border-color)',
                        background: theoryDone ? 'rgba(24,128,56,0.14)' : 'var(--bg-secondary)',
                        color: theoryDone ? '#188038' : 'var(--text-secondary)',
                      }}
                    >
                      {theoryDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                      {theoryDone ? 'Appunti sistemati' : 'Segna appunti fatti'}
                    </button>
                  )}
                  {tracks.hasExercise && (
                    <button
                      type="button"
                      onClick={() => setLessonTrackDone(linkedEvent.id, 'exercise', !exDone)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        border: exDone ? '1px solid rgba(24,128,56,0.4)' : '1px solid var(--border-color)',
                        background: exDone ? 'rgba(24,128,56,0.14)' : 'var(--bg-secondary)',
                        color: exDone ? '#188038' : 'var(--text-secondary)',
                      }}
                    >
                      {exDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                      {exDone ? 'Esercitazione fatta' : 'Segna esercizi fatti'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="cp-card-actions">
              {!inCalendar && !l.cancelled && (
                <button
                  className="cp-icon-btn"
                  title="Aggiungi al calendario generale"
                  onClick={() => pushToGeneralCalendar(l)}
                >
                  <CalendarPlus size={15} />
                </button>
              )}
              <button className="cp-icon-btn" title="Modifica" onClick={() => openEdit(l)}>
                <Edit2 size={15} />
              </button>
              <button className="cp-icon-btn danger" title="Elimina" onClick={() => remove(l)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

