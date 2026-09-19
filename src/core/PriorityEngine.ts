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
      if (upcomingLesson) {
        const d1Time = new Date(upcomingLesson.startTime).getTime();
        const hoursToD1 = (d1Time - now) / 3600000;
        
        // Default high priority (but not "urgent" out of the box)
        // Normal tasks are ~50-80. We give a +35 bonus to make it ~85 default.
        score += 35; 

        if (hoursToD1 > 0) {
          // As the next lesson approaches (< 72h), increase priority massively
          // so it becomes genuinely urgent right before the next lesson.
          if (hoursToD1 <= 72) {
            const ratio = (72 - hoursToD1) / 72;
            score += 150 * Math.pow(ratio, 1.5);
          }
        } else {
          // We missed the next lesson! Critical priority.
          score += 300;
        }
      } else {
        const d2Time = new Date(originalEvent.startTime).getTime() + (7 * 24 * 60 * 60 * 1000); // Original + 7 days
        const hoursToD2 = (d2Time - now) / 3600000;
        if (hoursToD2 > 0) {
          // Phase 2: approaching D2 (1 week after original lesson)
          const ratio = ((7 * 24) - hoursToD2) / (7 * 24); // 0 at original, 1 at D2
          score += 120 + 80 * Math.pow(ratio, 2); // scales from 120 up to 200
        } else {
          // Phase 3: Missed D2 (More than a week late!)
          score += 500; // Force recovery
        }
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

    // Sort by score descending, but ALWAYS put lesson recoveries first
    scored.sort((a, b) => {
      const aIsRecovery = a.title.startsWith('Seguire/Recuperare lezione');
      const bIsRecovery = b.title.startsWith('Seguire/Recuperare lezione');
      
      if (aIsRecovery && !bIsRecovery) return -1;
      if (!aIsRecovery && bIsRecovery) return 1;
      
      return b.priorityScore - a.priorityScore;
    });

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
