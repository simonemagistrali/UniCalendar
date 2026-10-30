import { useAppStore } from '../../../store/useAppStore';
import type { Course, CourseInfo } from '../../../core/types';

/** Restituisce una funzione che aggiorna (merge) la scheda del corso e la salva. */
export function useInfoPatch(course: Course) {
  const updateCourse = useAppStore(s => s.updateCourse);
  return (patch: Partial<CourseInfo>) => {
    // Legge sempre la versione più recente dallo store: più modifiche ravvicinate non si sovrascrivono
    const latest = useAppStore.getState().courses.find(c => c.id === course.id) ?? course;
    updateCourse(course.id, { info: { ...(latest.info ?? {}), ...patch, updatedAt: new Date().toISOString() } });
  };
}

export function fmtDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

