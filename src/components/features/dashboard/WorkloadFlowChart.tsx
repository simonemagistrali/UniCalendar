import { useMemo } from 'react';
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
import { Activity, TrendingUp, TrendingDown, Equal, Crosshair } from 'lucide-react';

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

/**
 * Get the Monday of the week for a given date (ISO week).
 * Uses pure string arithmetic to avoid any timezone issues.
 */
function getWeekStart(date: Date): string {
  // Work entirely in UTC to avoid timezone shifts
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay(); // 0=Sunday, 1=Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // Shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  // Return YYYY-MM-DD from UTC
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Format a YYYY-MM-DD week start date to a readable label */
function formatWeekLabel(weekStart: string): string {
  // Parse as UTC to avoid shifts
  const parts = weekStart.split('-');
  const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/**
 * Add N weeks to a YYYY-MM-DD string, returns YYYY-MM-DD.
 * Timezone-safe.
 */
function addWeeks(dateStr: string, weeks: number): string {
  const parts = dateStr.split('-');
  const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Simple linear regression: y = mx + b
 * Returns slope m and intercept b
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
  netVelocity: number; // positive = catching up
}

const NO_DATA_RESULT = {
  weekLabels: [] as string[],
  cumulativeCreated: [] as number[],
  cumulativeCompleted: [] as number[],
  projectedCreated: [] as (number | null)[],
  projectedCompleted: [] as (number | null)[],
  allLabels: [] as string[],
  flowAnalysis: {
    status: 'no_data',
    message: 'Nessun dato disponibile',
    detail: 'Aggiungi e completa task per iniziare a vedere le statistiche.',
    estimatedCatchUpWeek: null,
    currentBacklog: 0,
    avgCreatedPerWeek: 0,
    avgCompletedPerWeek: 0,
    netVelocity: 0,
  } as FlowAnalysis,
  intersectionIndex: null as number | null,
};

export function WorkloadFlowChart() {
  const tasks = useAppStore(s => s.tasks);

  const analysis = useMemo(() => {
    // Collect all tasks with createdAt timestamp (exclude phantom/predicted tasks)
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

    // Sort weeks chronologically
    const sortedWeeks = Array.from(weekMap.keys()).sort();
    if (sortedWeeks.length === 0) return NO_DATA_RESULT;

    // Fill in any missing weeks between first and last (timezone-safe)
    const filledWeeks: string[] = [];
    const firstWeekStr = sortedWeeks[0];
    const lastWeekStr = sortedWeeks[sortedWeeks.length - 1];

    let cursorStr = firstWeekStr;
    while (cursorStr <= lastWeekStr) {
      filledWeeks.push(cursorStr);
      if (!weekMap.has(cursorStr)) weekMap.set(cursorStr, { created: 0, completed: 0 });
      cursorStr = addWeeks(cursorStr, 1);
    }

    // ─── Compute cumulative sums ───
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

    // ─── Analysis ───
    const currentBacklog = totalCreated - totalCompleted;
    const numWeeks = filledWeeks.length;

    // Calculate average rates (use last 4 data-bearing weeks if available)
    // FIX: ensure lookback index never goes negative
    const recentWindow = Math.min(4, numWeeks - 1);
    const lookbackIndex = Math.max(0, numWeeks - 1 - recentWindow);
    const recentCreated = recentWindow > 0
      ? (cumulativeCreated[numWeeks - 1] - cumulativeCreated[lookbackIndex]) / recentWindow
      : totalCreated;
    const recentCompleted = recentWindow > 0
      ? (cumulativeCompleted[numWeeks - 1] - cumulativeCompleted[lookbackIndex]) / recentWindow
      : totalCompleted;

    const netVelocity = recentCompleted - recentCreated; // positive = reducing backlog

    // ─── Linear Regression for Projection ───
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

    // Project forward up to 8 weeks
    const maxProjectionWeeks = 8;
    const projectedCreated: (number | null)[] = new Array(numWeeks).fill(null);
    const projectedCompleted: (number | null)[] = new Array(numWeeks).fill(null);
    const projectedLabels: string[] = [];

    // Bridge: connect projection to last actual data point
    projectedCreated[numWeeks - 1] = cumulativeCreated[numWeeks - 1];
    projectedCompleted[numWeeks - 1] = cumulativeCompleted[numWeeks - 1];

    let intersectionIndex: number | null = null;
    let estimatedCatchUpWeek: string | null = null;

    for (let i = 1; i <= maxProjectionWeeks; i++) {
      const xVal = numWeeks - 1 + i;
      const projCreated = Math.max(regCreated.m * xVal + regCreated.b, cumulativeCreated[numWeeks - 1]);
      const projCompleted = Math.max(regCompleted.m * xVal + regCompleted.b, cumulativeCompleted[numWeeks - 1]);

      projectedCreated.push(projCreated);
      projectedCompleted.push(projCompleted);

      // Generate future week label (timezone-safe)
      const futureWeekStr = addWeeks(lastWeekStr, i);
      projectedLabels.push(formatWeekLabel(futureWeekStr));

      // Detect intersection (completed catches up to created)
      if (intersectionIndex === null && projCompleted >= projCreated && currentBacklog > 0) {
        intersectionIndex = numWeeks - 1 + i;
        const parts = futureWeekStr.split('-');
        const d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
        estimatedCatchUpWeek = d.toLocaleDateString('it-IT', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        });
      }
    }

    const allLabels = [...weekLabels, ...projectedLabels];

    // ─── Determine status ───
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
        estimatedCatchUpWeek,
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

    return {
      weekLabels,
      cumulativeCreated,
      cumulativeCompleted,
      projectedCreated,
      projectedCompleted,
      allLabels,
      flowAnalysis,
      intersectionIndex,
    };
  }, [tasks]);

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

  // ─── Chart Data ───
  const totalPoints = analysis.allLabels.length;

  const chartData = {
    labels: analysis.allLabels,
    datasets: [
      // Actual Created (solid red)
      {
        label: 'Carico cumulato (task aggiunti)',
        data: [
          ...analysis.cumulativeCreated,
          ...new Array(totalPoints - analysis.cumulativeCreated.length).fill(null),
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
      // Actual Completed (solid green)
      {
        label: 'Studio cumulato (task completati)',
        data: [
          ...analysis.cumulativeCompleted,
          ...new Array(totalPoints - analysis.cumulativeCompleted.length).fill(null),
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
      // Projected Created (dashed red)
      {
        label: 'Proiezione carico',
        data: analysis.projectedCreated,
        borderColor: 'rgba(239, 68, 68, 0.4)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.1,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
      // Projected Completed (dashed green)
      {
        label: 'Proiezione studio',
        data: analysis.projectedCompleted,
        borderColor: 'rgba(16, 185, 129, 0.4)',
        borderWidth: 2,
        borderDash: [6, 4],
        tension: 0.1,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 3,
      },
    ],
  };

  // Build annotation for intersection point
  const annotations: Record<string, any> = {};
  if (analysis.intersectionIndex !== null) {
    annotations['intersectionLine'] = {
      type: 'line',
      xMin: analysis.intersectionIndex,
      xMax: analysis.intersectionIndex,
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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          font: { size: 11 },
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          afterBody: (tooltipItems: any[]) => {
            const created = tooltipItems.find((i: any) => i.dataset.label?.includes('Carico'));
            const completed = tooltipItems.find((i: any) => i.dataset.label?.includes('Studio'));
            if (created && completed && created.parsed.y != null && completed.parsed.y != null) {
              const backlog = Math.round(created.parsed.y - completed.parsed.y);
              return `\n📊 Backlog: ${backlog} task`;
            }
            return '';
          },
        },
      },
      annotation: {
        annotations,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Task cumulativi',
          font: { size: 11 },
        },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
      x: {
        title: {
          display: true,
          text: 'Settimana (inizio)',
          font: { size: 11 },
        },
        grid: { display: false },
      },
    },
  };

  return (
    <GlassPanel className="dashboard-chart-panel">
      {/* Header */}
      <div className="workload-flow-header">
        <Activity size={20} />
        <h3 className="dashboard-label">FLUSSO CARICO vs STUDIO</h3>
      </div>

      {/* Status Banner */}
      <div
        className="workload-flow-status"
        style={{
          borderLeft: `4px solid ${statusColor}`,
          background: statusBg,
        }}
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

        {/* Metrics chips */}
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
          {analysis.flowAnalysis.estimatedCatchUpWeek && (
            <div className="workload-flow-metric-chip">
              <Crosshair size={14} style={{ color: 'rgba(124, 58, 237, 1)' }} />
              <span className="workload-flow-metric-label">
                A pari: <strong>{analysis.flowAnalysis.estimatedCatchUpWeek}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="dashboard-chart" style={{ height: '320px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Legend explanation */}
      <div className="workload-flow-legend">
        <div className="workload-flow-legend-item">
          <span className="workload-flow-legend-line" style={{ backgroundColor: 'rgba(239, 68, 68, 1)' }} />
          <span><strong>Linea rossa</strong> — Carico cumulato: quanti task sono stati <em>aggiunti</em> nel tempo</span>
        </div>
        <div className="workload-flow-legend-item">
          <span className="workload-flow-legend-line" style={{ backgroundColor: 'rgba(16, 185, 129, 1)' }} />
          <span><strong>Linea verde</strong> — Studio cumulato: quanti task sono stati <em>completati</em> nel tempo</span>
        </div>
        <div className="workload-flow-legend-item">
          <span className="workload-flow-legend-line" style={{ backgroundColor: 'rgba(0,0,0,0.15)', height: '2px', borderTop: '2px dashed rgba(0,0,0,0.3)' }} />
          <span><strong>Linee tratteggiate</strong> — Proiezione futura basata sulla regressione lineare</span>
        </div>
        <div className="workload-flow-legend-item" style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '4px' }}>
          La distanza verticale tra le due linee rappresenta il <strong>backlog</strong> (task arretrati).
          Quando le linee si incrociano = hai raggiunto la parità.
        </div>
      </div>
    </GlassPanel>
  );
}
