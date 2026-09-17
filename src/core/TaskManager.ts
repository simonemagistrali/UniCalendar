import type { CalendarEvent, Course, Task } from './types';
import { v4 as uuidv4 } from 'uuid';

export class TaskManager {
  /**
   * Scans past events and generates study tasks automatically based on course preferences.
   * Modifies the events array in-place (marks as done) and returns new tasks.
   */
  static generateTasksFromPastEvents(
    events: CalendarEvent[],
    courses: Course[]
  ): { updatedEvents: CalendarEvent[], newTasks: Task[] } {
    const now = new Date();
    const newTasks: Task[] = [];
    const updatedEvents = [...events];

    for (let i = 0; i < updatedEvents.length; i++) {
      const event = updatedEvents[i];
      
      // If event is in the past, is a lesson, and hasn't been processed yet
      if (!event.isDone && event.type === 'lesson' && event.endTime < now) {
        
        // Find the related course
        const course = courses.find(c => c.id === event.courseId);
        
        if (course) {
          const prefs = course.defaultStudyPreferences;
          
          // Generate a notes revision task if preferred
          if (prefs.requiresNotesRevision) {
            newTasks.push({
              id: uuidv4(),
              title: `Sistemare appunti: ${event.title}`,
              description: `Generato automaticamente dopo la lezione del ${event.startTime.toLocaleDateString()}`,
              courseId: course.id,
              relatedEventId: event.id,
              status: 'todo',
              priorityScore: 0, // Will be calculated by PriorityEngine
              estimatedDuration: prefs.estimatedRevisionTimePerLesson,
              createdAt: now,
              dependencies: []
            });
          }

          // Generate exercises task if preferred (and make it dependent on notes if both exist)
          if (prefs.requiresExercises) {
            const exercisesTask: Task = {
              id: uuidv4(),
              title: `Esercizi post-lezione: ${event.title}`,
              courseId: course.id,
              relatedEventId: event.id,
              status: 'todo',
              priorityScore: 0,
              estimatedDuration: prefs.estimatedRevisionTimePerLesson * 1.5, // Usually takes longer
              createdAt: now,
              dependencies: prefs.requiresNotesRevision && newTasks.length > 0 
                ? [newTasks[newTasks.length - 1].id] // Depends on the notes task just created
                : []
            };
            newTasks.push(exercisesTask);
          }
        }

        // Mark as processed
        updatedEvents[i] = { ...event, isDone: true };
      }
    }

    return { updatedEvents, newTasks };
  }
}
