/* ─── Enums ─── */
export type EventType = 'generic' | 'lesson' | 'exam' | 'travel' | 'sport' | 'project_deadline' | 'meal';
export type LessonType = 'theory' | 'exercise' | 'theory_exercise' | 'lab';
export type LocationType = 'in_person' | 'remote';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

/* ─── Location ─── */
export interface Location {
  type: LocationType;
  address?: string;
}

/* ─── Course ─── */
export interface Course {
  id: string;
  name: string;
  difficulty: number; // 1-10
  color: string;
  defaultStudyPreferences: StudyPreferences;
}

export interface StudyPreferences {
  requiresNotesRevision: boolean;
  requiresExercises: boolean;
  estimatedRevisionTimePerLesson: number; // minutes
}

/* ─── Calendar Event ─── */
export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  startTime: string; // ISO string for serialization
  endTime: string;
  location?: Location;
  courseId?: string;
  lessonType?: LessonType;
  isDone: boolean;
  // Travel-specific
  isTravelStudyTime?: boolean;
  // Project/Deadline-specific
  projectScheduleFrequencyDays?: number; // How often to schedule work sessions
  projectImportance?: number; // 1-10
  projectTotalHours?: number; // Total estimated hours
  // Sport-specific
  sportType?: string; // corsa, palestra, etc.
  // Recurrence
  rrule?: string; // Simple recurrence: 'weekly', 'daily', etc.
  sourceCalendarId?: string; // To detect duplicates from Google Calendar
  // Override course preferences for this specific event
  studyPreferencesOverride?: {
    requiresNotesRevision: boolean;
    requiresExercises: boolean;
  };
  // Manual travel overrides
  travelInStartOffset?: number; // Minutes before lesson start to begin commute
  travelInEndOffset?: number;   // Minutes before lesson start to arrive
  travelOutStartOffset?: number; // Minutes after lesson end to begin return commute
  travelOutEndOffset?: number;   // Minutes after lesson end to arrive
}

/* ─── Task ─── */
export interface Task {
  id: string;
  title: string;
  description?: string;
  courseId?: string;
  relatedEventId?: string;
  status: TaskStatus;
  priorityScore: number;
  estimatedDuration: number; // minutes
  actualDuration?: number; // minutes, filled when done
  createdAt: string; // ISO string
  deadline?: string; // ISO string
  dependencies: string[]; // Task IDs (propedeuticità)
  completedAt?: string;
  postponedCount: number; // How many times postponed
  isProjectTask?: boolean; // From a project/deadline
  isTravelCompatible?: boolean; // Can this task be done during travel?
  completionMode?: 'attended' | 'recovered' | 'normal'; // Track how the task was completed
  isPhantom?: boolean; // True for predicted future tasks (not yet real)
  phantomSourceLesson?: string; // Description of the future lesson that will generate this task
}

/* ─── Study Session ─── */
export interface StudySession {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string;
  isBuffer: boolean;
}

/* ─── Performance History (per course) ─── */
export interface PerformanceRecord {
  courseId: string;
  taskId: string;
  estimatedMinutes: number;
  actualMinutes: number;
  completedAt: string;
}

/* ─── Per-Day Study Hours ─── */
export interface DayStudyHours {
  enabled: boolean;
  start: string; // "08:00"
  end: string;   // "18:00"
  lunchBreak?: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

/* ─── User Preferences ─── */
export interface UserPreferences {
  // Per-day study hours (0=Sunday, 1=Monday, ... 6=Saturday)
  dailyStudyHours: Record<number, DayStudyHours>;
  daysBeforeExamToIncreasePriority: number;
  defaultHomeAddress?: string; // To detect travel needs
  defaultCommuteTimeMinutes?: number; // Estimated commute time in minutes
  isCommuteProductive?: boolean; // True if commute is by train/bus and can be used for study
}

/* ─── Phantom Task (Future Projection) ─── */
export type PhantomTaskType = 'follow_recover' | 'notes' | 'exercises';

export interface PhantomTask {
  courseId: string;
  courseName: string;
  sourceEventId: string;        // The future lesson that will generate this
  expectedAvailableAfter: string; // When the lesson ends (ISO)
  estimatedDuration: number;     // Minutes
  type: PhantomTaskType;
  title: string;
}

export interface FutureWorkloadProjection {
  phantomTasks: PhantomTask[];
  totalProjectedMinutes: number;
  /** Maps date string "YYYY-MM-DD" → projected minutes arriving that day */
  projectionByDay: Record<string, number>;
  /** Maps courseId → total projected minutes */
  projectionByCourse: Record<string, number>;
}

/* ─── App User ─── */
export interface AppUser {
  id: string;
  name: string;
  email: string;
  photoURL: string;
}
