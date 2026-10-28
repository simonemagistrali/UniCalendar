import type { Task, LessonType } from './types';

/**
 * Quali task di studio genera una lezione, in base al suo tipo:
 * - teoria            → appunti (se il corso li prevede), mai esercizi
 * - esercitazione/lab → esercizi (a meno che l'evento li disattivi esplicitamente), mai appunti
 * - teoria+esercizi   → secondo le preferenze del corso
 * - tipo sconosciuto  → comportamento storico (preferenze del corso)
 */
export function lessonTaskNeeds(
  lessonType: LessonType | undefined,
  prefs: { requiresNotesRevision: boolean; requiresExercises: boolean },
  hasEventOverride: boolean = false
): { notes: boolean; exercises: boolean } {
  switch (lessonType) {
    case 'theory':
      return { notes: prefs.requiresNotesRevision, exercises: false };
    case 'exercise':
    case 'lab':
      return { notes: false, exercises: hasEventOverride ? prefs.requiresExercises : true };
    default:
      return { notes: prefs.requiresNotesRevision, exercises: prefs.requiresExercises };
  }
}

/**
 * Tipologia di un task. Unico punto in cui il tipo viene dedotto
 * (in precedenza la stessa logica basata sul titolo era duplicata in più file).
 */
export type TaskKind = 'PROJECT' | 'FOLLOW_LESSON' | 'NOTES' | 'EXERCISES' | 'OTHER';

export function getTaskKind(task: Pick<Task, 'title' | 'isProjectTask'>): TaskKind {
  if (task.isProjectTask) return 'PROJECT';
  const t = task.title.toLowerCase();
  if (t.startsWith('seguire/recuperare') || t.includes('recuperare:') || t.includes('seguire')) return 'FOLLOW_LESSON';
  if (t.startsWith('sistemare appunti') || t.includes('appunti:') || t.startsWith('ripasso:') || t.includes('notes')) return 'NOTES';
  if (t.startsWith('esercizi') || t.includes('esercizi:') || t.includes('eserciz')) return 'EXERCISES';
  return 'OTHER';
}

export function isLessonRecoveryTask(task: Pick<Task, 'title' | 'isProjectTask'>): boolean {
  return getTaskKind(task) === 'FOLLOW_LESSON';
}
