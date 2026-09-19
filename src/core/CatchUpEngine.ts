import type {
  CalendarEvent,
  Course,
  Task,
  StudySession,
} from './types';

/**
 * Per-course catch-up status.
 */
export interface CourseCatchUpStatus {
  courseId: string;
  courseName: string;
  courseColor: string;
  totalLessonsPast: number;
  lessonsFullyCaughtUp: number;
  pendingTasksCount: number;
  pendingMinutes: number;
  /** 0-100 percentage of how caught up the student is */
  catchUpPercentage: number;
  /** Estimated date when all pending tasks for this course will be done */
  estimatedCatchUpDate: string | null;
  /** Whether the planning successfully scheduled all tasks before the next lesson */
  isPlanningCaughtUp: boolean;
}

/**
 * Global catch-up summary.
 */
export interface CatchUpSummary {
  courses: CourseCatchUpStatus[];
  /** Weighted average catch-up percentage across all courses */
  globalPercentage: number;
  /** The latest catch-up date across all courses (when fully caught up) */
  globalCatchUpDate: string | null;
  /** True if all active courses have their planning caught up */
  globalPlanningCaughtUp: boolean;
}

/**
 * CatchUpEngine — Calculates how "caught up" a student is per course.
 *
 * For each course:
 * - Counts past lessons
 * - Checks if all generated tasks for each lesson are done
 * - Computes a catch-up percentage
 * - Estimates when the student will be fully caught up based on scheduled sessions
 */
export class CatchUpEngine {

  static calculate(
    events: CalendarEvent[],
    courses: Course[],
    tasks: Task[],
    studySessions: StudySession[]
  ): CatchUpSummary {
    const now = Date.now();
    const courseStatuses: CourseCatchUpStatus[] = [];

    for (const course of courses) {
      // Find all past lessons for this course
      const pastLessons = events.filter(
        e =>
          e.type === 'lesson' &&
          e.courseId === course.id &&
          new Date(e.endTime).getTime() <= now
      );

      if (pastLessons.length === 0) {
        // No past lessons → 100% caught up (nothing to do)
        courseStatuses.push({
          courseId: course.id,
          courseName: course.name,
          courseColor: course.color,
          totalLessonsPast: 0,
          lessonsFullyCaughtUp: 0,
          pendingTasksCount: 0,
          pendingMinutes: 0,
          catchUpPercentage: 100,
          estimatedCatchUpDate: null,
        });
        continue;
      }

      // For each past lesson, check if ALL its tasks are completed
      let fullyDone = 0;
      let totalPendingTasks = 0;
      let totalPendingMinutes = 0;

      for (const lesson of pastLessons) {
        const lessonTasks = tasks.filter(
          t => t.relatedEventId === lesson.id && !t.isPhantom
        );

        if (lessonTasks.length === 0) {
          // No tasks generated yet (edge case) — not caught up
          continue;
        }

        const allDone = lessonTasks.every(t => t.status === 'done');
        if (allDone) {
          fullyDone++;
        } else {
          const pending = lessonTasks.filter(t => t.status !== 'done');
          totalPendingTasks += pending.length;
          totalPendingMinutes += pending.reduce((sum, t) => sum + t.estimatedDuration, 0);
        }
      }

      const catchUpPercentage =
        pastLessons.length > 0
          ? Math.round((fullyDone / pastLessons.length) * 100)
          : 100;

      // Estimate catch-up date from scheduled study sessions
      const estimatedCatchUpDate = this.estimateCatchUpDate(
        course.id,
        tasks,
        studySessions
      );

      // Check planning caught up
      const pendingTasksForPlanning = tasks.filter(t => t.courseId === course.id && t.status !== 'done' && !t.isPhantom);
      let isPlanningCaughtUp = false;
      if (pendingTasksForPlanning.length === 0) {
        isPlanningCaughtUp = true;
      } else {
        const nextLesson = events
          .filter(e => e.type === 'lesson' && e.courseId === course.id && new Date(e.startTime).getTime() > now)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

        const planningPendingTaskIds = new Set(pendingTasksForPlanning.map(t => t.id));
        const planningScheduledTaskIds = new Set<string>();
        let latestSessionEndForPlanning = 0;

        for (const session of studySessions) {
          if (planningPendingTaskIds.has(session.taskId)) {
            planningScheduledTaskIds.add(session.taskId);
            const end = new Date(session.endTime).getTime();
            if (end > latestSessionEndForPlanning) latestSessionEndForPlanning = end;
          }
        }

        if (planningScheduledTaskIds.size === planningPendingTaskIds.size) {
          if (nextLesson) {
            const nextLessonStart = new Date(nextLesson.startTime).getTime();
            if (latestSessionEndForPlanning <= nextLessonStart) {
              isPlanningCaughtUp = true;
            }
          } else {
            isPlanningCaughtUp = true; // All scheduled and no next lesson
          }
        }
      }

      courseStatuses.push({
        courseId: course.id,
        courseName: course.name,
        courseColor: course.color,
        totalLessonsPast: pastLessons.length,
        lessonsFullyCaughtUp: fullyDone,
        pendingTasksCount: totalPendingTasks,
        pendingMinutes: totalPendingMinutes,
        catchUpPercentage,
        estimatedCatchUpDate,
        isPlanningCaughtUp,
      });
    }

    // Global percentage: weighted by number of past lessons
    const totalLessons = courseStatuses.reduce((s, c) => s + c.totalLessonsPast, 0);
    const globalPercentage =
      totalLessons > 0
        ? Math.round(
            courseStatuses.reduce(
              (s, c) => s + c.catchUpPercentage * c.totalLessonsPast,
              0
            ) / totalLessons
          )
        : 100;

    // Global catch-up date: the latest date across all courses
    let globalCatchUpDate: string | null = null;
    for (const cs of courseStatuses) {
      if (cs.estimatedCatchUpDate) {
        if (
          !globalCatchUpDate ||
          new Date(cs.estimatedCatchUpDate).getTime() >
            new Date(globalCatchUpDate).getTime()
        ) {
          globalCatchUpDate = cs.estimatedCatchUpDate;
        }
      }
    }

    // Global planning caught up: true if all courses with past lessons are caught up in planning
    const activeCourses = courseStatuses.filter(cs => cs.totalLessonsPast > 0);
    const globalPlanningCaughtUp = activeCourses.length > 0
      ? activeCourses.every(cs => cs.isPlanningCaughtUp)
      : true;

    return {
      courses: courseStatuses,
      globalPercentage,
      globalCatchUpDate,
      globalPlanningCaughtUp,
    };
  }

  /**
   * Estimate when all pending tasks for a course will be completed
   * based on existing study sessions.
   */
  private static estimateCatchUpDate(
    courseId: string,
    tasks: Task[],
    studySessions: StudySession[]
  ): string | null {
    // Find all pending tasks for this course
    const pendingTaskIds = new Set(
      tasks
        .filter(t => t.courseId === courseId && t.status !== 'done' && !t.isPhantom)
        .map(t => t.id)
    );

    if (pendingTaskIds.size === 0) return null; // Already caught up

    // Find the last scheduled session for any of these tasks
    let latestEnd: number = 0;

    for (const session of studySessions) {
      if (pendingTaskIds.has(session.taskId)) {
        const sessionEnd = new Date(session.endTime).getTime();
        if (sessionEnd > latestEnd) {
          latestEnd = sessionEnd;
        }
      }
    }

    if (latestEnd === 0) {
      // No sessions scheduled for these tasks — estimate based on pending minutes
      const pendingMinutes = tasks
        .filter(t => t.courseId === courseId && t.status !== 'done' && !t.isPhantom)
        .reduce((sum, t) => sum + t.estimatedDuration, 0);

      // Rough estimate: ~3 hours of study per day
      const daysNeeded = Math.ceil(pendingMinutes / 180);
      const estimatedDate = new Date(Date.now() + daysNeeded * 86400000);
      return estimatedDate.toISOString();
    }

    return new Date(latestEnd).toISOString();
  }
}
