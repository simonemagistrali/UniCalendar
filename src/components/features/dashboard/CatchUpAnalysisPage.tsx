import { useMemo } from 'react';
import { Target, Calendar as CalendarIcon, TrendingUp, CheckCircle, Clock, BarChart3, AlertCircle } from 'lucide-react';
import { GlassPanel } from '../../ui/GlassPanel';
import { useAppStore } from '../../../store/useAppStore';
import { CatchUpEngine } from '../../../core/CatchUpEngine';
import { FutureProjectionEngine } from '../../../core/FutureProjectionEngine';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function getStatusColor(percentage: number): string {
  if (percentage >= 80) return 'var(--accent-success)';
  if (percentage >= 50) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);

  if (diffDays <= 0) return 'Oggi';
  if (diffDays === 1) return 'Domani';

  return date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`;
  return `${m}m`;
}

export function CatchUpAnalysisPage() {
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const studySessions = useAppStore(s => s.studySessions);
  const performanceHistory = useAppStore(s => s.performanceHistory);

  // Calcolo stato attuale
  const catchUpSummary = useMemo(() => {
    return CatchUpEngine.calculate(events, courses, tasks, studySessions);
  }, [events, courses, tasks, studySessions]);

  // Proiezione a 14 giorni
  const projection = useMemo(() => {
    return FutureProjectionEngine.project(events, courses, tasks, performanceHistory, 14);
  }, [events, courses, tasks, performanceHistory]);

  const globalColor = getStatusColor(catchUpSummary.globalPercentage);

  // Configurazione grafico a barre (prossimi 14 giorni)
  const chartData = useMemo(() => {
    const labels = [];
    const dataPoints = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
      labels.push(label);
      dataPoints.push(Math.round((projection.projectionByDay[dayKey] || 0) / 60 * 10) / 10);
    }

    return {
      labels,
      datasets: [
        {
          label: 'Ore previste di task futuri',
          data: dataPoints,
          backgroundColor: 'rgba(124, 58, 237, 0.5)', // var(--accent-primary) with opacity
          borderColor: 'rgba(124, 58, 237, 1)',
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    };
  }, [projection]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.parsed.y} h`,
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Ore di studio'
        }
      }
    }
  };

  if (courses.length === 0) {
    return (
      <div className="analysis-empty" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Nessun corso attivo per generare un'analisi.
      </div>
    );
  }

  return (
    <div className="analysis-page-layout" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '16px' }}>
      
      {/* GLOBAL STATUS HEADER */}
      <GlassPanel style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '1.5rem', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={24} color={globalColor} />
              Stato Globale Recupero
            </h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
              Panoramica dinamica di come sei messo con le materie e del carico di lavoro in arrivo.
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: globalColor }}>
              {catchUpSummary.globalPercentage}%
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Completamento</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div className="analysis-stat-chip" style={{ background: 'var(--bg-tertiary)', padding: '12px 16px', borderRadius: '12px', flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <CalendarIcon size={16} />
              <strong style={{ fontSize: '1.1rem' }}>Previsto: {formatDate(catchUpSummary.globalCatchUpDate)}</strong>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Stima fine task attuali</div>
          </div>
          
          <div className="analysis-stat-chip" style={{ background: catchUpSummary.globalPlanningCaughtUp ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', padding: '12px 16px', borderRadius: '12px', flex: 1, minWidth: '200px', border: `1px solid ${catchUpSummary.globalPlanningCaughtUp ? 'var(--accent-success)' : 'var(--accent-warning)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', color: catchUpSummary.globalPlanningCaughtUp ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
              {catchUpSummary.globalPlanningCaughtUp ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
              <strong style={{ fontSize: '1.1rem' }}>
                {catchUpSummary.globalPlanningCaughtUp ? 'Pianificazione in Pari' : 'Ritardo Pianificazione'}
              </strong>
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {catchUpSummary.globalPlanningCaughtUp ? 'Nessun accavallamento con nuove lezioni.' : 'Attenzione: i task si accavalleranno con le prossime lezioni.'}
            </div>
          </div>
        </div>
      </GlassPanel>

      {/* FUTURE PROJECTION CHART */}
      <GlassPanel>
        <div style={{ marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} color="var(--accent-primary)" />
            Proiezione Carico Futuro (14 gg)
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Stima dei nuovi task che verranno generati dalle lezioni future, adattata sulla tua frequenza passata. Totale stimato: <strong>{formatMinutes(projection.totalProjectedMinutes)}</strong>
          </p>
        </div>
        <div style={{ height: '250px', width: '100%' }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </GlassPanel>

      {/* COURSE BY COURSE BREAKDOWN */}
      <h3 style={{ fontSize: '1.2rem', margin: '8px 0 0 0' }}>Dettaglio Materie</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {catchUpSummary.courses.filter(c => c.totalLessonsPast > 0 || projection.projectionByCourse[c.courseId]).map(cs => {
          const courseProjectionMinutes = projection.projectionByCourse[cs.courseId] || 0;
          
          return (
            <GlassPanel key={cs.courseId} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <span className="task-course-dot" style={{ backgroundColor: cs.courseColor, width: '16px', height: '16px' }} />
                <h4 style={{ margin: 0, fontSize: '1.1rem', flex: 1 }}>{cs.courseName}</h4>
                <span style={{ fontWeight: 600, color: getStatusColor(cs.catchUpPercentage), fontSize: '1.1rem' }}>
                  {cs.catchUpPercentage}%
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Task in attesa:</span>
                  <strong>{cs.pendingTasksCount} ({formatMinutes(cs.pendingMinutes)})</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Task futuri previsti:</span>
                  <strong>{formatMinutes(courseProjectionMinutes)} in arrivo</strong>
                </div>

                <div style={{ 
                  marginTop: '8px',
                  padding: '12px', 
                  borderRadius: '8px', 
                  background: cs.isPlanningCaughtUp ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                  borderLeft: `4px solid ${cs.isPlanningCaughtUp ? 'var(--accent-success)' : 'var(--accent-warning)'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: cs.isPlanningCaughtUp ? 'var(--accent-success)' : 'var(--accent-warning)', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>
                    {cs.isPlanningCaughtUp ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                    {cs.isPlanningCaughtUp ? 'Pianificazione Ok' : 'Pianificazione Indietro'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {cs.estimatedCatchUpDate ? (
                       <span>A pari il: <strong>{formatDate(cs.estimatedCatchUpDate)}</strong></span>
                    ) : (
                       <span>Nessun task in sospeso, sei a pari!</span>
                    )}
                  </div>
                </div>
              </div>
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}
