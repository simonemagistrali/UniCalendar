import { useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { GlassPanel } from '../../ui/GlassPanel';
import { useAppStore } from '../../../store/useAppStore';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export function EfficiencyDashboard() {
  const tasks = useAppStore(s => s.tasks);
  const performanceHistory = useAppStore(s => s.performanceHistory);
  const courses = useAppStore(s => s.courses);

  const stats = useMemo(() => {
    const doneTasks = tasks.filter(t => t.status === 'done' && t.actualDuration);
    const todoTasks = tasks.filter(t => t.status !== 'done');

    // Efficiency score
    let efficiency = 0;
    if (doneTasks.length > 0) {
      const totalEstimated = doneTasks.reduce((a, t) => a + t.estimatedDuration, 0);
      const totalActual = doneTasks.reduce((a, t) => a + (t.actualDuration || t.estimatedDuration), 0);
      efficiency = totalActual > 0 ? Math.min(100, Math.round((totalEstimated / totalActual) * 100)) : 0;
    }

    // Per-course comparison
    const courseStats = courses.map(c => {
      const courseTasks = doneTasks.filter(t => t.courseId === c.id);
      const est = courseTasks.reduce((a, t) => a + t.estimatedDuration, 0);
      const act = courseTasks.reduce((a, t) => a + (t.actualDuration || 0), 0);
      return { name: c.name, estimated: Math.round(est / 60 * 10) / 10, actual: Math.round(act / 60 * 10) / 10, color: c.color };
    }).filter(c => c.estimated > 0 || c.actual > 0);

    // Weekly trend (from performance history)
    const weeklyEfficiency: number[] = [];
    if (performanceHistory.length > 0) {
      const sorted = [...performanceHistory].sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime());
      const chunkSize = Math.max(1, Math.ceil(sorted.length / 4));
      for (let i = 0; i < 4; i++) {
        const chunk = sorted.slice(i * chunkSize, (i + 1) * chunkSize);
        if (chunk.length === 0) { weeklyEfficiency.push(0); continue; }
        const est = chunk.reduce((a, h) => a + h.estimatedMinutes, 0);
        const act = chunk.reduce((a, h) => a + h.actualMinutes, 0);
        weeklyEfficiency.push(act > 0 ? Math.min(100, Math.round((est / act) * 100)) : 0);
      }
    }

    // Trend
    let trend: 'up' | 'down' | 'flat' = 'flat';
    if (weeklyEfficiency.length >= 2) {
      const last = weeklyEfficiency[weeklyEfficiency.length - 1];
      const prev = weeklyEfficiency[weeklyEfficiency.length - 2];
      if (last > prev + 2) trend = 'up';
      else if (last < prev - 2) trend = 'down';
    }

    // Attendance rate
    const lessonTasks = doneTasks.filter(t => t.title.startsWith('Seguire/Recuperare lezione'));
    let attendanceRate: number | null = null;
    let attendedCount = 0;
    let recoveredCount = 0;
    if (lessonTasks.length > 0) {
      attendedCount = lessonTasks.filter(t => t.completionMode === 'attended').length;
      recoveredCount = lessonTasks.filter(t => t.completionMode === 'recovered').length;
      const totalTracked = attendedCount + recoveredCount;
      if (totalTracked > 0) {
        attendanceRate = Math.round((attendedCount / totalTracked) * 100);
      }
    }

    return { efficiency, doneTasks: doneTasks.length, todoTasks: todoTasks.length, courseStats, weeklyEfficiency, trend, attendanceRate, attendedCount, recoveredCount };
  }, [tasks, performanceHistory, courses]);

  const barData = {
    labels: stats.courseStats.length > 0 ? stats.courseStats.map(c => c.name) : ['Nessun dato'],
    datasets: [
      {
        label: 'Stimato (h)',
        data: stats.courseStats.length > 0 ? stats.courseStats.map(c => c.estimated) : [0],
        backgroundColor: 'rgba(209, 213, 219, 0.6)',
        borderRadius: 4,
      },
      {
        label: 'Reale (h)',
        data: stats.courseStats.length > 0 ? stats.courseStats.map(c => c.actual) : [0],
        backgroundColor: 'rgba(26, 115, 232, 0.8)',
        borderRadius: 4,
      },
    ],
  };

  const lineData = {
    labels: ['Periodo 1', 'Periodo 2', 'Periodo 3', 'Periodo 4'],
    datasets: [
      {
        label: 'Efficienza (%)',
        data: stats.weeklyEfficiency.length > 0 ? stats.weeklyEfficiency : [0, 0, 0, 0],
        borderColor: 'rgba(24, 128, 56, 1)',
        backgroundColor: 'rgba(24, 128, 56, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: 'rgba(24, 128, 56, 1)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { font: { size: 11 } } },
    },
    scales: {
      y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
      x: { grid: { display: false } },
    },
  };

  const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stats.trend === 'up' ? 'var(--accent-success)' : stats.trend === 'down' ? 'var(--accent-danger)' : 'var(--text-secondary)';

  return (
    <div className="dashboard-container">
      {/* Score Card */}
      <GlassPanel>
        <div className="dashboard-score-header">
          <div>
            <h3 className="dashboard-label">EFFICIENZA STUDIO</h3>
            <div className="dashboard-score-row">
              <span className="dashboard-score">{stats.efficiency || '—'}%</span>
              <span className="dashboard-trend" style={{ color: trendColor }}>
                <TrendIcon size={16} />
              </span>
            </div>
          </div>
          <div className="dashboard-quick-stats">
            <div className="dashboard-stat">
              <span className="dashboard-stat-num">{stats.todoTasks}</span>
              <span className="dashboard-stat-label">Da fare</span>
            </div>
            <div className="dashboard-stat">
              <span className="dashboard-stat-num">{stats.doneTasks}</span>
              <span className="dashboard-stat-label">Completate</span>
            </div>
            {stats.attendanceRate !== null && (
              <div className="dashboard-stat">
                <span className="dashboard-stat-num" style={{ color: stats.attendanceRate < 50 ? 'var(--accent-danger)' : 'inherit' }}>
                  {stats.attendanceRate}%
                </span>
                <span className="dashboard-stat-label">Frequenza</span>
              </div>
            )}
          </div>
        </div>
        {stats.attendanceRate !== null && stats.attendanceRate < 50 && (
          <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'rgba(220, 53, 69, 0.1)', color: 'var(--accent-danger)', borderRadius: '8px', fontSize: '0.85rem' }}>
            <strong>Attenzione:</strong> Stai saltando molte lezioni (tasso di recupero: {100 - stats.attendanceRate}%). Questo potrebbe rallentare la tua preparazione!
          </div>
        )}
        {stats.doneTasks === 0 && (
          <p className="dashboard-hint">Completa delle attività per vedere le statistiche!</p>
        )}
      </GlassPanel>

      {/* Bar Chart */}
      <GlassPanel className="dashboard-chart-panel">
        <h3 className="dashboard-label">TEMPO STIMATO vs REALE</h3>
        <div className="dashboard-chart">
          <Bar data={barData} options={chartOptions} />
        </div>
      </GlassPanel>

      {/* Line Chart */}
      <GlassPanel className="dashboard-chart-panel">
        <h3 className="dashboard-label">ANDAMENTO NEL TEMPO</h3>
        <div className="dashboard-chart">
          <Line data={lineData} options={chartOptions} />
        </div>
      </GlassPanel>
    </div>
  );
}
