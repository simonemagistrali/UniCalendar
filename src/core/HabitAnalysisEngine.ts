import type {
  AnkiDaySnapshot,
  CalendarEvent,
  Course,
  PerformanceRecord,
  StudySession,
  Task,
  UserPreferences,
} from './types';
import { getTaskKind, type TaskKind } from './taskKind';

/* ─── Types & Interfaces ─── */

export type CircadianBandId =
  | 'early_morning'   // 06:00 - 09:30
  | 'late_morning'    // 09:30 - 13:00
  | 'early_afternoon' // 13:00 - 16:30
  | 'late_afternoon'  // 16:30 - 20:00
  | 'evening';        // 20:00 - 24:00

export interface CircadianBandStat {
  id: CircadianBandId;
  label: string;
  rangeLabel: string;
  weightedMinutes: number;
  taskCount: number;
  /** Rapporto medio stimato/reale (>1 = più veloce del previsto, <1 = più lento) */
  efficiencyScore: number;
  /** Punteggio combinato (attivazione + efficienza) normalizzato 0-100 */
  focusIndex: number;
}

export interface ChronotypeProfile {
  bands: CircadianBandStat[];
  peakBand: CircadianBandStat | null;
  dipBand: CircadianBandStat | null;
  chronotypeLabel: 'Allodola (Mattutino)' | 'Colibrì (Diurno centrale)' | 'Gufo (Serale)' | 'In calibrazione';
  /** Scostamento medio (in minuti) tra orario di inizio impostato e primo task effettivo */
  startDriftMinutes: number | null;
  suggestedStartTime: string | null;
}

export interface CourseStrainStat {
  courseId: string;
  courseName: string;
  courseColor: string;
  declaredDifficulty: number;
  /** Difficoltà reale dedotta dai comportamenti (1-10) */
  implicitDifficulty: number;
  /** Difficoltà combinata (dichiarata + comportamentale) usata dai motori */
  effectiveDifficulty: number;
  ewmaOverrunRatio: number; // >1 significa che richiede più tempo del previsto
  avgSkipCount: number;
  avgLatencyDays: number;
  fragmentationRate: number;
}

export interface ProcrastinationProfile {
  /** Soglia in minuti oltre cui i task subiscono rinvii/ritardi anomali (es. 75 o 90 min) */
  durationWallMinutes: number | null;
  /** Durata massima consigliata per singolo blocco nello scheduler */
  recommendedMaxBlockMinutes: number;
  mostAvoidedKind: TaskKind | null;
  /** Effetto cascata: ritardo medio (in giorni) di appunti/esercizi quando la lezione è seguita vs recuperata */
  attendedFollowUpDelayDays: number | null;
  recoveredFollowUpDelayDays: number | null;
  scheduleAdherenceRate: number | null; // % task completati in linea con le sessioni pianificate
}

export interface TopicRetentionItem {
  courseId: string;
  courseName: string;
  topic: string;
  lastStudiedAt: string;
  daysSinceReview: number;
  memoryStrengthDays: number;
  /** Ritenzione stimata secondo Ebbinghaus: 0-100% */
  retentionPct: number;
}

export interface MonteCarloResult {
  /** Probabilità (0-100%) di smaltire arretrato + carico in arrivo entro l'orizzonte (14gg o prossimo esame) */
  successProbabilityPct: number;
  horizonDays: number;
  horizonLabel: string;
  p50DaysToCatchUp: number;
  p90DaysToCatchUp: number;
  /** Minuti extra al giorno necessari per raggiungere il 90% di probabilità */
  extraDailyMinutesFor90Pct: number;
  avgHistoricalDailyMinutes: number;
}

export interface WellbeingAndPacingProfile {
  burnoutRisk: 'low' | 'moderate' | 'high';
  boomBustCyclesDetected: number;
  sustainableDailyCapMinutes: number;
  sportBoostPct: number | null; // % di efficienza/studio in più nei giorni con sport
}

export interface ReconstructedTimeWindow {
  inferredStartTime: string;
  completedAt: string;
  timeConfidence: number; // w in [0, 1]
  durationConfidence: number; // c_d in [0, 1]
  isMultiDay: boolean;
  tier: 'attended_event' | 'explicit_timer' | 'single_backcalc' | 'batch_checkoff';
  wasScheduledSlotHit: boolean;
}

export interface FullHabitAnalysis {
  chronotype: ChronotypeProfile;
  courseStrains: CourseStrainStat[];
  procrastination: ProcrastinationProfile;
  decayedTopics: TopicRetentionItem[];
  monteCarlo: MonteCarloResult;
  wellbeing: WellbeingAndPacingProfile;
  smartTips: string[];
}

const DAY_MS = 86400000;

export class HabitAnalysisEngine {

  /* ═══════════════════════════════════════════════════════════════════════════
   * 1. RICOSTRUZIONE ORARIA A 4 LIVELLI DI CONFIDENZA (Senza obbligo di "Inizia")
   * ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Ricostruisce la finestra temporale di studio anche quando l'utente non ha premuto "Inizia",
   * distinguendo tra lezione seguita dal vivo, completamento singolo a fine studio e
   * spunta cumulativa a fine giornata (Batch Check-off).
   */
  static reconstructStudyWindow(
    task: Task,
    actualMinutes: number,
    completionMode: 'attended' | 'recovered' | 'normal',
    completedAtIso: string,
    allTasks: Task[],
    events: CalendarEvent[],
    studySessions: StudySession[],
    opts?: { durationConfidence?: number; wasDistracted?: boolean; isMultiDay?: boolean }
  ): ReconstructedTimeWindow {
    const completedMs = new Date(completedAtIso).getTime();
    const safeMinutes = Math.max(1, actualMinutes || task.estimatedDuration || 30);
    const durationMs = safeMinutes * 60000;

    // Anticorpo 1: Calcolo confidenza della durata (Default-Click Decay & Multi-Day)
    const createdMs = new Date(task.createdAt).getTime();
    const ageDays = Math.max(0, (completedMs - createdMs) / DAY_MS);
    const isUnchangedDefault = safeMinutes === task.estimatedDuration && !task.startedAt && !(task.accumulatedTime && task.accumulatedTime > 0);

    let durationConfidence = opts?.durationConfidence ?? 1.0;
    if (opts?.durationConfidence === undefined) {
      if (ageDays > 4 && isUnchangedDefault && completionMode !== 'attended') {
        // L'utente ha chiuso un task vecchio di >4 giorni senza timer e lasciando il valore precompilato:
        // probabilmente non ricordava la durata esatta ("Conferma pigro")
        durationConfidence = 0.2;
      }
    }

    const isMultiDay =
      opts?.isMultiDay ??
      (durationConfidence === 0 || ((task.pauseCount || 0) >= 2 && ageDays >= 1.5));

    // Controlla se questo task aveva una sessione pianificata oggi
    const todayStr = new Date(completedMs).toDateString();
    const plannedToday = studySessions.filter(
      s => s.taskId === task.id && !s.isBuffer && new Date(s.startTime).toDateString() === todayStr
    );
    const wasScheduledSlotHit = plannedToday.length > 0;

    // Se è stato svolto in più giorni o l'utente ha cliccato "Non ricordo", azzera confidenza oraria
    if (isMultiDay || durationConfidence === 0) {
      return {
        inferredStartTime: new Date(completedMs - durationMs).toISOString(),
        completedAt: completedAtIso,
        timeConfidence: 0,
        durationConfidence,
        isMultiDay: true,
        tier: 'batch_checkoff',
        wasScheduledSlotHit,
      };
    }

    // LIVELLO 1: Lezione segnata come "Seguita" (attended) -> usa l'orario reale della lezione!
    if (completionMode === 'attended' && task.relatedEventId) {
      const ev = events.find(e => e.id === task.relatedEventId);
      if (ev) {
        return {
          inferredStartTime: ev.startTime,
          completedAt: ev.endTime,
          timeConfidence: 1.0,
          durationConfidence,
          isMultiDay: false,
          tier: 'attended_event',
          wasScheduledSlotHit: true,
        };
      }
    }

    // LIVELLO 2: Rilevamento Batch Check-off (spunta multipla ravvicinata)
    // Se un altro task è stato completato a una distanza inferiore al 60% della durata di questo task
    // (es. 3 task chiusi in 2 minuti la sera), non usiamo completedAt per non falsare la curva circadiana.
    const recentOtherCompletions = allTasks.filter(t => {
      if (t.id === task.id || t.status !== 'done' || !t.completedAt) return false;
      const otherEnd = new Date(t.completedAt).getTime();
      const gapMs = Math.abs(completedMs - otherEnd);
      return gapMs < Math.min(durationMs * 0.6, 15 * 60000); // Entro 15 min o <60% durata
    });

    if (recentOtherCompletions.length > 0 && !task.startedAt) {
      // Se aveva una sessione pianificata oggi, ancoriamo l'inizio stimato a quella sessione con confidenza moderata
      if (plannedToday.length > 0) {
        return {
          inferredStartTime: plannedToday[0].startTime,
          completedAt: completedAtIso,
          timeConfidence: 0.35,
          durationConfidence,
          isMultiDay: false,
          tier: 'batch_checkoff',
          wasScheduledSlotHit: true,
        };
      }
      return {
        inferredStartTime: new Date(completedMs - durationMs).toISOString(),
        completedAt: completedAtIso,
        timeConfidence: 0.1, // Peso quasi nullo sulla curva oraria, valido per durate/corsi secondo durationConfidence
        durationConfidence,
        isMultiDay: false,
        tier: 'batch_checkoff',
        wasScheduledSlotHit,
      };
    }

    // LIVELLO 3: Utente che ha usato il pulsante "Inizia" (senza dimenticare il timer acceso per ore)
    if (task.startedAt) {
      const startMs = new Date(task.startedAt).getTime();
      const elapsedMs = completedMs - startMs;
      // Se il tempo trascorso sul timer è compatibile con la durata reale (non dimenticato acceso > 1.8x)
      if (elapsedMs > 0 && elapsedMs <= durationMs * 1.8) {
        return {
          inferredStartTime: task.startedAt,
          completedAt: completedAtIso,
          timeConfidence: 1.0,
          durationConfidence,
          isMultiDay: false,
          tier: 'explicit_timer',
          wasScheduledSlotHit,
        };
      }
    }

    // LIVELLO 4: Back-calculation da singolo clic su "Concludi" (completedAt - actualDuration)
    const backCalcStartMs = completedMs - durationMs;
    return {
      inferredStartTime: new Date(backCalcStartMs).toISOString(),
      completedAt: completedAtIso,
      timeConfidence: 0.85,
      durationConfidence,
      isMultiDay: false,
      tier: 'single_backcalc',
      wasScheduledSlotHit,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 2. STIMA ADATTIVA BAYESIANA / EWMA DEI TEMPI (Per Corso e Tipo Task)
   * ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Calcola il moltiplicatore di durata (actual / estimated) per uno specifico corso e tipo di task,
   * combinando una Media Mobile Esponenziale (EWMA) con uno Shrinkage Bayesiano verso il comportamento
   * globale dell'utente (così funziona bene anche con pochissimi dati a inizio semestre).
   */
  static getCourseTaskMultiplier(
    courseId: string | undefined,
    kind: TaskKind,
    tasks: Task[],
    history: PerformanceRecord[],
    events: CalendarEvent[] = []
  ): number {
    // Anticorpo 1 & 2: Escludi i task in cui l'utente ha dichiarato "Non ricordo" (durationConfidence === 0)
    // o "Mi sono distratto" (wasDistracted === true) per non falsare la difficoltà/durata del corso!
    const doneTasks = tasks.filter(
      t =>
        t.status === 'done' &&
        !t.isPhantom &&
        t.actualDuration &&
        t.actualDuration > 0 &&
        t.estimatedDuration > 0 &&
        !t.wasDistracted &&
        (t.durationConfidence === undefined || t.durationConfidence > 0.05)
    );

    // Calcola il rapporto reale/nominale di un task e il suo peso di confidenza
    const getWeightedObservation = (t: Task): { ratio: number; weight: number } => {
      let weight = t.durationConfidence ?? 1.0;
      if (t.durationConfidence === undefined && t.completedAt) {
        const ageDays = (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / DAY_MS;
        if (ageDays > 4 && t.actualDuration === t.estimatedDuration && !t.startedAt) {
          weight = 0.2; // Default-click decay automatico per task storici
        }
      }

      if (getTaskKind(t) === 'FOLLOW_LESSON' && t.relatedEventId) {
        const ev = events.find(e => e.id === t.relatedEventId);
        if (ev) {
          const nominal = Math.max(15, Math.round((new Date(ev.endTime).getTime() - new Date(ev.startTime).getTime()) / 60000));
          return {
            ratio: Math.max(0.4, Math.min(3.0, (t.actualDuration || nominal) / nominal)),
            weight,
          };
        }
      }
      return {
        ratio: Math.max(0.4, Math.min(3.0, (t.actualDuration || t.estimatedDuration) / t.estimatedDuration)),
        weight,
      };
    };

    // Ordina cronologicamente per EWMA
    const sortedDone = [...doneTasks].sort(
      (a, b) => new Date(a.completedAt || a.createdAt).getTime() - new Date(b.completedAt || b.createdAt).getTime()
    );

    // Anticorpo 2: EWMA pesata per confidenza con filtro Huber / Winsorized anti-outlier
    const computeRobustWeightedEwma = (obs: { ratio: number; weight: number }[], baseAlpha = 0.35): number => {
      if (obs.length === 0) return 1.0;
      let ewma = obs[0].ratio;
      const HUBER_DELTA = 0.6; // Soglia oltre cui un singolo picco anomalo viene smorzato
      for (let i = 1; i < obs.length; i++) {
        const { ratio, weight } = obs[i];
        const diff = ratio - ewma;
        // Huber soft-clipping: se una singola sessione sfora in modo anomalo, ammortizza l'eccesso
        const robustRatio =
          Math.abs(diff) > HUBER_DELTA
            ? ewma + Math.sign(diff) * (HUBER_DELTA + (Math.abs(diff) - HUBER_DELTA) * 0.35)
            : ratio;
        const effectiveAlpha = Math.max(0.05, Math.min(0.6, baseAlpha * weight));
        ewma = effectiveAlpha * robustRatio + (1 - effectiveAlpha) * ewma;
      }
      return ewma;
    };

    // Prior globale per questo TaskKind
    const globalKindObs = sortedDone.filter(t => getTaskKind(t) === kind).map(getWeightedObservation);
    const globalPrior = globalKindObs.length > 0 ? computeRobustWeightedEwma(globalKindObs, 0.25) : 1.0;

    if (!courseId) return globalPrior;

    // Osservazioni specifiche per (courseId, kind)
    const courseKindObs = sortedDone
      .filter(t => t.courseId === courseId && getTaskKind(t) === kind)
      .map(getWeightedObservation);

    // Fallback su history del corso se i task sono stati archiviati in semestri chiusi
    if (courseKindObs.length === 0) {
      const courseHist = history.filter(
        h =>
          h.courseId === courseId &&
          h.estimatedMinutes > 0 &&
          h.actualMinutes > 0 &&
          !h.wasDistracted &&
          (h.durationConfidence === undefined || h.durationConfidence > 0.05)
      );
      if (courseHist.length === 0) return globalPrior;
      const histObs = courseHist.map(h => ({
        ratio: Math.max(0.4, Math.min(3.0, h.actualMinutes / h.estimatedMinutes)),
        weight: h.durationConfidence ?? 1.0,
      }));
      const courseEwma = computeRobustWeightedEwma(histObs, 0.3);
      const effectiveN = histObs.reduce((s, o) => s + o.weight, 0);
      const m = 3; // Peso del prior
      return (effectiveN / (effectiveN + m)) * courseEwma + (m / (effectiveN + m)) * globalPrior;
    }

    const courseKindEwma = computeRobustWeightedEwma(courseKindObs, 0.35);
    const effectiveN = courseKindObs.reduce((s, o) => s + o.weight, 0);
    const m = 3; // Costante di shrinkage Bayesiano
    const shrunk = (effectiveN / (effectiveN + m)) * courseKindEwma + (m / (effectiveN + m)) * globalPrior;

    return Math.max(0.5, Math.min(2.8, shrunk));
  }

  /**
   * Restituisce la durata stimata personalizzata (arrotondata a 5 min) per un nuovo task.
   */
  static estimateTaskDuration(
    baseMinutes: number,
    courseId: string | undefined,
    kind: TaskKind,
    tasks: Task[],
    history: PerformanceRecord[],
    events: CalendarEvent[] = []
  ): number {
    const mult = this.getCourseTaskMultiplier(courseId, kind, tasks, history, events);
    const raw = Math.round(baseMinutes * mult);
    return Math.max(15, Math.round(raw / 5) * 5);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 3. PROFILAZIONE CRONOBIOLOGICA (Curva Circadiana pesata per confidenza)
   * ═══════════════════════════════════════════════════════════════════════════ */

  private static readonly BANDS_META: { id: CircadianBandId; label: string; rangeLabel: string; startHour: number; endHour: number }[] = [
    { id: 'early_morning', label: 'Mattina presto', rangeLabel: '06:00 – 09:30', startHour: 6, endHour: 9.5 },
    { id: 'late_morning', label: 'Tarda mattina', rangeLabel: '09:30 – 13:00', startHour: 9.5, endHour: 13 },
    { id: 'early_afternoon', label: 'Primo pomeriggio', rangeLabel: '13:00 – 16:30', startHour: 13, endHour: 16.5 },
    { id: 'late_afternoon', label: 'Tardo pomeriggio', rangeLabel: '16:30 – 20:00', startHour: 16.5, endHour: 20 },
    { id: 'evening', label: 'Sera / Notte', rangeLabel: '20:00 – 24:00', startHour: 20, endHour: 24 },
  ];

  static getBandForDate(d: Date): CircadianBandId {
    const h = d.getHours() + d.getMinutes() / 60;
    if (h >= 6 && h < 9.5) return 'early_morning';
    if (h >= 9.5 && h < 13) return 'late_morning';
    if (h >= 13 && h < 16.5) return 'early_afternoon';
    if (h >= 16.5 && h < 20) return 'late_afternoon';
    return 'evening';
  }

  static computeChronotypeProfile(
    tasks: Task[],
    events: CalendarEvent[],
    studySessions: StudySession[],
    preferences?: UserPreferences
  ): ChronotypeProfile {
    const doneTasks = tasks.filter(t => t.status === 'done' && !t.isPhantom && t.completedAt);

    const acc = new Map<CircadianBandId, { weightedMins: number; count: number; effWeightedSum: number; weightSum: number }>();
    for (const b of this.BANDS_META) {
      acc.set(b.id, { weightedMins: 0, count: 0, effWeightedSum: 0, weightSum: 0 });
    }

    // Per calcolare lo scostamento dell'orario di inizio mattutino
    const firstStartByDay = new Map<string, { actualMinutesFromMidnight: number; configuredMinutesFromMidnight: number }>();

    for (const t of doneTasks) {
      const actual = t.actualDuration || t.estimatedDuration || 30;
      const est = t.estimatedDuration || actual;

      // Usa i metadati già salvati sul task, oppure ricostruiscili al volo per i task storici
      let startIso = t.inferredStartTime;
      let confidence = t.timeConfidence;

      if (!startIso || confidence === undefined) {
        const rec = this.reconstructStudyWindow(
          t,
          actual,
          t.completionMode || 'normal',
          t.completedAt!,
          doneTasks,
          events,
          studySessions
        );
        startIso = rec.inferredStartTime;
        confidence = rec.timeConfidence;
      }

      // Ignora le lezioni seguite in aula, i task multi-giorno e quelli con "Non ricordo" per la curva oraria
      if (t.completionMode === 'attended' || t.isMultiDay || t.durationConfidence === 0) continue;
      if (confidence <= 0.15) continue; // Esclude i Batch Check-off serali dalla statistica oraria!

      const startDate = new Date(startIso);
      const midDate = new Date(startDate.getTime() + (actual * 60000) / 2);
      const bandId = this.getBandForDate(midDate);
      const entry = acc.get(bandId)!;

      // Se l'utente ha segnalato distrazione in quella fascia oraria, registra l'abbassamento di focus nella fascia
      // (senza aver penalizzato il corso!)
      const eff = t.wasDistracted
        ? 0.6
        : Math.max(0.5, Math.min(1.5, est / Math.max(1, actual)));
      entry.weightedMins += actual * confidence;
      entry.count += 1;
      entry.effWeightedSum += eff * confidence;
      entry.weightSum += confidence;

      // Registra il primo avvio della giornata (se confidenza alta)
      if (confidence >= 0.8 && preferences?.dailyStudyHours) {
        const dow = startDate.getDay();
        const dayCfg = preferences.dailyStudyHours[dow];
        if (dayCfg?.enabled) {
          const [cfgH, cfgM] = dayCfg.start.split(':').map(Number);
          const cfgMins = cfgH * 60 + cfgM;
          const actMins = startDate.getHours() * 60 + startDate.getMinutes();
          // Considera solo avvii mattutini/diurni entro 5 ore dall'inizio configurato
          if (actMins >= cfgMins - 60 && actMins <= cfgMins + 300) {
            const dayKey = startDate.toLocaleDateString('sv-SE');
            const prev = firstStartByDay.get(dayKey);
            if (!prev || actMins < prev.actualMinutesFromMidnight) {
              firstStartByDay.set(dayKey, {
                actualMinutesFromMidnight: actMins,
                configuredMinutesFromMidnight: cfgMins,
              });
            }
          }
        }
      }
    }

    const maxWeightedMins = Math.max(1, ...Array.from(acc.values()).map(v => v.weightedMins));

    const bands: CircadianBandStat[] = this.BANDS_META.map(meta => {
      const data = acc.get(meta.id)!;
      const avgEff = data.weightSum > 0 ? data.effWeightedSum / data.weightSum : 1.0;
      const volumeNorm = data.weightedMins / maxWeightedMins; // 0..1
      const effNorm = (avgEff - 0.5) / 1.0; // 0..1
      const focusIndex = data.count > 0 ? Math.round((volumeNorm * 0.55 + effNorm * 0.45) * 100) : 50;

      return {
        id: meta.id,
        label: meta.label,
        rangeLabel: meta.rangeLabel,
        weightedMinutes: Math.round(data.weightedMins),
        taskCount: data.count,
        efficiencyScore: Math.round(avgEff * 100) / 100,
        focusIndex,
      };
    });

    const activeBands = bands.filter(b => b.taskCount >= 1);
    const sortedByFocus = [...activeBands].sort((a, b) => b.focusIndex - a.focusIndex);
    const peakBand = sortedByFocus[0] || null;
    const dipBand = sortedByFocus.length >= 2 ? sortedByFocus[sortedByFocus.length - 1] : null;

    let chronotypeLabel: ChronotypeProfile['chronotypeLabel'] = 'In calibrazione';
    if (peakBand && activeBands.reduce((s, b) => s + b.taskCount, 0) >= 3) {
      if (peakBand.id === 'early_morning' || peakBand.id === 'late_morning') {
        chronotypeLabel = 'Allodola (Mattutino)';
      } else if (peakBand.id === 'early_afternoon' || peakBand.id === 'late_afternoon') {
        chronotypeLabel = 'Colibrì (Diurno centrale)';
      } else {
        chronotypeLabel = 'Gufo (Serale)';
      }
    }

    let startDriftMinutes: number | null = null;
    let suggestedStartTime: string | null = null;
    if (firstStartByDay.size >= 3) {
      const drifts = Array.from(firstStartByDay.values()).map(
        v => v.actualMinutesFromMidnight - v.configuredMinutesFromMidnight
      );
      const avgDrift = Math.round(drifts.reduce((a, b) => a + b, 0) / drifts.length);
      if (Math.abs(avgDrift) >= 30) {
        startDriftMinutes = avgDrift;
        const avgActual = Math.round(
          Array.from(firstStartByDay.values()).reduce((s, v) => s + v.actualMinutesFromMidnight, 0) /
            firstStartByDay.size /
            15
        ) * 15;
        const hh = String(Math.floor(avgActual / 60)).padStart(2, '0');
        const mm = String(avgActual % 60).padStart(2, '0');
        suggestedStartTime = `${hh}:${mm}`;
      }
    }

    return {
      bands,
      peakBand,
      dipBand,
      chronotypeLabel,
      startDriftMinutes,
      suggestedStartTime,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 4. DIFFICOLTÀ REALE / COMPORTAMENTALE PER CORSO (Composite Strain Score)
   * ═══════════════════════════════════════════════════════════════════════════ */

  static computeCourseStrain(
    courses: Course[],
    tasks: Task[],
    history: PerformanceRecord[],
    events: CalendarEvent[] = []
  ): CourseStrainStat[] {
    return courses.map(course => {
      const courseTasks = tasks.filter(t => t.courseId === course.id && !t.isPhantom);
      const doneTasks = courseTasks.filter(t => t.status === 'done');

      // 1. Sforamento medio (EWMA)
      const notesMult = this.getCourseTaskMultiplier(course.id, 'NOTES', tasks, history, events);
      const exMult = this.getCourseTaskMultiplier(course.id, 'EXERCISES', tasks, history, events);
      const ewmaOverrunRatio = Math.round(((notesMult + exMult) / 2) * 100) / 100;

      // 2. Media di salti/rinvii
      const avgSkipCount =
        courseTasks.length > 0
          ? courseTasks.reduce((s, t) => s + (t.postponedCount || 0), 0) / courseTasks.length
          : 0;

      // 3. Latenza media di completamento (in giorni dalla creazione)
      const latencies = doneTasks
        .filter(t => t.completedAt && t.createdAt)
        .map(t => Math.max(0, (new Date(t.completedAt!).getTime() - new Date(t.createdAt).getTime()) / DAY_MS));
      const avgLatencyDays =
        latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

      // 4. Indice di frammentazione (pause)
      const pausedTasks = courseTasks.filter(t => (t.pauseCount || 0) > 0 || (t.accumulatedTime || 0) > 0).length;
      const fragmentationRate = courseTasks.length > 0 ? pausedTasks / courseTasks.length : 0;

      // Calcolo difficoltà implicita su scala 1-10
      let implicit = course.difficulty;
      if (doneTasks.length >= 2 || courseTasks.some(t => t.postponedCount > 0)) {
        const overrunDelta = (ewmaOverrunRatio - 1.0) * 4.5; // es. 1.4x -> +1.8 punti
        const skipDelta = Math.min(2.5, avgSkipCount * 1.2);
        const latencyDelta = avgLatencyDays > 4 ? Math.min(2.0, (avgLatencyDays - 4) * 0.25) : -0.3;
        const fragDelta = fragmentationRate * 1.5;

        implicit = Math.max(1, Math.min(10, Math.round((5 + overrunDelta + skipDelta + latencyDelta + fragDelta) * 10) / 10));
      }

      // Media pesata tra difficoltà dichiarata (40%) e difficoltà reale osservata (60%)
      const sampleWeight = Math.min(0.65, (doneTasks.length / 8) * 0.65);
      const effectiveDifficulty =
        Math.round((course.difficulty * (1 - sampleWeight) + implicit * sampleWeight) * 10) / 10;

      return {
        courseId: course.id,
        courseName: course.name,
        courseColor: course.color,
        declaredDifficulty: course.difficulty,
        implicitDifficulty: implicit,
        effectiveDifficulty,
        ewmaOverrunRatio,
        avgSkipCount: Math.round(avgSkipCount * 10) / 10,
        avgLatencyDays: Math.round(avgLatencyDays * 10) / 10,
        fragmentationRate: Math.round(fragmentationRate * 100),
      };
    });
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 5. PROFILO DI PROCRASTINAZIONE & EFFETTO CASCATA ASSENZE
   * ═══════════════════════════════════════════════════════════════════════════ */

  static computeProcrastinationProfile(
    tasks: Task[],
    preferences?: UserPreferences
  ): ProcrastinationProfile {
    const realTasks = tasks.filter(t => !t.isPhantom);
    const maxCfgBlock = preferences?.maxStudyBlockMinutes || 120;

    // 1. Ricerca "Wall of Awful" (soglia di durata oltre cui i task vengono saltati o rimangono aperti a lungo)
    const buckets = [45, 60, 75, 90, 120];
    let durationWallMinutes: number | null = null;

    const shortTasks = realTasks.filter(t => t.estimatedDuration <= 45);
    const shortSkipRate =
      shortTasks.length > 0
        ? shortTasks.reduce((s, t) => s + (t.postponedCount || 0), 0) / shortTasks.length
        : 0;

    for (const threshold of buckets) {
      const longTasks = realTasks.filter(t => t.estimatedDuration >= threshold);
      if (longTasks.length >= 3) {
        const longSkipRate = longTasks.reduce((s, t) => s + (t.postponedCount || 0), 0) / longTasks.length;
        const longOpenOld = longTasks.filter(
          t => t.status !== 'done' && (Date.now() - new Date(t.createdAt).getTime()) / DAY_MS > 7
        ).length;
        if (longSkipRate > shortSkipRate + 0.6 || longOpenOld / longTasks.length >= 0.5) {
          durationWallMinutes = threshold;
          break;
        }
      }
    }

    const recommendedMaxBlockMinutes = durationWallMinutes
      ? Math.max(30, Math.min(maxCfgBlock, durationWallMinutes - 15))
      : maxCfgBlock;

    // 2. Tipologia più evitata
    const kindSkips = new Map<TaskKind, { skips: number; count: number }>();
    for (const t of realTasks) {
      const k = getTaskKind(t);
      const cur = kindSkips.get(k) || { skips: 0, count: 0 };
      cur.skips += t.postponedCount || 0;
      cur.count += 1;
      kindSkips.set(k, cur);
    }
    let mostAvoidedKind: TaskKind | null = null;
    let maxAvgSkip = 0.3; // soglia minima
    for (const [k, v] of kindSkips.entries()) {
      if (v.count >= 2 && v.skips / v.count > maxAvgSkip) {
        maxAvgSkip = v.skips / v.count;
        mostAvoidedKind = k;
      }
    }

    // 3. Effetto cascata assenze: confronta la latenza di completamento di Appunti/Esercizi
    // quando la lezione collegata è stata 'attended' vs 'recovered'
    const lessonModeByEventId = new Map<string, 'attended' | 'recovered'>();
    for (const t of realTasks) {
      if (t.relatedEventId && getTaskKind(t) === 'FOLLOW_LESSON' && t.status === 'done' && (t.completionMode === 'attended' || t.completionMode === 'recovered')) {
        lessonModeByEventId.set(t.relatedEventId, t.completionMode);
      }
    }

    const attendedDelays: number[] = [];
    const recoveredDelays: number[] = [];
    for (const t of realTasks) {
      if (t.status === 'done' && t.completedAt && t.relatedEventId && (getTaskKind(t) === 'NOTES' || getTaskKind(t) === 'EXERCISES')) {
        const mode = lessonModeByEventId.get(t.relatedEventId);
        const delayDays = Math.max(0, (new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime()) / DAY_MS);
        if (mode === 'attended') attendedDelays.push(delayDays);
        if (mode === 'recovered') recoveredDelays.push(delayDays);
      }
    }

    const attendedFollowUpDelayDays =
      attendedDelays.length >= 2
        ? Math.round((attendedDelays.reduce((a, b) => a + b, 0) / attendedDelays.length) * 10) / 10
        : null;
    const recoveredFollowUpDelayDays =
      recoveredDelays.length >= 2
        ? Math.round((recoveredDelays.reduce((a, b) => a + b, 0) / recoveredDelays.length) * 10) / 10
        : null;

    // 4. Tasso di aderenza allo scheduler
    const trackedSlotTasks = realTasks.filter(t => t.status === 'done' && t.wasScheduledSlotHit !== undefined);
    const scheduleAdherenceRate =
      trackedSlotTasks.length >= 3
        ? Math.round((trackedSlotTasks.filter(t => t.wasScheduledSlotHit).length / trackedSlotTasks.length) * 100)
        : null;

    return {
      durationWallMinutes,
      recommendedMaxBlockMinutes,
      mostAvoidedKind,
      attendedFollowUpDelayDays,
      recoveredFollowUpDelayDays,
      scheduleAdherenceRate,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 6. CURVA DELL'OBLIO DI EBBINGHAUS & SINERGIA ANKI (Ritenzione per Topic)
   * ═══════════════════════════════════════════════════════════════════════════ */

  static computeTopicRetention(
    courses: Course[],
    events: CalendarEvent[],
    tasks: Task[],
    ankiHistory: AnkiDaySnapshot[] = [],
    nowMs: number = Date.now()
  ): TopicRetentionItem[] {
    const courseMap = new Map(courses.map(c => [c.id, c]));
    const eventsById = new Map(events.map(e => [e.id, e]));

    // Bonus di stabilità mnemonica se l'utente usa attivamente Anki negli ultimi 7 giorni
    const sevenDaysAgoKey = new Date(nowMs - 7 * DAY_MS).toLocaleDateString('sv-SE');
    const recentAnkiDays = ankiHistory.filter(a => a.date >= sevenDaysAgoKey && a.studied > 0).length;
    const ankiBonusDays = recentAnkiDays >= 4 ? 4 : recentAnkiDays >= 2 ? 2 : 0;

    const topicMap = new Map<
      string,
      {
        courseId: string;
        courseName: string;
        topic: string;
        lastStudiedMs: number;
        attended: boolean;
        notesDone: boolean;
        exercisesDone: boolean;
        reviewsCount: number;
      }
    >();

    const extractTopic = (t: Task): string | undefined => {
      const m = t.description?.match(/Argomento:\s*([^\n\r]+)/i);
      if (m && m[1].trim()) return m[1].trim();
      const ev = t.relatedEventId ? eventsById.get(t.relatedEventId) : undefined;
      if (ev?.topic && ev.topic.trim()) return ev.topic.trim();
      return undefined;
    };

    for (const t of tasks) {
      if (t.status !== 'done' || !t.completedAt || !t.courseId || t.isPhantom) continue;
      const course = courseMap.get(t.courseId);
      if (!course) continue;

      const topic = extractTopic(t);
      if (!topic) continue;

      const key = `${t.courseId}::${topic.toLowerCase()}`;
      const compMs = new Date(t.completedAt).getTime();
      const kind = getTaskKind(t);

      const cur = topicMap.get(key) || {
        courseId: t.courseId,
        courseName: course.name,
        topic,
        lastStudiedMs: compMs,
        attended: false,
        notesDone: false,
        exercisesDone: false,
        reviewsCount: 0,
      };

      if (compMs > cur.lastStudiedMs) cur.lastStudiedMs = compMs;
      if (kind === 'FOLLOW_LESSON' && t.completionMode === 'attended') cur.attended = true;
      if (kind === 'NOTES') cur.notesDone = true;
      if (kind === 'EXERCISES') cur.exercisesDone = true;
      cur.reviewsCount += 1;
      topicMap.set(key, cur);
    }

    const results: TopicRetentionItem[] = [];
    for (const item of topicMap.values()) {
      const daysSinceReview = Math.max(0, (nowMs - item.lastStudiedMs) / DAY_MS);
      // Forza della traccia mnemonica S (in giorni):
      // Base 5gg + 3gg se lezione seguita dal vivo + 6gg se appunti + 8gg se esercizi + bonus Anki
      const memoryStrengthDays =
        5 +
        (item.attended ? 3 : 0) +
        (item.notesDone ? 6 : 0) +
        (item.exercisesDone ? 8 : 0) +
        Math.min(6, (item.reviewsCount - 1) * 2) +
        ankiBonusDays;

      const retentionPct = Math.round(Math.exp(-daysSinceReview / memoryStrengthDays) * 100);

      results.push({
        courseId: item.courseId,
        courseName: item.courseName,
        topic: item.topic,
        lastStudiedAt: new Date(item.lastStudiedMs).toISOString(),
        daysSinceReview: Math.round(daysSinceReview * 10) / 10,
        memoryStrengthDays,
        retentionPct,
      });
    }

    // Ordina dai temi più dimenticati (retentionPct più bassa) a quelli più freschi
    return results.sort((a, b) => a.retentionPct - b.retentionPct);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 7. SIMULAZIONE MONTE CARLO SCADENZE & RILEVAMENTO BURNOUT / SPORT
   * ═══════════════════════════════════════════════════════════════════════════ */

  /**
   * Anticorpo 3: Spalmatura Multi-Giorno (Multi-Day Load Spreading).
   * Se un'attività è stata svolta in più giorni (`isMultiDay`, `durationConfidence === 0` o task lungo chiuso dopo molti giorni),
   * spalma i minuti su 3 giorni invece di concentrarli tutti sul giorno del clic, evitando falsi picchi di Burnout.
   */
  private static buildSpreadDailyMinutesMap(tasks: Task[], nowMs: number, daysBack: number = 21): Map<string, number> {
    const dailyMinutesMap = new Map<string, number>();
    for (let i = 0; i <= daysBack; i++) {
      const dKey = new Date(nowMs - i * DAY_MS).toLocaleDateString('sv-SE');
      dailyMinutesMap.set(dKey, 0);
    }

    const doneTasks = tasks.filter(t => t.status === 'done' && !t.isPhantom && t.completedAt);
    for (const t of doneTasks) {
      const compMs = new Date(t.completedAt!).getTime();
      const createdMs = new Date(t.createdAt).getTime();
      const ageDays = Math.max(0, (compMs - createdMs) / DAY_MS);
      const mins = t.actualDuration || t.estimatedDuration || 0;

      const shouldSpread =
        t.isMultiDay ||
        t.durationConfidence === 0 ||
        ((t.pauseCount || 0) >= 2 && ageDays >= 1.5) ||
        (mins >= 110 && ageDays >= 3 && !t.startedAt);

      if (shouldSpread && ageDays >= 1) {
        const span = Math.min(3, Math.max(2, Math.floor(ageDays)));
        const chunk = Math.round(mins / span);
        for (let k = 0; k < span; k++) {
          const dKey = new Date(compMs - k * DAY_MS).toLocaleDateString('sv-SE');
          if (dailyMinutesMap.has(dKey)) {
            dailyMinutesMap.set(dKey, (dailyMinutesMap.get(dKey) || 0) + chunk);
          }
        }
      } else {
        const dKey = new Date(compMs).toLocaleDateString('sv-SE');
        if (dailyMinutesMap.has(dKey)) {
          dailyMinutesMap.set(dKey, (dailyMinutesMap.get(dKey) || 0) + mins);
        }
      }
    }

    return dailyMinutesMap;
  }

  static simulateMonteCarlo(
    tasks: Task[],
    events: CalendarEvent[],
    futureProjectedMinutes14d: number,
    nowMs: number = Date.now()
  ): MonteCarloResult {
    const pendingMinutes = tasks
      .filter(t => t.status !== 'done' && !t.isPhantom)
      .reduce((s, t) => s + t.estimatedDuration, 0);

    // Individua l'esame più vicino entro 21 giorni (se presente), altrimenti usa finestra 14 giorni
    const upcomingExams = events
      .filter(e => e.type === 'exam' && new Date(e.startTime).getTime() > nowMs)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    let horizonDays = 14;
    let horizonLabel = 'Prossimi 14 giorni';
    if (upcomingExams.length > 0) {
      const daysToExam = Math.max(1, Math.ceil((new Date(upcomingExams[0].startTime).getTime() - nowMs) / DAY_MS));
      if (daysToExam <= 21) {
        horizonDays = daysToExam;
        horizonLabel = `Esame: ${upcomingExams[0].title} (${daysToExam}g)`;
      }
    }

    const scaledFutureMinutes = Math.round((futureProjectedMinutes14d / 14) * horizonDays);
    const totalTargetMinutes = pendingMinutes + scaledFutureMinutes;

    // Costruisci la distribuzione empirica degli ultimi 21 giorni (con Multi-Day Load Spreading)
    const spreadMap = this.buildSpreadDailyMinutesMap(tasks, nowMs, 21);
    const todayKey = new Date(nowMs).toLocaleDateString('sv-SE');
    spreadMap.delete(todayKey); // Usa i 21 giorni conclusi
    const historicalSample = Array.from(spreadMap.values());
    const nonZeroDays = historicalSample.filter(m => m > 0);
    // Se l'utente ha appena installato l'app o ha meno di 3 giorni attivi, usa una distribuzione prior ragionevole
    const empiricalPool =
      nonZeroDays.length >= 3 ? historicalSample : [0, 60, 90, 120, 150, 180, 120];

    const avgHistoricalDailyMinutes = Math.round(
      empiricalPool.reduce((a, b) => a + b, 0) / empiricalPool.length
    );

    if (totalTargetMinutes <= 0) {
      return {
        successProbabilityPct: 100,
        horizonDays,
        horizonLabel,
        p50DaysToCatchUp: 0,
        p90DaysToCatchUp: 0,
        extraDailyMinutesFor90Pct: 0,
        avgHistoricalDailyMinutes,
      };
    }

    // Esegui 400 traiettorie Monte Carlo deterministiche (seed fisso per stabilità di render)
    const SIMULATIONS = 400;
    let seed = 42 + totalTargetMinutes + horizonDays;
    const nextRand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    let successCount = 0;
    const daysToFinishList: number[] = [];
    const dailyIncoming = scaledFutureMinutes / Math.max(1, horizonDays);

    for (let sim = 0; sim < SIMULATIONS; sim++) {
      let cumStudied = 0;
      let finishedDay = 60;
      for (let d = 1; d <= 60; d++) {
        const sampleIdx = Math.floor(nextRand() * empiricalPool.length);
        cumStudied += empiricalPool[sampleIdx];
        const targetAtDay = pendingMinutes + dailyIncoming * Math.min(d, horizonDays);
        if (cumStudied >= targetAtDay) {
          finishedDay = d;
          break;
        }
      }
      if (finishedDay <= horizonDays) successCount++;
      daysToFinishList.push(finishedDay);
    }

    daysToFinishList.sort((a, b) => a - b);
    const p50DaysToCatchUp = daysToFinishList[Math.floor(SIMULATIONS * 0.5)];
    const p90DaysToCatchUp = daysToFinishList[Math.floor(SIMULATIONS * 0.9)];
    const successProbabilityPct = Math.round((successCount / SIMULATIONS) * 100);

    // Calcola quanti minuti extra al giorno servono per arrivare al 90% entro horizonDays
    const requiredDailyForTarget = totalTargetMinutes / Math.max(1, horizonDays);
    const extraDailyMinutesFor90Pct =
      successProbabilityPct >= 90
        ? 0
        : Math.max(15, Math.round((requiredDailyForTarget * 1.15 - avgHistoricalDailyMinutes) / 5) * 5);

    return {
      successProbabilityPct,
      horizonDays,
      horizonLabel,
      p50DaysToCatchUp,
      p90DaysToCatchUp,
      extraDailyMinutesFor90Pct,
      avgHistoricalDailyMinutes,
    };
  }

  static computeWellbeingAndPacing(
    tasks: Task[],
    events: CalendarEvent[],
    nowMs: number = Date.now()
  ): WellbeingAndPacingProfile {
    const dailyMins: { dateKey: string; mins: number; hasSport: boolean; avgEff: number }[] = [];
    const sportDates = new Set(
      events
        .filter(e => e.type === 'sport')
        .map(e => new Date(e.startTime).toLocaleDateString('sv-SE'))
    );

    const doneTasks = tasks.filter(t => t.status === 'done' && !t.isPhantom && t.completedAt);
    const spreadMap = this.buildSpreadDailyMinutesMap(tasks, nowMs, 20);

    for (let i = 20; i >= 0; i--) {
      const dKey = new Date(nowMs - i * DAY_MS).toLocaleDateString('sv-SE');
      const dayDone = doneTasks.filter(t => new Date(t.completedAt!).toLocaleDateString('sv-SE') === dKey);
      const mins = spreadMap.get(dKey) || 0;
      const effs = dayDone
        .filter(t => t.actualDuration && t.estimatedDuration && !t.wasDistracted && t.durationConfidence !== 0)
        .map(t => t.estimatedDuration / Math.max(1, t.actualDuration!));
      const avgEff = effs.length > 0 ? effs.reduce((a, b) => a + b, 0) / effs.length : 1.0;

      dailyMins.push({
        dateKey: dKey,
        mins,
        hasSport: sportDates.has(dKey),
        avgEff,
      });
    }

    const activeDays = dailyMins.filter(d => d.mins > 0);
    const meanActiveMins =
      activeDays.length > 0 ? activeDays.reduce((s, d) => s + d.mins, 0) / activeDays.length : 180;

    // Rileva cicli Boom-Bust (giorno > 1.5x media seguito da 1-2 giorni a zero assoluto)
    let boomBustCyclesDetected = 0;
    for (let i = 0; i < dailyMins.length - 2; i++) {
      if (dailyMins[i].mins > meanActiveMins * 1.5 && dailyMins[i + 1].mins === 0 && dailyMins[i + 2].mins < 30) {
        boomBustCyclesDetected++;
      }
    }

    const burnoutRisk: WellbeingAndPacingProfile['burnoutRisk'] =
      boomBustCyclesDetected >= 2 ? 'high' : boomBustCyclesDetected === 1 ? 'moderate' : 'low';

    const sustainableDailyCapMinutes = Math.max(
      90,
      Math.min(360, Math.round((meanActiveMins * 1.25) / 15) * 15)
    );

    // Effetto Sport
    const sportActive = activeDays.filter(d => d.hasSport);
    const nonSportActive = activeDays.filter(d => !d.hasSport);
    let sportBoostPct: number | null = null;
    if (sportActive.length >= 2 && nonSportActive.length >= 2) {
      const sportEff = sportActive.reduce((s, d) => s + d.avgEff, 0) / sportActive.length;
      const nonSportEff = nonSportActive.reduce((s, d) => s + d.avgEff, 0) / nonSportActive.length;
      sportBoostPct = Math.round(((sportEff - nonSportEff) / nonSportEff) * 100);
    }

    return {
      burnoutRisk,
      boomBustCyclesDetected,
      sustainableDailyCapMinutes,
      sportBoostPct,
    };
  }

  /* ═══════════════════════════════════════════════════════════════════════════
   * 8. ANALISI COMPLETA UNIFICATA E SUGGERIMENTI ADATTIVI
   * ═══════════════════════════════════════════════════════════════════════════ */

  static analyzeAll(
    tasks: Task[],
    courses: Course[],
    events: CalendarEvent[],
    studySessions: StudySession[],
    history: PerformanceRecord[],
    ankiHistory: AnkiDaySnapshot[] = [],
    preferences?: UserPreferences,
    futureProjectedMinutes14d: number = 0
  ): FullHabitAnalysis {
    const chronotype = this.computeChronotypeProfile(tasks, events, studySessions, preferences);
    const courseStrains = this.computeCourseStrain(courses, tasks, history, events);
    const procrastination = this.computeProcrastinationProfile(tasks, preferences);
    const decayedTopics = this.computeTopicRetention(courses, events, tasks, ankiHistory);
    const monteCarlo = this.simulateMonteCarlo(tasks, events, futureProjectedMinutes14d);
    const wellbeing = this.computeWellbeingAndPacing(tasks, events);

    const smartTips: string[] = [];

    if (chronotype.peakBand && chronotype.chronotypeLabel !== 'In calibrazione') {
      smartTips.push(
        `Il tuo picco cognitivo è nella fascia "${chronotype.peakBand.label}" (${chronotype.peakBand.rangeLabel}): lo scheduler ora assegna lì gli esercizi e le materie più ostiche.`
      );
    }
    if (chronotype.suggestedStartTime && chronotype.startDriftMinutes && chronotype.startDriftMinutes > 30) {
      smartTips.push(
        `Inizi a studiare mediamente ${chronotype.startDriftMinutes} min dopo l'orario impostato: potresti aggiornare l'inizio giornata a ${chronotype.suggestedStartTime} nelle Impostazioni.`
      );
    }
    if (
      procrastination.attendedFollowUpDelayDays !== null &&
      procrastination.recoveredFollowUpDelayDays !== null &&
      procrastination.recoveredFollowUpDelayDays > procrastination.attendedFollowUpDelayDays + 1.5
    ) {
      smartTips.push(
        `Quando segui lezione dal vivo chiudi appunti/esercizi in ${procrastination.attendedFollowUpDelayDays}g; quando recuperi, il ritardo sale a ${procrastination.recoveredFollowUpDelayDays}g.`
      );
    }
    if (procrastination.durationWallMinutes) {
      smartTips.push(
        `Tendi a saltare le attività più lunghe di ${procrastination.durationWallMinutes} min: lo scheduler ora spezza i blocchi a max ${procrastination.recommendedMaxBlockMinutes} min.`
      );
    }
    const hiddenHardCourse = courseStrains.find(c => c.implicitDifficulty - c.declaredDifficulty >= 2.0);
    if (hiddenHardCourse) {
      smartTips.push(
        `"${hiddenHardCourse.courseName}" ha difficoltà impostata a ${hiddenHardCourse.declaredDifficulty}/10, ma dai tuoi tempi/rinvii si comporta come un ${hiddenHardCourse.implicitDifficulty}/10.`
      );
    }
    if (wellbeing.burnoutRisk !== 'low') {
      smartTips.push(
        `Rilevati ${wellbeing.boomBustCyclesDetected} cicli di "studio estremo seguito da stop totale": mantieni un tetto sostenibile di ~${Math.round((wellbeing.sustainableDailyCapMinutes / 60) * 10) / 10}h/giorno.`
      );
    }

    return {
      chronotype,
      courseStrains,
      procrastination,
      decayedTopics,
      monteCarlo,
      wellbeing,
      smartTips,
    };
  }
}

