import type { CalendarEvent, Course, Task } from './types';
import { getTaskKind, lessonTaskNeeds } from './taskKind';
import { localDateKey, localTime, taskBelongsToEvent } from './lessonLink';

export interface LessonTrackItem {
  eventId: string;
  event: CalendarEvent;
  /** Numero progressivo nel binario (1, 2, 3...) */
  index: number;
  dateIso: string;
  dateIt: string;
  startTime: string;
  endTime: string;
  topic: string;
  chapters?: string;
  lecturer?: string;
  room?: string;
  readings?: string[];
  isPast: boolean;
  isOngoing: boolean;
  isDone: boolean;
  /** ID del task collegato a questo binario per questa lezione (se generato) */
  relatedTaskId?: string;
}

export interface TrackSummary {
  track: 'theory' | 'exercise';
  totalScheduled: number;
  profCurrentIndex: number; // Quante lezioni/esercitazioni sono già state svolte dal prof
  studentDoneCount: number; // Quante lezioni/esercitazioni passate sono state completate dallo studente
  gapCount: number;         // Quante lezioni/esercitazioni passate mancano allo studente
  lastProfLesson: LessonTrackItem | null;
  lastStudentLesson: LessonTrackItem | null;
  nextLesson: LessonTrackItem | null;
  missingLessons: LessonTrackItem[];
  allLessons: LessonTrackItem[];
  percentage: number;
}

export interface CoursePaceStatus {
  courseId: string;
  courseName: string;
  courseColor: string;
  theory: TrackSummary;
  exercise: TrackSummary;
  totalGap: number;
  overallPercentage: number;
}

export interface GlobalPaceSummary {
  courses: CoursePaceStatus[];
  totalTheoryGap: number;
  totalExerciseGap: number;
  totalGap: number;
  globalPercentage: number;
}

/**
 * Determina su quali binari ("theory", "exercise") cade un evento lezione.
 */
export function getLessonTracks(
  event: CalendarEvent,
  course: Course
): { hasTheory: boolean; hasExercise: boolean } {
  const prefs = event.studyPreferencesOverride || course.defaultStudyPreferences;
  const lt = event.lessonType;

  if (lt === 'exercise' || lt === 'lab') {
    return { hasTheory: false, hasExercise: true };
  }
  if (lt === 'theory_exercise') {
    return { hasTheory: true, hasExercise: true };
  }
  if (lt === 'theory') {
    return { hasTheory: true, hasExercise: !!prefs.requiresExercises };
  }

  // Fallback sul titolo se lessonType non è specificato
  const titleLow = (event.title + ' ' + (event.topic || '')).toLowerCase();
  if (
    titleLow.includes('esercitazion') ||
    titleLow.includes('laboratorio') ||
    /\blab\b/.test(titleLow)
  ) {
    return { hasTheory: false, hasExercise: true };
  }

  const wants = lessonTaskNeeds(lt, prefs, !!event.studyPreferencesOverride);
  return {
    hasTheory: wants.notes !== false,
    hasExercise: wants.exercises,
  };
}

/**
 * Verifica se per una determinata lezione il binario ('theory' o 'exercise') è completato.
 * Fonte di verità:
 *  1. Flag esplicito sull'evento (`event.theoryDone` / `event.exerciseDone`) se definito (true o false)
 *  2. Task corrispondente ('NOTES' per theory, 'EXERCISES' per exercise) con status === 'done'
 */
export function isLessonTrackDone(
  event: CalendarEvent,
  track: 'theory' | 'exercise',
  courseTasks: Task[]
): { done: boolean; relatedTask?: Task } {
  const wantedKind = track === 'theory' ? 'NOTES' : 'EXERCISES';
  const relatedTask = courseTasks.find(
    t => !t.isPhantom && getTaskKind(t) === wantedKind && taskBelongsToEvent(t, event)
  );

  const explicitFlag = track === 'theory' ? event.theoryDone : event.exerciseDone;
  if (typeof explicitFlag === 'boolean') {
    return { done: explicitFlag, relatedTask };
  }

  if (relatedTask) {
    return { done: relatedTask.status === 'done', relatedTask };
  }

  return { done: false, relatedTask: undefined };
}

function buildTrackSummary(
  track: 'theory' | 'exercise',
  trackEvents: CalendarEvent[],
  course: Course,
  courseTasks: Task[],
  nowMs: number
): TrackSummary {
  const sorted = [...trackEvents].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Arricchimento da course.info.lessonPlan se l'evento non ha ancora topic
  const planByEventId = new Map(
    (course.info?.lessonPlan ?? []).filter(p => p.eventId).map(p => [p.eventId!, p])
  );
  const planByDate = new Map(
    (course.info?.lessonPlan ?? []).map(p => [p.date, p])
  );

  const allLessons: LessonTrackItem[] = sorted.map((ev, idx) => {
    const startMs = new Date(ev.startTime).getTime();
    const endMs = new Date(ev.endTime).getTime();
    const isPast = endMs <= nowMs;
    const isOngoing = startMs <= nowMs && endMs > nowMs;
    const dateIso = localDateKey(ev.startTime);
    const dateIt = new Date(ev.startTime).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
    });
    const planItem = planByEventId.get(ev.id) || planByDate.get(dateIso);
    const { done, relatedTask } = isLessonTrackDone(ev, track, courseTasks);

    const rawTopic = ev.topic?.trim() || planItem?.topic?.trim() || '';
    const cleanTitle = ev.title
      .replace(new RegExp(`^${course.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[-–—:]?\\s*`, 'i'), '')
      .trim();
    const topic =
      rawTopic ||
      (cleanTitle && cleanTitle.toLowerCase() !== course.name.toLowerCase()
        ? cleanTitle
        : `${track === 'theory' ? 'Lezione' : 'Esercitazione'} ${idx + 1}`);

    return {
      eventId: ev.id,
      event: ev,
      index: idx + 1,
      dateIso,
      dateIt,
      startTime: localTime(ev.startTime),
      endTime: localTime(ev.endTime),
      topic,
      chapters: ev.notes || planItem?.chapters,
      lecturer: ev.lecturer || planItem?.lecturer,
      room: ev.location?.address || (planItem?.room ? `Aula ${planItem.room}` : undefined),
      readings: ev.readings || planItem?.links,
      isPast,
      isOngoing,
      isDone: done,
      relatedTaskId: relatedTask?.id,
    };
  });

  const pastLessons = allLessons.filter(l => l.isPast);
  const futureLessons = allLessons.filter(l => !l.isPast);
  const donePastLessons = pastLessons.filter(l => l.isDone);
  const missingLessons = pastLessons.filter(l => !l.isDone);

  // Anche se lo studente si porta avanti su una lezione futura, contiamola o mostriamola come ultima completata
  const allDoneLessons = allLessons.filter(l => l.isDone);

  const profCurrentIndex = pastLessons.length;
  const studentDoneCount = donePastLessons.length;
  const gapCount = missingLessons.length;

  const lastProfLesson = pastLessons.length > 0 ? pastLessons[pastLessons.length - 1] : null;
  const lastStudentLesson = allDoneLessons.length > 0 ? allDoneLessons[allDoneLessons.length - 1] : null;
  const nextLesson = futureLessons.length > 0 ? futureLessons[0] : null;

  const percentage =
    profCurrentIndex > 0
      ? Math.round((studentDoneCount / profCurrentIndex) * 100)
      : 100;

  return {
    track,
    totalScheduled: allLessons.length,
    profCurrentIndex,
    studentDoneCount,
    gapCount,
    lastProfLesson,
    lastStudentLesson,
    nextLesson,
    missingLessons,
    allLessons,
    percentage,
  };
}

export class LessonProgressEngine {
  static calculateCourse(
    course: Course,
    events: CalendarEvent[],
    tasks: Task[],
    nowMs: number = Date.now()
  ): CoursePaceStatus {
    const courseEvents = events.filter(
      e =>
        e.type === 'lesson' &&
        (e.courseId === course.id ||
          (!e.courseId &&
            e.title &&
            course.name &&
            e.title.toLowerCase().includes(course.name.toLowerCase())))
    );
    const courseTasks = tasks.filter(t => t.courseId === course.id && !t.isPhantom);

    const theoryEvents: CalendarEvent[] = [];
    const exerciseEvents: CalendarEvent[] = [];

    for (const ev of courseEvents) {
      const tracks = getLessonTracks(ev, course);
      if (tracks.hasTheory) theoryEvents.push(ev);
      if (tracks.hasExercise) exerciseEvents.push(ev);
    }

    const theory = buildTrackSummary('theory', theoryEvents, course, courseTasks, nowMs);
    const exercise = buildTrackSummary('exercise', exerciseEvents, course, courseTasks, nowMs);

    const totalPast = theory.profCurrentIndex + exercise.profCurrentIndex;
    const totalDone = theory.studentDoneCount + exercise.studentDoneCount;
    const totalGap = theory.gapCount + exercise.gapCount;
    const overallPercentage = totalPast > 0 ? Math.round((totalDone / totalPast) * 100) : 100;

    return {
      courseId: course.id,
      courseName: course.name,
      courseColor: course.color,
      theory,
      exercise,
      totalGap,
      overallPercentage,
    };
  }

  static calculateAll(
    courses: Course[],
    events: CalendarEvent[],
    tasks: Task[],
    nowMs: number = Date.now()
  ): GlobalPaceSummary {
    const statuses = courses.map(c => this.calculateCourse(c, events, tasks, nowMs));
    const totalTheoryGap = statuses.reduce((s, c) => s + c.theory.gapCount, 0);
    const totalExerciseGap = statuses.reduce((s, c) => s + c.exercise.gapCount, 0);
    const totalGap = totalTheoryGap + totalExerciseGap;

    const totalPast = statuses.reduce(
      (s, c) => s + c.theory.profCurrentIndex + c.exercise.profCurrentIndex,
      0
    );
    const totalDone = statuses.reduce(
      (s, c) => s + c.theory.studentDoneCount + c.exercise.studentDoneCount,
      0
    );
    const globalPercentage = totalPast > 0 ? Math.round((totalDone / totalPast) * 100) : 100;

    return {
      courses: statuses,
      totalTheoryGap,
      totalExerciseGap,
      totalGap,
      globalPercentage,
    };
  }
}

