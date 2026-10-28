import { v4 as uuidv4 } from 'uuid';
import type { CalendarEvent, Course, Task, UserPreferences } from './types';
import { HabitAnalysisEngine } from './HabitAnalysisEngine';

/**
 * AssessmentPlanner — preparazione a ritroso (backward planning) per esami e quiz,
 * più ricalibrazione dei progetti.
 *
 * Basi: la preparazione si ancora alla data della verifica e si divide in fasi
 * (ripasso → esercizi → simulazioni cronometrate → ripasso leggero finale).
 * I quiz generano solo un ripasso mirato leggero (disattivabile nelle impostazioni).
 */
export class AssessmentPlanner {
  static readonly DEFAULT_EXAM_PREP_DAYS = 21;

  /** Task di preparazione mancanti per le verifiche future. Non tocca quelli già esistenti. */
  static generatePrepTasks(
    events: CalendarEvent[],
    courses: Course[],
    existingTasks: Task[],
    prefs: UserPreferences,
    now: number = Date.now()
  ): Task[] {
    const out: Task[] = [];
    const haveFor = new Set(
      existingTasks.filter(t => t.assessmentPrep && t.relatedEventId).map(t => t.relatedEventId as string)
    );

    // Calcola la ritenzione mnemonica (Curva dell'Oblio di Ebbinghaus) sui topic studiati
    const allTopicRetentions = HabitAnalysisEngine.computeTopicRetention(courses, events, existingTasks, [], now);

    for (const ev of events) {
      if (ev.type !== 'exam' && ev.type !== 'quiz') continue;
      if (!ev.courseId) continue;
      const startMs = new Date(ev.startTime).getTime();
      if (startMs <= now) continue;
      if (haveFor.has(ev.id)) continue;
      if (ev.type === 'quiz' && prefs.autoQuizPrep === false) continue;

      const course = courses.find(c => c.id === ev.courseId);
      if (!course) continue;

      const courseDecayedTopics = allTopicRetentions
        .filter(tr => tr.courseId === course.id && tr.retentionPct < 80)
        .slice(0, 4)
        .map(tr => `${tr.topic} (${tr.retentionPct}%)`);
      const decayedTopicsHint =
        courseDecayedTopics.length > 0
          ? `\nPriorità Ebbinghaus (temi più lontani): ${courseDecayedTopics.join(', ')}.`
          : '';

      const daysLeft = (startMs - now) / 86400000;
      const label = ev.title;
      const hasExercises = course.defaultStudyPreferences.requiresExercises;
      const created = new Date(now).toISOString();
      let order = 0;

      const make = (
        title: string,
        minutes: number,
        phase: NonNullable<Task['assessmentPhase']>,
        description: string
      ): Task => ({
        id: uuidv4(),
        title,
        description,
        courseId: ev.courseId,
        relatedEventId: ev.id,
        status: 'todo',
        priorityScore: 0,
        estimatedDuration: minutes,
        // Offset di 1 ms per mantenere l'ordine delle fasi nella modalità "più vecchi prima"
        createdAt: new Date(new Date(created).getTime() + order++).toISOString(),
        deadline: ev.startTime,
        dependencies: [],
        postponedCount: 0,
        assessmentPrep: true,
        assessmentPhase: phase,
      });

      if (ev.type === 'quiz') {
        out.push(make(`Ripasso quiz: ${label}`, 45, 'review', `Ripasso mirato degli argomenti del quiz (richiamo attivo, senza rileggere passivamente).${decayedTopicsHint}`));
        if (daysLeft >= 4) {
          out.push(make(`Ripasso quiz (2): ${label}`, 30, 'final', 'Secondo passaggio leggero, a distanza di qualche giorno dal primo.'));
        }
        continue;
      }

      const window = Math.max(3, prefs.examPrepDays ?? this.DEFAULT_EXAM_PREP_DAYS);
      const usable = Math.min(daysLeft, window);

      const reviews = usable >= 14 ? 3 : usable >= 7 ? 2 : 1;
      const exerciseSessions = usable >= 14 ? 2 : 1;
      const mocks = usable >= 14 ? 2 : usable >= 5 ? 1 : 0;

      for (let i = 1; i <= reviews; i++) {
        out.push(make(
          `Ripasso teoria (${i}/${reviews}): ${label}`,
          90,
          'review',
          `Richiamo attivo: chiudi gli appunti, scrivi ciò che ricordi e poi verifica.${i === 1 ? decayedTopicsHint : ''}`
        ));
      }
      if (hasExercises || exerciseSessions > 0) {
        for (let i = 1; i <= exerciseSessions; i++) {
          out.push(make(
            `Esercizi misti (${i}/${exerciseSessions}): ${label}`,
            90,
            'exercises',
            'Mescola tipi di problema di capitoli diversi (interleaving) invece di ripetere lo stesso tipo.'
          ));
        }
      }
      for (let i = 1; i <= mocks; i++) {
        out.push(make(
          `Simulazione d'esame (${i}/${mocks}): ${label}`,
          120,
          'mock',
          'Prova passata in condizioni reali (tempo e senza appunti). Annota gli errori: concetto, calcolo o strategia?'
        ));
      }
      out.push(make(`Ripasso leggero finale: ${label}`, 30, 'final', 'Solo formule e concetti chiave. Poi riposa.'));
    }

    return out;
  }

  /**
   * Task di preparazione ancora aperti per verifiche già passate: vanno archiviati (rimossi dalla lista).
   * Restituisce gli id da rimuovere.
   */
  static expiredPrepTaskIds(tasks: Task[], now: number = Date.now()): string[] {
    return tasks
      .filter(t => t.assessmentPrep && t.status !== 'done' && t.deadline && new Date(t.deadline).getTime() < now)
      .map(t => t.id);
  }

  /**
   * Ricalibra le sessioni dei progetti: se hai saltato/anticipato lavoro, le sessioni future
   * vengono ridimensionate in modo che il totale rimanente = ore totali − ore già fatte.
   * Ritorna la lista task aggiornata, o null se non serve cambiare nulla.
   */
  static recalibrateProjectTasks(events: CalendarEvent[], tasks: Task[], now: number = Date.now()): Task[] | null {
    let changed = false;
    let next = tasks;

    for (const ev of events) {
      if (ev.type !== 'project_deadline' || !ev.projectTotalHours) continue;
      if (new Date(ev.startTime).getTime() <= now) continue;

      const projectTasks = next.filter(t => t.isProjectTask && t.relatedEventId === ev.id);
      const todo = projectTasks.filter(t => t.status !== 'done');
      if (todo.length === 0) continue;

      const doneMinutes = projectTasks
        .filter(t => t.status === 'done')
        .reduce((s, t) => s + (t.actualDuration ?? t.estimatedDuration), 0);
      const remainingTarget = Math.max(30, ev.projectTotalHours * 60 - doneMinutes);
      const todoMinutes = todo.reduce((s, t) => s + t.estimatedDuration, 0);
      if (todoMinutes <= 0) continue;

      const factor = remainingTarget / todoMinutes;
      // Tolleranza del 15% per evitare continui piccoli aggiustamenti
      if (Math.abs(factor - 1) < 0.15) continue;

      const ids = new Set(todo.map(t => t.id));
      next = next.map(t =>
        ids.has(t.id)
          ? { ...t, estimatedDuration: Math.max(15, Math.round((t.estimatedDuration * factor) / 5) * 5) }
          : t
      );
      changed = true;
    }

    return changed ? next : null;
  }
}
