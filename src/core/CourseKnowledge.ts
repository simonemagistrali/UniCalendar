import { v4 as uuidv4 } from 'uuid';
import type {
  AssessmentType,
  CalendarEvent,
  Course,
  CourseAssessment,
  CourseInfo,
  CoursePlanLesson,
  CourseTopic,
  EventType,
  ParsedAssessment,
  SyllabusExtractionResult,
  Task,
} from './types';
import { applySyllabusMatches, type MatchResultItem } from './SyllabusMatcher';
import { localDateKey } from './lessonLink';

export const ASSESSMENT_LABELS: Record<AssessmentType, string> = {
  quiz: 'Quiz',
  lab: 'Laboratorio',
  exam: 'Esame',
  oral: 'Orale',
  project: 'Progetto',
  deadline: 'Scadenza',
  other: 'Altro',
};

/** Unisce due stringhe di testo informativo senza duplicazioni o sovrascritture distruttive. */
function mergeText(existing?: string, incoming?: string): string | undefined {
  if (!existing && !incoming) return undefined;
  if (!existing) return incoming?.trim() || undefined;
  if (!incoming) return existing?.trim() || undefined;

  const exClean = existing.trim();
  const inClean = incoming.trim();
  if (exClean === inClean) return exClean;

  const exLow = exClean.toLowerCase();
  const inLow = inClean.toLowerCase();
  // Se uno contiene già interamente l'altro, teniamo la versione più ricca e completa
  if (exLow.includes(inLow)) return exClean;
  if (inLow.includes(exLow)) return inClean;

  // Altrimenti uniamo le due informazioni in modo equilibrato
  return `${exClean}\n\n[Integrazione]:\n${inClean}`;
}

/** Unisce array di link o stringhe eliminando duplicati */
function mergeLists(a?: string[], b?: string[]): string[] | undefined {
  const set = new Set<string>();
  for (const item of a ?? []) if (item?.trim()) set.add(item.trim());
  for (const item of b ?? []) if (item?.trim()) set.add(item.trim());
  return set.size > 0 ? Array.from(set) : undefined;
}

/** Tipo di evento del calendario corrispondente a una prova/scadenza. */
export function assessmentEventType(type: AssessmentType): EventType {
  switch (type) {
    case 'exam':
    case 'oral':
      return 'exam';
    case 'quiz':
      return 'quiz';
    case 'project':
    case 'deadline':
      return 'project_deadline';
    default:
      return 'generic';
  }
}

/** Crea l'evento di calendario per una prova con data. */
export function createAssessmentEvent(a: Pick<CourseAssessment, 'type' | 'title' | 'date' | 'time' | 'notes'>, course: Course): CalendarEvent | null {
  if (!a.date) return null;
  const isDeadline = a.type === 'deadline' || a.type === 'project';
  const [h, m] = (a.time || (isDeadline ? '23:00' : '09:00')).split(':').map(Number);
  const start = new Date(`${a.date}T00:00:00`);
  start.setHours(h || 0, m || 0, 0, 0);
  const durationMin = isDeadline ? 30 : a.type === 'exam' ? 120 : 90;
  const end = new Date(start.getTime() + durationMin * 60000);
  const title = a.title.toLowerCase().includes(course.name.toLowerCase()) ? a.title : `${course.name} — ${a.title}`;
  return {
    id: uuidv4(),
    title,
    type: assessmentEventType(a.type),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    courseId: course.id,
    isDone: false,
  };
}

/** Cerca nel calendario l'evento che corrisponde già a una prova (stesso corso, stesso giorno, tipo compatibile). */
export function findEventForAssessment(a: Pick<CourseAssessment, 'type' | 'date'>, events: CalendarEvent[], courseId: string): CalendarEvent | undefined {
  if (!a.date) return undefined;
  const wanted = assessmentEventType(a.type);
  return events.find(e => e.courseId === courseId && e.type === wanted && localDateKey(e.startTime) === a.date);
}

function sameAssessment(a: CourseAssessment, b: ParsedAssessment): boolean {
  if (a.type === b.type && norm(a.title) === norm(b.title)) return true;
  if (a.type === b.type && a.date && b.date && a.date === b.date) return true;
  return false;
}

export interface ApplyOptions {
  applyLessons: boolean;
  createMissingLessonEvents: boolean;
  applyTopics: boolean;
  applyAssessments: boolean;
  createAssessmentEvents: boolean;
  applyTexts: boolean;
}

export interface ApplyStats {
  lessonsEnriched: number;
  lessonsCreated: number;
  tasksUpdated: number;
  topicsAdded: number;
  assessmentsAdded: number;
  assessmentsUpdated: number;
  assessmentEventsCreated: number;
}

/**
 * Applica il risultato dell'analisi AI al corso: aggiorna la scheda (indice, valutazioni, calendario del corso),
 * gli eventi del calendario generale e i task collegati. Funzione pura: restituisce il nuovo stato.
 */
export function applyExtractionToCourse(input: {
  course: Course;
  result: SyllabusExtractionResult;
  fileName: string;
  matches: MatchResultItem[];
  events: CalendarEvent[];
  tasks: Task[];
  options: ApplyOptions;
}): { course: Course; events: CalendarEvent[]; tasks: Task[]; stats: ApplyStats } {
  const { course, result, fileName, matches, options } = input;
  let events = input.events;
  let tasks = input.tasks;
  const info: CourseInfo = { ...(course.info ?? {}) };
  const stats: ApplyStats = {
    lessonsEnriched: 0,
    lessonsCreated: 0,
    tasksUpdated: 0,
    topicsAdded: 0,
    assessmentsAdded: 0,
    assessmentsUpdated: 0,
    assessmentEventsCreated: 0,
  };

  // ── Lezioni: eventi, task e calendario della materia ──
  if (options.applyLessons && matches.length > 0) {
    const applied = applySyllabusMatches(matches, events, tasks, course, options.createMissingLessonEvents);
    events = applied.updatedEvents;
    tasks = applied.updatedTasks;
    stats.lessonsEnriched = applied.eventsEnrichedCount;
    stats.lessonsCreated = applied.newEventsCreatedCount;
    stats.tasksUpdated = applied.tasksUpdatedCount;

    const plan: CoursePlanLesson[] = [...(info.lessonPlan ?? [])];
    for (const item of matches) {
      const l = item.syllabusLesson;
      if (!l.parsedDate) continue;
      const eventId = (l.id && applied.eventIdByLessonId[l.id]) || item.matchedEvent?.id;
      const idx = plan.findIndex(p => p.date === l.parsedDate && (p.startTime && l.startTime ? p.startTime === l.startTime : true));
      const existing = idx >= 0 ? plan[idx] : undefined;
      const entry: CoursePlanLesson = {
        id: existing ? existing.id : uuidv4(),
        date: l.parsedDate,
        startTime: l.startTime ?? existing?.startTime,
        endTime: l.endTime ?? existing?.endTime,
        topic: mergeText(existing?.topic, l.topic) || '',
        lessonType: l.lessonType || existing?.lessonType || 'theory',
        room: l.room ?? existing?.room,
        lecturer: l.lecturer ?? existing?.lecturer,
        chapters: mergeText(existing?.chapters, l.sectionsOrChapters),
        links: mergeLists(existing?.links, l.readingsOrLinks),
        coursePart: l.coursePart ?? existing?.coursePart,
        cancelled: l.isCancelled !== undefined ? l.isCancelled : existing?.cancelled,
        eventId: eventId ?? existing?.eventId,
      };
      if (idx >= 0) plan[idx] = entry;
      else plan.push(entry);
    }
    info.lessonPlan = plan.sort((a, b) => (a.date + (a.startTime ?? '')).localeCompare(b.date + (b.startTime ?? '')));
  }

  // ── Indice degli argomenti ──
  if (options.applyTopics && result.topics.length > 0) {
    const topics: CourseTopic[] = [...(info.topics ?? [])];
    for (const t of result.topics) {
      const key = norm(t.title);
      if (!key) continue;
      const existing = topics.find(ex => norm(ex.title) === key);
      if (existing) {
        // Merge bilanciato dei dettagli e del modulo
        existing.part = existing.part || t.part;
        existing.details = mergeText(existing.details, t.details);
      } else {
        topics.push({ id: uuidv4(), title: t.title, part: t.part, details: t.details, source: 'ai' });
        stats.topicsAdded++;
      }
    }
    info.topics = topics;
  }

  // ── Valutazioni e scadenze ──
  if (options.applyAssessments && result.assessments.length > 0) {
    const list: CourseAssessment[] = (info.assessments ?? []).map(a => ({ ...a }));
    const newEvents: CalendarEvent[] = [];

    for (const p of result.assessments) {
      let target = list.find(a => sameAssessment(a, p));
      if (target) {
        let changed = false;
        if (!target.date && p.date) { target.date = p.date; changed = true; }
        if (!target.time && p.time) { target.time = p.time; changed = true; }
        if (target.weightPercent == null && p.weightPercent != null) { target.weightPercent = p.weightPercent; changed = true; }
        const mergedNotes = mergeText(target.notes, p.notes);
        if (mergedNotes !== target.notes) {
          target.notes = mergedNotes;
          changed = true;
        }
        if (changed) stats.assessmentsUpdated++;
      } else {
        target = {
          id: uuidv4(),
          type: p.type,
          title: p.title,
          weightPercent: p.weightPercent,
          date: p.date,
          time: p.time,
          notes: p.notes,
          done: false,
          source: 'ai',
        };
        list.push(target);
        stats.assessmentsAdded++;
      }

      // Collegamento al calendario: evento già presente nello stesso giorno, oppure nuovo evento
      if (target.date && !target.linkedEventId) {
        const existing = findEventForAssessment(target, [...events, ...newEvents], course.id);
        if (existing) {
          target.linkedEventId = existing.id;
        } else if (options.createAssessmentEvents) {
          const ev = createAssessmentEvent(target, course);
          if (ev) {
            newEvents.push(ev);
            target.linkedEventId = ev.id;
            stats.assessmentEventsCreated++;
          }
        }
      }
    }
    if (newEvents.length) events = [...events, ...newEvents];
    info.assessments = list.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  }

  // ── Testi generali: merge armonico senza sovrascritture distruttive ──
  if (options.applyTexts) {
    info.overview = mergeText(info.overview, result.overview);
    info.gradingSummary = mergeText(info.gradingSummary, result.gradingSummary);
    info.studyPlan = mergeText(info.studyPlan, result.studyPlan);
  }

  info.documents = [
    ...(info.documents ?? []),
    { name: fileName, kind: result.documentKind, at: new Date().toISOString(), summary: result.documentSummary },
  ].slice(-30);
  info.updatedAt = new Date().toISOString();

  return { course: { ...course, info }, events, tasks, stats };
}

/** Crea l'evento di calendario generale per una lezione del calendario del corso. */
export function createEventFromPlanLesson(l: CoursePlanLesson, course: Course): CalendarEvent {
  const [sh, sm] = (l.startTime || '09:00').split(':').map(Number);
  const [eh, em] = (l.endTime || '').split(':').map(Number);
  const start = new Date(`${l.date}T00:00:00`);
  start.setHours(sh || 0, sm || 0, 0, 0);
  const end = new Date(`${l.date}T00:00:00`);
  if (l.endTime && Number.isFinite(eh)) end.setHours(eh, em || 0, 0, 0);
  else end.setTime(start.getTime() + 2 * 3600000);
  return {
    id: uuidv4(),
    title: l.topic ? `${course.name} - ${l.topic}` : course.name,
    type: 'lesson',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    courseId: course.id,
    lessonType: l.lessonType,
    topic: l.topic || undefined,
    lecturer: l.lecturer,
    notes: l.chapters,
    readings: l.links,
    location: l.room ? { type: 'in_person', address: `Aula ${l.room}` } : undefined,
    // Le lezioni future generano i task a lezione finita; quelle già passate non creano task arretrati
    isDone: end.getTime() <= Date.now(),
  };
}

/** Prove di un corso ordinate per data (senza data in fondo). */
export function sortAssessments(list: CourseAssessment[]): CourseAssessment[] {
  return [...list].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}
