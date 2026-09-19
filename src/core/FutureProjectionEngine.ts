import type {
  CalendarEvent,
  Course,
  Task,
  PerformanceRecord,
  PhantomTask,
  PhantomTaskType,
  FutureWorkloadProjection,
} from './types';

/**
 * FutureProjectionEngine — Projects future workload by simulating what tasks
 * will be generated after upcoming lessons.
 *
 * This allows the SchedulerEngine to "reserve" time for predicted tasks,
 * avoiding the problem of over-scheduling current tasks and leaving no room
 * for the inevitable post-lesson work that will appear.
 *
 * Uses an adaptive approach: starts conservative (70% reservation) and
 * adjusts based on historical accuracy.
 */
export class FutureProjectionEngine {

  /**
   * Generate a full future workload projection.
   *
   * @param events       All calendar events (past and future)
   * @param courses      All courses
   * @param existingTasks Current real tasks (to compute historical multiplier)
   * @param history      Performance history for adaptive estimation
   * @param daysToProject How many days ahead to project (default 14)
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

      // --- Phantom Task 1: Follow/Recover lesson ---
      const adjustedLessonDuration = Math.round(lessonDurationMin * multiplier * reservationFactor);
      const eventDate = new Date(lesson.startTime).toLocaleDateString('it-IT');

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
   * For a given day, calculate how many minutes should be reserved
   * for future (phantom) tasks. This is used by the SchedulerEngine
   * to avoid over-filling days where new tasks will arrive.
   *
   * The reservation distributes the phantom task load across the days
   * between "now" and the phantom task's expected date, plus 1-2 days after.
   */
  static getReservedMinutesForDay(
    dayDate: Date,
    projection: FutureWorkloadProjection
  ): number {
    const dayKey = this.toDayKey(dayDate);

    // Direct assignment: tasks expected to arrive on this day
    const directLoad = projection.projectionByDay[dayKey] || 0;

    // Also consider that tasks arriving on previous days may spill into this day.
    // We distribute the load: phantom tasks arriving on day X are expected
    // to be worked on during day X and X+1 (spread the load).
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
   * Calculate a historical multiplier for lesson recovery time.
   * If the student historically takes longer or shorter than estimated,
   * this adjusts future projections accordingly.
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
      // Cap between 0.5x and 3.0x
      return Math.max(0.5, Math.min(3.0, totalActual / totalNominal));
    }

    return 1.0; // No history, assume 1:1
  }

  /**
   * Adaptive reservation factor: starts conservative (0.7) and adjusts
   * based on how accurate past projections were.
   *
   * If the student consistently completes tasks faster than estimated → lower factor
   * If the student consistently takes longer → higher factor
   */
  private static getAdaptiveReservationFactor(
    history: PerformanceRecord[],
    courseId: string
  ): number {
    const BASE_FACTOR = 0.7; // Conservative start

    if (history.length < 3) return BASE_FACTOR;

    const courseHistory = history.filter(h => h.courseId === courseId);
    if (courseHistory.length < 2) return BASE_FACTOR;

    // Calculate average ratio of actual/estimated
    const ratios = courseHistory.map(h =>
      h.estimatedMinutes > 0 ? h.actualMinutes / h.estimatedMinutes : 1.0
    );
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

    // Adjust factor: if student averages 1.2x estimated, bump reservation
    // Range: 0.5 to 1.0
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
