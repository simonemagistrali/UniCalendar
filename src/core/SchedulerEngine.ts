import { Task, StudySession, UserPreferences, CalendarEvent } from './types';
import { addMinutes, setHours, setMinutes, startOfDay, isBefore, isAfter, isSameDay } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export class SchedulerEngine {
  /**
   * Generates study sessions dynamically filling empty gaps in the calendar.
   */
  static generateSchedule(
    tasks: Task[], 
    existingEvents: CalendarEvent[], 
    prefs: UserPreferences,
    startDate: Date,
    daysToSchedule: number = 7
  ): StudySession[] {
    const sessions: StudySession[] = [];
    let currentTime = new Date(startDate);
    
    // Convert time limits to numbers
    const startHour = parseInt(prefs.studyHours.start.split(':')[0]);
    const startMinute = parseInt(prefs.studyHours.start.split(':')[1]);
    const endHour = parseInt(prefs.studyHours.end.split(':')[0]);
    const endMinute = parseInt(prefs.studyHours.end.split(':')[1]);

    let currentTaskIndex = 0;
    let remainingTaskTime = tasks.length > 0 ? tasks[0].estimatedDuration : 0;

    // Buffer Logic: dynamically adjusted based on history.
    // For now we use a default of 15 mins buffer between tasks.
    const standardBufferMinutes = 15;

    while (currentTaskIndex < tasks.length && differenceInDays(currentTime, startDate) < daysToSchedule) {
      // 1. Check if current day is forbidden
      if (prefs.forbiddenDays.includes(currentTime.getDay())) {
        currentTime = startOfDay(addDays(currentTime, 1));
        continue;
      }

      // 2. Check time bounds
      const dayStart = setMinutes(setHours(currentTime, startHour), startMinute);
      const dayEnd = setMinutes(setHours(currentTime, endHour), endMinute);

      if (isBefore(currentTime, dayStart)) {
        currentTime = dayStart;
      }

      if (isAfter(currentTime, dayEnd) || currentTime.getTime() === dayEnd.getTime()) {
        currentTime = startOfDay(addDays(currentTime, 1));
        continue;
      }

      // 3. Find next available slot (check collisions with existingEvents)
      const collision = this.findNextCollision(currentTime, existingEvents);
      if (collision && isBefore(collision.startTime, addMinutes(currentTime, 30))) {
        // Skip over the event
        currentTime = collision.endTime;
        continue;
      }

      // 4. Schedule block
      const task = tasks[currentTaskIndex];
      // Max block size is 2 hours before forcing a break
      const blockDuration = Math.min(remainingTaskTime, 120); 
      let endTime = addMinutes(currentTime, blockDuration);

      // If block crosses a collision, truncate it
      if (collision && isBefore(endTime, collision.startTime) === false) {
        endTime = collision.startTime;
      }

      // If block crosses day boundary, truncate it
      if (isAfter(endTime, dayEnd)) {
        endTime = dayEnd;
      }

      const actualDuration = differenceInMinutes(endTime, currentTime);
      
      if (actualDuration > 0) {
        sessions.push({
          id: uuidv4(),
          taskId: task.id,
          startTime: currentTime,
          endTime: endTime,
          isBuffer: false
        });

        remainingTaskTime -= actualDuration;
      }

      // Move time forward
      currentTime = endTime;

      // Check if task is done
      if (remainingTaskTime <= 0) {
        currentTaskIndex++;
        if (currentTaskIndex < tasks.length) {
          remainingTaskTime = tasks[currentTaskIndex].estimatedDuration;
          
          // Add buffer after finishing a task
          sessions.push({
            id: uuidv4(),
            taskId: 'buffer',
            startTime: currentTime,
            endTime: addMinutes(currentTime, standardBufferMinutes),
            isBuffer: true
          });
          currentTime = addMinutes(currentTime, standardBufferMinutes);
        }
      }
    }

    return sessions;
  }

  private static findNextCollision(time: Date, events: CalendarEvent[]): CalendarEvent | undefined {
    return events
      .filter(e => isAfter(e.endTime, time))
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())[0];
  }
}

// Helper functions (since they were used above but missing imports for brevity)
function differenceInDays(dateLeft: Date, dateRight: Date): number {
  return Math.floor((dateLeft.getTime() - dateRight.getTime()) / (1000 * 60 * 60 * 24));
}
function differenceInMinutes(dateLeft: Date, dateRight: Date): number {
  return Math.floor((dateLeft.getTime() - dateRight.getTime()) / (1000 * 60));
}
function addDays(date: Date, amount: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}
