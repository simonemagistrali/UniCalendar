/**
 * Persistence layer — saves/loads app state to/from localStorage.
 * Minimal overhead, only serializes what's needed.
 */

const STORAGE_KEY = 'unicalendar_state';

export interface PersistedState {
  events: unknown[];
  tasks: unknown[];
  courses: unknown[];
  preferences: unknown;
  performanceHistory: unknown[];
  studySessions: unknown[];
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('UniCalendar: Failed to save state', e);
  }
}

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch (e) {
    console.warn('UniCalendar: Failed to load state', e);
    return null;
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}
