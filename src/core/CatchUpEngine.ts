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
        studySessions,
        events,
        courses
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
    studySessions: StudySession[],
    events: CalendarEvent[],
    courses: Course[]
  ): string | null {
    // Find all pending tasks for this course
    const pendingTasks = tasks.filter(t => t.courseId === courseId && t.status !== 'done' && !t.isPhantom);
    if (pendingTasks.length === 0) return null; // Already caught up

    // Check if ALL pending tasks are already fully scheduled in the calendar
    const pendingTaskIds = new Set(pendingTasks.map(t => t.id));
    const scheduledTaskIds = new Set<string>();
    let latestEnd: number = 0;

    for (const session of studySessions) {
      if (pendingTaskIds.has(session.taskId)) {
        scheduledTaskIds.add(session.taskId);
        const sessionEnd = new Date(session.endTime).getTime();
        if (sessionEnd > latestEnd) {
          latestEnd = sessionEnd;
        }
      }
    }

    if (scheduledTaskIds.size === pendingTaskIds.size && latestEnd > 0) {
      return new Date(latestEnd).toISOString();
    }

    // Otherwise, simulate based on historical velocity and future incoming load
    const pendingMinutes = pendingTasks.reduce((sum, t) => sum + t.estimatedDuration, 0);

    // 1. Calculate actual historical velocity (minutes completed per day over last 14 days)
    const now = Date.now();
    const twoWeeksAgo = now - 14 * 86400000;
    const recentlyCompletedTasks = tasks.filter(t => 
      t.courseId === courseId && 
      t.status === 'done' && 
      t.completedAt && 
      new Date(t.completedAt).getTime() > twoWeeksAgo
    );
    const completedMinutes = recentlyCompletedTasks.reduce((sum, t) => sum + (t.actualDuration || t.estimatedDuration), 0);
    // If no historical data, fallback to a conservative 60 minutes/day for this specific course
    let dailyVelocityMinutes = completedMinutes > 0 ? (completedMinutes / 14) : 60; 

    // 2. Estimate average incoming load (minutes added per day from future lessons)
    const futureLessons = events.filter(e => 
      e.courseId === courseId && 
      e.type === 'lesson' && 
      new Date(e.endTime).getTime() > now
    );
    
    let dailyIncomingMinutes = 0;
    if (futureLessons.length > 0) {
      const course = courses.find(c => c.id === courseId);
      let tasksPerLesson = 1;
      if (course) {
        if (course.defaultStudyPreferences.requiresNotesRevision) tasksPerLesson++;
        if (course.defaultStudyPreferences.requiresExercises) tasksPerLesson++;
      }
      const lastLesson = futureLessons.sort((a,b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];
      const daysUntilLastLesson = Math.max(1, (new Date(lastLesson.endTime).getTime() - now) / 86400000);
      const totalFutureMinutes = futureLessons.length * tasksPerLesson * 60; // rough 60 min per task
      dailyIncomingMinutes = totalFutureMinutes / daysUntilLastLesson;
    }

    // Net daily progress = Velocity - Incoming load
    const netDailyProgress = dailyVelocityMinutes - dailyIncomingMinutes;

    if (netDailyProgress <= 0) {
       // Cannot catch up! You are accumulating more tasks than you complete.
       // Cap at 180 days to indicate it's very far/impossible without changing pace
       return new Date(now + 180 * 86400000).toISOString();
    }

    const daysNeeded = Math.ceil(pendingMinutes / netDailyProgress);
    const finalDaysNeeded = Math.min(180, daysNeeded);
    return new Date(now + finalDaysNeeded * 86400000).toISOString();
  }
}
