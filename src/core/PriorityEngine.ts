import type { Task, Course, CalendarEvent, UserPreferences, PerformanceRecord, FutureWorkloadProjection, TaskSortMode } from './types';
import { isLessonRecoveryTask } from './taskKind';
import { HabitAnalysisEngine } from './HabitAnalysisEngine';

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
    history: PerformanceRecord[],
    _futureProjection?: FutureWorkloadProjection,
    effectiveCourseDifficulty?: number
  ): number {
    let score = 0;
    const now = Date.now();

    // 1. Difficulty base (ibrida: difficoltà dichiarata + difficoltà comportamentale reale)
    const diff = effectiveCourseDifficulty ?? (course ? course.difficulty : 5);
    score += 30 + diff * 4;

    // 1.5 Momentum per attività già avviate e messe in pausa (evita task lasciati a metà)
    if ((task.accumulatedTime || 0) > 0) {
      score += 18;
    }

    // 2. Delay weight — how long since creation
    const daysSinceCreation = (now - new Date(task.createdAt).getTime()) / 86400000;
    if (daysSinceCreation > 0) {
      score += Math.min(daysSinceCreation * 5, 100); // Cap at 100
    }

    // 3. Postpone penalty (con tetto, per evitare spirali)
    score += Math.min(task.postponedCount * 15, 30);

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

    // 9. (rimosso) Il bonus "carico futuro" era uguale per tutti i task e non cambiava
    // l'ordine relativo: ora il carico in arrivo è solo informativo.

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
    history: PerformanceRecord[],
    futureProjection?: FutureWorkloadProjection
  ): Task[] {
    void futureProjection;
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

    // Calcola difficoltà reale/comportamentale per ogni corso
    const strainList = HabitAnalysisEngine.computeCourseStrain(
      Array.from(courses.values()),
      tasks,
      history,
      events
    );
    const effectiveDiffByCourse = new Map(strainList.map(s => [s.courseId, s.effectiveDifficulty]));

    // Update scores
    const scored = tasks.map(t => {
      const course = t.courseId ? courses.get(t.courseId) : undefined;
      const exam = t.courseId ? examsByCourse.get(t.courseId) : undefined;
      const lesson = t.courseId ? lessonsByCourse.get(t.courseId) : undefined;
      const originalEvent = t.relatedEventId ? events.find(e => e.id === t.relatedEventId) : undefined;
      const effDiff = t.courseId ? effectiveDiffByCourse.get(t.courseId) : undefined;
      return {
        ...t,
        priorityScore: this.calculatePriority(t, course, exam, lesson, originalEvent, prefs, history, undefined, effDiff)
      };
    });

    // Questo è l'UNICO ordinamento: UI e Scheduler lo usano entrambi.
    // "In corso" è sempre in cima; poi vale la modalità scelta dall'utente.
    const mode: TaskSortMode = prefs.taskSortMode || 'oldest';
    const created = (t: Task) => new Date(t.createdAt).getTime();
    const dueTime = (t: Task): number => {
      const candidates: number[] = [];
      if (t.deadline) candidates.push(new Date(t.deadline).getTime());
      const exam = t.courseId ? examsByCourse.get(t.courseId) : undefined;
      if (exam) candidates.push(new Date(exam.startTime).getTime());
      return candidates.length ? Math.min(...candidates) : Number.POSITIVE_INFINITY;
    };

    scored.sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;

      switch (mode) {
        case 'smart': {
          const aIsRecovery = isLessonRecoveryTask(a);
          const bIsRecovery = isLessonRecoveryTask(b);
          if (aIsRecovery && !bIsRecovery) return -1;
          if (!aIsRecovery && bIsRecovery) return 1;
          return b.priorityScore - a.priorityScore || created(a) - created(b);
        }
        case 'deadline': {
          const da = dueTime(a);
          const db = dueTime(b);
          if (da !== db) return da < db ? -1 : 1;
          return b.priorityScore - a.priorityScore || created(a) - created(b);
        }
        case 'shortest':
          return a.estimatedDuration - b.estimatedDuration || created(a) - created(b);
        case 'course': {
          const da = dueTime({ ...a, deadline: undefined });
          const db = dueTime({ ...b, deadline: undefined });
          if (da !== db) return da < db ? -1 : 1;
          if ((a.courseId || '') !== (b.courseId || '')) return (a.courseId || '') < (b.courseId || '') ? -1 : 1;
          return created(a) - created(b);
        }
        case 'oldest':
        default:
          return created(a) - created(b) || b.priorityScore - a.priorityScore;
      }
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
