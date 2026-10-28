import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent, Course, Semester, SemesterArchive, StudySession, Task } from './types';

export interface CloseSemesterOptions {
  /** Corsi che terminano con il semestre (vengono archiviati e tolti dalle liste attive). */
  endCourseIds: string[];
  /** Cosa fare dei task ancora aperti dei corsi terminati. */
  openTasks: 'discard' | 'keep';
  closedAt?: Date;
}

export interface CloseSemesterResult {
  courses: Course[];
  events: CalendarEvent[];
  tasks: Task[];
  studySessions: StudySession[];
  archive: SemesterArchive;
}

function topicOf(t: Task, eventsById: Map<string, CalendarEvent>): string | undefined {
  const m = t.description?.match(/Argomento:\s*([^\n\r]+)/i);
  if (m && m[1].trim()) return m[1].trim();
  const ev = t.relatedEventId ? eventsById.get(t.relatedEventId) : undefined;
  return ev?.topic || undefined;
}

/**
 * SemesterManager — gestione dei semestri.
 *
 * Alla chiusura NON si perde ciò che si è imparato: per ogni corso terminato viene salvata
 * una fotografia (ore, attività completate, temi studiati) dentro Semester.archive.
 * Lo storico delle prestazioni (stime vs tempi reali) resta nell'app e continua a migliorare le stime.
 */
export class SemesterManager {
  static createInitial(name: string, now: Date = new Date()): Semester {
    return { id: uuidv4(), name, startDate: now.toISOString(), status: 'active' };
  }

  static getActive(semesters: Semester[]): Semester | undefined {
    return semesters.find(s => s.status === 'active');
  }

  /** Nome suggerito in base alla data (es. "Autunno 2026" / "Primavera 2027"). */
  static suggestName(now: Date = new Date()): string {
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    if (m >= 9) return `Autunno ${y}`;
    if (m <= 1) return `Autunno ${y - 1}`;
    return `Primavera ${y}`;
  }

  /** Statistiche di archivio per un insieme di corsi (anteprima e chiusura). */
  static buildArchive(
    courses: Course[],
    events: CalendarEvent[],
    tasks: Task[],
    endCourseIds: string[],
    closedAt: Date
  ): SemesterArchive {
    const eventsById = new Map(events.map(e => [e.id, e]));
    const done = tasks.filter(t => t.status === 'done' && !t.isPhantom);
    const perCourse = endCourseIds
      .map(id => courses.find(c => c.id === id))
      .filter((c): c is Course => !!c)
      .map(c => {
        const ct = done.filter(t => t.courseId === c.id);
        const topics: string[] = [];
        for (const t of ct) {
          const tp = topicOf(t, eventsById);
          if (tp && !topics.includes(tp)) topics.push(tp);
        }
        // Se non ci sono temi nelle attività, usa i temi delle lezioni del corso
        if (topics.length === 0) {
          for (const e of events) {
            if (e.courseId === c.id && e.type === 'lesson' && e.topic && !topics.includes(e.topic)) topics.push(e.topic);
          }
        }
        return {
          id: c.id,
          name: c.name,
          minutes: ct.reduce((s, t) => s + (t.actualDuration ?? t.estimatedDuration ?? 0), 0),
          tasksCompleted: ct.length,
          topics: topics.slice(0, 60),
        };
      });

    return {
      closedAt: closedAt.toISOString(),
      totalMinutes: perCourse.reduce((s, c) => s + c.minutes, 0),
      tasksCompleted: perCourse.reduce((s, c) => s + c.tasksCompleted, 0),
      courses: perCourse,
    };
  }

  /** Applica la chiusura: restituisce i nuovi array "attivi" e l'archivio. Non muta gli input. */
  static close(
    courses: Course[],
    events: CalendarEvent[],
    tasks: Task[],
    studySessions: StudySession[],
    opts: CloseSemesterOptions
  ): CloseSemesterResult {
    const closedAt = opts.closedAt || new Date();
    const ending = new Set(opts.endCourseIds);
    const archive = this.buildArchive(courses, events, tasks, opts.endCourseIds, closedAt);

    const nextCourses = courses.filter(c => !ending.has(c.id));
    const nextEvents = events.filter(e => !(e.courseId && ending.has(e.courseId)));

    const nextTasks = tasks.filter(t => {
      if (!t.courseId || !ending.has(t.courseId)) return true;
      // Task dei corsi terminati: completati → riassunti nell'archivio; aperti → secondo la scelta
      if (t.status === 'done') return false;
      return opts.openTasks === 'keep';
    });
    // Se si tengono task aperti di corsi rimossi, resterebbero orfani: li teniamo solo senza corso
    const finalTasks = nextTasks.map(t =>
      t.courseId && ending.has(t.courseId) ? { ...t, courseId: undefined, relatedEventId: undefined } : t
    );

    const keptIds = new Set(finalTasks.map(t => t.id));
    const nextSessions = studySessions.filter(s => s.taskId === 'buffer' || keptIds.has(s.taskId));

    return { courses: nextCourses, events: nextEvents, tasks: finalTasks, studySessions: nextSessions, archive };
  }
}
