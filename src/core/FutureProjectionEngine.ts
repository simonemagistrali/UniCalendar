import type {
  CalendarEvent,
  Course,
  Task,
  PerformanceRecord,
  PhantomTask,
  FutureWorkloadProjection,
} from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * FutureProjectionEngine — Projects future workload by simulating what tasks
 * will be generated after upcoming lessons.
 *
 * Features:
 * - Behavioral prediction: uses attendance rate to skip "recover" phantom tasks
 *   for students who consistently attend in person
 * - Adaptive estimation: adjusts durations based on historical performance
 * - Visible phantom tasks: generates Task objects marked as phantom for UI display
 */
export class FutureProjectionEngine {

  /**
   * Generate a full future workload projection.
   */
  static project(
    events: CalendarEvent[],
    courses: Course[],
    existingTasks: Task[],
    history: PerformanceRecord[],
    daysToProject: number = 14
  ): FutureWorkloadProjection {
    const now = Date.now();
    const endProjection = now + daysToProject * 86400000;

    // Find future lessons within the projection window
    const futureLessons = events.filter(e => {
      if (e.type !== 'lesson') return false;
      const eEnd = new Date(e.endTime).getTime();
      return eEnd > now && eEnd <= endProjection;
    });

    const phantomTasks: PhantomTask[] = [];
    const projectionByDay: Record<string, number> = {};
    const projectionByCourse: Record<string, number> = {};

    for (const lesson of futureLessons) {
      const course = courses.find(c => c.id === lesson.courseId);
      if (!course) continue;

      const prefs = lesson.studyPreferencesOverride || course.defaultStudyPreferences;
      const lessonEnd = new Date(lesson.endTime);
      const dayKey = this.toDayKey(lessonEnd);

      // Calculate lesson duration in minutes
      const lessonDurationMin = Math.max(
        0,
        Math.round(
          (new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime()) / 60000
        )
      ) || 120;

      // Apply historical multiplier for this course
      const multiplier = this.getCourseMultiplier(course.id, existingTasks, events);

      // Apply adaptive reservation factor (from performance history)
      const reservationFactor = this.getAdaptiveReservationFactor(history, course.id);

      const eventDate = new Date(lesson.startTime).toLocaleDateString('it-IT');

      // --- Behavioral Prediction: Attendance Rate ---
      // If the student usually attends this course (≥70%), don't generate
      // "recover lesson" phantom — they'll probably be in class.
      const attendanceRate = this.getCourseAttendanceRate(course.id, existingTasks);
      const willLikelyAttend = attendanceRate >= 0.70;

      // --- Phantom Task 1: Follow/Recover lesson ---
      // Only generate if student is likely to MISS the lesson
      if (!willLikelyAttend) {
        const adjustedLessonDuration = Math.round(lessonDurationMin * multiplier * reservationFactor);
        const followPhantom: PhantomTask = {
          courseId: course.id,
          courseName: course.name,
          sourceEventId: lesson.id,
          expectedAvailableAfter: lesson.endTime,
          estimatedDuration: adjustedLessonDuration,
          type: 'follow_recover',
          title: `[Previsto] Recuperare: ${lesson.title} (${eventDate})`,
        };
        phantomTasks.push(followPhantom);
        this.addToProjection(projectionByDay, dayKey, adjustedLessonDuration);
        this.addToProjection(projectionByCourse, course.id, adjustedLessonDuration);
      }

      // --- Phantom Task 2: Notes revision (if required by course prefs) ---
      if (prefs.requiresNotesRevision) {
        const notesDuration = Math.round(prefs.estimatedRevisionTimePerLesson * reservationFactor);
        const notesPhantom: PhantomTask = {
          courseId: course.id,
          courseName: course.name,
          sourceEventId: lesson.id,
          expectedAvailableAfter: lesson.endTime,
          estimatedDuration: notesDuration,
          type: 'notes',
          title: `[Previsto] Appunti: ${lesson.title} (${eventDate})`,
        };
        phantomTasks.push(notesPhantom);
        this.addToProjection(projectionByDay, dayKey, notesDuration);
        this.addToProjection(projectionByCourse, course.id, notesDuration);
      }

      // --- Phantom Task 3: Exercises (if required by course prefs) ---
      if (prefs.requiresExercises) {
        const exerciseDuration = Math.round(
          prefs.estimatedRevisionTimePerLesson * 1.5 * reservationFactor
        );
        const exercisePhantom: PhantomTask = {
          courseId: course.id,
          courseName: course.name,
          sourceEventId: lesson.id,
          expectedAvailableAfter: lesson.endTime,
          estimatedDuration: exerciseDuration,
          type: 'exercises',
          title: `[Previsto] Esercizi: ${lesson.title} (${eventDate})`,
        };
        phantomTasks.push(exercisePhantom);
        this.addToProjection(projectionByDay, dayKey, exerciseDuration);
        this.addToProjection(projectionByCourse, course.id, exerciseDuration);
      }
    }

    const totalProjectedMinutes = phantomTasks.reduce((sum, pt) => sum + pt.estimatedDuration, 0);

    return {
      phantomTasks,
      totalProjectedMinutes,
      projectionByDay,
      projectionByCourse,
    };
  }

  /**
   * Convert phantom tasks into visible Task objects for UI display.
   * These are NOT persisted — they are generated on-the-fly each render.
   */
  static generateVisiblePhantomTasks(
    projection: FutureWorkloadProjection,
    events: CalendarEvent[]
  ): Task[] {
    return projection.phantomTasks.map(pt => {
      const sourceEvent = events.find(e => e.id === pt.sourceEventId);
      const lessonDateStr = sourceEvent
        ? new Date(sourceEvent.startTime).toLocaleDateString('it-IT', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })
        : '';

      return {
        id: `phantom-${pt.sourceEventId}-${pt.type}`,
        title: pt.title,
        description: `Previsto dopo la lezione di ${lessonDateStr}`,
        courseId: pt.courseId,
        relatedEventId: pt.sourceEventId,
        status: 'todo' as const,
        priorityScore: 0,
        estimatedDuration: pt.estimatedDuration,
        createdAt: new Date().toISOString(),
        dependencies: [],
        postponedCount: 0,
        isPhantom: true,
        phantomSourceLesson: `Dopo lezione del ${lessonDateStr}`,
      };
    });
  }

  /**
   * For a given day, calculate how many minutes should be reserved
   * for future (phantom) tasks.
   */
  static getReservedMinutesForDay(
    dayDate: Date,
    projection: FutureWorkloadProjection
  ): number {
    const dayKey = this.toDayKey(dayDate);

    // Direct assignment: tasks expected to arrive on this day
    const directLoad = projection.projectionByDay[dayKey] || 0;

    // Also consider that tasks arriving on previous days may spill into this day.
    let spillLoad = 0;
    const yesterday = new Date(dayDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = this.toDayKey(yesterday);
    const yesterdayLoad = projection.projectionByDay[yesterdayKey] || 0;

    // Assume 50% of yesterday's arriving load spills to today
    spillLoad = Math.round(yesterdayLoad * 0.5);

    return directLoad + spillLoad;
  }

  /**
   * Calculate the attendance rate for a course.
   * Returns a value between 0 and 1 (1 = always attends).
   * If no data, returns 0.5 (neutral — will generate recovery phantom).
   */
  private static getCourseAttendanceRate(
    courseId: string,
    existingTasks: Task[]
  ): number {
    const lessonTasks = existingTasks.filter(
      t =>
        t.courseId === courseId &&
        t.status === 'done' &&
        t.title.startsWith('Seguire/Recuperare lezione') &&
        t.completionMode
    );

    if (lessonTasks.length < 2) return 0.5; // Not enough data, be neutral

    const attended = lessonTasks.filter(t => t.completionMode === 'attended').length;
    return attended / lessonTasks.length;
  }

  /**
   * Calculate a historical multiplier for lesson recovery time.
   */
  private static getCourseMultiplier(
    courseId: string,
    existingTasks: Task[],
    events: CalendarEvent[]
  ): number {
    let totalNominal = 0;
    let totalActual = 0;

    for (const t of existingTasks) {
      if (
        t.status === 'done' &&
        t.actualDuration &&
        t.courseId === courseId &&
        t.title.startsWith('Seguire/Recuperare')
      ) {
        const ev = events.find(e => e.id === t.relatedEventId);
        if (ev) {
          const nominal =
            Math.max(
              0,
              Math.round(
                (new Date(ev.endTime).getTime() - new Date(ev.startTime).getTime()) / 60000
              )
            ) || 120;
          totalNominal += nominal;
          totalActual += t.actualDuration;
        }
      }
    }

    if (totalNominal > 0) {
      return Math.max(0.5, Math.min(3.0, totalActual / totalNominal));
    }

    return 1.0;
  }

  /**
   * Adaptive reservation factor: starts conservative (0.7) and adjusts
   * based on how accurate past projections were.
   */
  private static getAdaptiveReservationFactor(
    history: PerformanceRecord[],
    courseId: string
  ): number {
    const BASE_FACTOR = 0.7;

    if (history.length < 3) return BASE_FACTOR;

    const courseHistory = history.filter(h => h.courseId === courseId);
    if (courseHistory.length < 2) return BASE_FACTOR;

    const ratios = courseHistory.map(h =>
      h.estimatedMinutes > 0 ? h.actualMinutes / h.estimatedMinutes : 1.0
    );
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

    const adjusted = Math.max(0.5, Math.min(1.0, BASE_FACTOR * avgRatio));
    return adjusted;
  }

  /** Convert a Date to "YYYY-MM-DD" string */
  private static toDayKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /** Increment a value in a Record<string, number> */
  private static addToProjection(
    map: Record<string, number>,
    key: string,
    minutes: number
  ): void {
    map[key] = (map[key] || 0) + minutes;
  }
}
