import { create } from 'zustand';
import type { Task, Course, CalendarEvent, UserPreferences, StudySession, PerformanceRecord, AppUser, DayStudyHours } from '../core/types';
import { saveState, loadState } from '../core/persistence';
import { TaskManager } from '../core/TaskManager';
import { PriorityEngine } from '../core/PriorityEngine';
import { SchedulerEngine } from '../core/SchedulerEngine';
import { TravelManager } from '../core/TravelManager';
import { MealManager } from '../core/MealManager';
import { FutureProjectionEngine } from '../core/FutureProjectionEngine';
import { persistState, loadFromCloud } from '../core/syncManager';

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
  defaultCommuteTimeMinutes: 45,
  isCommuteProductive: false,
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
    defaultHomeAddress: p.defaultHomeAddress,
    defaultCommuteTimeMinutes: p.defaultCommuteTimeMinutes ?? 45,
    isCommuteProductive: p.isCommuteProductive ?? false,
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

  // User Actions
  setUser: (user: AppUser | null) => void;
  initializeUser: (user: AppUser) => Promise<void>;
  
  
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
  completeTask: (id: string, actualMinutes: number, completionMode?: 'attended' | 'recovered' | 'normal') => void;
  
  // Courses
  addCourse: (course: Course) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  removeCourse: (id: string) => void;
  
  // Sessions
  setStudySessions: (sessions: StudySession[]) => void;
  
  // Performance
  addPerformanceRecord: (record: PerformanceRecord) => void;
  
  // Preferences
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  
  // Bulk
  setEvents: (events: CalendarEvent[]) => void;
  setTasks: (tasks: Task[]) => void;
  
  // Sync
  syncAndSchedule: () => void;

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
  }, state.user?.id || null);
}

/* ─── Deduplicate Tasks Helper ─── */
function deduplicateTasks(tasks: Task[]): Task[] {
  const uniqueMap = new Map<string, Task>();
  for (const t of tasks) {
    const key = `${t.courseId}-${t.title}`;
    if (uniqueMap.has(key)) {
      const existing = uniqueMap.get(key)!;
      // Prefer keeping 'done' tasks over 'todo'
      if (existing.status !== 'done' && t.status === 'done') {
        uniqueMap.set(key, t);
      }
    } else {
      uniqueMap.set(key, t);
    }
  }
  return Array.from(uniqueMap.values());
}

/* ─── Deduplicate Events Helper ─── */
function isEventDuplicate(newEvent: CalendarEvent, existingEvents: CalendarEvent[]): boolean {
  if (newEvent.sourceCalendarId && existingEvents.some(e => e.sourceCalendarId === newEvent.sourceCalendarId)) {
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

/* ─── Load initial state ─── */
const saved = loadState();

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  events: (saved?.events as CalendarEvent[]) || [],
  tasks: deduplicateTasks((saved?.tasks as Task[]) || []),
  courses: (saved?.courses as Course[]) || [],
  preferences: mergePreferences(saved?.preferences),
  studySessions: (saved?.studySessions as StudySession[]) || [],
  performanceHistory: (saved?.performanceHistory as PerformanceRecord[]) || [],
  pastStates: [],

  setUser: (user) => {
    set({ user });
  },

  initializeUser: async (user) => {
    set({ user });
    
    try {
      console.log("[Sync] Tentativo di caricamento dati per:", user.id);
      const cloudData = await loadFromCloud(user.id);
      console.log("[Sync] Dati ricevuti dal cloud:", cloudData);
      
      if (cloudData) {
        set((s) => {
          const next = {
            ...s,
            events: cloudData.events || s.events,
            tasks: deduplicateTasks(cloudData.tasks || s.tasks),
            courses: cloudData.courses || s.courses,
            preferences: mergePreferences(cloudData.preferences || s.preferences),
            studySessions: cloudData.studySessions || s.studySessions,
            performanceHistory: cloudData.performanceHistory || s.performanceHistory,
          };
          
          // Forza il salvataggio locale per cache
          setTimeout(() => persist(next as AppState), 500);
          return next;
        });
      }
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
    get().saveSnapshot();
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
    get().saveSnapshot();
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
    get().saveSnapshot();
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
      const next = { ...s, tasks: s.tasks.filter(t => t.id !== id) };
      persist(next as AppState);
      return next;
    });
  },

  completeTask: (id, actualMinutes, completionMode = 'normal') => {
    get().saveSnapshot();
    const state = get();
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;

    const now = new Date().toISOString();

    // Record performance
    if (task.courseId) {
      state.addPerformanceRecord({
        courseId: task.courseId,
        taskId: id,
        estimatedMinutes: task.estimatedDuration,
        actualMinutes,
        completedAt: now,
      });
    }

    state.updateTask(id, {
      status: 'done',
      actualDuration: actualMinutes,
      completedAt: now,
      completionMode,
    });
  },

  setTasks: (tasks) => {
    get().saveSnapshot();
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
      const next = { ...s, courses: [...s.courses, course] };
      persist(next as AppState);
      return next;
    });
  },

  updateCourse: (id, updates) => {
    get().saveSnapshot();
    set((s) => {
      const next = { ...s, courses: s.courses.map(c => c.id === id ? { ...c, ...updates } : c) };
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

  // ── Sync & Schedule ──
  syncAndSchedule: () => {
    get().saveSnapshot();
    const state = get();
    
    // 1. Generate tasks from past events
    const { updatedEvents, newTasks } = TaskManager.generateTasksFromPastEvents(state.events, state.courses, state.tasks);
    const allTasks = [...state.tasks, ...newTasks];

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
}));
