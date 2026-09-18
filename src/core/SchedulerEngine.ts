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
    daysToSchedule: number = 14,
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

    // Safety counter to prevent infinite loops
    let iterations = 0;
    const maxIterations = daysToSchedule * 100;

    while (taskIdx < todoTasks.length && currentTime < endScheduleDate && iterations < maxIterations) {
      iterations++;
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

      // Check lunch break
      let breakStart: Date | undefined;
      let breakEnd: Date | undefined;
      if (dayConfig.lunchBreak && dayConfig.lunchBreak.enabled) {
        const [bStartH, bStartM] = dayConfig.lunchBreak.start.split(':').map(Number);
        const [bEndH, bEndM] = dayConfig.lunchBreak.end.split(':').map(Number);
        breakStart = new Date(currentTime);
        breakStart.setHours(bStartH, bStartM, 0, 0);
        breakEnd = new Date(currentTime);
        breakEnd.setHours(bEndH, bEndM, 0, 0);
      }

      // Skip past lunch break if inside it
      if (breakStart && breakEnd && currentTime >= breakStart && currentTime < breakEnd) {
        currentTime = new Date(breakEnd);
        continue;
      }

      // Check if current time is inside an existing event — if so, skip past it
      const overlapping = this.findOverlappingEvent(currentTime, existingEvents);
      const task = todoTasks[taskIdx];

      if (overlapping) {
        const isProductiveTravel = overlapping.type === 'travel' && overlapping.isTravelStudyTime;
        const isTaskCompatible = task.isTravelCompatible;

        if (!(isProductiveTravel && isTaskCompatible)) {
          const overlapEnd = new Date(overlapping.endTime);
          currentTime = new Date(Math.max(overlapEnd.getTime(), currentTime.getTime() + 60000));
          continue;
        }
      }

      // Find next collision (event that starts after current time)
      const collision = this.findNextCollision(currentTime, existingEvents, dayEnd, task);

      // If collision starts within 15 min, skip over it
      if (collision) {
        const collisionStart = new Date(collision.startTime);
        const collisionEnd = new Date(collision.endTime);
        const gapMinutes = (collisionStart.getTime() - currentTime.getTime()) / 60000;
        if (gapMinutes < 15) {
          currentTime = new Date(Math.max(collisionEnd.getTime(), currentTime.getTime() + 60000));
          continue;
        }
      }

      // Schedule a study block
      // (task is already defined above)
      const maxBlock = Math.min(remainingTime, 120); // Max 2h per block
      let blockEnd = new Date(currentTime.getTime() + maxBlock * 60000);

      // Truncate at collision
      if (collision) {
        const cs = new Date(collision.startTime);
        if (blockEnd > cs) blockEnd = new Date(cs);
      }

      // Truncate at day end
      if (blockEnd > dayEnd) blockEnd = new Date(dayEnd);

      // Truncate at lunch break
      if (breakStart && blockEnd > breakStart && currentTime < breakStart) {
        blockEnd = new Date(breakStart);
      }

      const actualMinutes = Math.round((blockEnd.getTime() - currentTime.getTime()) / 60000);

      if (actualMinutes >= 15 || (actualMinutes > 0 && remainingTime < 15)) { // Minimum 15 min session, unless it's the final chunk
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
          // Only add buffer if it fits within the day
          if (bufferEnd <= dayEnd) {
            sessions.push({
              id: uuidv4(),
              taskId: 'buffer',
              startTime: currentTime.toISOString(),
              endTime: bufferEnd.toISOString(),
              isBuffer: true,
            });
            currentTime = bufferEnd;
          }
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

  /**
   * Find an event that the current time falls inside of.
   */
  private static findOverlappingEvent(time: Date, events: CalendarEvent[]): CalendarEvent | undefined {
    const t = time.getTime();
    for (const e of events) {
      const eStart = new Date(e.startTime).getTime();
      const eEnd = new Date(e.endTime).getTime();
      if (t >= eStart && t < eEnd) {
        return e;
      }
    }
    return undefined;
  }

  /**
   * Find the next event that starts after the given time (and before dayEnd).
   */
  private static findNextCollision(time: Date, events: CalendarEvent[], dayEnd: Date, task: Task): CalendarEvent | undefined {
    let nearest: CalendarEvent | undefined;
    let nearestTime = dayEnd.getTime(); // Don't look beyond day end

    for (const e of events) {
      const eStart = new Date(e.startTime).getTime();
      if (eStart > time.getTime() && eStart < nearestTime) {
        if (e.type === 'travel' && e.isTravelStudyTime && task.isTravelCompatible) {
          continue; // Not a collision for this task
        }
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
