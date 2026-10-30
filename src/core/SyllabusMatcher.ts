import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent, Task, ParsedLessonNote, Course, LessonType } from './types';
import { localDateKey, refreshLessonTasks } from './lessonLink';

export interface MatchResultItem {
  syllabusLesson: ParsedLessonNote;
  matchedEvent?: CalendarEvent;
  matchedTasks?: Task[];
  isNewEventNeeded: boolean;
  proposedEvent?: CalendarEvent;
}

const LESSON_TYPES: LessonType[] = ['theory', 'exercise', 'theory_exercise', 'lab'];

export function normalizeLessonType(value: unknown): LessonType {
  return LESSON_TYPES.includes(value as LessonType) ? (value as LessonType) : 'theory';
}

/** True se la data era scritta con l'anno esplicito (es. "15/09/2026"): in quel caso non va corretta. */
function hasExplicitYear(rawDate: string | undefined): boolean {
  return !!rawDate && /\b(19|20)\d{2}\b/.test(rawDate);
}

/**
 * Le date senza anno (es. "15/1") vengono assegnate dall'AI all'anno corrente, ma in un anno accademico
 * gennaio-giugno cade nell'anno solare successivo. Si sceglie l'anno (±1) per cui esiste una lezione
 * del corso in quel giorno; se nessuna combacia si mantiene la data proposta.
 */
export function resolveLessonDate(lesson: ParsedLessonNote, courseEvents: CalendarEvent[]): string {
  const parsed = lesson.parsedDate || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return parsed;
  if (hasExplicitYear(lesson.rawDate)) return parsed;

  const eventDays = new Set(courseEvents.map(e => localDateKey(e.startTime)));
  if (eventDays.has(parsed)) return parsed;

  const year = Number(parsed.substring(0, 4));
  const monthDay = parsed.substring(4);
  for (const y of [year + 1, year - 1]) {
    const candidate = `${y}${monthDay}`;
    if (eventDays.has(candidate)) return candidate;
  }
  return parsed;
}

function isCourseEvent(e: CalendarEvent, course: Course): boolean {
  if (e.type !== 'lesson' && e.type !== 'generic') return false;
  if (e.courseId) return e.courseId === course.id;
  return !!e.title && !!course.name && e.title.toLowerCase().includes(course.name.toLowerCase());
}

/**
 * Abbina le lezioni estratte dal documento agli eventi del calendario (e ai task esistenti).
 */
export function matchSyllabusWithCalendar(
  syllabusLessons: ParsedLessonNote[],
  existingEvents: CalendarEvent[],
  course: Course,
  existingTasks: Task[] = []
): MatchResultItem[] {
  const courseEvents = existingEvents.filter(e => isCourseEvent(e, course));
  const usedEventIds = new Set<string>();

  return syllabusLessons.map(rawLesson => {
    const date = resolveLessonDate(rawLesson, courseEvents);
    const lesson: ParsedLessonNote = { ...rawLesson, parsedDate: date, lessonType: normalizeLessonType(rawLesson.lessonType) };

    const dayMatches = courseEvents.filter(e => localDateKey(e.startTime) === date && !usedEventIds.has(e.id));

    let matched: CalendarEvent | undefined;
    if (dayMatches.length === 1) {
      matched = dayMatches[0];
    } else if (dayMatches.length > 1) {
      if (lesson.startTime) {
        const [targetH, targetM = 0] = lesson.startTime.split(':').map(Number);
        const targetTotalMin = targetH * 60 + targetM;
        let bestDiff = Infinity;
        for (const ev of dayMatches) {
          const evD = new Date(ev.startTime);
          const diff = Math.abs(evD.getHours() * 60 + evD.getMinutes() - targetTotalMin);
          if (diff < bestDiff) {
            bestDiff = diff;
            matched = ev;
          }
        }
      } else {
        matched = dayMatches.find(e => e.lessonType === lesson.lessonType) || dayMatches[0];
      }
    }
    if (matched) usedEventIds.add(matched.id);

    const matchedTasks = matched ? existingTasks.filter(t => t.relatedEventId === matched!.id) : [];

    if (lesson.isCancelled || matched) {
      return { syllabusLesson: lesson, matchedEvent: matched, matchedTasks, isNewEventNeeded: false };
    }

    // Nessun evento esistente: si propone la creazione di una nuova lezione
    const [startH, startM] = (lesson.startTime || '09:00').split(':').map(Number);
    const [endH, endM] = (lesson.endTime || '11:00').split(':').map(Number);
    const lessonDate = date || new Date().toISOString().substring(0, 10);
    const startDate = new Date(`${lessonDate}T00:00:00`);
    startDate.setHours(startH || 9, startM || 0, 0, 0);
    const endDate = new Date(`${lessonDate}T00:00:00`);
    endDate.setHours(endH || 11, endM || 0, 0, 0);

    const proposed: CalendarEvent = {
      id: uuidv4(),
      title: `${course.name} - ${lesson.topic}`,
      type: 'lesson',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      courseId: course.id,
      lessonType: lesson.lessonType,
      topic: lesson.topic,
      lecturer: lesson.lecturer,
      notes: lesson.sectionsOrChapters,
      readings: lesson.readingsOrLinks,
      location: lesson.room ? { type: 'in_person', address: `Aula ${lesson.room}` } : undefined,
      isDone: false,
    };

    return { syllabusLesson: lesson, matchedTasks, isNewEventNeeded: true, proposedEvent: proposed };
  });
}

/**
 * Rimuove i task di lezione doppi di un corso, unendone le descrizioni nel task canonico.
 */
export function deduplicateCourseTasks(tasks: Task[], courseId: string): Task[] {
  const seen = new Map<string, Task>();
  const result: Task[] = [];

  for (const t of tasks) {
    if (t.courseId !== courseId || t.isProjectTask || t.assessmentPrep || t.isPhantom) {
      result.push(t);
      continue;
    }

    const lower = t.title.toLowerCase();
    const category = lower.startsWith('seguire') || lower.startsWith('recuperare')
      ? 'follow'
      : lower.startsWith('sistemare appunti') || lower.startsWith('ripasso') || lower.startsWith('appunti')
        ? 'notes'
        : lower.startsWith('esercizi')
          ? 'exercise'
          : '';
    if (!category) {
      result.push(t);
      continue;
    }

    const dateMatch = t.title.match(/\((\d{1,2}\/\d{1,2}(?:\/\d{4})?)/);
    const dateKey = t.lessonDate || (dateMatch ? dateMatch[1] : (t.relatedEventId || t.id));
    const timeMatch = t.title.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
    const slotKey = t.lessonTimeSlot || (timeMatch ? timeMatch[1] : 'all');
    const key = `${category}__${dateKey}__${slotKey}`;

    const existing = seen.get(key);
    if (existing) {
      // Mantiene il task già completato e unisce la descrizione, se manca
      if (existing.status !== 'done' && t.status === 'done') {
        if (!t.description && existing.description) t.description = existing.description;
        result[result.indexOf(existing)] = t;
        seen.set(key, t);
      } else if (!existing.description && t.description) {
        existing.description = t.description;
      }
      continue;
    }
    seen.set(key, t);
    result.push(t);
  }

  return result;
}

/**
 * Applica gli abbinamenti: arricchisce gli eventi con argomento/capitoli/docente/materiali e riallinea
 * titolo e descrizione dei task collegati (compresi quelli che nasceranno dopo, perché leggono l'evento).
 */
export function applySyllabusMatches(
  matchResults: MatchResultItem[],
  currentEvents: CalendarEvent[],
  currentTasks: Task[],
  course: Course,
  createNewEvents = false
): {
  updatedEvents: CalendarEvent[];
  updatedTasks: Task[];
  newEventsCreatedCount: number;
  eventsEnrichedCount: number;
  tasksUpdatedCount: number;
  /** lezione (id) → id evento nel calendario, per collegare il calendario del corso */
  eventIdByLessonId: Record<string, string>;
} {
  const eventsMap = new Map<string, CalendarEvent>(currentEvents.map(e => [e.id, { ...e }]));
  const eventIdByLessonId: Record<string, string> = {};
  const now = Date.now();

  let newEventsCreatedCount = 0;
  let eventsEnrichedCount = 0;

  for (const item of matchResults) {
    const { syllabusLesson, matchedEvent, isNewEventNeeded, proposedEvent } = item;

    if (matchedEvent) {
      const target = eventsMap.get(matchedEvent.id);
      if (!target) continue;
      if (syllabusLesson.id) eventIdByLessonId[syllabusLesson.id] = target.id;
      if (syllabusLesson.isCancelled) continue;

      if (!target.courseId) target.courseId = course.id;
      if (syllabusLesson.topic) target.topic = syllabusLesson.topic;
      if (syllabusLesson.lessonType) target.lessonType = syllabusLesson.lessonType;
      if (syllabusLesson.lecturer) target.lecturer = syllabusLesson.lecturer;
      if (syllabusLesson.sectionsOrChapters) target.notes = syllabusLesson.sectionsOrChapters;
      if (syllabusLesson.readingsOrLinks && syllabusLesson.readingsOrLinks.length > 0) {
        target.readings = syllabusLesson.readingsOrLinks;
      }
      if (syllabusLesson.room && !target.location?.address) {
        target.location = { type: 'in_person', address: `Aula ${syllabusLesson.room}` };
      }
      eventsEnrichedCount++;
    } else if (isNewEventNeeded && createNewEvents && proposedEvent) {
      // Le lezioni future restano "da elaborare" così, a lezione finita, l'app genera i task di studio.
      // Quelle già passate vengono segnate come elaborate per non creare task arretrati a pioggia.
      proposedEvent.isDone = new Date(proposedEvent.endTime).getTime() <= now;
      eventsMap.set(proposedEvent.id, proposedEvent);
      if (syllabusLesson.id) eventIdByLessonId[syllabusLesson.id] = proposedEvent.id;
      newEventsCreatedCount++;
    }
  }

  const updatedEvents = Array.from(eventsMap.values());
  const refreshed = refreshLessonTasks(currentTasks.map(t => ({ ...t })), updatedEvents, [course]);

  return {
    updatedEvents,
    updatedTasks: deduplicateCourseTasks(refreshed.tasks, course.id),
    newEventsCreatedCount,
    eventsEnrichedCount,
    tasksUpdatedCount: refreshed.updatedCount,
    eventIdByLessonId,
  };
}
