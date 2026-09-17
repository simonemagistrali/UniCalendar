import type { CalendarEvent, Course, Task } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * TaskManager — Scans past events and generates tasks automatically.
 * Handles: lesson tasks, project tasks, travel detection.
 */
export class TaskManager {

  /**
   * Generate tasks from past lessons based on course study preferences.
   */
  static generateTasksFromPastEvents(
    events: CalendarEvent[],
    courses: Course[],
    existingTasks: Task[]
  ): { updatedEvents: CalendarEvent[]; newTasks: Task[] } {
    const now = new Date().toISOString();
    const nowMs = Date.now();
    const newTasks: Task[] = [];
    const updatedEvents = [...events];
    const existingRelatedIds = new Set(existingTasks.map(t => t.relatedEventId).filter(Boolean));

    for (let i = 0; i < updatedEvents.length; i++) {
      const event = updatedEvents[i];

      // Skip if already processed or not past
      if (event.isDone || event.type !== 'lesson' || new Date(event.endTime).getTime() > nowMs) continue;
      // Skip if task already exists for this event
      if (existingRelatedIds.has(event.id)) continue;

      const course = courses.find(c => c.id === event.courseId);
      if (!course) {
        updatedEvents[i] = { ...event, isDone: true };
        continue;
      }

      const prefs = course.defaultStudyPreferences;
      const eventDate = new Date(event.startTime).toLocaleDateString('it-IT');

      // Notes revision task
      if (prefs.requiresNotesRevision) {
        const notesTask: Task = {
          id: uuidv4(),
          title: `Sistemare appunti: ${event.title} (${eventDate})`,
          description: `Revisione appunti della lezione`,
          courseId: course.id,
          relatedEventId: event.id,
          status: 'todo',
          priorityScore: 0,
          estimatedDuration: prefs.estimatedRevisionTimePerLesson,
          createdAt: now,
          dependencies: [],
          postponedCount: 0,
        };
        newTasks.push(notesTask);
      }

      // Exercises task (depends on notes if both exist)
      if (prefs.requiresExercises) {
        const exerciseTask: Task = {
          id: uuidv4(),
          title: `Esercizi: ${event.title} (${eventDate})`,
          description: `Esercitazione post-lezione`,
          courseId: course.id,
          relatedEventId: event.id,
          status: 'todo',
          priorityScore: 0,
          estimatedDuration: Math.round(prefs.estimatedRevisionTimePerLesson * 1.5),
          createdAt: now,
          dependencies: prefs.requiresNotesRevision && newTasks.length > 0
            ? [newTasks[newTasks.length - 1].id]
            : [],
          postponedCount: 0,
        };
        newTasks.push(exerciseTask);
      }

      updatedEvents[i] = { ...event, isDone: true };
    }

    return { updatedEvents, newTasks };
  }

  /**
   * Generate tasks from project/deadline events.
   * Splits the total hours into scheduled work sessions before the deadline.
   */
  static generateProjectTasks(event: CalendarEvent): Task[] {
    if (event.type !== 'project_deadline' || !event.projectTotalHours) return [];

    const tasks: Task[] = [];
    const totalMinutes = event.projectTotalHours * 60;
    const frequency = event.projectScheduleFrequencyDays || 3;
    const importance = event.projectImportance || 5;

    const deadlineMs = new Date(event.startTime).getTime();
    const nowMs = Date.now();
    const daysUntil = Math.max(1, Math.floor((deadlineMs - nowMs) / 86400000));
    const sessionsCount = Math.max(1, Math.floor(daysUntil / frequency));
    const minutesPerSession = Math.round(totalMinutes / sessionsCount);

    for (let i = 0; i < sessionsCount; i++) {
      /* const sessionDate = ... */
      tasks.push({
        id: uuidv4(),
        title: `${event.title} — sessione ${i + 1}/${sessionsCount}`,
        description: `Lavoro su progetto/scadenza`,
        courseId: event.courseId,
        relatedEventId: event.id,
        status: 'todo',
        priorityScore: importance * 10,
        estimatedDuration: minutesPerSession,
        createdAt: new Date().toISOString(),
        deadline: event.startTime,
        dependencies: i > 0 ? [tasks[i - 1].id] : [],
        postponedCount: 0,
        isProjectTask: true,
      });
    }

    return tasks;
  }

  /**
   * Detect if consecutive events are in different locations and suggest travel events.
   */
  static detectTravelNeeds(
    events: CalendarEvent[],
    /* homeAddress?: string */
  ): { from: CalendarEvent; to: CalendarEvent; suggestedStart: string }[] {
    const suggestions: { from: CalendarEvent; to: CalendarEvent; suggestedStart: string }[] = [];

    // Sort events by start time
    const sorted = [...events]
      .filter(e => new Date(e.startTime).getTime() > Date.now())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];

      // Both must have in_person locations with addresses
      if (!current.location?.address || !next.location?.address) continue;
      if (current.location.type !== 'in_person' || next.location.type !== 'in_person') continue;

      // Different locations
      if (current.location.address.toLowerCase() !== next.location.address.toLowerCase()) {
        suggestions.push({
          from: current,
          to: next,
          suggestedStart: current.endTime,
        });
      }
    }

    return suggestions;
  }

  /**
   * Auto-detect courses from imported events by grouping by title prefix.
   */
  static detectCoursesFromEvents(events: CalendarEvent[], existingCourses: Course[]): Course[] {
    const existingNames = new Set(existingCourses.map(c => c.name.toLowerCase()));
    const titleCounts = new Map<string, number>();

    for (const e of events) {
      if (e.type !== 'lesson') continue;
      // Use first 3 words as course name
      const name = e.title.split(/[\s-–]+/).slice(0, 3).join(' ').trim();
      if (name && !existingNames.has(name.toLowerCase())) {
        titleCounts.set(name, (titleCounts.get(name) || 0) + 1);
      }
    }

    const colors = ['#1a73e8', '#d93025', '#188038', '#f29900', '#a142f4', '#e8710a', '#1967d2', '#c5221f'];
    let colorIdx = 0;

    const newCourses: Course[] = [];
    for (const [name, count] of titleCounts) {
      if (count >= 1) { // At least 1 occurrence
        newCourses.push({
          id: uuidv4(),
          name,
          difficulty: 5,
          color: colors[colorIdx % colors.length],
          defaultStudyPreferences: {
            requiresNotesRevision: true,
            requiresExercises: false,
            estimatedRevisionTimePerLesson: 45,
          },
        });
        colorIdx++;
      }
    }

    return newCourses;
  }
}
