/**
 * Dati di esempio relativi alla data odierna, per provare il server senza account.
 */
import type { CalendarEvent, Course, StudySession, Task } from '../../src/core/types.ts';
import type { UserData } from './data.ts';

function at(dayOffset: number, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function buildDemoData(): UserData {
  const courses: Course[] = [
    {
      id: 'c-analisi', name: 'Analisi Matematica', difficulty: 8, color: '#ef4444',
      defaultStudyPreferences: { requiresNotesRevision: true, requiresExercises: true, estimatedRevisionTimePerLesson: 45 },
    },
    {
      id: 'c-fisica', name: 'Fisica Generale', difficulty: 7, color: '#3b82f6',
      defaultStudyPreferences: { requiresNotesRevision: true, requiresExercises: true, estimatedRevisionTimePerLesson: 40 },
    },
    {
      id: 'c-db', name: 'Basi di Dati', difficulty: 5, color: '#10b981',
      defaultStudyPreferences: { requiresNotesRevision: true, requiresExercises: false, estimatedRevisionTimePerLesson: 30 },
    },
  ];

  const lesson = (id: string, title: string, courseId: string, off: number, s: string, e: string): CalendarEvent => ({
    id, title, type: 'lesson', courseId, startTime: at(off, s), endTime: at(off, e),
    isDone: off < 0, lessonType: 'theory', location: { type: 'in_person', address: 'Aula 2.1' },
  });

  const events: CalendarEvent[] = [
    lesson('e1', 'Analisi: Limiti e continuità', 'c-analisi', -3, '09:00', '11:00'),
    lesson('e2', 'Fisica: Cinematica', 'c-fisica', -2, '11:15', '13:15'),
    lesson('e3', 'Basi di Dati: Algebra relazionale', 'c-db', -1, '14:00', '16:00'),
    lesson('e4', 'Analisi: Derivate', 'c-analisi', 1, '09:00', '11:00'),
    lesson('e5', 'Fisica: Dinamica', 'c-fisica', 2, '11:15', '13:15'),
    lesson('e6', 'Basi di Dati: SQL', 'c-db', 3, '14:00', '16:00'),
    {
      id: 'e7', title: 'Esame Basi di Dati', type: 'exam', courseId: 'c-db',
      startTime: at(14, '09:00'), endTime: at(14, '12:00'), isDone: false,
    },
    {
      id: 'e8', title: 'Quiz Fisica', type: 'quiz', courseId: 'c-fisica',
      startTime: at(6, '15:00'), endTime: at(6, '16:00'), isDone: false,
    },
  ];

  const task = (p: Partial<Task> & Pick<Task, 'id' | 'title'>): Task => ({
    status: 'todo', priorityScore: 50, estimatedDuration: 60, createdAt: at(-4, '08:00'),
    dependencies: [], postponedCount: 0, ...p,
  });

  const tasks: Task[] = [
    task({ id: 't1', title: 'Rivedere appunti: Limiti e continuità', courseId: 'c-analisi', relatedEventId: 'e1', status: 'done', completedAt: at(-2, '18:00'), actualDuration: 50 }),
    task({ id: 't2', title: 'Esercizi: Limiti', courseId: 'c-analisi', relatedEventId: 'e1', estimatedDuration: 90, priorityScore: 80 }),
    task({ id: 't3', title: 'Rivedere appunti: Cinematica', courseId: 'c-fisica', relatedEventId: 'e2', estimatedDuration: 45, priorityScore: 70 }),
    task({ id: 't4', title: 'Esercizi: Cinematica', courseId: 'c-fisica', relatedEventId: 'e2', estimatedDuration: 60, deadline: at(5, '23:59') }),
    task({ id: 't5', title: 'Rivedere appunti: Algebra relazionale', courseId: 'c-db', relatedEventId: 'e3', status: 'done', completedAt: at(0, '10:00'), actualDuration: 35 }),
    task({ id: 't6', title: 'Preparazione esame Basi di Dati (ripasso)', courseId: 'c-db', assessmentPrep: true, assessmentPhase: 'review', estimatedDuration: 120, deadline: at(13, '23:59'), priorityScore: 90 }),
  ];

  const studySessions: StudySession[] = [
    { id: 's1', taskId: 't2', startTime: at(0, '16:00'), endTime: at(0, '17:30'), isBuffer: false },
    { id: 's2', taskId: 't3', startTime: at(1, '14:00'), endTime: at(1, '14:45'), isBuffer: false },
  ];

  const dailyStudyHours: Record<number, { enabled: boolean; start: string; end: string; lunchBreak?: { enabled: boolean; start: string; end: string } }> = {};
  for (let d = 0; d < 7; d++) {
    dailyStudyHours[d] = {
      enabled: d !== 0,
      start: '09:00',
      end: d === 6 ? '13:00' : '19:00',
      lunchBreak: { enabled: true, start: '13:00', end: '14:00' },
    };
  }

  return {
    tasks, events, courses, studySessions, ankiHistory: [], semesters: [],
    preferences: { dailyStudyHours, dailyTaskGoal: 3 },
    source: 'demo',
  };
}
