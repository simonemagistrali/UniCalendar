import { Task, Course, CalendarEvent, UserPreferences } from './types';
import { differenceInDays, differenceInHours } from 'date-fns';

export class PriorityEngine {
  /**
   * Calculates the priority score for a given task.
   * Higher score = more important/urgent.
   */
  static calculatePriority(
    task: Task, 
    course: Course | undefined, 
    upcomingExam: CalendarEvent | undefined,
    prefs: UserPreferences
  ): number {
    let score = 0;
    const now = new Date();

    // 1. Difficulty Base Weight (1-10)
    const difficultyWeight = course ? course.difficulty : 5;
    score += difficultyWeight * 10; 

    // 2. Delay Weight: how long the task has been pending since creation
    const daysSinceCreation = differenceInDays(now, task.createdAt);
    if (daysSinceCreation > 0) {
      score += daysSinceCreation * 5; // Increases by 5 points per day delayed
    }

    // 3. Deadline / Exam Proximity Weight (The "Project Deadline" logic)
    if (upcomingExam) {
      const daysToExam = differenceInDays(upcomingExam.startTime, now);
      
      // If we are within the user's defined critical window
      if (daysToExam <= prefs.daysBeforeExamToIncreasePriority && daysToExam >= 0) {
        // Exponential/Progressive increase as exam approaches
        // Example: If threshold is 14 days, at 14 days multiplier is 1, at 0 days it's max.
        const urgencyMultiplier = Math.pow((prefs.daysBeforeExamToIncreasePriority - daysToExam + 1), 1.5);
        score += (100 * urgencyMultiplier); 
      }
    } else if (task.deadline) {
      // General deadline (e.g. next lesson)
      const hoursToDeadline = differenceInHours(task.deadline, now);
      if (hoursToDeadline < 48 && hoursToDeadline >= 0) {
        score += (48 - hoursToDeadline) * 2;
      }
    }

    // 4. Past Performance (if they historically take longer, we should prioritize starting earlier)
    // This could be derived from global stats, but for now we increase slightly if it's a known heavy task
    if (task.estimatedDuration > 120) {
      score += 20; // Long tasks get a bump to be scheduled earlier
    }

    return Math.round(score);
  }

  /**
   * Sorts tasks considering dependencies and priority scores.
   * If Task B depends on Task A, Task A must come first regardless of score.
   */
  static sortTasks(tasks: Task[], courses: Map<string, Course>, exams: CalendarEvent[], prefs: UserPreferences): Task[] {
    // 1. Update all scores
    tasks.forEach(t => {
      const course = t.courseId ? courses.get(t.courseId) : undefined;
      const exam = exams.find(e => e.courseId === t.courseId && e.type === 'exam' && e.startTime > new Date());
      t.priorityScore = this.calculatePriority(t, course, exam, prefs);
    });

    // 2. Sort by score descending
    let sorted = [...tasks].sort((a, b) => b.priorityScore - a.priorityScore);

    // 3. Resolve Dependencies (Propedeuticità)
    // Simple topological sort / dependency reordering
    const resolved: Task[] = [];
    const resolvedIds = new Set<string>();

    let progress = true;
    while (sorted.length > 0 && progress) {
      progress = false;
      for (let i = 0; i < sorted.length; i++) {
        const task = sorted[i];
        const canBeScheduled = task.dependencies.every(depId => resolvedIds.has(depId));
        
        if (canBeScheduled) {
          resolved.push(task);
          resolvedIds.add(task.id);
          sorted.splice(i, 1);
          progress = true;
          break; // restart the loop with updated sorted list
        }
      }
    }

    // If there are circular dependencies or missing deps, just append the rest
    if (sorted.length > 0) {
      resolved.push(...sorted);
    }

    return resolved;
  }
}
