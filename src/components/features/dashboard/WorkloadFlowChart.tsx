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

/** Get the Monday of the week for a given date (ISO week) */
function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

/** Format a week start date to a readable label */
function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/**
 * Simple linear regression: y = mx + b
 * Returns slope m and intercept b
 */
function linearRegression(points: { x: number; y: number }[]): { m: number; b: number } {
  const n = points.length;
  if (n < 2) return { m: 0, b: 0 };

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

export function WorkloadFlowChart() {
  const tasks = useAppStore(s => s.tasks);

  const analysis = useMemo(() => {
    // Collect all tasks with createdAt timestamp
    const allTasks = tasks.filter(t => t.createdAt);

    if (allTasks.length === 0) {
      return {
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
    }

    // Build per-week created/completed counts
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

    // Sort weeks chronologically and fill gaps
    const sortedWeeks = Array.from(weekMap.keys()).sort();
    if (sortedWeeks.length === 0) {
      return {
        weekLabels: [],
        cumulativeCreated: [],
        cumulativeCompleted: [],
        projectedCreated: [] as (number | null)[],
        projectedCompleted: [] as (number | null)[],
        allLabels: [],
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
        intersectionIndex: null,
      };
    }

    // Fill in any missing weeks between first and last
    const filledWeeks: string[] = [];
    const firstWeek = new Date(sortedWeeks[0] + 'T00:00:00');
    const lastWeek = new Date(sortedWeeks[sortedWeeks.length - 1] + 'T00:00:00');
    const cursor = new Date(firstWeek);
    while (cursor <= lastWeek) {
      const weekKey = cursor.toISOString().split('T')[0];
      filledWeeks.push(weekKey);
      if (!weekMap.has(weekKey)) weekMap.set(weekKey, { created: 0, completed: 0 });
      cursor.setDate(cursor.getDate() + 7);
    }

    // Compute cumulative sums
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

    // Calculate average rates (use last 4 weeks if available for recent trend)
    const recentWindow = Math.min(4, numWeeks);
    const recentCreated = numWeeks >= 2
      ? (cumulativeCreated[numWeeks - 1] - cumulativeCreated[numWeeks - 1 - recentWindow]) / recentWindow
      : totalCreated / Math.max(1, numWeeks);
    const recentCompleted = numWeeks >= 2
      ? (cumulativeCompleted[numWeeks - 1] - cumulativeCompleted[numWeeks - 1 - recentWindow]) / recentWindow
      : totalCompleted / Math.max(1, numWeeks);

    const netVelocity = recentCompleted - recentCreated; // positive = reducing backlog

    // ─── Linear Regression for Projection ───
    // Use last 6 weeks (or all available) for regression
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

    // Start projection from last data point
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

      // Generate future week label
      const futureDate = new Date(lastWeek);
      futureDate.setDate(futureDate.getDate() + i * 7);
      projectedLabels.push(formatWeekLabel(futureDate.toISOString().split('T')[0]));

      // Detect intersection
      if (intersectionIndex === null && projCompleted >= projCreated && currentBacklog > 0) {
        intersectionIndex = numWeeks - 1 + i;
        const futureWeekDate = new Date(lastWeek);
        futureWeekDate.setDate(futureWeekDate.getDate() + i * 7);
        estimatedCatchUpWeek = futureWeekDate.toLocaleDateString('it-IT', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    }

    const allLabels = [...weekLabels, ...projectedLabels];

    // Determine status
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
    analysis.flowAnalysis.status === 'caught_up' ? 'var(--accent-success)' :
    analysis.flowAnalysis.status === 'catching_up' ? 'rgba(16, 185, 129, 1)' :
    analysis.flowAnalysis.status === 'falling_behind' ? 'var(--accent-danger)' :
    'var(--accent-warning)';

  const StatusIcon =
    analysis.flowAnalysis.status === 'catching_up' || analysis.flowAnalysis.status === 'caught_up' ? TrendingUp :
    analysis.flowAnalysis.status === 'falling_behind' ? TrendingDown :
    Equal;

  // ─── Chart Data ───
  const chartData = {
    labels: analysis.allLabels,
    datasets: [
      // Actual Created (solid)
      {
        label: 'Carico cumulato (task aggiunti)',
        data: [
          ...analysis.cumulativeCreated,
          ...new Array(analysis.allLabels.length - analysis.cumulativeCreated.length).fill(null),
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
      // Actual Completed (solid)
      {
        label: 'Studio cumulato (task completati)',
        data: [
          ...analysis.cumulativeCompleted,
          ...new Array(analysis.allLabels.length - analysis.cumulativeCompleted.length).fill(null),
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
      // Projected Created (dashed)
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
      // Projected Completed (dashed)
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

  // Add a shaded area between the two actual lines (backlog area)
  const chartDataWithFill = {
    ...chartData,
    datasets: [
      ...chartData.datasets,
      // Backlog fill area (between created and completed)
      {
        label: 'Backlog (differenza)',
        data: analysis.cumulativeCreated.map((val, i) => val),
        borderColor: 'transparent',
        backgroundColor: 'rgba(239, 68, 68, 0.06)',
        borderWidth: 0,
        tension: 0.3,
        fill: {
          target: '+1', // won't work perfectly but we handle it via tooltip
          above: 'rgba(239, 68, 68, 0.06)',
        },
        pointRadius: 0,
        pointHoverRadius: 0,
        // Hide from legend
        hidden: true,
      } as any,
    ],
  };

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
          filter: (item: any) => !item.text.includes('Backlog'),
        },
      },
      tooltip: {
        callbacks: {
          afterBody: (tooltipItems: any[]) => {
            const created = tooltipItems.find(i => i.dataset.label?.includes('Carico'));
            const completed = tooltipItems.find(i => i.dataset.label?.includes('Studio'));
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
          background: `${statusColor}10`,
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
              <Crosshair size={14} style={{ color: 'var(--accent-primary)' }} />
              <span className="workload-flow-metric-label">
                A pari: <strong>{analysis.flowAnalysis.estimatedCatchUpWeek}</strong>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="dashboard-chart" style={{ height: '320px' }}>
        <Line data={chartDataWithFill} options={chartOptions} />
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
