export type EventType = 'generic' | 'lesson' | 'exam' | 'travel' | 'sport';
export type LessonType = 'theory' | 'exercise' | 'theory_exercise' | 'lab';
export type LocationType = 'in_person' | 'remote';

export interface Location {
  type: LocationType;
  address?: string;
}

export interface Course {
  id: string;
  name: string;
  difficulty: number; // 1-10
  color: string;
  defaultStudyPreferences: {
    requiresNotesRevision: boolean;
    requiresExercises: boolean;
    estimatedRevisionTimePerLesson: number; // minutes
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  startTime: Date;
  endTime: Date;
  location?: Location;
  courseId?: string; // If related to a course
  lessonType?: LessonType;
  isDone: boolean; // For tracking past events
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  courseId?: string;
  relatedEventId?: string; // E.g., the lesson this task refers to
  status: 'todo' | 'in_progress' | 'done';
  priorityScore: number; // Calculated dynamically
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes, filled when done
  createdAt: Date;
  deadline?: Date; // E.g., next lesson or exam date
  dependencies: string[]; // Task IDs that must be completed before this one
}

export interface StudySession {
  id: string;
  taskId: string;
  startTime: Date;
  endTime: Date;
  isBuffer: boolean;
}

export interface UserPreferences {
  studyHours: {
    start: string; // e.g. "08:00"
    end: string;   // e.g. "18:00"
  };
  forbiddenDays: number[]; // e.g. [0] for Sunday
  daysBeforeExamToIncreasePriority: number;
}
