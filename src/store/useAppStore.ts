import { create } from 'zustand';
import type { Task, Course, CalendarEvent, UserPreferences, StudySession, PerformanceRecord, AppUser, DayStudyHours, AnkiDaySnapshot } from '../core/types';
import { saveState, loadState } from '../core/persistence';
import { TaskManager } from '../core/TaskManager';
import { PriorityEngine } from '../core/PriorityEngine';
import { SchedulerEngine } from '../core/SchedulerEngine';
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
  defaultCommuteTimeMinutes: 45,
  isCommuteProductive: false,
  ankiAverageTimeSeconds: 15,
  geminiApiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || '',
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
    ankiAverageTimeSeconds: p.ankiAverageTimeSeconds ?? 15,
    geminiApiKey: p.geminiApiKey || defaultPreferences.geminiApiKey,
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
  completeTask: (id: string, actualMinutes: number, completionMode?: 'attended' | 'recovered' | 'normal') => void;
  
  // Courses
  addCourse: (course: Course) => void;
  updateCourse: (id: string, updates: Partial<Course>) => void;
  removeCourse: (id: string) => void;
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

  // Cleanup
  cleanupDuplicates: () => { removedTasks: number; removedEvents: number };

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
  pastStates: [],

  selectedDailyGoalType: null,
  selectedDailyGoalValue: null,
  setDailyGoal: (type, value) => set({ selectedDailyGoalType: type, selectedDailyGoalValue: value }),

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
          const lower = t.title.toLowerCase();
          const isNotes = lower.includes('appunti') || lower.includes('notes') || lower.includes('ripasso');
          const isExercises = lower.includes('eserciz');
          const isFollow = lower.includes('seguire') || lower.includes('recuperare');
          if (filter.taskType === 'NOTES' && !isNotes) return true;
          if (filter.taskType === 'EXERCISES' && !isExercises) return true;
          if (filter.taskType === 'FOLLOW_LESSON' && !isFollow) return true;
          if (filter.taskType === 'PROJECT' && !t.isProjectTask) return true;
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
}));
