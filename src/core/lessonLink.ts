import type { CalendarEvent, Course, Task } from './types';
import { getTaskKind } from './taskKind';

/** Data locale "YYYY-MM-DD" di un istante (ISO string o Date). Mai in UTC: evita slittamenti di giorno. */
export function localDateKey(d: string | Date | undefined): string {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return String(d).substring(0, 10);
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "HH:mm" locale di un istante. */
export function localTime(d: string | Date): string {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
}

/** Converte "5/9/2026", "05/09/2026" o "2026-09-05" in "YYYY-MM-DD" (stringa vuota se non riconosciuta). */
export function toIsoDateKey(value: string | undefined): string {
  if (!value) return '';
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '';
}

/** Data (it-IT) e fascia oraria usate nei titoli e nei metadati dei task di lezione. */
export function eventSlot(event: CalendarEvent): { dateIt: string; dateIso: string; timeSlot: string } {
  const timeOpts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
  const startHM = new Date(event.startTime).toLocaleTimeString('it-IT', timeOpts);
  const endHM = new Date(event.endTime).toLocaleTimeString('it-IT', timeOpts);
  return {
    dateIt: new Date(event.startTime).toLocaleDateString('it-IT'),
    dateIso: localDateKey(event.startTime),
    timeSlot: `${startHM} - ${endHM}`,
  };
}

/** Data ISO a cui si riferisce un task di lezione (da lessonDate o dal titolo). */
export function taskLessonDateIso(task: Task): string {
  const fromField = toIsoDateKey(task.lessonDate);
  if (fromField) return fromField;
  const m = task.title.match(/\((\d{1,2}\/\d{1,2}\/\d{4})/);
  return m ? toIsoDateKey(m[1]) : '';
}

/** True se il task appartiene a quella lezione (per id evento, oppure per corso + data + fascia oraria). */
export function taskBelongsToEvent(task: Task, event: CalendarEvent): boolean {
  if (task.relatedEventId === event.id) return true;
  if (task.relatedEventId || !event.courseId || task.courseId !== event.courseId) return false;
  const taskDate = taskLessonDateIso(task);
  if (!taskDate || taskDate !== localDateKey(event.startTime)) return false;
  const slot = task.lessonTimeSlot || task.title.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/)?.[1];
  if (slot) return slot.replace(/\s/g, '') === eventSlot(event).timeSlot.replace(/\s/g, '');
  return true;
}

/** Nome mostrato nei task: "Corso - Argomento" se la lezione ha un argomento, altrimenti il titolo dell'evento. */
export function lessonLabel(event: CalendarEvent, course?: Pick<Course, 'name'>): string {
  const topic = event.topic?.trim();
  if (topic) return `${course?.name ?? event.title} - ${topic}`;
  return event.title;
}

/** Descrizione ricca (argomento, capitoli, docente, materiali) o stringa vuota se l'evento non ha dettagli. */
export function lessonDetailsText(event: CalendarEvent): string {
  const parts: string[] = [];
  if (event.topic) parts.push(`Argomento: ${event.topic}`);
  if (event.notes) parts.push(`Capitoli/Libro: ${event.notes}`);
  if (event.lecturer) parts.push(`Docente: ${event.lecturer}`);
  if (event.readings && event.readings.length > 0) parts.push(`Materiali e Link:\n${event.readings.join('\n')}`);
  return parts.join('\n');
}

const GENERIC_DESCRIPTIONS = new Set([
  'Revisione appunti della lezione',
  'Esercitazione post-lezione',
  "Segna come completato se hai seguito la lezione, altrimenti l'app pianificherà il recupero.",
]);

export function isGenericTaskDescription(desc: string | undefined): boolean {
  return !desc || GENERIC_DESCRIPTIONS.has(desc.trim());
}

const TITLE_PREFIX: Record<string, string> = {
  FOLLOW_LESSON: 'Seguire/Recuperare lezione',
  NOTES: 'Sistemare appunti',
  EXERCISES: 'Esercizi',
};

/**
 * Riallinea titolo e descrizione dei task di lezione (segui/appunti/esercizi) ai dettagli correnti
 * dell'evento collegato. Non tocca task completati, di preparazione esami o di progetto, né le
 * descrizioni scritte a mano dall'utente.
 */
export function refreshLessonTasks(
  tasks: Task[],
  events: CalendarEvent[],
  courses: Course[]
): { tasks: Task[]; updatedCount: number } {
  const courseById = new Map(courses.map(c => [c.id, c]));
  const byCourse = new Map<string, CalendarEvent[]>();
  const byId = new Map<string, CalendarEvent>();
  for (const e of events) {
    byId.set(e.id, e);
    if (e.type === 'lesson' && e.courseId) {
      const arr = byCourse.get(e.courseId) ?? [];
      arr.push(e);
      byCourse.set(e.courseId, arr);
    }
  }

  let updatedCount = 0;
  const next = tasks.map(task => {
    if (task.status === 'done' || task.isPhantom || task.isProjectTask || task.assessmentPrep) return task;
    const kind = getTaskKind(task);
    const prefix = TITLE_PREFIX[kind];
    if (!prefix) return task;

    let event = task.relatedEventId ? byId.get(task.relatedEventId) : undefined;
    if (!event && task.courseId) {
      event = (byCourse.get(task.courseId) ?? []).find(e => taskBelongsToEvent(task, e));
    }
    if (!event || event.type !== 'lesson' || !event.topic) return task;

    const course = event.courseId ? courseById.get(event.courseId) : undefined;
    const { dateIt, timeSlot } = eventSlot(event);
    const computedTitle = `${prefix}: ${lessonLabel(event, course)} (${dateIt} ${timeSlot})`;
    // Un titolo che contiene già l'argomento non si tocca (può essere stato personalizzato dall'utente)
    const title = task.title.includes(event.topic) ? task.title : computedTitle;
    const details = lessonDetailsText(event);
    const canWriteDescription = isGenericTaskDescription(task.description) || task.isAiEnriched;
    const description = canWriteDescription && details ? details : task.description;

    if (
      task.title === title &&
      task.description === description &&
      task.relatedEventId === event.id &&
      task.isAiEnriched
    ) {
      return task;
    }
    updatedCount++;
    return {
      ...task,
      title,
      description,
      relatedEventId: event.id,
      lessonDate: dateIt,
      lessonTimeSlot: timeSlot,
      isAiEnriched: true,
    };
  });

  return { tasks: next, updatedCount };
}
