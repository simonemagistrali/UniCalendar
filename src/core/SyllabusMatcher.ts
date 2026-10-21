import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent, Task, ParsedLessonNote, Course } from './types';

export interface MatchResultItem {
  syllabusLesson: ParsedLessonNote;
  matchedEvent?: CalendarEvent;
  matchedTasks?: Task[];
  isNewEventNeeded: boolean;
  proposedEvent?: CalendarEvent;
}

/**
 * Returns a localized date string "YYYY-MM-DD" from an ISO string or Date.
 */
function toLocalDateKey(d: string | Date | undefined): string {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) {
    return String(d).substring(0, 10);
  }
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Matches extracted syllabus lessons against existing calendar events and tasks.
 */
export function matchSyllabusWithCalendar(
  syllabusLessons: ParsedLessonNote[],
  existingEvents: CalendarEvent[],
  course: Course,
  existingTasks: Task[] = []
): MatchResultItem[] {
  // Filter events belonging to this course (by id or course title if unassigned)
  const courseEvents = existingEvents.filter(e => 
    e.courseId === course.id || 
    (!e.courseId && e.title && course.name && e.title.toLowerCase().includes(course.name.toLowerCase()))
  );

  return syllabusLessons.map(lesson => {
    const lessonDateKey = toLocalDateKey(lesson.parsedDate);
    const lessonMonthDay = lessonDateKey.length >= 10 ? lessonDateKey.substring(5) : '';

    // Match by exact date key YYYY-MM-DD or MM-DD (if academic year differs slightly)
    let dayMatches = courseEvents.filter(e => {
      const evDateKey = toLocalDateKey(e.startTime);
      if (evDateKey === lessonDateKey) return true;
      if (lessonMonthDay && evDateKey.substring(5) === lessonMonthDay) return true;
      return false;
    });

    let matched: CalendarEvent | undefined = undefined;

    if (dayMatches.length === 1) {
      matched = dayMatches[0];
    } else if (dayMatches.length > 1 && lesson.startTime) {
      // If multiple events on the same day, compare start hour
      const targetHour = parseInt(lesson.startTime.split(':')[0], 10);
      matched = dayMatches.find(e => {
        const evHour = new Date(e.startTime).getHours();
        return Math.abs(evHour - targetHour) <= 1;
      }) || dayMatches[0];
    }

    // Find any existing tasks associated with this event or date
    const lessonDateIt = lesson.parsedDate ? new Date(lesson.parsedDate).toLocaleDateString('it-IT') : '';
    const matchedTasks = existingTasks.filter(t => {
      if (matched && t.relatedEventId === matched.id) return true;
      if (t.courseId === course.id) {
        if (lessonDateIt && t.title.includes(`(${lessonDateIt})`)) return true;
        if (lesson.rawDate && t.title.includes(lesson.rawDate)) return true;
      }
      return false;
    });

    if (lesson.isCancelled) {
      return {
        syllabusLesson: lesson,
        matchedEvent: matched,
        matchedTasks,
        isNewEventNeeded: false,
      };
    }

    if (matched) {
      return {
        syllabusLesson: lesson,
        matchedEvent: matched,
        matchedTasks,
        isNewEventNeeded: false,
      };
    }

    // No existing event found: propose creating a new one
    const startHourMin = lesson.startTime || '09:00';
    const endHourMin = lesson.endTime || '11:00';
    const [startH, startM] = startHourMin.split(':').map(Number);
    const [endH, endM] = endHourMin.split(':').map(Number);

    const lessonDate = lesson.parsedDate || new Date().toISOString().substring(0, 10);
    const startDate = new Date(`${lessonDate}T00:00:00`);
    startDate.setHours(startH || 9, startM || 0, 0, 0);

    const endDate = new Date(`${lessonDate}T00:00:00`);
    endDate.setHours(endH || 11, endM || 0, 0, 0);

    const proposed: CalendarEvent = {
      id: uuidv4(),
      title: `${course.name} - ${lesson.topic}`,
      type: 'lesson',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      courseId: course.id,
      lessonType: lesson.lessonType,
      topic: lesson.topic,
      lecturer: lesson.lecturer,
      notes: lesson.sectionsOrChapters,
      readings: lesson.readingsOrLinks,
      location: lesson.room ? { type: 'in_person', address: `Aula ${lesson.room}` } : undefined,
      isDone: false,
    };

    return {
      syllabusLesson: lesson,
      matchedTasks,
      isNewEventNeeded: true,
      proposedEvent: proposed,
    };
  });
}

/**
 * Cleanly removes duplicate tasks that may have accumulated for a course,
 * merging descriptions into the canonical task.
 */
export function deduplicateCourseTasks(tasks: Task[], courseId: string): Task[] {
  const seenNotes = new Map<string, Task>();
  const seenExercises = new Map<string, Task>();
  const seenFollow = new Map<string, Task>();
  const result: Task[] = [];

  for (const t of tasks) {
    if (t.courseId !== courseId) {
      result.push(t);
      continue;
    }

    // Extract date from title e.g. "(15/09/2026)"
    const dateMatch = t.title.match(/\((\d{1,2}\/\d{1,2}(?:\/\d{4})?)\)/);
    const dateKey = dateMatch ? dateMatch[1] : (t.relatedEventId || t.id);

    const isNotes = t.title.toLowerCase().includes('appunti') || t.title.toLowerCase().includes('ripasso') || t.title.toLowerCase().includes('notes');
    const isExercise = t.title.toLowerCase().includes('eserciz');
    const isFollow = t.title.toLowerCase().includes('seguire') || t.title.toLowerCase().includes('recuperare');

    if (isNotes) {
      if (seenNotes.has(dateKey)) {
        const existing = seenNotes.get(dateKey)!;
        if (!existing.description && t.description) {
          existing.description = t.description;
        }
        continue; // drop duplicate
      }
      seenNotes.set(dateKey, t);
      result.push(t);
    } else if (isExercise) {
      if (seenExercises.has(dateKey)) {
        continue; // drop duplicate
      }
      seenExercises.set(dateKey, t);
      result.push(t);
    } else if (isFollow) {
      if (seenFollow.has(dateKey)) {
        continue; // drop duplicate
      }
      seenFollow.set(dateKey, t);
      result.push(t);
    } else {
      result.push(t);
    }
  }

  return result;
}

/**
 * Applies matched syllabus items to enrich events and corresponding study tasks.
 * Does NOT generate duplicate tasks; instead updates existing tasks and aligns titles.
 */
export function applySyllabusMatches(
  matchResults: MatchResultItem[],
  currentEvents: CalendarEvent[],
  currentTasks: Task[],
  course: Course,
  createNewEvents = false
): {
  updatedEvents: CalendarEvent[];
  updatedTasks: Task[];
  newEventsCreatedCount: number;
  eventsEnrichedCount: number;
  tasksUpdatedCount: number;
} {
  const eventsMap = new Map<string, CalendarEvent>(currentEvents.map(e => [e.id, { ...e }]));
  const tasksMap = new Map<string, Task>(currentTasks.map(t => [t.id, { ...t }]));

  let newEventsCreatedCount = 0;
  let eventsEnrichedCount = 0;
  let tasksUpdatedCount = 0;

  for (const item of matchResults) {
    const { syllabusLesson, matchedEvent, isNewEventNeeded, proposedEvent } = item;

    if (matchedEvent) {
      // Enrich existing event
      const target = eventsMap.get(matchedEvent.id);
      if (target) {
        // Ensure courseId is assigned if it was missing
        if (!target.courseId) {
          target.courseId = course.id;
        }

        target.topic = syllabusLesson.topic || target.topic;
        target.lessonType = syllabusLesson.lessonType || target.lessonType;
        if (syllabusLesson.lecturer) target.lecturer = syllabusLesson.lecturer;
        if (syllabusLesson.sectionsOrChapters) target.notes = syllabusLesson.sectionsOrChapters;
        if (syllabusLesson.readingsOrLinks && syllabusLesson.readingsOrLinks.length > 0) {
          target.readings = syllabusLesson.readingsOrLinks;
        }
        if (syllabusLesson.room && !target.location?.address) {
          target.location = { type: 'in_person', address: `Aula ${syllabusLesson.room}` };
        }

        eventsEnrichedCount++;

        const eventDate = new Date(target.startTime).toLocaleDateString('it-IT');

        // Build rich description
        const descParts: string[] = [];
        if (syllabusLesson.topic) {
          descParts.push(`Argomento: ${syllabusLesson.topic}`);
        }
        if (syllabusLesson.sectionsOrChapters) {
          descParts.push(`Capitoli/Libro: ${syllabusLesson.sectionsOrChapters}`);
        }
        if (syllabusLesson.lecturer) {
          descParts.push(`Docente: ${syllabusLesson.lecturer}`);
        }
        if (syllabusLesson.readingsOrLinks && syllabusLesson.readingsOrLinks.length > 0) {
          descParts.push(`Materiali e Link:\n${syllabusLesson.readingsOrLinks.join('\n')}`);
        }
        const formattedDesc = descParts.join('\n');

        // Update corresponding Task(s) for this event (matching by relatedEventId or course + date)
        for (const task of tasksMap.values()) {
          const isDirectEventMatch = task.relatedEventId === target.id;
          const isCourseDateMatch = task.courseId === course.id && task.title.includes(`(${eventDate})`);

          if (isDirectEventMatch || isCourseDateMatch) {
            // Attach relatedEventId if missing
            if (!task.relatedEventId) {
              task.relatedEventId = target.id;
            }

            // Keep standard prefixes required by TaskManager
            const lowerTitle = task.title.toLowerCase();
            if (lowerTitle.includes('appunti') || lowerTitle.includes('ripasso')) {
              task.title = `Sistemare appunti: ${course.name} - ${syllabusLesson.topic} (${eventDate})`;
            } else if (lowerTitle.includes('eserciz')) {
              task.title = `Esercizi: ${course.name} - ${syllabusLesson.topic} (${eventDate})`;
            } else if (lowerTitle.includes('seguire') || lowerTitle.includes('recuperare')) {
              task.title = `Seguire/Recuperare lezione: ${course.name} - ${syllabusLesson.topic} (${eventDate})`;
            }

            if (formattedDesc) {
              task.description = formattedDesc;
            }

            tasksUpdatedCount++;
          }
        }
      }
    } else if (isNewEventNeeded && createNewEvents && proposedEvent) {
      // Add proposed event
      eventsMap.set(proposedEvent.id, proposedEvent);
      newEventsCreatedCount++;
    }
  }

  // Deduplicate tasks to ensure no multiple copies remain
  const cleanedTasks = deduplicateCourseTasks(Array.from(tasksMap.values()), course.id);

  return {
    updatedEvents: Array.from(eventsMap.values()),
    updatedTasks: cleanedTasks,
    newEventsCreatedCount,
    eventsEnrichedCount,
    tasksUpdatedCount,
  };
}
