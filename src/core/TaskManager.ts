import type { CalendarEvent, Course, Task } from './types';
import { v4 as uuidv4 } from 'uuid';
import { courseNameFromTitle, normalizeCourseName, BOGUS_COURSE_NAMES } from './courseNames';

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

    const isNotesTask = (t: Task) =>
      t.title.toLowerCase().startsWith('sistemare appunti') ||
      t.title.toLowerCase().includes('appunti:') ||
      t.title.toLowerCase().startsWith('ripasso:');

    const isExerciseTask = (t: Task) =>
      t.title.toLowerCase().startsWith('esercizi') ||
      t.title.toLowerCase().includes('esercizi:');

    const isFollowTask = (t: Task) =>
      t.title.toLowerCase().startsWith('seguire/recuperare') ||
      t.title.toLowerCase().includes('recuperare:');

    const existingFollowTasks = new Set(existingTasks.filter(isFollowTask).map(t => t.relatedEventId).filter(Boolean));
    const existingNotesTasks = new Set(existingTasks.filter(isNotesTask).map(t => t.relatedEventId).filter(Boolean));
    const existingExerciseTasks = new Set(existingTasks.filter(isExerciseTask).map(t => t.relatedEventId).filter(Boolean));

    const existingFollowTaskTitles = new Set(existingTasks.filter(isFollowTask).map(t => `${t.courseId}-${t.title}`));
    const existingNotesTaskTitles = new Set(existingTasks.filter(isNotesTask).map(t => `${t.courseId}-${t.title}`));
    const existingExerciseTaskTitles = new Set(existingTasks.filter(isExerciseTask).map(t => `${t.courseId}-${t.title}`));

    for (let i = 0; i < updatedEvents.length; i++) {
      const event = updatedEvents[i];

      // Skip if not past lesson
      if (event.type !== 'lesson' || new Date(event.endTime).getTime() > nowMs) continue;

      const course = courses.find(c => c.id === event.courseId);
      if (!course) {
        if (!event.isDone) updatedEvents[i] = { ...event, isDone: true };
        continue;
      }

      const prefs = event.studyPreferencesOverride || course.defaultStudyPreferences;
      
      const eventDate = new Date(event.startTime).toLocaleDateString('it-IT');
      const startHM = new Date(event.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const endHM = new Date(event.endTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const timeSlot = `${startHM} - ${endHM}`;

      const followTitle = `Seguire/Recuperare lezione: ${event.title} (${eventDate} ${timeSlot})`;
      const notesTitle = `Sistemare appunti: ${event.title} (${eventDate} ${timeSlot})`;
      const exerciseTitle = `Esercizi: ${event.title} (${eventDate} ${timeSlot})`;

      const followKey = `${course.id}-${followTitle}`;
      const notesKey = `${course.id}-${notesTitle}`;
      const exerciseKey = `${course.id}-${exerciseTitle}`;

      // Check if any existing task matches this specific event or time slot
      const hasFollowForSlot = existingTasks.some(t => 
        t.relatedEventId === event.id || 
        (t.courseId === course.id && isFollowTask(t) && (
          (t.lessonDate === eventDate && t.lessonTimeSlot === timeSlot) ||
          t.title.includes(`(${eventDate} ${timeSlot})`) ||
          (!t.lessonTimeSlot && t.title.includes(`(${eventDate})`))
        ))
      );
      const hasNotesForSlot = existingTasks.some(t => 
        t.relatedEventId === event.id || 
        (t.courseId === course.id && isNotesTask(t) && (
          (t.lessonDate === eventDate && t.lessonTimeSlot === timeSlot) ||
          t.title.includes(`(${eventDate} ${timeSlot})`) ||
          (!t.lessonTimeSlot && t.title.includes(`(${eventDate})`))
        ))
      );
      const hasExerciseForSlot = existingTasks.some(t => 
        t.relatedEventId === event.id || 
        (t.courseId === course.id && isExerciseTask(t) && (
          (t.lessonDate === eventDate && t.lessonTimeSlot === timeSlot) ||
          t.title.includes(`(${eventDate} ${timeSlot})`) ||
          (!t.lessonTimeSlot && t.title.includes(`(${eventDate})`))
        ))
      );

      const needsFollow = !existingFollowTasks.has(event.id) && !existingFollowTaskTitles.has(followKey) && !hasFollowForSlot;
      const needsNotes = prefs.requiresNotesRevision && !existingNotesTasks.has(event.id) && !existingNotesTaskTitles.has(notesKey) && !hasNotesForSlot;
      const needsExercises = prefs.requiresExercises && !existingExerciseTasks.has(event.id) && !existingExerciseTaskTitles.has(exerciseKey) && !hasExerciseForSlot;

      if (!needsFollow && !needsNotes && !needsExercises) {
        if (!event.isDone) updatedEvents[i] = { ...event, isDone: true };
        continue;
      }

      const eventDurationMinutes = Math.max(0, Math.round((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000)) || 120;
      
      // Calculate historical multiplier for unbiased smart estimation
      let lessonMultiplier = 1.0;
      let totalNominal = 0;
      let totalActual = 0;
      for (const t of existingTasks) {
        if (t.status === 'done' && t.actualDuration && t.courseId === course.id && t.title.startsWith('Seguire/Recuperare')) {
           const ev = events.find(e => e.id === t.relatedEventId);
           if (ev) {
             const nominal = Math.max(0, Math.round((new Date(ev.endTime).getTime() - new Date(ev.startTime).getTime()) / 60000)) || 120;
             totalNominal += nominal;
             totalActual += t.actualDuration;
           }
        }
      }
      if (totalNominal > 0) {
        lessonMultiplier = totalActual / totalNominal;
        lessonMultiplier = Math.max(0.5, Math.min(3.0, lessonMultiplier));
      }
      
      const adjustedLessonDuration = Math.round(eventDurationMinutes * lessonMultiplier);

      let followTaskId: string | null = null;
      let notesTaskId: string | null = null;

      // Lesson follow/recover task
      if (needsFollow) {
        const followTask: Task = {
          id: uuidv4(),
          title: followTitle,
          description: `Segna come completato se hai seguito la lezione, altrimenti l'app pianificherà il recupero.`,
          courseId: course.id,
          relatedEventId: event.id,
          lessonDate: eventDate,
          lessonTimeSlot: timeSlot,
          status: 'todo',
          priorityScore: 50,
          estimatedDuration: adjustedLessonDuration,
          createdAt: now,
          dependencies: [],
          postponedCount: 0,
        };
        newTasks.push(followTask);
        followTaskId = followTask.id;
        
        if (event.id) existingFollowTasks.add(event.id);
        existingFollowTaskTitles.add(followKey);
      }

      // Notes revision task
      if (needsNotes) {
        const notesTask: Task = {
          id: uuidv4(),
          title: notesTitle,
          description: `Revisione appunti della lezione`,
          courseId: course.id,
          relatedEventId: event.id,
          lessonDate: eventDate,
          lessonTimeSlot: timeSlot,
          status: 'todo',
          priorityScore: 0,
          estimatedDuration: prefs.estimatedRevisionTimePerLesson,
          createdAt: now,
          dependencies: followTaskId ? [followTaskId] : [],
          postponedCount: 0,
          isTravelCompatible: true,
        };
        newTasks.push(notesTask);
        notesTaskId = notesTask.id;
        
        if (event.id) existingNotesTasks.add(event.id);
        existingNotesTaskTitles.add(notesKey);
      }

      // Exercises task
      if (needsExercises) {
        const dependencies: string[] = [];
        if (notesTaskId) dependencies.push(notesTaskId);
        else if (followTaskId) dependencies.push(followTaskId);

        const exerciseTask: Task = {
          id: uuidv4(),
          title: exerciseTitle,
          description: `Esercitazione post-lezione`,
          courseId: course.id,
          relatedEventId: event.id,
          lessonDate: eventDate,
          lessonTimeSlot: timeSlot,
          status: 'todo',
          priorityScore: 0,
          estimatedDuration: Math.round(prefs.estimatedRevisionTimePerLesson * 1.5),
          createdAt: now,
          dependencies,
          postponedCount: 0,
        };
        newTasks.push(exerciseTask);
        
        if (event.id) existingExerciseTasks.add(event.id);
        existingExerciseTaskTitles.add(exerciseKey);
      }

      if (!event.isDone) updatedEvents[i] = { ...event, isDone: true };
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
    const existingNames = new Set(existingCourses.map(c => normalizeCourseName(c.name)));
    const titleCounts = new Map<string, { name: string; count: number }>();

    for (const e of events) {
      if (e.type === 'exam' || e.type === 'sport' || e.type === 'travel' || e.type === 'meal') continue;
      // Nome completo del corso (senza prefissi tipo "Lezione di" e info accessorie)
      const name = courseNameFromTitle(e.title);
      const key = normalizeCourseName(name);
      if (key && !existingNames.has(key) && !BOGUS_COURSE_NAMES.has(key) && !/^\d+$/.test(key)) {
        const entry = titleCounts.get(key);
        if (entry) entry.count++;
        else titleCounts.set(key, { name, count: 1 });
      }
    }

    const colors = ['#1a73e8', '#d93025', '#188038', '#f29900', '#a142f4', '#e8710a', '#1967d2', '#c5221f'];
    let colorIdx = 0;

    const newCourses: Course[] = [];
    for (const { name, count } of titleCounts.values()) {
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
