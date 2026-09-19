import { useMemo } from 'react';
import { Target, Calendar, TrendingUp, CheckCircle } from 'lucide-react';
import { GlassPanel } from '../../ui/GlassPanel';
import { useAppStore } from '../../../store/useAppStore';
import { CatchUpEngine } from '../../../core/CatchUpEngine';
import type { CourseCatchUpStatus } from '../../../core/CatchUpEngine';

function getStatusColor(percentage: number): string {
  if (percentage >= 80) return 'var(--accent-success)';
  if (percentage >= 50) return 'var(--accent-warning)';
  return 'var(--accent-danger)';
}

function getStatusLabel(percentage: number): string {
  if (percentage >= 100) return 'A pari! ✨';
  if (percentage >= 80) return 'Quasi a pari';
  if (percentage >= 50) return 'In recupero';
  if (percentage >= 20) return 'Indietro';
  return 'Molto indietro';
}

function formatDate(isoString: string | null): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / 86400000);

  if (diffDays <= 0) return 'Oggi';
  if (diffDays === 1) return 'Domani';

  return date.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
  });
}

function CircularProgress({ percentage, color, size = 64 }: { percentage: number; color: string; size?: number }) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, percentage) / 100) * circumference;

  return (
    <svg width={size} height={size} className="catchup-circle">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--bg-tertiary)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 0.6s ease-out',
          transform: 'rotate(-90deg)',
          transformOrigin: '50% 50%',
        }}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className="catchup-circle-text"
        fill={color}
      >
        {percentage}%
      </text>
    </svg>
  );
}

function CourseCard({ status }: { status: CourseCatchUpStatus }) {
  const color = getStatusColor(status.catchUpPercentage);
  const label = getStatusLabel(status.catchUpPercentage);

  return (
    <div className="catchup-course-card">
      <div className="catchup-course-left">
        <CircularProgress percentage={status.catchUpPercentage} color={color} size={56} />
      </div>
      <div className="catchup-course-info">
        <div className="catchup-course-name">
          <span className="task-course-dot" style={{ backgroundColor: status.courseColor }} />
          {status.courseName}
        </div>
        <div className="catchup-course-label" style={{ color }}>{label}</div>
        <div className="catchup-course-details">
          {status.pendingTasksCount > 0 ? (
            <>
              <span>{status.pendingTasksCount} task pendenti</span>
              <span>·</span>
              <span>~{Math.round(status.pendingMinutes / 60 * 10) / 10}h di lavoro</span>
            </>
          ) : (
            <span style={{ color: 'var(--accent-success)' }}>
              <CheckCircle size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Tutto completato
            </span>
          )}
        </div>
        {status.estimatedCatchUpDate && status.catchUpPercentage < 100 && (
          <div className="catchup-course-date">
            <Calendar size={12} />
            <span>Completamento previsto: <strong>{formatDate(status.estimatedCatchUpDate)}</strong></span>
          </div>
        )}
        {status.catchUpPercentage < 100 && (
          <div className="catchup-course-date" style={{ color: status.isPlanningCaughtUp ? 'var(--accent-success)' : 'var(--accent-warning)', marginTop: 4 }}>
            {status.isPlanningCaughtUp ? <CheckCircle size={12} /> : <Calendar size={12} />}
            <span>{status.isPlanningCaughtUp ? 'Pianificazione in pari con le lezioni' : 'Pianificazione in ritardo sulle lezioni'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CatchUpIndicator() {
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const studySessions = useAppStore(s => s.studySessions);

  const summary = useMemo(() => {
    return CatchUpEngine.calculate(events, courses, tasks, studySessions);
  }, [events, courses, tasks, studySessions]);

  const globalColor = getStatusColor(summary.globalPercentage);
  const coursesWithLessons = summary.courses.filter(c => c.totalLessonsPast > 0);

  if (coursesWithLessons.length === 0) {
    return null; // No data to show yet
  }

  return (
    <GlassPanel>
      <div className="catchup-header">
        <div className="catchup-header-left">
          <Target size={18} />
          <h3 className="dashboard-label">QUANTO SEI A PARI</h3>
        </div>
        <div className="catchup-global">
          <CircularProgress percentage={summary.globalPercentage} color={globalColor} size={72} />
          {summary.globalCatchUpDate && summary.globalPercentage < 100 && (
            <div className="catchup-global-date">
              <TrendingUp size={14} style={{ color: globalColor }} />
              <span>Completamento previsto: <strong>{formatDate(summary.globalCatchUpDate)}</strong></span>
            </div>
          )}
          {summary.globalPercentage < 100 && (
            <div className="catchup-global-date" style={{ color: summary.globalPlanningCaughtUp ? 'var(--accent-success)' : 'var(--accent-warning)', marginTop: 4 }}>
              {summary.globalPlanningCaughtUp ? <CheckCircle size={14} /> : <Target size={14} />}
              <span>{summary.globalPlanningCaughtUp ? 'Pianificazione globale in pari' : 'Attenzione: nuove lezioni prima del recupero'}</span>
            </div>
          )}
          {summary.globalPercentage >= 100 && (
            <div className="catchup-global-date" style={{ color: 'var(--accent-success)' }}>
              <CheckCircle size={14} />
              <span>Sei a pari con tutto! 🎉</span>
            </div>
          )}
        </div>
      </div>

      <div className="catchup-courses-grid">
        {coursesWithLessons.map(cs => (
          <CourseCard key={cs.courseId} status={cs} />
        ))}
      </div>
    </GlassPanel>
  );
}

/**
 * Compact version for the calendar sidebar.
 */
export function CatchUpMini() {
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const studySessions = useAppStore(s => s.studySessions);

  const summary = useMemo(() => {
    return CatchUpEngine.calculate(events, courses, tasks, studySessions);
  }, [events, courses, tasks, studySessions]);

  const globalColor = getStatusColor(summary.globalPercentage);
  const coursesWithLessons = summary.courses.filter(c => c.totalLessonsPast > 0);

  if (coursesWithLessons.length === 0) return null;

  return (
    <div className="catchup-mini">
      <div className="catchup-mini-header">
        <Target size={14} />
        <span>A pari</span>
        <CircularProgress percentage={summary.globalPercentage} color={globalColor} size={36} />
      </div>
      <div className="catchup-mini-list">
        {coursesWithLessons.map(cs => (
          <div key={cs.courseId} className="catchup-mini-item">
            <span className="task-course-dot" style={{ backgroundColor: cs.courseColor }} />
            <span className="catchup-mini-name">{cs.courseName}</span>
            <div className="catchup-mini-bar-container">
              <div
                className="catchup-mini-bar"
                style={{
                  width: `${Math.min(100, cs.catchUpPercentage)}%`,
                  backgroundColor: getStatusColor(cs.catchUpPercentage),
                }}
              />
            </div>
            <span className="catchup-mini-pct" style={{ color: getStatusColor(cs.catchUpPercentage) }}>
              {cs.catchUpPercentage}%
            </span>
          </div>
        ))}
      </div>
      {summary.globalCatchUpDate && summary.globalPercentage < 100 && (
        <div className="catchup-mini-footer" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={12} />
            <span>Previsto: {formatDate(summary.globalCatchUpDate)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: summary.globalPlanningCaughtUp ? 'var(--accent-success)' : 'var(--accent-warning)', fontSize: '0.9em' }}>
            {summary.globalPlanningCaughtUp ? <CheckCircle size={10} /> : <Target size={10} />}
            <span>{summary.globalPlanningCaughtUp ? 'Plan OK' : 'Ritardo Plan'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
