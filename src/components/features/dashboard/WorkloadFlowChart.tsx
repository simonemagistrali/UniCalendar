import { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { Line } from 'react-chartjs-2';
import { GlassPanel } from '../../ui/GlassPanel';
import { useAppStore } from '../../../store/useAppStore';
import { Activity, TrendingUp, TrendingDown, Equal, Crosshair, ZoomIn, ZoomOut, Calendar, Info } from 'lucide-react';
import { Modal } from '../../ui/Modal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

/* ─── Helpers ─── */

/** Get the Monday of the week for a given date (ISO week), timezone-safe. */
function getWeekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toDateStr(d);
}

/** Format a YYYY-MM-DD to UTC Date */
function parseUTC(dateStr: string): Date {
  const parts = dateStr.split('-');
  return new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
}

/** UTC Date → YYYY-MM-DD */
function toDateStr(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Format YYYY-MM-DD to readable Italian label */
function formatWeekLabel(weekStart: string): string {
  const d = parseUTC(weekStart);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** Add N weeks to a YYYY-MM-DD string */
function addWeeks(dateStr: string, weeks: number): string {
  const d = parseUTC(dateStr);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return toDateStr(d);
}

/** Weeks between two YYYY-MM-DD dates */
function weeksBetween(a: string, b: string): number {
  const da = parseUTC(a).getTime();
  const db = parseUTC(b).getTime();
  return Math.round((db - da) / (7 * 86400000));
}

/** Format a YYYY-MM-DD to a long Italian date */
function formatLongDate(dateStr: string): string {
  const d = parseUTC(dateStr);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Simple linear regression: y = mx + b
 */
function linearRegression(points: { x: number; y: number }[]): { m: number; b: number } {
  const n = points.length;
  if (n < 2) return { m: 0, b: points.length === 1 ? points[0].y : 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { m: 0, b: sumY / n };

  const m = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - m * sumX) / n;
  return { m, b };
}

/* ─── Types ─── */
interface FlowAnalysis {
  status: 'catching_up' | 'falling_behind' | 'keeping_pace' | 'caught_up' | 'no_data';
  message: string;
  detail: string;
  estimatedCatchUpWeek: string | null;
  currentBacklog: number;
  avgCreatedPerWeek: number;
  avgCompletedPerWeek: number;
  netVelocity: number;
}

interface ChartViewData {
  allLabels: string[];
  cumulativeCreated: number[];
  cumulativeCompleted: number[];
  projectedCreated: (number | null)[];
  projectedCompleted: (number | null)[];
  intersectionIndex: number | null;
  estimatedCatchUpLabel: string | null;
  lessonsEndIndex: number | null;
  lessonsEndLabel: string | null;
}

type ViewMode = 'short' | 'semester';

const NO_DATA_RESULT = {
  flowAnalysis: {
    status: 'no_data' as const,
    message: 'Nessun dato disponibile',
    detail: 'Aggiungi e completa task per iniziare a vedere le statistiche.',
    estimatedCatchUpWeek: null,
    currentBacklog: 0,
    avgCreatedPerWeek: 0,
    avgCompletedPerWeek: 0,
    netVelocity: 0,
  },
  shortView: null as ChartViewData | null,
  semesterView: null as ChartViewData | null,
  lastLessonDate: null as string | null,
  totalFutureTasks: 0,
  futureTasksPerWeek: 0,
  daysUntilLastLesson: null as number | null,
};

export function WorkloadFlowChart() {
  const tasks = useAppStore(s => s.tasks);
  const events = useAppStore(s => s.events);
  const courses = useAppStore(s => s.courses);
  const [viewMode, setViewMode] = useState<ViewMode>('short');
  const [infoPopup, setInfoPopup] = useState<{ title: string; formula: string; calc: string } | null>(null);

  const analysis = useMemo(() => {
    // Collect all real tasks (exclude phantom/predicted)
    const allTasks = tasks.filter(t => t.createdAt && !t.isPhantom);
    if (allTasks.length === 0) return NO_DATA_RESULT;

    // ─── Build per-week created/completed counts ───
    const weekMap = new Map<string, { created: number; completed: number }>();

    for (const t of allTasks) {
      const createdWeek = getWeekStart(new Date(t.createdAt));
      if (!weekMap.has(createdWeek)) weekMap.set(createdWeek, { created: 0, completed: 0 });
      weekMap.get(createdWeek)!.created++;

      if (t.status === 'done' && t.completedAt) {
        const completedWeek = getWeekStart(new Date(t.completedAt));
        if (!weekMap.has(completedWeek)) weekMap.set(completedWeek, { created: 0, completed: 0 });
        weekMap.get(completedWeek)!.completed++;
      }
    }

    const sortedWeeks = Array.from(weekMap.keys()).sort();
    if (sortedWeeks.length === 0) return NO_DATA_RESULT;

    // Fill gaps
    const filledWeeks: string[] = [];
    const firstWeekStr = sortedWeeks[0];
    const lastWeekStr = sortedWeeks[sortedWeeks.length - 1];
    let cursorStr = firstWeekStr;
    while (cursorStr <= lastWeekStr) {
      filledWeeks.push(cursorStr);
      if (!weekMap.has(cursorStr)) weekMap.set(cursorStr, { created: 0, completed: 0 });
      cursorStr = addWeeks(cursorStr, 1);
    }

    // ─── Cumulative sums ───
    const cumulativeCreated: number[] = [];
    const cumulativeCompleted: number[] = [];
    let totalCreated = 0;
    let totalCompleted = 0;

    for (const week of filledWeeks) {
      const entry = weekMap.get(week)!;
      totalCreated += entry.created;
      totalCompleted += entry.completed;
      cumulativeCreated.push(totalCreated);
      cumulativeCompleted.push(totalCompleted);
    }

    const weekLabels = filledWeeks.map(w => formatWeekLabel(w));
    const currentBacklog = totalCreated - totalCompleted;
    const numWeeks = filledWeeks.length;

    // ─── Recent averages ───
    const recentWindow = Math.min(4, numWeeks - 1);
    const lookbackIndex = Math.max(0, numWeeks - 1 - recentWindow);
    const recentCreated = recentWindow > 0
      ? (cumulativeCreated[numWeeks - 1] - cumulativeCreated[lookbackIndex]) / recentWindow
      : totalCreated;
    const recentCompleted = recentWindow > 0
      ? (cumulativeCompleted[numWeeks - 1] - cumulativeCompleted[lookbackIndex]) / recentWindow
      : totalCompleted;
    const netVelocity = recentCompleted - recentCreated;

    // ─── Linear regression ───
    const regressionWindow = Math.min(6, numWeeks);
    const regressionStart = numWeeks - regressionWindow;
    const createdPoints = [];
    const completedPoints = [];
    for (let i = regressionStart; i < numWeeks; i++) {
      createdPoints.push({ x: i, y: cumulativeCreated[i] });
      completedPoints.push({ x: i, y: cumulativeCompleted[i] });
    }
    const regCreated = linearRegression(createdPoints);
    const regCompleted = linearRegression(completedPoints);

    // ─── Detect last lesson and future task rate ───
    const now = new Date();
    const nowWeek = getWeekStart(now);
    const futureLessons = events.filter(e => {
      if (e.type !== 'lesson') return false;
      return new Date(e.endTime).getTime() > now.getTime();
    });

    // Find the last lesson date
    let lastLessonDate: string | null = null;
    let lastLessonWeek: string | null = null;
    let daysUntilLastLesson: number | null = null;
    if (futureLessons.length > 0) {
      const sortedFuture = futureLessons.sort((a, b) =>
        new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      );
      lastLessonDate = toDateStr(new Date(
        Date.UTC(
          new Date(sortedFuture[0].endTime).getFullYear(),
          new Date(sortedFuture[0].endTime).getMonth(),
          new Date(sortedFuture[0].endTime).getDate()
        )
      ));
      lastLessonWeek = getWeekStart(new Date(sortedFuture[0].endTime));
      daysUntilLastLesson = Math.max(1, Math.ceil((new Date(sortedFuture[0].endTime).getTime() - now.getTime()) / 86400000));
    }

    // Estimate how many tasks each future lesson generates
    // Based on course preferences (same logic as TaskManager)
    let estimatedFutureTasksPerLesson = 0;
    const courseSet = new Set(futureLessons.map(e => e.courseId).filter(Boolean));
    for (const courseId of courseSet) {
      const course = courses.find(c => c.id === courseId);
      if (!course) continue;
      let tasksPerLesson = 1; // Always at least the follow/recover task
      if (course.defaultStudyPreferences.requiresNotesRevision) tasksPerLesson++;
      if (course.defaultStudyPreferences.requiresExercises) tasksPerLesson++;
      estimatedFutureTasksPerLesson += tasksPerLesson;
    }

    // Group future lessons by week to get tasks per future week
    const futureWeekLessonCount = new Map<string, number>();
    for (const lesson of futureLessons) {
      const week = getWeekStart(new Date(lesson.endTime));
      const course = courses.find(c => c.id === lesson.courseId);
      if (!course) continue;
      let count = 1;
      if (course.defaultStudyPreferences.requiresNotesRevision) count++;
      if (course.defaultStudyPreferences.requiresExercises) count++;
      futureWeekLessonCount.set(week, (futureWeekLessonCount.get(week) || 0) + count);
    }

    // Average tasks per week from future lessons (for the short view regression fallback)
    const futureWeeks = Array.from(futureWeekLessonCount.values());
    const totalFutureTasks = futureWeeks.reduce((a, b) => a + b, 0);
    const avgFutureTasksPerWeek = futureWeeks.length > 0
      ? totalFutureTasks / futureWeeks.length
      : recentCreated; // fallback to historical rate

    // ─── Determine analysis status ───
    let flowAnalysis: FlowAnalysis;
    if (currentBacklog <= 0) {
      flowAnalysis = {
        status: 'caught_up',
        message: 'Sei a pari! 🎉',
        detail: 'Hai completato tutti i task creati. Le linee si sovrappongono — ottimo lavoro!',
        estimatedCatchUpWeek: null,
        currentBacklog: 0,
        avgCreatedPerWeek: Math.round(recentCreated * 10) / 10,
        avgCompletedPerWeek: Math.round(recentCompleted * 10) / 10,
        netVelocity: Math.round(netVelocity * 10) / 10,
      };
    } else if (netVelocity > 0.5) {
      flowAnalysis = {
        status: 'catching_up',
        message: 'Stai recuperando! 📈',
        detail: `Le linee convergono: completi più task di quanti ne arrivano. Backlog attuale: ${currentBacklog} task.`,
        estimatedCatchUpWeek: null, // Will be set per-view
        currentBacklog,
        avgCreatedPerWeek: Math.round(recentCreated * 10) / 10,
        avgCompletedPerWeek: Math.round(recentCompleted * 10) / 10,
        netVelocity: Math.round(netVelocity * 10) / 10,
      };
    } else if (netVelocity < -0.5) {
      flowAnalysis = {
        status: 'falling_behind',
        message: 'Stai accumulando ritardo 📉',
        detail: `Le linee divergono: arrivano più task di quanti ne completi. Backlog attuale: ${currentBacklog} task. Prova ad aumentare il ritmo!`,
        estimatedCatchUpWeek: null,
        currentBacklog,
        avgCreatedPerWeek: Math.round(recentCreated * 10) / 10,
        avgCompletedPerWeek: Math.round(recentCompleted * 10) / 10,
        netVelocity: Math.round(netVelocity * 10) / 10,
      };
    } else {
      flowAnalysis = {
        status: 'keeping_pace',
        message: 'Stai tenendo il passo ➡️',
        detail: `Le linee sono parallele: mantieni un ritmo stabile. Backlog attuale: ${currentBacklog} task.`,
        estimatedCatchUpWeek: null,
        currentBacklog,
        avgCreatedPerWeek: Math.round(recentCreated * 10) / 10,
        avgCompletedPerWeek: Math.round(recentCompleted * 10) / 10,
        netVelocity: Math.round(netVelocity * 10) / 10,
      };
    }

    // ═══════════════════════════════════════════════════
    // ─── SHORT VIEW (current: 8-week regression) ───
    // ═══════════════════════════════════════════════════
    const shortMaxWeeks = 8;
    const shortProjCreated: (number | null)[] = new Array(numWeeks).fill(null);
    const shortProjCompleted: (number | null)[] = new Array(numWeeks).fill(null);
    const shortProjLabels: string[] = [];

    shortProjCreated[numWeeks - 1] = cumulativeCreated[numWeeks - 1];
    shortProjCompleted[numWeeks - 1] = cumulativeCompleted[numWeeks - 1];

    let shortIntersection: number | null = null;
    let shortCatchUpLabel: string | null = null;

    if (currentBacklog > 0) {
      if (regCompleted.m > regCreated.m) {
        const xIntersection = (regCreated.b - regCompleted.b) / (regCompleted.m - regCreated.m);
        const weeksToIntersect = Math.ceil(xIntersection - (numWeeks - 1));
        if (weeksToIntersect > 0 && weeksToIntersect < 104) {
          shortCatchUpLabel = formatLongDate(addWeeks(lastWeekStr, weeksToIntersect));
          flowAnalysis.estimatedCatchUpWeek = shortCatchUpLabel;
        }
      }
    }

    for (let i = 1; i <= shortMaxWeeks; i++) {
      const xVal = numWeeks - 1 + i;
      const projCreated = Math.max(regCreated.m * xVal + regCreated.b, cumulativeCreated[numWeeks - 1]);
      const projCompleted = Math.max(regCompleted.m * xVal + regCompleted.b, cumulativeCompleted[numWeeks - 1]);

      shortProjCreated.push(projCreated);
      shortProjCompleted.push(projCompleted);

      const futureWeekStr = addWeeks(lastWeekStr, i);
      shortProjLabels.push(formatWeekLabel(futureWeekStr));

      if (shortIntersection === null && projCompleted >= projCreated && currentBacklog > 0) {
        shortIntersection = numWeeks - 1 + i;
      }
    }

    const shortView: ChartViewData = {
      allLabels: [...weekLabels, ...shortProjLabels],
      cumulativeCreated,
      cumulativeCompleted,
      projectedCreated: shortProjCreated,
      projectedCompleted: shortProjCompleted,
      intersectionIndex: shortIntersection,
      estimatedCatchUpLabel: shortCatchUpLabel,
      lessonsEndIndex: null,
      lessonsEndLabel: null,
    };

    // ═══════════════════════════════════════════════════════════════
    // ─── SEMESTER VIEW (full: until lessons end + catch-up) ───
    // ═══════════════════════════════════════════════════════════════
    let semesterView: ChartViewData | null = null;

    if (lastLessonWeek) {
      // How many weeks from now until last lesson?
      const weeksUntilEnd = Math.max(1, weeksBetween(lastWeekStr, lastLessonWeek));
      // After lessons end, extend further until catch-up or max 20 extra weeks
      const maxPostLessonWeeks = 30;

      const semProjCreated: (number | null)[] = new Array(numWeeks).fill(null);
      const semProjCompleted: (number | null)[] = new Array(numWeeks).fill(null);
      const semProjLabels: string[] = [];

      semProjCreated[numWeeks - 1] = cumulativeCreated[numWeeks - 1];
      semProjCompleted[numWeeks - 1] = cumulativeCompleted[numWeeks - 1];

      let semIntersection: number | null = null;
      let semCatchUpLabel: string | null = null;
      let lessonsEndIndex: number | null = null;
      let lessonsEndLabel: string | null = null;
      let runningCreatedTotal = cumulativeCreated[numWeeks - 1];

      // Total projection = until lessons end + post-lesson buffer
      const totalProjectWeeks = weeksUntilEnd + maxPostLessonWeeks;

      for (let i = 1; i <= totalProjectWeeks; i++) {
        const futureWeekStr = addWeeks(lastWeekStr, i);

        // ─── CREATED LINE ───
        // Before lessons end: add estimated tasks from scheduled future lessons
        // After lessons end: line goes flat (no new tasks)
        if (i <= weeksUntilEnd) {
          // Use actual future lesson data for this specific week
          const tasksThisWeek = futureWeekLessonCount.get(futureWeekStr) || 0;
          runningCreatedTotal += tasksThisWeek;
        }
        // After weeksUntilEnd: runningCreatedTotal stays flat

        semProjCreated.push(runningCreatedTotal);

        // ─── COMPLETED LINE ───
        // Keep using regression slope (study pace continues)
        const xVal = numWeeks - 1 + i;
        const projCompleted = Math.max(
          regCompleted.m * xVal + regCompleted.b,
          cumulativeCompleted[numWeeks - 1]
        );
        semProjCompleted.push(projCompleted);

        semProjLabels.push(formatWeekLabel(futureWeekStr));

        // Mark where lessons end
        if (lessonsEndIndex === null && i >= weeksUntilEnd) {
          lessonsEndIndex = numWeeks - 1 + i;
          lessonsEndLabel = formatLongDate(futureWeekStr);
        }

        // Detect catch-up intersection (after all data is flat)
        if (semIntersection === null && projCompleted >= runningCreatedTotal && currentBacklog > 0) {
          semIntersection = numWeeks - 1 + i;
          semCatchUpLabel = formatLongDate(futureWeekStr);
        }

        // If we've already caught up past the lesson end, stop extending
        if (i > weeksUntilEnd && semIntersection !== null) {
          // Add a few more weeks for visual context
          if (i > weeksUntilEnd + 3) break;
        }
      }

      semesterView = {
        allLabels: [...weekLabels, ...semProjLabels],
        cumulativeCreated,
        cumulativeCompleted,
        projectedCreated: semProjCreated,
        projectedCompleted: semProjCompleted,
        intersectionIndex: semIntersection,
        estimatedCatchUpLabel: semCatchUpLabel,
        lessonsEndIndex,
        lessonsEndLabel,
      };
    }

    return {
      flowAnalysis,
      shortView,
      semesterView,
      lastLessonDate,
      totalFutureTasks,
      futureTasksPerWeek: Math.round(avgFutureTasksPerWeek * 10) / 10,
      daysUntilLastLesson,
    };
  }, [tasks, events, courses]);

  // ─── No data state ───
  if (analysis.flowAnalysis.status === 'no_data') {
    return (
      <GlassPanel className="dashboard-chart-panel">
        <div className="workload-flow-header">
          <Activity size={20} />
          <h3 className="dashboard-label">FLUSSO CARICO / STUDIO</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
          {analysis.flowAnalysis.detail}
        </p>
      </GlassPanel>
    );
  }

  // ─── Select active view data ───
  const activeView = viewMode === 'semester' && analysis.semesterView
    ? analysis.semesterView
    : analysis.shortView!;

  const hasSemesterView = analysis.semesterView !== null;

  // ─── Status colors ───
  const statusColor =
    analysis.flowAnalysis.status === 'caught_up' ? 'rgba(16, 185, 129, 1)' :
    analysis.flowAnalysis.status === 'catching_up' ? 'rgba(16, 185, 129, 1)' :
    analysis.flowAnalysis.status === 'falling_behind' ? 'rgba(220, 53, 69, 1)' :
    'rgba(245, 158, 11, 1)';

  const statusBg =
    analysis.flowAnalysis.status === 'caught_up' ? 'rgba(16, 185, 129, 0.08)' :
    analysis.flowAnalysis.status === 'catching_up' ? 'rgba(16, 185, 129, 0.08)' :
    analysis.flowAnalysis.status === 'falling_behind' ? 'rgba(220, 53, 69, 0.08)' :
    'rgba(245, 158, 11, 0.08)';

  const StatusIcon =
    analysis.flowAnalysis.status === 'catching_up' || analysis.flowAnalysis.status === 'caught_up' ? TrendingUp :
    analysis.flowAnalysis.status === 'falling_behind' ? TrendingDown :
    Equal;

  // ─── Build chart data from active view ───
  const totalPoints = activeView.allLabels.length;

  const chartData = {
    labels: activeView.allLabels,
    datasets: [
      {
        label: 'Carico cumulato (task aggiunti)',
        data: [
          ...activeView.cumulativeCreated,
          ...new Array(totalPoints - activeView.cumulativeCreated.length).fill(null),
        ],
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        borderWidth: 2.5,
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        pointBackgroundColor: 'rgba(239, 68, 68, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
      },
      {
        label: 'Studio cumulato (task completati)',
        data: [
          ...activeView.cumulativeCompleted,
          ...new Array(totalPoints - activeView.cumulativeCompleted.length).fill(null),
        ],
        borderColor: 'rgba(16, 185, 129, 1)',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: 2.5,
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 1.5,
        pointHoverRadius: 6,
      },
      {
        label: viewMode === 'semester' ? 'Carico previsto (da lezioni)' : 'Proiezione carico',
        data: activeView.projectedCreated,
        borderColor: 'rgba(239, 68, 68, 0.5)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.1,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
      {
        label: 'Proiezione studio',
        data: activeView.projectedCompleted,
        borderColor: 'rgba(16, 185, 129, 0.5)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.1,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
    ],
  };

  // ─── Annotations ───
  const annotations: Record<string, any> = {};

  // Catch-up intersection
  if (activeView.intersectionIndex !== null) {
    annotations['intersectionLine'] = {
      type: 'line',
      xMin: activeView.intersectionIndex,
      xMax: activeView.intersectionIndex,
      borderColor: 'rgba(124, 58, 237, 0.6)',
      borderWidth: 2,
      borderDash: [4, 4],
      label: {
        display: true,
        content: '🎯 Catch-up!',
        position: 'start',
        backgroundColor: 'rgba(124, 58, 237, 0.8)',
        color: '#fff',
        font: { size: 11, weight: 'bold' as const },
        padding: 6,
        borderRadius: 6,
      },
    };
  }

  // Lessons end marker (semester view only)
  if (viewMode === 'semester' && activeView.lessonsEndIndex !== null) {
    annotations['lessonsEnd'] = {
      type: 'line',
      xMin: activeView.lessonsEndIndex,
      xMax: activeView.lessonsEndIndex,
      borderColor: 'rgba(245, 158, 11, 0.6)',
      borderWidth: 2,
      borderDash: [8, 4],
      label: {
        display: true,
        content: '📚 Fine lezioni',
        position: 'end',
        backgroundColor: 'rgba(245, 158, 11, 0.85)',
        color: '#fff',
        font: { size: 11, weight: 'bold' as const },
        padding: 6,
        borderRadius: 6,
      },
    };
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { font: { size: 11 }, usePointStyle: true },
      },
      tooltip: {
        callbacks: {
          afterBody: (tooltipItems: any[]) => {
            const created = tooltipItems.find((i: any) =>
              i.dataset.label?.includes('Carico'));
            const completed = tooltipItems.find((i: any) =>
              i.dataset.label?.includes('Studio'));
            if (created && completed && created.parsed.y != null && completed.parsed.y != null) {
              const backlog = Math.round(created.parsed.y - completed.parsed.y);
              return `\n📊 Backlog: ${backlog} task`;
            }
            return '';
          },
        },
      },
      annotation: { annotations },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Task cumulativi', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        title: { display: true, text: 'Settimana (inizio)', font: { size: 11 } },
        grid: { display: false },
      },
    },
  };

  return (
    <GlassPanel className="dashboard-chart-panel">
      {/* Header with view toggle */}
      <div className="workload-flow-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} />
          <h3 className="dashboard-label" style={{ margin: 0 }}>FLUSSO CARICO vs STUDIO</h3>
        </div>

        {hasSemesterView && (
          <div className="workload-flow-view-toggle">
            <button
              className={`workload-flow-view-btn ${viewMode === 'short' ? 'active' : ''}`}
              onClick={() => setViewMode('short')}
              title="Vista breve: proiezione a 8 settimane"
            >
              <ZoomIn size={14} />
              Breve
            </button>
            <button
              className={`workload-flow-view-btn ${viewMode === 'semester' ? 'active' : ''}`}
              onClick={() => setViewMode('semester')}
              title="Vista semestre: fino a fine lezioni e catch-up"
            >
              <ZoomOut size={14} />
              Semestre
            </button>
          </div>
        )}
      </div>

      {/* Status Banner */}
      <div
        className="workload-flow-status"
        style={{ borderLeft: `4px solid ${statusColor}`, background: statusBg }}
      >
        <div className="workload-flow-status-main">
          <StatusIcon size={20} style={{ color: statusColor, flexShrink: 0 }} />
          <div>
            <strong style={{ color: statusColor }}>{analysis.flowAnalysis.message}</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              {analysis.flowAnalysis.detail}
            </p>
          </div>
        </div>

        <div className="workload-flow-metrics">
          <div className="workload-flow-metric-chip">
            <span className="workload-flow-metric-value" style={{ color: 'rgba(239, 68, 68, 1)' }}>
              {analysis.flowAnalysis.avgCreatedPerWeek}
            </span>
            <span className="workload-flow-metric-label">Task/sett. aggiunti</span>
          </div>
          <div className="workload-flow-metric-chip">
            <span className="workload-flow-metric-value" style={{ color: 'rgba(16, 185, 129, 1)' }}>
              {analysis.flowAnalysis.avgCompletedPerWeek}
            </span>
            <span className="workload-flow-metric-label">Task/sett. completati</span>
          </div>
          <div className="workload-flow-metric-chip">
            <span className="workload-flow-metric-value" style={{ color: statusColor }}>
              {analysis.flowAnalysis.netVelocity > 0 ? '+' : ''}{analysis.flowAnalysis.netVelocity}
            </span>
            <span className="workload-flow-metric-label">Velocità netta</span>
          </div>
          {(activeView.estimatedCatchUpLabel || analysis.semesterView?.estimatedCatchUpLabel) && (
            <div className="workload-flow-metric-chip">
              <Crosshair size={14} style={{ color: 'rgba(124, 58, 237, 1)' }} />
              <span className="workload-flow-metric-label">
                A pari: <strong>{activeView.estimatedCatchUpLabel || analysis.semesterView?.estimatedCatchUpLabel}</strong>
              </span>
            </div>
          )}
          {analysis.lastLessonDate && (
            <div className="workload-flow-metric-chip">
              <Calendar size={14} style={{ color: 'rgba(245, 158, 11, 1)' }} />
              <span className="workload-flow-metric-label">
                Fine lezioni: <strong>{formatLongDate(analysis.lastLessonDate)}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Semester-specific info */}
      {viewMode === 'semester' && analysis.lastLessonDate && (
        <div style={{
          padding: '10px 14px',
          marginBottom: '16px',
          borderRadius: '8px',
          background: 'rgba(245, 158, 11, 0.06)',
          border: '1px solid rgba(245, 158, 11, 0.2)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
        }}>
          📚 Dopo il <strong>{formatLongDate(analysis.lastLessonDate)}</strong> non verranno più aggiunte lezioni → la linea rossa diventa <strong>piatta</strong>.
          {activeView.intersectionIndex !== null
            ? <> La linea verde la raggiungerà — sarai a pari! 🎯</>
            : <> Continua a completare task per raggiungere la parità.</>
          }
        </div>
      )}

      {/* Obiettivi Giornalieri */}
      {analysis.flowAnalysis.status !== 'no_data' && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '16px'
        }}>
          <div style={{ flex: 1, minWidth: '200px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '3px solid rgba(16, 185, 129, 1)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Stare al passo (rette parallele)
              <button 
                onClick={() => setInfoPopup({
                  title: 'Stare al passo',
                  formula: 'Math.ceil(Media task aggiunti a settimana / 7 giorni)',
                  calc: `Math.ceil(${analysis.flowAnalysis.avgCreatedPerWeek} / 7) = ${Math.max(0, Math.ceil(analysis.flowAnalysis.avgCreatedPerWeek / 7))}`
                })}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', opacity: 0.7 }}
                title="Vedi calcolo"
              >
                <Info size={14} />
              </button>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{Math.max(0, Math.ceil(analysis.flowAnalysis.avgCreatedPerWeek / 7))} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>task/giorno</span></div>
          </div>
          
          <div style={{ flex: 1, minWidth: '200px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '3px solid rgba(245, 158, 11, 1)' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Recuperare entro 7 giorni
              <button 
                onClick={() => setInfoPopup({
                  title: 'Recuperare entro 7 giorni',
                  formula: 'Math.ceil((Media task aggiunti a settimana / 7) + (Backlog attuale / 7))',
                  calc: `Math.ceil((${analysis.flowAnalysis.avgCreatedPerWeek} / 7) + (${analysis.flowAnalysis.currentBacklog} / 7)) = ${Math.max(0, Math.ceil((analysis.flowAnalysis.avgCreatedPerWeek / 7) + (analysis.flowAnalysis.currentBacklog / 7)))}`
                })}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', opacity: 0.7 }}
                title="Vedi calcolo"
              >
                <Info size={14} />
              </button>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{Math.max(0, Math.ceil((analysis.flowAnalysis.avgCreatedPerWeek / 7) + (analysis.flowAnalysis.currentBacklog / 7)))} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>task/giorno</span></div>
          </div>
          
          {analysis.daysUntilLastLesson && analysis.daysUntilLastLesson > 0 && (
            <div style={{ flex: 1, minWidth: '200px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', borderLeft: '3px solid rgba(124, 58, 237, 1)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Essere in pari a fine corsi
                <button 
                  onClick={() => setInfoPopup({
                    title: 'Essere in pari a fine corsi',
                    formula: 'Math.ceil((Task futuri totali stimati + Backlog attuale) / Giorni alla fine delle lezioni)',
                    calc: `Math.ceil((${analysis.totalFutureTasks} + ${analysis.flowAnalysis.currentBacklog}) / ${analysis.daysUntilLastLesson}) = ${Math.max(0, Math.ceil((analysis.totalFutureTasks + analysis.flowAnalysis.currentBacklog) / analysis.daysUntilLastLesson))}`
                  })}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', opacity: 0.7 }}
                  title="Vedi calcolo"
                >
                  <Info size={14} />
                </button>
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{Math.max(0, Math.ceil((analysis.totalFutureTasks + analysis.flowAnalysis.currentBacklog) / analysis.daysUntilLastLesson))} <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: 'var(--text-secondary)' }}>task/giorno</span></div>
            </div>
          )}
        </div>
      )}

      {/* Modal formula */}
      <Modal 
        isOpen={infoPopup !== null} 
        onClose={() => setInfoPopup(null)} 
        title={infoPopup?.title || 'Dettaglio calcolo'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Formula:</h4>
            <code style={{ display: 'block', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.85rem' }}>
              {infoPopup?.formula}
            </code>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Calcolo con valori attuali:</h4>
            <code style={{ display: 'block', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--accent-color, #10b981)' }}>
              {infoPopup?.calc}
            </code>
          </div>
        </div>
      </Modal>

      {/* Chart */}
      <div className="dashboard-chart" style={{ height: viewMode === 'semester' ? '380px' : '320px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Legend */}
      <div className="workload-flow-legend">
        <div className="workload-flow-legend-item">
          <span className="workload-flow-legend-line" style={{ backgroundColor: 'rgba(239, 68, 68, 1)' }} />
          <span><strong>Linea rossa</strong> — Task aggiunti cumulativi{viewMode === 'semester' ? ' (piatta dopo fine lezioni)' : ''}</span>
        </div>
        <div className="workload-flow-legend-item">
          <span className="workload-flow-legend-line" style={{ backgroundColor: 'rgba(16, 185, 129, 1)' }} />
          <span><strong>Linea verde</strong> — Task completati cumulativi</span>
        </div>
        <div className="workload-flow-legend-item">
          <span className="workload-flow-legend-line" style={{ backgroundColor: 'rgba(0,0,0,0.15)', height: '2px', borderTop: '2px dashed rgba(0,0,0,0.3)' }} />
          <span><strong>Tratteggiate</strong> — Proiezione futura{viewMode === 'semester' ? ' (basata su lezioni reali nel calendario)' : ' (regressione lineare)'}</span>
        </div>
        {viewMode === 'semester' && (
          <div className="workload-flow-legend-item">
            <span className="workload-flow-legend-line" style={{ backgroundColor: 'rgba(245, 158, 11, 0.7)' }} />
            <span><strong>Linea arancione</strong> — Fine lezioni: da qui la linea rossa diventa piatta</span>
          </div>
        )}
        <div className="workload-flow-legend-item" style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '4px' }}>
          La distanza verticale = <strong>backlog</strong>. Incrocio = parità raggiunta.
        </div>
      </div>
    </GlassPanel>
  );
}
