import type { Task, Course, CalendarEvent, UserPreferences, PerformanceRecord } from './types';

/**
 * PriorityEngine — Calculates dynamic priority scores for tasks.
 * Uses: difficulty, delay, exam proximity, past performance, look-ahead, postpone count.
 */
export class PriorityEngine {
  
  static calculatePriority(
    task: Task,
    course: Course | undefined,
    upcomingExam: CalendarEvent | undefined,
    upcomingLesson: CalendarEvent | undefined,
    originalEvent: CalendarEvent | undefined,
    prefs: UserPreferences,
    history: PerformanceRecord[]
  ): number {
    let score = 0;
    const now = Date.now();

    // 1. Difficulty base (1-10 scaled to 10-100)
    const diff = course ? course.difficulty : 5;
    score += diff * 10;

    // 2. Delay weight — how long since creation
    const daysSinceCreation = (now - new Date(task.createdAt).getTime()) / 86400000;
    if (daysSinceCreation > 0) {
      score += Math.min(daysSinceCreation * 5, 100); // Cap at 100
    }

    // 3. Postpone penalty
    score += task.postponedCount * 15;

    // 4. Exam proximity — progressive increase
    if (upcomingExam) {
      const daysToExam = (new Date(upcomingExam.startTime).getTime() - now) / 86400000;
      const threshold = prefs.daysBeforeExamToIncreasePriority;
      
      if (daysToExam >= 0 && daysToExam <= threshold) {
        // Exponential urgency as exam approaches
        const ratio = (threshold - daysToExam) / threshold; // 0 to 1
        score += 150 * Math.pow(ratio, 1.5);
      }
    } else if (task.deadline) {
      // General deadline
      const hoursToDeadline = (new Date(task.deadline).getTime() - now) / 3600000;
      if (hoursToDeadline >= 0 && hoursToDeadline < 72) {
        score += (72 - hoursToDeadline) * 2;
      }
    }

    // 5. Past performance — if student historically takes longer for this course, bump priority
    if (course) {
      const courseHistory = history.filter(h => h.courseId === course.id);
      if (courseHistory.length > 0) {
        const avgOverrun = courseHistory.reduce((acc, h) => acc + (h.actualMinutes - h.estimatedMinutes), 0) / courseHistory.length;
        if (avgOverrun > 0) {
          score += Math.min(avgOverrun * 0.5, 40); // If they always run over, prioritize earlier
        }
      }
    }

    // 6. Long tasks get a bump to be started earlier
    if (task.estimatedDuration > 120) {
      score += 20;
    }

    // 7. Dynamic Lesson Recovery Priority (D1 and D2)
    if (originalEvent && originalEvent.type === 'lesson') {
      const d2Time = new Date(originalEvent.startTime).getTime() + (7 * 24 * 60 * 60 * 1000); // Original + 7 days
      const d1Time = upcomingLesson ? new Date(upcomingLesson.startTime).getTime() : d2Time;
      
      const hoursToD1 = (d1Time - now) / 3600000;
      const hoursToD2 = (d2Time - now) / 3600000;

      if (hoursToD1 > 0) {
        // Phase 1: Approaching D1 (Next Lesson)
        if (hoursToD1 <= 72) {
          // Bonus scaling up to 120 as D1 approaches
          const ratio = (72 - hoursToD1) / 72;
          score += 120 * Math.pow(ratio, 1.5);
        } else {
          // Base bonus just for having a next lesson pending
          score += 20; 
        }
      } else if (hoursToD2 > 0) {
        // Phase 2: Missed D1, approaching D2 (1 week after original lesson)
        const ratio = ((7 * 24) - hoursToD2) / (7 * 24); // 0 at D1, 1 at D2
        score += 120 + 80 * Math.pow(ratio, 2); // scales from 120 up to 200
      } else {
        // Phase 3: Missed D2 (More than a week late!)
        score += 250; // Critical priority to force recovery
      }
    }

    // 8. Project tasks get moderate consistent priority
    if (task.isProjectTask) {
      score += 30;
    }

    return Math.round(score);
  }

  /**
   * Sorts tasks respecting dependencies (propedeuticità) and priority.
   */
  static sortTasks(
    tasks: Task[],
    courses: Map<string, Course>,
    events: CalendarEvent[],
    prefs: UserPreferences,
    history: PerformanceRecord[]
  ): Task[] {
    const now = Date.now();

    // Precompute exams and upcoming lessons per course
    const examsByCourse = new Map<string, CalendarEvent>();
    const lessonsByCourse = new Map<string, CalendarEvent>();

    for (const e of events) {
      if (!e.courseId) continue;
      const eTime = new Date(e.startTime).getTime();
      if (eTime < now) continue;

      if (e.type === 'exam') {
        const existing = examsByCourse.get(e.courseId);
        if (!existing || eTime < new Date(existing.startTime).getTime()) {
          examsByCourse.set(e.courseId, e);
        }
      }
      if (e.type === 'lesson') {
        const existing = lessonsByCourse.get(e.courseId);
        if (!existing || eTime < new Date(existing.startTime).getTime()) {
          lessonsByCourse.set(e.courseId, e);
        }
      }
    }

    // Update scores
    const scored = tasks.map(t => {
      const course = t.courseId ? courses.get(t.courseId) : undefined;
      const exam = t.courseId ? examsByCourse.get(t.courseId) : undefined;
      const lesson = t.courseId ? lessonsByCourse.get(t.courseId) : undefined;
      const originalEvent = t.relatedEventId ? events.find(e => e.id === t.relatedEventId) : undefined;
      return {
        ...t,
        priorityScore: this.calculatePriority(t, course, exam, lesson, originalEvent, prefs, history)
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.priorityScore - a.priorityScore);

    // Topological sort respecting dependencies
    const resolved: Task[] = [];
    const resolvedIds = new Set<string>();
    const remaining = [...scored];

    let progress = true;
    while (remaining.length > 0 && progress) {
      progress = false;
      for (let i = 0; i < remaining.length; i++) {
        const task = remaining[i];
        if (task.dependencies.every(d => resolvedIds.has(d) || !remaining.some(r => r.id === d))) {
          resolved.push(task);
          resolvedIds.add(task.id);
          remaining.splice(i, 1);
          progress = true;
          break;
        }
      }
    }

    // Append any with circular deps
    resolved.push(...remaining);
    return resolved;
  }
}
