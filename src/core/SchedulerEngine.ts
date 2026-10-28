import type { Task, StudySession, UserPreferences, CalendarEvent, PerformanceRecord, FutureWorkloadProjection } from './types';
import { v4 as uuidv4 } from 'uuid';
import { getTaskKind } from './taskKind';

/**
 * SchedulerEngine — Generates study sessions dynamically filling empty calendar gaps.
 * Features: per-day hours, adaptive buffer from history, collision avoidance,
 * configurable block duration, and support for "weekdays theory, weekend exercises" study distribution.
 */
export class SchedulerEngine {

  static generateSchedule(
    tasks: Task[],
    existingEvents: CalendarEvent[],
    prefs: UserPreferences,
    startDate: Date,
    daysToSchedule: number = 14,
    history: PerformanceRecord[] = [],
    _futureProjection?: FutureWorkloadProjection
  ): StudySession[] {
    const sessions: StudySession[] = [];
    const todoTasks = tasks.filter(t => t.status !== 'done');
    if (todoTasks.length === 0) return sessions;

    const remainingDuration = new Map<string, number>(todoTasks.map(t => [t.id, t.estimatedDuration]));
    const isTaskDoneInSchedule = (taskId: string) => (remainingDuration.get(taskId) || 0) <= 0;

    let currentTime = new Date(startDate);
    const endScheduleDate = new Date(startDate);
    endScheduleDate.setDate(endScheduleDate.getDate() + daysToSchedule);

    // Track minutes used per day
    const minutesUsedPerDay: Record<string, number> = {};

    let iterations = 0;
    const maxIterations = daysToSchedule * 120;

    const maxBlockMinutes = Math.max(20, prefs.maxStudyBlockMinutes || 120);
    const minBlockMinutes = Math.max(10, prefs.minStudyBlockMinutes || 15);
    const distributeMode = prefs.studyDistributionPreference;

    // Helper to pick candidate task for current slot
    const pickNextTask = (isWeekend: boolean): Task | undefined => {
      const candidates = todoTasks.filter(t => !isTaskDoneInSchedule(t.id));
      if (candidates.length === 0) return undefined;

      if (distributeMode === 'weekdays_theory_weekend_exercises') {
        if (isWeekend) {
          // Weekend: prefer exercises
          const exerciseTask = candidates.find(t => getTaskKind(t) === 'EXERCISES');
          if (exerciseTask) return exerciseTask;
        } else {
          // Weekdays: prefer theory / notes / lessons
          const theoryTask = candidates.find(t => getTaskKind(t) !== 'EXERCISES');
          if (theoryTask) return theoryTask;
        }
      }

      return candidates[0];
    };

    while (currentTime < endScheduleDate && iterations < maxIterations) {
      iterations++;
      const dayOfWeek = currentTime.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dayConfig = prefs.dailyStudyHours ? prefs.dailyStudyHours[dayOfWeek] : undefined;

      // Skip disabled days
      if (!dayConfig || !dayConfig.enabled) {
        currentTime = this.nextDay(currentTime);
        continue;
      }

      // Check if all tasks are completed
      const task = pickNextTask(isWeekend);
      if (!task) break;

      let remainingTime = remainingDuration.get(task.id) || 0;
      if (remainingTime <= 0) continue;

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

      // Check overlapping events
      const overlapping = this.findOverlappingEvent(currentTime, existingEvents);
      if (overlapping) {
        const isProductiveTravel = overlapping.type === 'travel' && overlapping.isTravelStudyTime;
        const isTaskCompatible = task.isTravelCompatible;

        if (!(isProductiveTravel && isTaskCompatible)) {
          const overlapEnd = new Date(overlapping.endTime);
          currentTime = new Date(Math.max(overlapEnd.getTime(), currentTime.getTime() + 60000));
          continue;
        }
      }

      // Find next collision
      const collision = this.findNextCollision(currentTime, existingEvents, dayEnd, task);
      if (collision) {
        const collisionStart = new Date(collision.startTime);
        const gapMinutes = (collisionStart.getTime() - currentTime.getTime()) / 60000;
        if (gapMinutes < minBlockMinutes) {
          currentTime = new Date(collisionStart);
          continue;
        }
      }

      // Schedule a study block
      const maxBlock = Math.min(remainingTime, maxBlockMinutes);
      let blockEnd = new Date(currentTime.getTime() + maxBlock * 60000);

      if (collision) {
        const cs = new Date(collision.startTime);
        if (blockEnd > cs) blockEnd = new Date(cs);
      }

      if (blockEnd > dayEnd) blockEnd = new Date(dayEnd);

      if (breakStart && blockEnd > breakStart && currentTime < breakStart) {
        blockEnd = new Date(breakStart);
      }

      const actualMinutes = Math.round((blockEnd.getTime() - currentTime.getTime()) / 60000);

      if (actualMinutes >= minBlockMinutes || (actualMinutes > 0 && remainingTime < minBlockMinutes)) {
        const todayKey = currentTime.toISOString().split('T')[0];
        minutesUsedPerDay[todayKey] = (minutesUsedPerDay[todayKey] || 0) + actualMinutes;

        sessions.push({
          id: uuidv4(),
          taskId: task.id,
          startTime: currentTime.toISOString(),
          endTime: blockEnd.toISOString(),
          isBuffer: false,
        });

        remainingTime -= actualMinutes;
        remainingDuration.set(task.id, Math.max(0, remainingTime));
      }

      currentTime = new Date(blockEnd);

      // Task chunk or completion buffer
      if (remainingDuration.get(task.id)! <= 0) {
        const bufferMin = this.getDynamicBuffer(task, history, prefs);
        if (bufferMin > 0) {
          const bufferEnd = new Date(currentTime.getTime() + bufferMin * 60000);
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
      }
    }

    return sessions;
  }

  /**
   * Adaptive buffer: configured base (default 10 min), increases if user historically overruns.
   */
  private static getDynamicBuffer(task: Task, history: PerformanceRecord[], prefs: UserPreferences): number {
    let buffer = prefs.bufferMinutes ?? 10;

    if (task.courseId && history.length > 0) {
      const courseHist = history.filter(h => h.courseId === task.courseId);
      if (courseHist.length >= 2) {
        const avgOverrun = courseHist.reduce((a, h) => a + Math.max(0, h.actualMinutes - h.estimatedMinutes), 0) / courseHist.length;
        buffer += Math.min(Math.round(avgOverrun * 0.5), 30);
      }
    }

    if (task.priorityScore > 80) buffer += 5;

    return buffer;
  }

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

  private static findNextCollision(time: Date, events: CalendarEvent[], dayEnd: Date, task: Task): CalendarEvent | undefined {
    let nearest: CalendarEvent | undefined;
    let nearestTime = dayEnd.getTime();

    for (const e of events) {
      const eStart = new Date(e.startTime).getTime();
      if (eStart > time.getTime() && eStart < nearestTime) {
        if (e.type === 'travel' && e.isTravelStudyTime && task.isTravelCompatible) {
          continue;
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
