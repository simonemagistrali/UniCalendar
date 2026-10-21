import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent, Task, ParsedLessonNote, Course } from './types';

export interface MatchResultItem {
  syllabusLesson: ParsedLessonNote;
  matchedEvent?: CalendarEvent;
  isNewEventNeeded: boolean;
  proposedEvent?: CalendarEvent;
}

/**
 * Matches extracted syllabus lessons against existing calendar events for a specific course.
 */
export function matchSyllabusWithCalendar(
  syllabusLessons: ParsedLessonNote[],
  existingEvents: CalendarEvent[],
  course: Course
): MatchResultItem[] {
  // Filter events belonging to this course (or lesson events in general)
  const courseEvents = existingEvents.filter(e => e.courseId === course.id);

  return syllabusLessons.map(lesson => {
    if (lesson.isCancelled) {
      // If syllabus says NO CLASS, find if there is an event scheduled there that should perhaps be cancelled/flagged
      const matched = courseEvents.find(e => {
        const evDate = e.startTime.substring(0, 10);
        return evDate === lesson.parsedDate;
      });
      return {
        syllabusLesson: lesson,
        matchedEvent: matched,
        isNewEventNeeded: false,
      };
    }

    // Try matching by exact date
    const dayMatches = courseEvents.filter(e => {
      const evDate = e.startTime.substring(0, 10);
      return evDate === lesson.parsedDate;
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

    if (matched) {
      return {
        syllabusLesson: lesson,
        matchedEvent: matched,
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
      isNewEventNeeded: true,
      proposedEvent: proposed,
    };
  });
}

/**
 * Applies matched syllabus items to enrich events and corresponding study tasks.
 */
export function applySyllabusMatches(
  matchResults: MatchResultItem[],
  currentEvents: CalendarEvent[],
  currentTasks: Task[],
  course: Course,
  createNewEvents = true
): {
  updatedEvents: CalendarEvent[];
  updatedTasks: Task[];
  newEventsCreatedCount: number;
  eventsEnrichedCount: number;
} {
  const eventsMap = new Map<string, CalendarEvent>(currentEvents.map(e => [e.id, { ...e }]));
  const tasksMap = new Map<string, Task>(currentTasks.map(t => [t.id, { ...t }]));

  let newEventsCreatedCount = 0;
  let eventsEnrichedCount = 0;

  for (const item of matchResults) {
    const { syllabusLesson, matchedEvent, isNewEventNeeded, proposedEvent } = item;

    if (matchedEvent) {
      // Enrich existing event
      const target = eventsMap.get(matchedEvent.id);
      if (target) {
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

        // Update corresponding Task(s) for this event
        for (const task of tasksMap.values()) {
          if (task.relatedEventId === target.id || (task.courseId === course.id && task.createdAt.startsWith(target.startTime.substring(0, 10)))) {
            // Enrich task title and description with exact topic and textbook sections
            if (syllabusLesson.topic) {
              const prefix = syllabusLesson.lessonType === 'exercise' ? 'Esercizi' : 'Ripasso';
              task.title = `${prefix}: ${syllabusLesson.topic}`;
            }
            const descParts: string[] = [];
            if (syllabusLesson.sectionsOrChapters) {
              descParts.push(`Capitoli/Libro: ${syllabusLesson.sectionsOrChapters}`);
            }
            if (syllabusLesson.lecturer) {
              descParts.push(`Docente: ${syllabusLesson.lecturer}`);
            }
            if (syllabusLesson.readingsOrLinks && syllabusLesson.readingsOrLinks.length > 0) {
              descParts.push(`Materiali/Link: \n${syllabusLesson.readingsOrLinks.join('\n')}`);
            }
            if (descParts.length > 0) {
              task.description = descParts.join('\n');
            }
          }
        }
      }
    } else if (isNewEventNeeded && createNewEvents && proposedEvent) {
      // Add proposed event
      eventsMap.set(proposedEvent.id, proposedEvent);
      newEventsCreatedCount++;
    }
  }

  return {
    updatedEvents: Array.from(eventsMap.values()),
    updatedTasks: Array.from(tasksMap.values()),
    newEventsCreatedCount,
    eventsEnrichedCount,
  };
}
