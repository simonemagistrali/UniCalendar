import { create } from 'zustand';
import type { Task, Course, CalendarEvent, UserPreferences, StudySession, PerformanceRecord, AppUser, DayStudyHours, AnkiDaySnapshot, Semester } from '../core/types';
import { SemesterManager, type CloseSemesterOptions, type CloseSemesterResult } from '../core/SemesterManager';
import { saveState, loadState } from '../core/persistence';
import { TaskManager } from '../core/TaskManager';
import { getTaskKind } from '../core/taskKind';
import { refreshLessonTasks, taskBelongsToEvent, localDateKey } from '../core/lessonLink';
import { getLessonTracks } from '../core/LessonProgressEngine';
import { PriorityEngine } from '../core/PriorityEngine';
import { SchedulerEngine } from '../core/SchedulerEngine';
import { HabitAnalysisEngine } from '../core/HabitAnalysisEngine';
import { TravelManager } from '../core/TravelManager';
import { MealManager } from '../core/MealManager';
import { FutureProjectionEngine } from '../core/FutureProjectionEngine';
import { persistState, loadFromCloud, subscribeToCloud } from '../core/syncManager';
import { repairCourseNames } from '../core/courseNames';
import { mergeAnkiHistory, unionAnkiHistory, isSameSnapshot } from '../core/ankiStats';

/* ─── Default per-day study hours ─── */
function defaultDailyHours(): Record<number, DayStudyHours> {
  const h: Record<number, DayStudyHours> = {};
  for (let d = 0; d < 7; d++) {
    h[d] = d === 0
      ? { enabled: true, start: '09:00', end: '14:00', lunchBreak: { enabled: true, start: '13:00', end: '14:00' } } // Sunday: shorter hours
      : d === 6
        ? { enabled: true, start: '09:00', end: '17:00', lunchBreak: { enabled: true, start: '13:00', end: '14:00' } } // Saturday: slightly shorter
        : { enabled: true, start: '08:00', end: '18:00', lunchBreak: { enabled: true, start: '13:00', end: '14:00' } }; // Weekdays
  }
  return h;
}

const defaultPreferences: UserPreferences = {
  dailyStudyHours: defaultDailyHours(),
  daysBeforeExamToIncreasePriority: 14,
  taskSortMode: 'oldest',
  studyDistributionPreference: 'balanced',
  autoQuizPrep: true,
  examPrepDays: 21,
  dailyTaskGoal: 3,
  maxStudyBlockMinutes: 120,
  minStudyBlockMinutes: 15,
  bufferMinutes: 10,
  weeklySummary: { emailEnabled: false, day: 0, hour: 20 },
  defaultCommuteTimeMinutes: 45,
  isCommuteProductive: false,
  ankiAverageTimeSeconds: 15,
};

/**
 * Merge saved preferences with defaults to ensure all 7 days are present
 * and no data is missing from older saved versions.
 */
function mergePreferences(saved: unknown): UserPreferences {
  if (!saved || typeof saved !== 'object') return defaultPreferences;
  const p = saved as Partial<UserPreferences>;
  const defaults = defaultDailyHours();
  const merged: Record<number, DayStudyHours> = {};

  for (let d = 0; d < 7; d++) {
    const savedDay = p.dailyStudyHours?.[d];
    merged[d] = savedDay && typeof savedDay.enabled === 'boolean'
      ? savedDay
      : defaults[d];
  }

  return {
    dailyStudyHours: merged,
    daysBeforeExamToIncreasePriority: p.daysBeforeExamToIncreasePriority ?? 14,
    taskSortMode: p.taskSortMode ?? 'oldest',
    studyDistributionPreference: p.studyDistributionPreference ?? 'balanced',
    autoQuizPrep: p.autoQuizPrep ?? true,
    examPrepDays: p.examPrepDays ?? 21,
    dailyTaskGoal: p.dailyTaskGoal ?? 3,
    maxStudyBlockMinutes: p.maxStudyBlockMinutes ?? 120,
    minStudyBlockMinutes: p.minStudyBlockMinutes ?? 15,
    bufferMinutes: p.bufferMinutes ?? 10,
    weeklySummary: p.weeklySummary ?? { emailEnabled: false, day: 0, hour: 20 },
    defaultHomeAddress: p.defaultHomeAddress,
    defaultCommuteTimeMinutes: p.defaultCommuteTimeMinutes ?? 45,
    isCommuteProductive: p.isCommuteProductive ?? false,
    ankiAverageTimeSeconds: p.ankiAverageTimeSeconds ?? 15,
  };
}

/* ─── State Interface ─── */
interface AppState {
  // Data
  user: AppUser | null;
  events: CalendarEvent[];
  tasks: Task[];
  courses: Course[];
  preferences: UserPreferences;
  studySessions: StudySession[];
  performanceHistory: PerformanceRecord[];
  ankiHistory: AnkiDaySnapshot[];
  setUser: (user: AppUser | null) => void;
  initializeUser: (user: AppUser) => Promise<void>;

  // Daily Goal
  selectedDailyGoalType: 'PACE' | '7DAYS' | 'END' | null;
  selectedDailyGoalValue: number | null;
  setDailyGoal: (type: 'PACE' | '7DAYS' | 'END' | null, value: number | null) => void;


  // Events
  addEvent: (event: CalendarEvent) => void;
  addEvents: (events: CalendarEvent[]) => void;
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  removeEvent: (id: string) => void;

  // Tasks
  addTask: (task: Task) => void;
  addTasks: (tasks: Task[]) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  removeTasks: (ids: string[]) => void;
  removeTasksByFilter: (filter: { courseId?: string; taskType?: string; onlyAiEnriched?: boolean; status?: string }) => number;
  completeTask: (
    id: string,
    actualMinutes: number,
    completionMode?: 'attended' | 'recovered' | 'normal',
    opts?: { durationConfidence?: number; wasDistracted?: boolean; isMultiDay?: boolean }
  ) => void;

  // Courses
  addCourse: (course: Course) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  removeCourse: (id: string) => void;
  /** Salva in un'unica operazione atomica corso + eventi + task (usato dall'import AI dei documenti). */
  commitCourseImport: (data: { course: Course; events: CalendarEvent[]; tasks: Task[] }) => void;
  repairCourses: () => { changed: boolean; count: number };

  // Sessions
  setStudySessions: (sessions: StudySession[]) => void;

  // Performance
  addPerformanceRecord: (record: PerformanceRecord) => void;

  // Preferences
  updatePreferences: (prefs: Partial<UserPreferences>) => void;

  // Anki
  recordAnkiSync: (today: AnkiDaySnapshot, reviewsByDay: Record<string, number>) => void;

  // Bulk
  setEvents: (events: CalendarEvent[]) => void;
  setTasks: (tasks: Task[]) => void;

  // Sync
  syncAndSchedule: () => void;

  // Cleanup & Lesson Progress
  cleanupDuplicates: () => { removedTasks: number; removedEvents: number };
  setLessonTrackDone: (eventId: string, track: 'theory' | 'exercise', done: boolean) => void;
  setCourseCheckpoint: (courseId: string, track: 'theory' | 'exercise', upToEventId: string | null) => { markedLessons: number; removedTasks: number };
  cleanupNoisyTasks: (opts?: { removeFollowLessonTasks?: boolean; removeOrphanLessonTasks?: boolean; deduplicate?: boolean }) => { removedTasks: number; removedEvents: number };
  resetAllData: (opts?: { keepCourses?: boolean; keepHistory?: boolean }) => void;

  // Semesters
  semesters: Semester[];
  addSemester: (name: string) => void;
  closeActiveSemester: (opts: CloseSemesterOptions) => CloseSemesterResult;
  setSemesters: (semesters: Semester[]) => void;

  // History
  pastStates: string[];
  saveSnapshot: () => void;
  undo: () => void;
}

/* ─── Persist middleware (manual, lightweight) ─── */
function persist(state: AppState) {
  persistState({
    events: state.events,
    tasks: state.tasks,
    courses: state.courses,
    preferences: state.preferences,
    performanceHistory: state.performanceHistory,
    studySessions: state.studySessions,
    ankiHistory: state.ankiHistory,
    semesters: state.semesters,
  }, state.user?.id || null);
}

/* ─── Course name repair (migrazione nomi corso troncati) ─── */
function withRepairedCourses<T extends { courses: Course[]; events: CalendarEvent[]; tasks: Task[]; performanceHistory: PerformanceRecord[] }>(data: T): { data: T; changed: boolean } {
  const result = repairCourseNames(data);
  if (!result.changed) return { data, changed: false };
  console.log('[Courses] Nomi dei corsi riparati');
  return {
    data: { ...data, courses: result.courses, events: result.events, tasks: result.tasks, performanceHistory: result.performanceHistory },
    changed: true,
  };
}

/* ─── Deduplicate Tasks Helper ─── */
function deduplicateTasks(tasks: Task[], events: CalendarEvent[] = []): Task[] {
  const eventsMap = new Map<string, CalendarEvent>(events.map(e => [e.id, e]));
  const groupMap = new Map<string, Task>();

  for (const t of tasks) {
    // Sessioni di progetto e fasi di preparazione condividono evento/data/orario:
    // non vanno fuse tra loro (ognuna è un task distinto).
    if (t.isProjectTask || t.assessmentPrep) {
      groupMap.set(t.id, t);
      continue;
    }
    // Determine category
    const titleLower = t.title.toLowerCase();
    let category = 'other';
    if (t.isProjectTask) category = 'project';
    else if (titleLower.includes('seguire') || titleLower.includes('recuperare')) category = 'follow';
    else if (titleLower.includes('appunti') || titleLower.includes('ripasso') || titleLower.includes('notes')) category = 'notes';
    else if (titleLower.includes('eserciz')) category = 'exercise';

    // Extract target date from title (DD/MM/YYYY), lessonDate property, or related event
    const dateMatch = t.title.match(/\((\d{1,2}\/\d{1,2}(?:\/\d{4})?)/);
    let dateKey = t.lessonDate || (dateMatch ? dateMatch[1] : '');
    if (!dateKey && t.relatedEventId && eventsMap.has(t.relatedEventId)) {
      dateKey = new Date(eventsMap.get(t.relatedEventId)!.startTime).toLocaleDateString('it-IT');
    }
    if (!dateKey) {
      dateKey = t.id; // Fallback: preserve unique task if date cannot be resolved
    }

    // Extract time slot from lessonTimeSlot, related event, or title (HH:mm - HH:mm)
    let slotKey = t.lessonTimeSlot;
    if (!slotKey && t.relatedEventId && eventsMap.has(t.relatedEventId)) {
      const ev = eventsMap.get(t.relatedEventId)!;
      const startHM = new Date(ev.startTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const endHM = new Date(ev.endTime).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      slotKey = `${startHM} - ${endHM}`;
    }
    if (!slotKey) {
      const timeMatch = t.title.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
      slotKey = timeMatch ? timeMatch[1] : 'noslot';
    }

    const key = `${t.courseId || 'nocourse'}::${category}::${dateKey}::${slotKey}`;

    if (groupMap.has(key)) {
      const existing = groupMap.get(key)!;
      // Prefer keeping 'done' tasks over 'todo'
      if (existing.status !== 'done' && t.status === 'done') {
        if (!t.description && existing.description) {
          t.description = existing.description;
        }
        groupMap.set(key, t);
      } else {
        // Keep existing, merge description if candidate has more info
        if (!existing.description && t.description) {
          existing.description = t.description;
        }
        if (!existing.relatedEventId && t.relatedEventId) {
          existing.relatedEventId = t.relatedEventId;
        }
      }
    } else {
      groupMap.set(key, t);
    }
  }

  return Array.from(groupMap.values());
}

/* ─── Deduplicate Events Helper ─── */
function isEventDuplicate(newEvent: CalendarEvent, existingEvents: CalendarEvent[]): boolean {
  // Se l'ID è identico, è ovviamente un duplicato (stesso evento importato due volte)
  if (existingEvents.some(e => e.id === newEvent.id)) {
    return true;
  }

  const nStart = new Date(newEvent.startTime).getTime();
  const nEnd = new Date(newEvent.endTime).getTime();
  const nTitle = newEvent.title.toLowerCase();

  return existingEvents.some(e => {
    const eStart = new Date(e.startTime).getTime();
    const eEnd = new Date(e.endTime).getTime();
    const eTitle = e.title.toLowerCase();

    const sameTime = nStart === eStart && nEnd === eEnd;
    const sameTitle = nTitle === eTitle || nTitle.includes(eTitle) || eTitle.includes(nTitle);

    return sameTime && sameTitle;
  });
}

function deduplicateEventsList(events: CalendarEvent[]): CalendarEvent[] {
  const uniqueEvents: CalendarEvent[] = [];
  for (const event of events) {
    if (!isEventDuplicate(event, uniqueEvents)) {
      uniqueEvents.push(event);
    }
  }
  return uniqueEvents;
}

/* ─── Load initial state ─── */
const saved = loadState();
const savedEvents = deduplicateEventsList((saved?.events as CalendarEvent[]) || []);
const initialRepair = withRepairedCourses({
  events: savedEvents,
  tasks: deduplicateTasks((saved?.tasks as Task[]) || [], savedEvents),
  courses: (saved?.courses as Course[]) || [],
  performanceHistory: (saved?.performanceHistory as PerformanceRecord[]) || [],
});
if (initialRepair.changed && saved) {
  saveState({ ...saved, ...initialRepair.data });
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  events: initialRepair.data.events,
  tasks: initialRepair.data.tasks,
  courses: initialRepair.data.courses,
  preferences: mergePreferences(saved?.preferences),
  studySessions: (saved?.studySessions as StudySession[]) || [],
  performanceHistory: initialRepair.data.performanceHistory,
  ankiHistory: (saved?.ankiHistory as AnkiDaySnapshot[]) || [],
  semesters: (saved?.semesters as Semester[]) || [],
  pastStates: [],

  selectedDailyGoalType: null,
  selectedDailyGoalValue: mergePreferences(saved?.preferences).dailyTaskGoal ?? null,
  setDailyGoal: (type, value) => {
    set({ selectedDailyGoalType: type, selectedDailyGoalValue: value });
    if (value !== null) {
      get().updatePreferences({ dailyTaskGoal: value });
    }
  },

  setUser: (user) => {
    set({ user });
  },

  initializeUser: async (user) => {
    set({ user });

    try {
      console.log("[Sync] Tentativo di caricamento dati per:", user.id);
      const cloudData = await loadFromCloud(user.id);
      console.log("[Sync] Dati ricevuti dal cloud:", cloudData);

      const updateFromCloud = (data: any) => {
        let needsCloudWrite = false;
        set((s) => {
          const repaired = withRepairedCourses({
            events: deduplicateEventsList(data.events || s.events),
            tasks: deduplicateTasks(data.tasks || s.tasks),
            courses: data.courses || s.courses,
            performanceHistory: data.performanceHistory || s.performanceHistory,
          });
          const ankiHistory = unionAnkiHistory(s.ankiHistory, data.ankiHistory || []);
          const next = {
            ...s,
            ...repaired.data,
            preferences: mergePreferences(data.preferences || s.preferences),
            studySessions: data.studySessions || s.studySessions,
            ankiHistory,
            semesters: data.semesters || s.semesters,
          };
          // Riscrivi sul cloud solo se abbiamo riparato i corsi o se il locale
          // aveva giorni Anki che il cloud non conosceva ancora
          needsCloudWrite = repaired.changed || ankiHistory.length !== (data.ankiHistory || []).length;

          // Salva solo in cache locale: NON ri-caricare sul cloud, altrimenti si
          // cancellerebbe un eventuale salvataggio locale in attesa (debounce).
          saveState({
            events: next.events,
            tasks: next.tasks,
            courses: next.courses,
            preferences: next.preferences,
            performanceHistory: next.performanceHistory,
            studySessions: next.studySessions,
            ankiHistory: next.ankiHistory,
            semesters: next.semesters,
          });
          return next;
        });
        if (needsCloudWrite) persist(get());
      };

      if (cloudData) {
        updateFromCloud(cloudData);
      }

      // Iscriviti ai cambiamenti in tempo reale per supportare il multi-device
      subscribeToCloud(user.id, (realtimeData) => {
        updateFromCloud(realtimeData);
      });

    } catch (error) {
      console.error("Failed to hydrate from cloud", error);
    }
  },

  saveSnapshot: () => {
    const state = get();
    const snap = JSON.stringify({
      events: state.events,
      tasks: state.tasks,
      courses: state.courses,
      preferences: state.preferences,
      studySessions: state.studySessions,
      semesters: state.semesters,
    });
    set((s) => ({ ...s, pastStates: [...s.pastStates, snap].slice(-10) }));
  },

  undo: () => {
    set((s) => {
      if (s.pastStates.length === 0) return s;
      const lastSnap = s.pastStates[s.pastStates.length - 1];
      const parsed = JSON.parse(lastSnap);
      const nextPast = s.pastStates.slice(0, -1);
      const next = { ...s, ...parsed, pastStates: nextPast };
      persist(next as AppState);
      return next;
    });
  },

  // ── Events ──
  addEvent: (event) => {
    get().saveSnapshot();
    set((s) => {
      if (isEventDuplicate(event, s.events)) {
        return s; // Skip duplicate
      }
      const next = { ...s, events: [...s.events, event] };
      persist(next as AppState);
      return next;
    });
  },

  addEvents: (events) => {
    set((s) => {
      const newEvents = events.filter(e => !isEventDuplicate(e, s.events));
      if (newEvents.length === 0) return s;
      const next = { ...s, events: [...s.events, ...newEvents] };
      persist(next as AppState);
      return next;
    });
  },

  updateEvent: (id, updates) => {
    get().saveSnapshot();
    set((s) => {
      const next = { ...s, events: s.events.map(e => e.id === id ? { ...e, ...updates } : e) };
      persist(next as AppState);
      return next;
    });
  },

  removeEvent: (id) => {
    get().saveSnapshot();
    set((s) => {
      const next = { ...s, events: s.events.filter(e => e.id !== id) };
      persist(next as AppState);
      return next;
    });
  },

  setEvents: (events) => {
    set((s) => {
      const next = { ...s, events };
      persist(next as AppState);
      return next;
    });
  },

  // ── Tasks ──
  addTask: (task) => {
    get().saveSnapshot();
    set((s) => {
      const next = { ...s, tasks: [...s.tasks, task] };
      persist(next as AppState);
      return next;
    });
  },

  addTasks: (tasks) => {
    set((s) => {
      const next = { ...s, tasks: deduplicateTasks([...s.tasks, ...tasks]) };
      persist(next as AppState);
      return next;
    });
  },

  updateTask: (id, updates) => {
    get().saveSnapshot();
    set((s) => {
      const next = { ...s, tasks: s.tasks.map(t => t.id === id ? { ...t, ...updates } : t) };
      persist(next as AppState);
      return next;
    });
  },

  removeTask: (id) => {
    get().saveSnapshot();
    set((s) => {
      const next = {
        ...s,
        tasks: s.tasks.filter(t => t.id !== id),
        studySessions: s.studySessions.filter(ss => ss.taskId !== id)
      };
      persist(next as AppState);
      return next;
    });
  },

  removeTasks: (ids) => {
    get().saveSnapshot();
    const idSet = new Set(ids);
    set((s) => {
      const next = {
        ...s,
        tasks: s.tasks.filter(t => !idSet.has(t.id)),
        studySessions: s.studySessions.filter(ss => !idSet.has(ss.taskId))
      };
      persist(next as AppState);
      return next;
    });
  },

  removeTasksByFilter: (filter) => {
    get().saveSnapshot();
    let count = 0;
    set((s) => {
      const remainingTasks = s.tasks.filter(t => {
        // Course filter
        if (filter.courseId && filter.courseId !== 'ALL' && t.courseId !== filter.courseId) return true;

        // Status filter
        if (filter.status && filter.status !== 'ALL') {
          if (filter.status === 'todo' && t.status === 'done') return true;
          if (filter.status === 'done' && t.status !== 'done') return true;
        }

        // AI enriched filter
        if (filter.onlyAiEnriched) {
          const isAi = t.isAiEnriched ||
            t.description?.includes('Argomento:') ||
            t.description?.includes('Capitoli/Libro:');
          if (!isAi) return true;
        }

        // Task type filter
        if (filter.taskType && filter.taskType !== 'ALL') {
          if (getTaskKind(t) !== filter.taskType) return true;
        }

        // If it matches all criteria, remove it!
        count++;
        return false;
      });

      const remainingIds = new Set(remainingTasks.map(t => t.id));
      const next = {
        ...s,
        tasks: remainingTasks,
        studySessions: s.studySessions.filter(ss => remainingIds.has(ss.taskId))
      };
      persist(next as AppState);
      return next;
    });
    return count;
  },

  completeTask: (id, actualMinutes, completionMode = 'normal', opts) => {
    get().saveSnapshot();
    set((s) => {
      const task = s.tasks.find(t => t.id === id);
      if (!task) return s;

      const nowDate = new Date();
      const now = nowDate.toISOString();
      const nowMs = nowDate.getTime();

      // Rilevamento automatico dei rinvii (Implicit Skip Detection):
      // Se l'utente completa un task più in basso nella lista ignorando i task
      // proposti in cima (negli obiettivi di oggi o con sessioni già passate oggi),
      // incrementa automaticamente `postponedCount` sui task saltati.
      const coursesMap = new Map(s.courses.map(c => [c.id, c]));
      const activeTasks = s.tasks.filter(t => t.status !== 'done' && !t.isPhantom);
      const sortedActive = PriorityEngine.sortTasks(
        activeTasks,
        coursesMap,
        s.events,
        s.preferences,
        s.performanceHistory
      );

      const completedIdx = sortedActive.findIndex(t => t.id === id);
      const skippedIds = new Set<string>();

      if (completedIdx > 0) {
        const doneIds = new Set(s.tasks.filter(t => t.status === 'done').map(t => t.id));
        const completedToday = s.tasks.filter(
          t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === nowDate.toDateString()
        ).length;
        const effectiveGoal = Math.max(1, s.selectedDailyGoalValue ?? s.preferences.dailyTaskGoal ?? 3);
        const remainingGoalSlots = Math.max(1, effectiveGoal - completedToday);

        const overdueScheduledIds = new Set(
          s.studySessions
            .filter(ss => !ss.isBuffer && new Date(ss.endTime).getTime() <= nowMs)
            .map(ss => ss.taskId)
        );

        for (let i = 0; i < completedIdx; i++) {
          const candidate = sortedActive[i];
          if (candidate.status !== 'todo') continue; // Non penalizzare task già "in_progress"
          const depsResolved = candidate.dependencies.every(depId => doneIds.has(depId));
          if (!depsResolved) continue;

          if (i < remainingGoalSlots || overdueScheduledIds.has(candidate.id)) {
            skippedIds.add(candidate.id);
          }
        }
      }

      // Ricostruzione finestra temporale a 4 livelli di confidenza (anche senza cliccare "Inizia")
      const timeWindow = HabitAnalysisEngine.reconstructStudyWindow(
        task,
        actualMinutes,
        completionMode,
        now,
        s.tasks,
        s.events,
        s.studySessions,
        opts
      );

      const nextTasks = s.tasks.map(t => {
        if (t.id === id) {
          return {
            ...t,
            status: 'done' as const,
            actualDuration: actualMinutes,
            completedAt: now,
            completionMode,
            startedAt: undefined,
            accumulatedTime: 0,
            inferredStartTime: timeWindow.inferredStartTime,
            timeConfidence: timeWindow.timeConfidence,
            durationConfidence: timeWindow.durationConfidence,
            wasDistracted: opts?.wasDistracted || false,
            isMultiDay: timeWindow.isMultiDay,
            wasScheduledSlotHit: timeWindow.wasScheduledSlotHit,
          };
        }
        if (skippedIds.has(t.id)) {
          return {
            ...t,
            postponedCount: (t.postponedCount || 0) + 1,
          };
        }
        return t;
      });

      const nextPerformanceHistory = task.courseId
        ? [
          ...s.performanceHistory,
          {
            courseId: task.courseId,
            taskId: id,
            estimatedMinutes: task.estimatedDuration,
            actualMinutes,
            completedAt: now,
            taskKind: getTaskKind(task),
            inferredStartTime: timeWindow.inferredStartTime,
            timeConfidence: timeWindow.timeConfidence,
            durationConfidence: timeWindow.durationConfidence,
            wasDistracted: opts?.wasDistracted || false,
            isMultiDay: timeWindow.isMultiDay,
            pauseCount: task.pauseCount || 0,
          },
        ]
        : s.performanceHistory;

      const next = {
        ...s,
        events: s.events.map(ev => {
          if (task.relatedEventId && ev.id === task.relatedEventId) {
            const k = getTaskKind(task);
            if (k === 'NOTES') return { ...ev, theoryDone: true };
            if (k === 'EXERCISES') return { ...ev, exerciseDone: true };
          }
          return ev;
        }),
        tasks: nextTasks,
        performanceHistory: nextPerformanceHistory,
      };
      persist(next as AppState);
      return next;
    });
  },

  setTasks: (tasks) => {
    set((s) => {
      const next = { ...s, tasks: deduplicateTasks(tasks) };
      persist(next as AppState);
      return next;
    });
  },

  // ── Courses ──
  addCourse: (course) => {
    get().saveSnapshot();
    set((s) => {
      const newCourse: Course = {
        ...course,
        isCustomName: course.isCustomName ?? true,
      };
      const next = { ...s, courses: [...s.courses, newCourse] };
      persist(next as AppState);
      return next;
    });
  },

  updateCourse: (id, updates) => {
    get().saveSnapshot();
    set((s) => {
      const nextCourses = s.courses.map(c => {
        if (c.id !== id) return c;
        const nameChanged = updates.name !== undefined && updates.name.trim() !== c.name;
        const isCustom = updates.isCustomName !== undefined
          ? updates.isCustomName
          : (nameChanged ? true : (c.isCustomName ?? false));
        const originalName = c.originalName || (nameChanged ? c.name : undefined);

        return {
          ...c,
          ...updates,
          name: updates.name ? updates.name.trim() : c.name,
          isCustomName: isCustom,
          originalName: originalName || c.originalName,
        };
      });

      const next = { ...s, courses: nextCourses };
      persist(next as AppState);
      return next;
    });
  },

  removeCourse: (id) => {
    get().saveSnapshot();
    set((s) => {
      const next = { ...s, courses: s.courses.filter(c => c.id !== id) };
      persist(next as AppState);
      return next;
    });
  },

  commitCourseImport: ({ course, events, tasks }) => {
    get().saveSnapshot();
    set((s) => {
      const exists = s.courses.some(c => c.id === course.id);
      const next = {
        ...s,
        courses: exists ? s.courses.map(c => (c.id === course.id ? course : c)) : [...s.courses, course],
        events,
        tasks: deduplicateTasks(tasks, events),
      };
      persist(next as AppState);
      return next;
    });
  },

  repairCourses: () => {
    const s = get();
    const result = repairCourseNames({
      courses: s.courses,
      events: s.events,
      tasks: s.tasks,
      performanceHistory: s.performanceHistory,
    });

    const deduplicatedTasks = deduplicateTasks(result.tasks, result.events);
    const tasksChanged = deduplicatedTasks.length !== s.tasks.length;

    if (result.changed || tasksChanged) {
      const next = {
        ...s,
        courses: result.courses,
        events: result.events,
        tasks: deduplicatedTasks,
        performanceHistory: result.performanceHistory,
      };
      set(next);
      saveState({
        events: next.events,
        tasks: next.tasks,
        courses: next.courses,
        preferences: next.preferences,
        performanceHistory: next.performanceHistory,
        studySessions: next.studySessions,
        ankiHistory: next.ankiHistory,
      });
      persist(next as AppState);
    }
    return { changed: result.changed || tasksChanged, count: result.repairedCount };
  },

  // ── Sessions ──
  setStudySessions: (sessions) => {
    set((s) => {
      const next = { ...s, studySessions: sessions };
      persist(next as AppState);
      return next;
    });
  },

  // ── Performance ──
  addPerformanceRecord: (record) => {
    set((s) => {
      const next = { ...s, performanceHistory: [...s.performanceHistory, record] };
      persist(next as AppState);
      return next;
    });
  },

  // ── Preferences ──
  updatePreferences: (prefs) => {
    set((s) => {
      const next = { ...s, preferences: { ...s.preferences, ...prefs } };
      persist(next as AppState);
      return next;
    });
  },

  // ── Anki ──
  recordAnkiSync: (today, reviewsByDay) => {
    set((s) => {
      const previous = s.ankiHistory.find(h => h.date === today.date);
      const merged = mergeAnkiHistory(s.ankiHistory, today, reviewsByDay);
      const nothingNew = isSameSnapshot(previous, merged.find(h => h.date === today.date)!)
        && merged.length === s.ankiHistory.length;
      if (nothingNew) return s; // Evita scritture inutili su cloud
      const next = { ...s, ankiHistory: merged };
      persist(next as AppState);
      return next;
    });
  },

  // ── Sync & Schedule ──
  syncAndSchedule: () => {
    get().saveSnapshot();
    const state = get();

    // 1. Generate tasks from past events
    const { updatedEvents, newTasks } = TaskManager.generateTasksFromPastEvents(state.events, state.courses, state.tasks);
    // Riallinea titolo/descrizione dei task di lezione agli argomenti correnti degli eventi (es. importati da AI)
    const refreshed = refreshLessonTasks([...state.tasks, ...newTasks], updatedEvents, state.courses);
    const allTasks = refreshed.tasks;

    // 1.5 Future Workload Projection — predict tasks from upcoming lessons
    const futureProjection = FutureProjectionEngine.project(
      updatedEvents,
      state.courses,
      allTasks,
      state.performanceHistory,
      14 // Project 14 days ahead
    );

    // 2. Sort/Prioritize tasks (now with future workload awareness)
    const coursesMap = new Map(state.courses.map(c => [c.id, c]));
    const activeTasks = allTasks.filter(t => t.status !== 'done');
    const sortedActiveTasks = PriorityEngine.sortTasks(
      activeTasks,
      coursesMap,
      updatedEvents,
      state.preferences,
      state.performanceHistory,
      futureProjection
    );

    const finalTasks = [
      ...sortedActiveTasks,
      ...allTasks.filter(t => t.status === 'done')
    ];

    // 3. Schedule sessions
    const travelEvents = TravelManager.generateTravelEvents(updatedEvents, state.preferences);
    const mealEvents = MealManager.generateMealEvents(state.preferences, new Date(), 14);
    const allEventsForScheduling = [...updatedEvents, ...travelEvents, ...mealEvents];

    const sessions = SchedulerEngine.generateSchedule(
      sortedActiveTasks,
      allEventsForScheduling,
      state.preferences,
      new Date(),
      14, // Schedule for next 14 days
      state.performanceHistory,
      futureProjection
    );

    set((s) => {
      const next = {
        ...s,
        events: updatedEvents,
        tasks: finalTasks,
        studySessions: sessions
      };
      persist(next as AppState);
      return next;
    });
  },

  // ── Cleanup Duplicates ──
  cleanupDuplicates: () => {
    get().saveSnapshot();
    const state = get();
    const cleanedTasks = deduplicateTasks(state.tasks, state.events);
    const cleanedEvents = deduplicateEventsList(state.events);
    const removedTasks = state.tasks.length - cleanedTasks.length;
    const removedEvents = state.events.length - cleanedEvents.length;

    if (removedTasks > 0 || removedEvents > 0) {
      set((s) => {
        const next = {
          ...s,
          tasks: cleanedTasks,
          events: cleanedEvents,
        };
        saveState({
          events: next.events,
          tasks: next.tasks,
          courses: next.courses,
          preferences: next.preferences,
          performanceHistory: next.performanceHistory,
          studySessions: next.studySessions,
          ankiHistory: next.ankiHistory,
        });
        persist(next as AppState);
        return next;
      });
    }
    return { removedTasks, removedEvents };
  },

  setLessonTrackDone: (eventId, track, done) => {
    get().saveSnapshot();
    set((s) => {
      const targetEvent = s.events.find(e => e.id === eventId);
      if (!targetEvent) return s;

      const wantedKind = track === 'theory' ? 'NOTES' : 'EXERCISES';
      const nowIso = new Date().toISOString();

      const nextEvents = s.events.map(e => {
        if (e.id !== eventId) return e;
        return track === 'theory'
          ? { ...e, theoryDone: done, isDone: done ? true : e.isDone }
          : { ...e, exerciseDone: done, isDone: done ? true : e.isDone };
      });

      // Aggiorna o rimuove i task pendenti associati a questa lezione senza inquinare performanceHistory
      const removedTaskIds = new Set<string>();
      const nextTasks = s.tasks
        .filter(t => {
          if (done && track === 'theory' && getTaskKind(t) === 'FOLLOW_LESSON' && t.status !== 'done' && taskBelongsToEvent(t, targetEvent)) {
            removedTaskIds.add(t.id);
            return false;
          }
          return true;
        })
        .map(t => {
          if (getTaskKind(t) === wantedKind && taskBelongsToEvent(t, targetEvent)) {
            if (done && t.status !== 'done') {
              return { ...t, status: 'done' as const, completedAt: nowIso, completionMode: 'normal' as const };
            }
            if (!done && t.status === 'done') {
              return { ...t, status: 'todo' as const, completedAt: undefined };
            }
          }
          return t;
        });

      const next = {
        ...s,
        events: nextEvents,
        tasks: nextTasks,
        studySessions: s.studySessions.filter(ss => !removedTaskIds.has(ss.taskId)),
      };
      persist(next as AppState);
      return next;
    });
  },

  setCourseCheckpoint: (courseId, track, upToEventId) => {
    get().saveSnapshot();
    let markedLessons = 0;
    let removedTasks = 0;

    set((s) => {
      const course = s.courses.find(c => c.id === courseId);
      if (!course) return s;

      const courseEvents = s.events
        .filter(e =>
          e.type === 'lesson' &&
          (e.courseId === course.id || (!e.courseId && e.title?.toLowerCase().includes(course.name.toLowerCase())))
        )
        .filter(e => {
          const tracks = getLessonTracks(e, course);
          return track === 'theory' ? tracks.hasTheory : tracks.hasExercise;
        })
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      const targetIdx = upToEventId ? courseEvents.findIndex(e => e.id === upToEventId) : -1;
      const doneEventIds = new Set<string>(
        targetIdx >= 0 ? courseEvents.slice(0, targetIdx + 1).map(e => e.id) : []
      );
      const trackEventIds = new Set<string>(courseEvents.map(e => e.id));

      markedLessons = doneEventIds.size;

      const nextEvents = s.events.map(e => {
        if (!trackEventIds.has(e.id)) return e;
        const isCovered = doneEventIds.has(e.id);
        return track === 'theory'
          ? { ...e, courseId: e.courseId || course.id, theoryDone: isCovered, isDone: isCovered ? true : e.isDone }
          : { ...e, courseId: e.courseId || course.id, exerciseDone: isCovered, isDone: isCovered ? true : e.isDone };
      });

      const wantedKind = track === 'theory' ? 'NOTES' : 'EXERCISES';
      const coveredEvents = courseEvents.filter(e => doneEventIds.has(e.id));

      const removedTaskIds = new Set<string>();
      const nextTasks = s.tasks.filter(t => {
        if (t.status === 'done' || t.courseId !== course.id) return true;
        const k = getTaskKind(t);
        const matchesCovered = coveredEvents.some(ev => taskBelongsToEvent(t, ev));
        if (!matchesCovered) return true;

        if (k === wantedKind || (track === 'theory' && k === 'FOLLOW_LESSON')) {
          removedTaskIds.add(t.id);
          removedTasks++;
          return false;
        }
        return true;
      });

      const next = {
        ...s,
        events: nextEvents,
        tasks: nextTasks,
        studySessions: s.studySessions.filter(ss => !removedTaskIds.has(ss.taskId)),
      };
      persist(next as AppState);
      return next;
    });

    return { markedLessons, removedTasks };
  },

  cleanupNoisyTasks: (opts) => {
    get().saveSnapshot();
    const removeFollow = opts?.removeFollowLessonTasks ?? true;
    const removeOrphan = opts?.removeOrphanLessonTasks ?? true;
    const doDedup = opts?.deduplicate ?? true;

    const state = get();
    const cleanedEvents = doDedup ? deduplicateEventsList(state.events) : state.events;
    const eventById = new Map(cleanedEvents.map(e => [e.id, e]));
    const courseIds = new Set(state.courses.map(c => c.id));

    let workingTasks = doDedup ? deduplicateTasks(state.tasks, cleanedEvents) : [...state.tasks];

    workingTasks = workingTasks.filter(t => {
      if (t.status === 'done') return true; // Non toccare mai i task già completati

      const kind = getTaskKind(t);
      if (removeFollow && kind === 'FOLLOW_LESSON') {
        return false;
      }

      if (removeOrphan && (kind === 'FOLLOW_LESSON' || kind === 'NOTES' || kind === 'EXERCISES')) {
        if (t.courseId && !courseIds.has(t.courseId)) return false;
        if (t.relatedEventId && !eventById.has(t.relatedEventId)) {
          // Verifica se esiste un evento lezione nello stesso giorno per quel corso
          const hasMatchingDay = cleanedEvents.some(
            e => e.type === 'lesson' && e.courseId === t.courseId && taskBelongsToEvent(t, e)
          );
          if (!hasMatchingDay) return false;
        }
        // Se la lezione collegata è già segnata come completata su quel binario, rimuovi il task pendente ridondante
        const ev = t.relatedEventId
          ? eventById.get(t.relatedEventId)
          : cleanedEvents.find(e => e.type === 'lesson' && e.courseId === t.courseId && taskBelongsToEvent(t, e));
        if (ev) {
          if (kind === 'NOTES' && ev.theoryDone) return false;
          if (kind === 'EXERCISES' && ev.exerciseDone) return false;
        }
      }

      return true;
    });

    const removedTasks = state.tasks.length - workingTasks.length;
    const removedEvents = state.events.length - cleanedEvents.length;

    if (removedTasks > 0 || removedEvents > 0) {
      const remainingIds = new Set(workingTasks.map(t => t.id));
      set((s) => {
        const next = {
          ...s,
          events: cleanedEvents,
          tasks: workingTasks,
          studySessions: s.studySessions.filter(ss => remainingIds.has(ss.taskId)),
        };
        persist(next as AppState);
        return next;
      });
    }

    return { removedTasks, removedEvents };
  },

  resetAllData: (opts) => {
    get().saveSnapshot();
    const state = get();
    const nextCourses = opts?.keepCourses ? state.courses : [];
    const nextHistory = opts?.keepHistory ? state.performanceHistory : [];
    const nextAnki = opts?.keepHistory ? state.ankiHistory : [];

    const next: Partial<AppState> = {
      events: [],
      tasks: [],
      courses: nextCourses,
      studySessions: [],
      performanceHistory: nextHistory,
      ankiHistory: nextAnki,
      semesters: [],
    };

    set((s) => {
      const updated = { ...s, ...next };
      saveState({
        events: updated.events,
        tasks: updated.tasks,
        courses: updated.courses,
        preferences: updated.preferences,
        performanceHistory: updated.performanceHistory,
        studySessions: updated.studySessions,
        ankiHistory: updated.ankiHistory,
        semesters: updated.semesters,
      });
      persist(updated as AppState);
      return updated;
    });
  },
  // ── Semesters ──
  addSemester: (name) => {
    get().saveSnapshot();
    set((s) => {
      const newSem = SemesterManager.createInitial(name);
      const updated = s.semesters.map(sm => sm.status === 'active' ? { ...sm, status: 'archived' as const } : sm);
      const next = { ...s, semesters: [...updated, newSem] };
      persist(next as AppState);
      return next;
    });
  },

  closeActiveSemester: (opts) => {
    get().saveSnapshot();
    const state = get();
    const active = SemesterManager.getActive(state.semesters);
    const res = SemesterManager.close(
      state.courses,
      state.events,
      state.tasks,
      state.studySessions,
      opts
    );

    set((s) => {
      let foundActive = false;
      const updatedSemesters = s.semesters.map(sm => {
        if (sm.status === 'active' || (active && sm.id === active.id)) {
          foundActive = true;
          return {
            ...sm,
            status: 'archived' as const,
            endDate: new Date().toISOString(),
            archive: res.archive
          };
        }
        return sm;
      });

      if (!foundActive) {
        updatedSemesters.push({
          id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : String(Date.now()),
          name: SemesterManager.suggestName(),
          startDate: new Date(Date.now() - 90 * 86400000).toISOString(),
          endDate: new Date().toISOString(),
          status: 'archived',
          archive: res.archive
        });
      }

      const next = {
        ...s,
        courses: res.courses,
        events: res.events,
        tasks: res.tasks,
        studySessions: res.studySessions,
        semesters: updatedSemesters
      };
      persist(next as AppState);
      return next;
    });

    return res;
  },

  setSemesters: (semesters) => {
    set((s) => {
      const next = { ...s, semesters };
      persist(next as AppState);
      return next;
    });
  },

}));
