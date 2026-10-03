import { useMemo } from 'react';
import { 
  Target, Calendar as CalendarIcon, AlertTriangle, 
  CheckCircle, Clock, Zap, Flame, ThermometerSun, Info 
} from 'lucide-react';
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

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`;
  return `${m}m`;
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

export function CatchUpAnalysisPage() {
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const studySessions = useAppStore(s => s.studySessions);
  const performanceHistory = useAppStore(s => s.performanceHistory);
  const settings = useAppStore(s => s.settings);

  // Calcolo stato attuale
  const catchUpSummary = useMemo(() => {
    return CatchUpEngine.calculate(events, courses, tasks, studySessions);
  }, [events, courses, tasks, studySessions]);

  // Proiezione a 14 giorni
  const projection = useMemo(() => {
    return FutureProjectionEngine.project(events, courses, tasks, performanceHistory, 14);
  }, [events, courses, tasks, performanceHistory]);

  const dailyCapacityHours = settings?.maxStudyHoursPerDay || 4;

  // Analisi per Insight Generali
  const insights = useMemo(() => {
    let maxHours = 0;
    let busiestDay = '';
    let totalFuture = 0;

    const dataPoints = [];
    const labels = [];
    const colors = [];
    const today = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dayKey = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' });
      
      const mins = projection.projectionByDay[dayKey] || 0;
      const hours = Math.round(mins / 60 * 10) / 10;
      
      labels.push(label);
      dataPoints.push(hours);
      totalFuture += hours;

      if (hours > maxHours) {
        maxHours = hours;
        busiestDay = label;
      }

      // Color coding basato sulla capacità giornaliera (maxStudyHoursPerDay)
      if (hours > dailyCapacityHours * 0.9) {
        colors.push('rgba(239, 68, 68, 0.8)'); // Rosso (Pericolo/Saturazione)
      } else if (hours > dailyCapacityHours * 0.5) {
        colors.push('rgba(245, 158, 11, 0.8)'); // Giallo (Moderato)
      } else if (hours > 0) {
        colors.push('rgba(16, 185, 129, 0.8)'); // Verde (Leggero)
      } else {
        colors.push('rgba(200, 200, 200, 0.3)'); // Grigio (Vuoto)
      }
    }

    const totalPendingMins = catchUpSummary.courses.reduce((acc, c) => acc + c.pendingMinutes, 0);
    const totalLoadHours = totalFuture + (totalPendingMins / 60);
    const avgRequiredHours = totalLoadHours / 14;

    let weatherTitle = "Meteo Sereno";
    let weatherDesc = "Carico futuro e arretrati sono gestibili. Ottimo momento per portarsi avanti o riposare.";
    let weatherIcon = <ThermometerSun size={32} style={{ color: 'rgba(16, 185, 129, 1)' }} />;

    if (avgRequiredHours > dailyCapacityHours * 1.2) {
      weatherTitle = "Allerta Rossa (Sovraccarico)";
      weatherDesc = `Hai un arretrato critico. Per metterti a pari in 14 giorni servirebbero ${Math.round(avgRequiredHours*10)/10}h al giorno (oltre il tuo limite di ${dailyCapacityHours}h). Concentrati solo sulle priorità!`;
      weatherIcon = <AlertTriangle size={32} style={{ color: 'rgba(239, 68, 68, 1)' }} />;
    } else if (avgRequiredHours > dailyCapacityHours * 0.8) {
      weatherTitle = "Carico Molto Elevato";
      weatherDesc = `Le prossime settimane richiederanno in media ${Math.round(avgRequiredHours*10)/10}h al giorno per smaltire il backlog e le nuove lezioni. Non accumulare altro ritardo.`;
      weatherIcon = <Flame size={32} style={{ color: 'rgba(245, 158, 11, 1)' }} />;
    } else if (avgRequiredHours > dailyCapacityHours * 0.4) {
      weatherTitle = "Carico Moderato";
      weatherDesc = "Il carico totale tra arretrati e nuove lezioni è nella norma. Mantieni un ritmo costante.";
      weatherIcon = <Zap size={32} style={{ color: 'rgba(245, 158, 11, 1)' }} />;
    }

    const worstCourse = catchUpSummary.courses.sort((a, b) => a.catchUpPercentage - b.catchUpPercentage)[0];

    return {
      labels, dataPoints, colors, maxHours, busiestDay, 
      weatherTitle, weatherDesc, weatherIcon, worstCourse
    };
  }, [projection, dailyCapacityHours, catchUpSummary.courses]);

  const chartData = {
    labels: insights.labels,
    datasets: [
      {
        label: 'Ore previste',
        data: insights.dataPoints,
        backgroundColor: insights.colors,
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context: any) => `${context.parsed.y} h stimate`,
        }
      },
      annotation: {
        annotations: {
          capacityLine: {
            type: 'line',
            yMin: dailyCapacityHours,
            yMax: dailyCapacityHours,
            borderColor: 'rgba(239, 68, 68, 0.5)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              display: true,
              content: `Capacità Max (${dailyCapacityHours}h)`,
              position: 'end',
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              color: '#fff',
              font: { size: 10 }
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Ore stimate', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: {
        grid: { display: false }
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
      
      {/* SEZIONE 1: IL METEO DELLO STUDIO (INSIGHTS) */}
      <GlassPanel className="insights-panel">
        <div style={{ flexShrink: 0, padding: '16px', background: 'var(--bg-primary)', borderRadius: '50%', boxShadow: '0 8px 16px rgba(0,0,0,0.05)' }}>
          {insights.weatherIcon}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.4rem' }}>{insights.weatherTitle}</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{insights.weatherDesc}</p>
        </div>
        
        {insights.worstCourse && insights.worstCourse.catchUpPercentage < 80 && (
          <div className="insights-action-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-warning)', fontWeight: 600, marginBottom: '4px' }}>
              <Target size={16} />
              Azione Consigliata
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Concentrati su <strong>{insights.worstCourse.courseName}</strong> (Sei al {insights.worstCourse.catchUpPercentage}%). 
              Hai {formatMinutes(insights.worstCourse.pendingMinutes)} di arretrati.
            </p>
          </div>
        )}
      </GlassPanel>

      {/* SEZIONE 2: GRAFICO CARICO (CALENDARIO) */}
      <GlassPanel>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarIcon size={20} color="var(--accent-primary)" />
              Volume di Studio (Prossimi 14 giorni)
            </h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Stima del tempo necessario per affrontare le future lezioni e l'attuale backlog.
            </p>
          </div>
          {insights.busiestDay && (
            <div style={{ background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
              🔥 Picco massimo: <strong>{insights.busiestDay} ({insights.maxHours}h)</strong>
            </div>
          )}
        </div>
        
        <div style={{ height: '280px', width: '100%' }}>
          <Bar data={chartData} options={chartOptions as any} />
        </div>
        
        <div style={{ display: 'flex', gap: '16px', marginTop: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', justifyContent: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.8)' }}></span> Leggero
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.8)' }}></span> Moderato
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.8)' }}></span> Intenso
          </span>
        </div>
      </GlassPanel>

      {/* SEZIONE 3: PIANO D'ATTACCO MATERIE */}
      <h3 style={{ fontSize: '1.2rem', margin: '8px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <CheckCircle size={20} />
        Piano d'Attacco per Materia
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
        {catchUpSummary.courses
          .filter(c => c.totalLessonsPast > 0 || projection.projectionByCourse[c.courseId])
          .sort((a, b) => a.catchUpPercentage - b.catchUpPercentage)
          .map(cs => {
          const futureMins = projection.projectionByCourse[cs.courseId] || 0;
          const isAtRisk = cs.catchUpPercentage < 50;
          const statusBg = isAtRisk ? 'rgba(239, 68, 68, 0.05)' : (cs.catchUpPercentage < 80 ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)');
          
          return (
            <GlassPanel key={cs.courseId} style={{ padding: '16px', borderTop: `4px solid ${cs.courseColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '1.1rem' }}>{cs.courseName}</h4>
                <div style={{ background: statusBg, padding: '4px 8px', borderRadius: '12px', fontWeight: 600, fontSize: '0.9rem', color: isAtRisk ? 'var(--accent-danger)' : (cs.catchUpPercentage < 80 ? 'var(--accent-warning)' : 'var(--accent-success)') }}>
                  {cs.catchUpPercentage}% completato
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Da recuperare oggi:</span>
                  <strong style={{ color: cs.pendingTasksCount > 0 ? 'var(--text-primary)' : 'var(--accent-success)' }}>
                    {cs.pendingTasksCount > 0 ? `${cs.pendingTasksCount} task (${formatMinutes(cs.pendingMinutes)})` : 'Nessuno! 🎉'}
                  </strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Carico in arrivo (14gg):</span>
                  <strong>{formatMinutes(futureMins)}</strong>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', color: cs.isPlanningCaughtUp ? 'var(--text-secondary)' : 'var(--accent-warning)' }}>
                  {cs.isPlanningCaughtUp ? <Info size={14} /> : <AlertTriangle size={14} />}
                  <span>
                    {cs.estimatedCatchUpDate 
                      ? `Tornerai a pari il: ${formatDate(cs.estimatedCatchUpDate)}` 
                      : 'Nessun arretrato critico in vista.'}
                  </span>
                </div>
              </div>
            </GlassPanel>
          );
        })}
      </div>
    </div>
  );
}
