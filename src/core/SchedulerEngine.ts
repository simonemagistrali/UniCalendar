import type { Task, StudySession, UserPreferences, CalendarEvent, PerformanceRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * SchedulerEngine — Generates study sessions dynamically filling empty calendar gaps.
 * Features: per-day hours, adaptive buffer from history, collision avoidance, max 2h blocks.
 */
export class SchedulerEngine {

  static generateSchedule(
    tasks: Task[],
    existingEvents: CalendarEvent[],
    prefs: UserPreferences,
    startDate: Date,
    daysToSchedule: number = 7,
    history: PerformanceRecord[] = []
  ): StudySession[] {
    const sessions: StudySession[] = [];
    const todoTasks = tasks.filter(t => t.status !== 'done');
    if (todoTasks.length === 0) return sessions;

    let currentTime = new Date(startDate);
    let taskIdx = 0;
    let remainingTime = todoTasks[0]?.estimatedDuration || 0;

    const endScheduleDate = new Date(startDate);
    endScheduleDate.setDate(endScheduleDate.getDate() + daysToSchedule);

    while (taskIdx < todoTasks.length && currentTime < endScheduleDate) {
      const dayOfWeek = currentTime.getDay();
      const dayConfig = prefs.dailyStudyHours ? prefs.dailyStudyHours[dayOfWeek] : undefined;

      // Skip disabled days
      if (!dayConfig || !dayConfig.enabled) {
        currentTime = this.nextDay(currentTime);
        continue;
      }

      // Parse day bounds
      const [startH, startM] = dayConfig.start.split(':').map(Number);
      const [endH, endM] = dayConfig.end.split(':').map(Number);

      const dayStart = new Date(currentTime);
      dayStart.setHours(startH, startM, 0, 0);
      const dayEnd = new Date(currentTime);
      dayEnd.setHours(endH, endM, 0, 0);

      // Clamp to day start
      if (currentTime < dayStart) {
        currentTime = new Date(dayStart);
      }

      // Past day end → next day
      if (currentTime >= dayEnd) {
        currentTime = this.nextDay(currentTime);
        continue;
      }

      // Find next collision
      const collision = this.findNextCollision(currentTime, existingEvents);

      // If collision starts within 15 min, skip over it
      if (collision) {
        const collisionStart = new Date(collision.startTime);
        const collisionEnd = new Date(collision.endTime);
        if (collisionStart.getTime() - currentTime.getTime() < 15 * 60000) {
          currentTime = new Date(Math.max(collisionEnd.getTime(), currentTime.getTime() + 60000));
          continue;
        }
      }

      // Schedule a study block
      const task = todoTasks[taskIdx];
      const maxBlock = Math.min(remainingTime, 120); // Max 2h per block
      let blockEnd = new Date(currentTime.getTime() + maxBlock * 60000);

      // Truncate at collision
      if (collision) {
        const cs = new Date(collision.startTime);
        if (blockEnd > cs) blockEnd = cs;
      }

      // Truncate at day end
      if (blockEnd > dayEnd) blockEnd = new Date(dayEnd);

      const actualMinutes = Math.round((blockEnd.getTime() - currentTime.getTime()) / 60000);

      if (actualMinutes >= 15) { // Minimum 15 min session
        sessions.push({
          id: uuidv4(),
          taskId: task.id,
          startTime: currentTime.toISOString(),
          endTime: blockEnd.toISOString(),
          isBuffer: false,
        });
        remainingTime -= actualMinutes;
      }

      currentTime = new Date(blockEnd);

      // Task completed → move to next
      if (remainingTime <= 0) {
        // Add dynamic buffer
        const bufferMin = this.getDynamicBuffer(task, history);
        if (bufferMin > 0) {
          const bufferEnd = new Date(currentTime.getTime() + bufferMin * 60000);
          sessions.push({
            id: uuidv4(),
            taskId: 'buffer',
            startTime: currentTime.toISOString(),
            endTime: bufferEnd.toISOString(),
            isBuffer: true,
          });
          currentTime = bufferEnd;
        }

        taskIdx++;
        if (taskIdx < todoTasks.length) {
          remainingTime = todoTasks[taskIdx].estimatedDuration;
        }
      }
    }

    return sessions;
  }

  /**
   * Adaptive buffer: base 10 min, increases if the user historically overruns for this course.
   */
  private static getDynamicBuffer(task: Task, history: PerformanceRecord[]): number {
    let buffer = 10;

    if (task.courseId && history.length > 0) {
      const courseHist = history.filter(h => h.courseId === task.courseId);
      if (courseHist.length >= 2) {
        const avgOverrun = courseHist.reduce((a, h) => a + Math.max(0, h.actualMinutes - h.estimatedMinutes), 0) / courseHist.length;
        buffer += Math.min(Math.round(avgOverrun * 0.5), 30); // Max +30 min extra buffer
      }
    }

    // High priority tasks get extra buffer
    if (task.priorityScore > 80) buffer += 5;

    return buffer;
  }

  private static findNextCollision(time: Date, events: CalendarEvent[]): CalendarEvent | undefined {
    let nearest: CalendarEvent | undefined;
    let nearestTime = Infinity;

    for (const e of events) {
      const eEnd = new Date(e.endTime).getTime();
      const eStart = new Date(e.startTime).getTime();
      if (eEnd > time.getTime() && eStart > time.getTime() && eStart < nearestTime) {
        nearest = e;
        nearestTime = eStart;
      }
    }
    return nearest;
  }

  private static nextDay(d: Date): Date {
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
  }
}
