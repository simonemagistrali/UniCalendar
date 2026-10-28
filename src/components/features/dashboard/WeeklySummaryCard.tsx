import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Mail, Share2, Copy } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { WeeklySummaryEngine } from '../../../core/WeeklySummaryEngine';

function Delta({ value, unit, formatter }: { value: number; unit?: string; formatter?: (n: number) => string }) {
  if (value === 0) return <span className="weekly-card-delta">invariato vs settimana prima</span>;
  const up = value > 0;
  const txt = formatter ? formatter(value) : `${Math.abs(value)}${unit || ''}`;
  return (
    <span className={`weekly-card-delta ${up ? 'up' : 'down'}`}>
      {up ? '▲' : '▼'} {txt} vs settimana prima
    </span>
  );
}

export function WeeklySummaryCard() {
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const events = useAppStore(s => s.events);
  const ankiHistory = useAppStore(s => s.ankiHistory);
  const user = useAppStore(s => s.user);
  const [offset, setOffset] = useState(0);
  const [msg, setMsg] = useState('');

  const summary = useMemo(
    () => WeeklySummaryEngine.compute(tasks, courses, events, ankiHistory, new Date(), offset),
    [tasks, courses, events, ankiHistory, offset]
  );
  const f = WeeklySummaryEngine.formatDuration;

  const weekLabel = (() => {
    const s = new Date(summary.weekStart);
    const e = new Date(new Date(summary.weekEnd).getTime() - 1);
    const fmt = (d: Date) => d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
    return `${fmt(s)} – ${fmt(e)}`;
  })();

  const text = () => WeeklySummaryEngine.toPlainText(summary);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const handleShare = async () => {
    const t = text();
    if (navigator.share) {
      try { await navigator.share({ title: 'Riepilogo settimanale UniCalendar', text: t }); return; } catch { /* annullato */ }
    }
    try { await navigator.clipboard.writeText(t); flash('Copiato negli appunti'); } catch { flash('Impossibile condividere'); }
  };

  const handleMail = () => {
    const to = user?.email || '';
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Riepilogo settimanale UniCalendar')}&body=${encodeURIComponent(text())}`;
  };

  return (
    <section className="weekly-summary" aria-label="Riepilogo settimanale">
      <div className="weekly-summary-head">
        <div>
          <h2>Riepilogo settimanale</h2>
          <div className="weekly-summary-sub">{weekLabel}{offset === 0 ? ' (in corso)' : ''}</div>
        </div>
        <div className="weekly-actions">
          <button className="task-more-btn" onClick={() => setOffset(o => o - 1)} aria-label="Settimana precedente"><ChevronLeft size={16} /></button>
          <button className="task-more-btn" onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset === 0} aria-label="Settimana successiva"><ChevronRight size={16} /></button>
          <button className="task-more-btn" onClick={handleShare} title="Condividi o copia il riepilogo"><Share2 size={15} /> Condividi</button>
          <button className="task-more-btn" onClick={handleMail} title="Apri una mail con il riepilogo"><Mail size={15} /> Email</button>
          <button className="task-more-btn" onClick={async () => { await navigator.clipboard.writeText(text()); flash('Copiato'); }} aria-label="Copia"><Copy size={15} /></button>
          {msg && <span className="weekly-summary-sub">{msg}</span>}
        </div>
      </div>

      <div className="weekly-grid">
        <div className="weekly-card">
          <span className="weekly-card-label">Attività fatte</span>
          <span className="weekly-card-value">{summary.tasksCompleted}</span>
          <Delta value={summary.deltaTasks} />
        </div>
        <div className="weekly-card">
          <span className="weekly-card-label">Tempo di studio</span>
          <span className="weekly-card-value">{f(summary.minutesStudied)}</span>
          <Delta value={summary.deltaMinutes} formatter={n => f(n)} />
        </div>
        <div className="weekly-card">
          <span className="weekly-card-label">Materia più studiata</span>
          <span className="weekly-card-value" style={{ fontSize: '1.05rem' }}>{summary.topCourse ? summary.topCourse.courseName : '—'}</span>
          {summary.topCourse && <span className="weekly-card-delta">{f(summary.topCourse.minutes)}</span>}
        </div>
        <div className="weekly-card">
          <span className="weekly-card-label">Serie</span>
          <span className="weekly-card-value">{summary.streakDays} <small style={{ fontSize: '0.8rem', fontWeight: 400 }}>giorni</small></span>
          {summary.bestDay && <span className="weekly-card-delta">Top: {new Date(summary.bestDay.date).toLocaleDateString('it-IT', { weekday: 'long' })}</span>}
        </div>
      </div>

      {summary.topics.length > 0 && (
        <div>
          <div className="weekly-card-label" style={{ marginBottom: 6 }}>Temi studiati</div>
          <ul className="weekly-list">{summary.topics.map(t => <li key={t}>{t}</li>)}</ul>
        </div>
      )}

      {(summary.upcoming.length > 0 || summary.atRisk.length > 0 || summary.tip) && (
        <div>
          {summary.upcoming.length > 0 && (
            <>
              <div className="weekly-card-label" style={{ marginBottom: 6 }}>In arrivo</div>
              <ul className="weekly-list">
                {summary.upcoming.map(u => (
                  <li key={u.title + u.date}>{u.title} — {new Date(u.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</li>
                ))}
              </ul>
            </>
          )}
          {summary.atRisk.length > 0 && (
            <>
              <div className="weekly-card-label" style={{ margin: '10px 0 6px' }}>Da non trascurare</div>
              <ul className="weekly-list">
                {summary.atRisk.map(r => <li key={r.courseName}>{r.courseName}: esame tra {r.daysToExam} giorni, {f(r.minutesThisWeek)} questa settimana</li>)}
              </ul>
            </>
          )}
          {summary.tip && <p className="weekly-summary-sub" style={{ marginTop: 10 }}>💡 {summary.tip}</p>}
        </div>
      )}
    </section>
  );
}
