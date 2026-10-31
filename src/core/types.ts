/* ─── Enums ─── */
export type EventType = 'generic' | 'lesson' | 'exam' | 'quiz' | 'travel' | 'sport' | 'project_deadline' | 'meal';
export type LessonType = 'theory' | 'exercise' | 'theory_exercise' | 'lab';
export type LocationType = 'in_person' | 'remote';
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export type TaskSortMode = 'oldest' | 'smart' | 'deadline' | 'shortest' | 'course';

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
  isCustomName?: boolean; // Se true, il nome è stato modificato o creato a mano ed è predefinito (protetto da riparazioni automatiche)
  originalName?: string;   // Nome originario rilevato dal calendario prima della modifica a mano
  /** Scheda della materia (inserita a mano o estratta dall'AI) */
  info?: CourseInfo;
}

/* ─── Scheda del corso ─── */
export type AssessmentType = 'quiz' | 'lab' | 'exam' | 'oral' | 'project' | 'deadline' | 'other';

export interface AssessmentNotification {
  id: string;
  daysBefore: number; // quanti giorni prima (es: 7 = una settimana prima, 1 = giorno prima, 0 = stesso giorno)
  time?: string; // orario di invio "HH:mm" (default 09:00)
  sentAt?: string; // ISO data invio se già notificata
}

export interface CourseAssessment {
  id: string;
  type: AssessmentType;
  title: string;
  weightPercent?: number; // peso sul voto finale
  date?: string; // YYYY-MM-DD (data della prova o scadenza)
  time?: string; // HH:mm
  notes?: string;
  done?: boolean; // spuntata (svolta / consegnata)
  grade?: string; // voto ottenuto
  linkedEventId?: string; // evento nel calendario collegato
  source?: 'manual' | 'ai';
  notifications?: AssessmentNotification[]; // notifiche email configurate per questa specifica scadenza
}

export interface CourseTopic {
  id: string;
  title: string;
  part?: string; // macro-argomento / modulo
  details?: string;
  studied?: boolean;
  source?: 'manual' | 'ai';
}

/** Lezione pianificata nel calendario della singola materia */
export interface CoursePlanLesson {
  id: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  topic: string;
  lessonType: LessonType;
  room?: string;
  lecturer?: string;
  chapters?: string;
  links?: string[];
  coursePart?: string;
  cancelled?: boolean;
  eventId?: string; // evento collegato nel calendario generale
}

export interface CourseDocumentLog {
  name: string;
  kind: string;
  at: string; // ISO
  summary?: string;
}

export interface CourseInfo {
  overview?: string; // riassunto generale della materia
  gradingSummary?: string; // composizione della valutazione in parole (es. "2 quiz + lab + esame")
  studyPlan?: string; // pianificazione dello studio suggerita
  assessments?: CourseAssessment[];
  topics?: CourseTopic[];
  lessonPlan?: CoursePlanLesson[];
  documents?: CourseDocumentLog[];
  updatedAt?: string;
}

export interface StudyPreferences {
  requiresNotesRevision: boolean;
  requiresExercises: boolean;
  requiresFollowLesson?: boolean; // Opzionale (default false): crea anche il task "Seguire/Recuperare lezione"
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
  // Syllabus & Lesson notes
  topic?: string;
  notes?: string;
  readings?: string[];
  lecturer?: string;
  // Avanzamento per lezione (Teoria vs Esercitazioni)
  theoryDone?: boolean;
  exerciseDone?: boolean;
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
  startedAt?: string; // ISO string when the task was started
  accumulatedTime?: number; // minutes accumulated from previous sessions
  deadline?: string; // ISO string
  dependencies: string[]; // Task IDs (propedeuticità)
  completedAt?: string;
  postponedCount: number; // How many times postponed
  isProjectTask?: boolean; // From a project/deadline
  isTravelCompatible?: boolean; // Can this task be done during travel?
  completionMode?: 'attended' | 'recovered' | 'normal'; // Track how the task was completed
  isPhantom?: boolean; // True for predicted future tasks (not yet real)
  phantomSourceLesson?: string; // Description of the future lesson that will generate this task
  lessonDate?: string; // Date of the lesson, e.g. "15/09/2026"
  lessonTimeSlot?: string; // Time window of the lesson, e.g. "14:30 - 16:30"
  isAiEnriched?: boolean; // True if notes, chapters or topics were added by AI
  assessmentPrep?: boolean; // True se generato dalla preparazione di un esame/quiz
  assessmentPhase?: 'review' | 'exercises' | 'mock' | 'final'; // Fase della preparazione
  pauseCount?: number; // Quante volte il task è stato messo in pausa (indice di frammentazione)
  inferredStartTime?: string; // Orario di inizio ricostruito (4 livelli di confidenza)
  timeConfidence?: number; // Peso di affidabilità oraria w in [0, 1]
  durationConfidence?: number; // Peso di affidabilità della durata in [0, 1] (0 se "Non ricordo")
  wasDistracted?: boolean; // True se lo sforamento è dovuto a distrazione e non a difficoltà del corso
  isMultiDay?: boolean; // True se svolta in più giorni/sessioni (spalma il carico giornaliero)
  wasScheduledSlotHit?: boolean; // True se completato nel giorno/fascia pianificati dallo scheduler
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
  taskKind?: string;
  inferredStartTime?: string;
  timeConfidence?: number;
  durationConfidence?: number;
  wasDistracted?: boolean;
  isMultiDay?: boolean;
  pauseCount?: number;
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

/* ─── Weekly summary prefs ─── */
export interface WeeklySummaryPrefs {
  email?: string;       // destinatario (se vuoto: email dell'account)
  emailEnabled: boolean; // invio automatico via email (richiede la funzione cloud attiva)
  day: number;          // 0=domenica ... 6=sabato (default 0)
  hour: number;         // 0-23, ora locale (default 20)
  timeZone?: string;    // es. Europe/Rome
}

export type { CloseSemesterOptions, CloseSemesterResult } from './SemesterManager';

/* ─── Semester ─── */
export interface Semester {
  id: string;
  name: string;
  startDate: string; // ISO
  endDate?: string;  // ISO (valorizzata alla chiusura)
  status: 'active' | 'archived';
  /** Fotografia della chiusura: serve per ricordare cosa si è imparato */
  archive?: SemesterArchive;
}

export interface SemesterArchive {
  closedAt: string;
  totalMinutes: number;
  tasksCompleted: number;
  courses: { id: string; name: string; minutes: number; tasksCompleted: number; topics: string[] }[];
}

export type StudyDistributionPreference = 'balanced' | 'weekdays_theory_weekend_exercises';

/* ─── User Preferences ─── */
export interface UserPreferences {
  // Per-day study hours (0=Sunday, 1=Monday, ... 6=Saturday)
  dailyStudyHours: Record<number, DayStudyHours>;
  daysBeforeExamToIncreasePriority: number;
  taskSortMode?: TaskSortMode; // default: 'oldest'
  studyDistributionPreference?: StudyDistributionPreference;
  autoQuizPrep?: boolean; // Genera un ripasso leggero per ogni quiz (default true)
  examPrepDays?: number; // Finestra di preparazione agli esami (default 21)
  dailyTaskGoal?: number; // Obiettivo giornaliero (n. attività), persistito
  maxStudyBlockMinutes?: number; // Durata massima di un blocco di studio (default 120)
  minStudyBlockMinutes?: number; // Durata minima di una sessione (default 15)
  bufferMinutes?: number; // Pausa base tra attività (default 10)
  weeklySummary?: WeeklySummaryPrefs; // Riepilogo settimanale (in-app / email)
  defaultHomeAddress?: string; // To detect travel needs
  defaultCommuteTimeMinutes?: number; // Estimated commute time in minutes
  isCommuteProductive?: boolean; // True if commute is by train/bus and can be used for study
  ankiAverageTimeSeconds?: number; // Average time to review a single Anki card
}

/* ─── Syllabus / Calendar Import via AI ─── */
export interface ParsedLessonNote {
  id?: string;
  rawDate: string; // e.g. "15/09/2026" or "Tuesday 15/9"
  parsedDate?: string; // "YYYY-MM-DD"
  startTime?: string; // "14:15" or "14:30"
  endTime?: string; // "16:15"
  room?: string; // "6.0.1" or "9.12"
  lecturer?: string; // "Francesco" or "Brambilla"
  topic: string; // "Introduction to Big Data"
  lessonType: LessonType; // 'theory' | 'exercise' | 'lab'
  coursePart?: string; // "Intro, RDBMS, DWH"
  sectionsOrChapters?: string; // "Chapter 1, Sections 1-2"
  readingsOrLinks?: string[]; // ["https://..."]
  isCancelled?: boolean; // true if NO CLASS
  matchedEventId?: string; // Existing CalendarEvent id if matched
}

export type DocumentKind = 'lesson_calendar' | 'syllabus' | 'exam_info' | 'study_plan' | 'deadlines' | 'other';

export interface ParsedAssessment {
  type: AssessmentType;
  title: string;
  weightPercent?: number;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  notes?: string;
}

export interface ParsedTopic {
  title: string;
  part?: string;
  details?: string;
}

/** Risultato completo dell'analisi AI di un documento di un corso */
export interface SyllabusExtractionResult {
  courseName?: string;
  documentKind: DocumentKind;
  documentSummary?: string;
  lessons: ParsedLessonNote[];
  assessments: ParsedAssessment[];
  topics: ParsedTopic[];
  overview?: string;
  gradingSummary?: string;
  studyPlan?: string;
  totalExtracted: number;
  tokensUsed?: number;
  modelUsed?: string;
}

/* ─── Anki History (salvata localmente + cloud, disponibile anche offline) ─── */
export interface AnkiDaySnapshot {
  date: string;              // "YYYY-MM-DD" (giorno Anki)
  updatedAt: string;         // ISO dell'ultimo aggiornamento
  /** Carte in ripasso dovute oggi (review) */
  reviewDue?: number;
  /** Carte in apprendimento dovute oggi */
  learnDue?: number;
  /** Carte nuove ancora da introdurre oggi (rispetta il limite giornaliero dei mazzi) */
  newToday?: number;
  /** Totale carte nuove nella collezione */
  newTotal?: number;
  /** Carte rimaste da fare oggi = reviewDue + learnDue + newToday */
  remaining?: number;
  /** Carte studiate (risposte date) oggi */
  studied: number;
  /** Tempo totale di studio in minuti */
  studyMinutes?: number;
  /** Velocità media di oggi in secondi per carta */
  avgSecondsPerCard?: number;
  /** Tempo stimato per finire le carte rimaste (minuti) */
  estimatedMinutes?: number;
  /** Tempo medio di risposta dell'intera collezione (statistiche Anki), usato come fallback */
  collectionAvgSeconds?: number;
  /** true se il giorno è stato ricostruito dallo storico Anki (solo conteggio studiate) */
  backfilled?: boolean;
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
