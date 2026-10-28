import type { Task } from './types';

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
