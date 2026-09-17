import { create } from 'zustand';
import { Task, Course, CalendarEvent, UserPreferences } from '../core/types';

interface AppState {
  tasks: Task[];
  courses: Course[];
  events: CalendarEvent[];
  preferences: UserPreferences;
  user: { name: string; email: string; photoURL: string } | null;
  
  // Actions
  setUser: (user: AppState['user']) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  addEvent: (event: CalendarEvent) => void;
  addCourse: (course: Course) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
}

const defaultPreferences: UserPreferences = {
  studyHours: { start: "08:00", end: "18:00" },
  forbiddenDays: [0], // 0 = Sunday
  daysBeforeExamToIncreasePriority: 14,
};

export const useAppStore = create<AppState>((set) => ({
  tasks: [],
  courses: [],
  events: [],
  preferences: defaultPreferences,
  user: null,

  setUser: (user) => set({ user }),
  
  addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
  
  updateTask: (taskId, updates) => set((state) => ({
    tasks: state.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
  })),

  addEvent: (event) => set((state) => ({ events: [...state.events, event] })),
  
  addCourse: (course) => set((state) => ({ courses: [...state.courses, course] })),

  updatePreferences: (prefs) => set((state) => ({
    preferences: { ...state.preferences, ...prefs }
  })),
}));
