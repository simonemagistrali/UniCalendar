import { useEffect, useMemo, useState } from 'react';
import { Sparkles, FileText, BookOpen, Wrench, CheckCircle2, AlertCircle, Check } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import type { Course } from '../../../core/types';
import { LessonProgressEngine, type TrackSummary } from '../../../core/LessonProgressEngine';
import { useInfoPatch } from './courseHooks';

interface Props {
  course: Course;
  onAnalyze: () => void;
}

function TrackProgressCard({
  courseId,
  title,
  icon,
  summary,
  accentColor,
}: {
  courseId: string;
  title: string;
  icon: React.ReactNode;
  summary: TrackSummary;
  accentColor: string;
}) {
  const setLessonTrackDone = useAppStore(s => s.setLessonTrackDone);
  const setCourseCheckpoint = useAppStore(s => s.setCourseCheckpoint);
  const [checkpointMsg, setCheckpointMsg] = useState<string | null>(null);

  if (summary.totalScheduled === 0) {
    return (
      <div style={{ flex: 1, minWidth: 260, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.92rem' }}>
          {icon} <span>{title}</span>
        </div>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Nessuna lezione di questo tipo a calendario per la materia.
        </div>
      </div>
    );
  }

  const isCaughtUp = summary.gapCount === 0;
  const statusColor = isCaughtUp ? '#188038' : summary.gapCount <= 2 ? '#b06d00' : '#d93025';
  const statusBg = isCaughtUp ? 'rgba(24,128,56,0.12)' : summary.gapCount <= 2 ? 'rgba(242,153,0,0.14)' : 'rgba(217,48,37,0.12)';

  const handleCheckpointChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const res = setCourseCheckpoint(courseId, summary.track, val === 'NONE' ? null : val);
    setCheckpointMsg(
      val === 'NONE'
        ? 'Avanzamento azzerato'
        : `✓ Segnate ${res.markedLessons} lezioni fatte${res.removedTasks > 0 ? ` (${res.removedTasks} task rimossi)` : ''}`
    );
    setTimeout(() => setCheckpointMsg(null), 3000);
  };

  const handleCatchUpAll = () => {
    if (!summary.lastProfLesson) return;
    const res = setCourseCheckpoint(courseId, summary.track, summary.lastProfLesson.eventId);
    setCheckpointMsg(`✓ In pari col professore! (${res.markedLessons} lezioni)`);
    setTimeout(() => setCheckpointMsg(null), 3000);
  };

  return (
    <div style={{ flex: 1, minWidth: 280, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontWeight: 700, fontSize: '0.94rem', color: 'var(--text-primary)' }}>
          <span style={{ color: accentColor, display: 'inline-flex' }}>{icon}</span>
          <span>{title}</span>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            ({summary.studentDoneCount}/{summary.profCurrentIndex} svolte · {summary.totalScheduled} tot)
          </span>
        </div>
        <span style={{ fontSize: '0.76rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: statusBg, color: statusColor, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {isCaughtUp ? (
            <>
              <CheckCircle2 size={13} /> In pari
            </>
          ) : (
            <>
              <AlertCircle size={13} /> {summary.gapCount} {summary.gapCount === 1 ? 'lezione indietro' : 'lezioni indietro'}
            </>
          )}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="cp-progress" style={{ height: 7 }}>
        <div style={{ width: `${Math.min(100, summary.percentage)}%`, background: isCaughtUp ? '#188038' : accentColor, transition: 'width 0.3s ease' }} />
      </div>

      {/* Dove è il Prof vs Dove sei Tu */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '0.8rem' }}>
        <div style={{ background: 'var(--bg-primary)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 2 }}>
            👨‍🏫 Dove è il Prof
          </div>
          {summary.lastProfLesson ? (
            <>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                #{summary.lastProfLesson.index} · {summary.lastProfLesson.dateIt}
              </div>
              <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={summary.lastProfLesson.topic}>
                {summary.lastProfLesson.topic}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Nessuna lezione ancora svolta</div>
          )}
        </div>

        <div style={{ background: 'var(--bg-primary)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 2 }}>
            🎯 Dove sono IO
          </div>
          {summary.lastStudentLesson ? (
            <>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                #{summary.lastStudentLesson.index} · {summary.lastStudentLesson.dateIt}
              </div>
              <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={summary.lastStudentLesson.topic}>
                {summary.lastStudentLesson.topic}
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-secondary)' }}>Nessuna segnata come fatta</div>
          )}
        </div>
      </div>

      {/* Checkpoint rapido "A che punto sono?" */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Checkpoint rapido (segna in pari fino a):
          </label>
          {!isCaughtUp && summary.lastProfLesson && (
            <button
              type="button"
              onClick={handleCatchUpAll}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: '0.75rem',
                fontWeight: 600,
                color: accentColor,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Segna tutto in pari col prof
            </button>
          )}
        </div>
        <select
          className="cp-select"
          style={{ fontSize: '0.82rem', padding: '6px 8px' }}
          value={summary.lastStudentLesson?.eventId || 'NONE'}
          onChange={handleCheckpointChange}
        >
          <option value="NONE">— Nessuna lezione completata (0/{summary.totalScheduled}) —</option>
          {summary.allLessons.map(l => (
            <option key={l.eventId} value={l.eventId}>
              {l.isPast ? '✓ ' : '⏳ '}#{l.index} ({l.dateIt}) — {l.topic}
            </option>
          ))}
        </select>
        {checkpointMsg && (
          <span style={{ fontSize: '0.76rem', color: '#188038', fontWeight: 600 }}>{checkpointMsg}</span>
        )}
      </div>

      {/* Lista delle lezioni mancanti (Gap) */}
      {summary.missingLessons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 2 }}>
          <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Da recuperare per tornare in pari ({summary.missingLessons.length}):
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 165, overflowY: 'auto', paddingRight: 2 }}>
            {summary.missingLessons.map(m => (
              <div
                key={m.eventId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 7,
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontWeight: 700, color: accentColor }}>#{m.index}</span>{' '}
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{m.dateIt}</span> ·{' '}
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{m.topic}</span>
                  {m.chapters && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📖 {m.chapters}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setLessonTrackDone(m.eventId, summary.track, true)}
                  title="Segna questa singola lezione come fatta"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(24,128,56,0.35)',
                    background: 'rgba(24,128,56,0.1)',
                    color: '#188038',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Check size={12} /> Fatto
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function CourseOverviewTab({ course, onAnalyze }: Props) {
  const patch = useInfoPatch(course);
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const info = course.info ?? {};

  const [overview, setOverview] = useState(info.overview ?? '');
  const [grading, setGrading] = useState(info.gradingSummary ?? '');
  const [studyPlan, setStudyPlan] = useState(info.studyPlan ?? '');

  useEffect(() => { setOverview(info.overview ?? ''); }, [course.id, info.overview]);
  useEffect(() => { setGrading(info.gradingSummary ?? ''); }, [course.id, info.gradingSummary]);
  useEffect(() => { setStudyPlan(info.studyPlan ?? ''); }, [course.id, info.studyPlan]);

  const pace = useMemo(
    () => LessonProgressEngine.calculateCourse(course, events, tasks),
    [course, events, tasks]
  );

  const topics = info.topics ?? [];
  const studied = topics.filter(t => t.studied).length;
  const assessments = info.assessments ?? [];
  const planLessons = info.lessonPlan ?? [];
  const calendarEvents = events.filter(e => e.courseId === course.id && (e.type === 'lesson' || (!e.courseId && e.title.toLowerCase().includes(course.name.toLowerCase()))));
  const totalLessonsCount = Math.max(planLessons.length, calendarEvents.length);
  const docs = info.documents ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Passo Lezioni & Esercitazioni (Prof vs Io) */}
      <div>
        <h4 className="cp-section-title" style={{ marginBottom: 8 }}>
          Passo con le Lezioni (Dove è il Prof vs Dove sono Io)
        </h4>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <TrackProgressCard
            courseId={course.id}
            title="Teoria & Appunti"
            icon={<BookOpen size={17} />}
            summary={pace.theory}
            accentColor="#1a73e8"
          />
          <TrackProgressCard
            courseId={course.id}
            title="Esercitazioni & Lab"
            icon={<Wrench size={17} />}
            summary={pace.exercise}
            accentColor="#e8710a"
          />
        </div>
      </div>

      <div className="cp-stats">
        <div className="cp-stat">
          <div className="cp-stat-value">{totalLessonsCount}</div>
          <div className="cp-stat-label">
            {planLessons.length > 0 ? 'lezioni con dettagli' : calendarEvents.length > 0 ? 'lezioni nel calendario (in attesa di syllabus)' : 'lezioni nel calendario'}
          </div>
        </div>
        <div className="cp-stat"><div className="cp-stat-value">{studied}/{topics.length}</div><div className="cp-stat-label">argomenti studiati</div></div>
        <div className="cp-stat"><div className="cp-stat-value">{assessments.filter(a => a.done).length}/{assessments.length}</div><div className="cp-stat-label">prove e scadenze completate</div></div>
      </div>

      <div className="cp-toolbar">
        <button className="btn btn-primary" onClick={onAnalyze} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} /> Analizza documento con AI
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Carica calendario, programma, regolamento d'esame o scadenze: l'AI aggiorna la scheda senza duplicare ciò che c'è già.
        </span>
      </div>

      <div className="cp-field">
        <label>Panoramica della materia</label>
        <textarea className="cp-textarea" value={overview} placeholder="Di cosa tratta il corso, docenti, libri di testo..."
          onChange={e => setOverview(e.target.value)} onBlur={() => overview !== (info.overview ?? '') && patch({ overview: overview.trim() || undefined })} />
      </div>

      <div className="cp-field">
        <label>Composizione della valutazione</label>
        <input className="cp-input" value={grading} placeholder="Es. 2 quiz + laboratorio + esame scritto"
          onChange={e => setGrading(e.target.value)} onBlur={() => grading !== (info.gradingSummary ?? '') && patch({ gradingSummary: grading.trim() || undefined })} />
      </div>

      <div className="cp-field">
        <label>Pianificazione dello studio</label>
        <textarea className="cp-textarea" value={studyPlan} placeholder="Come e quando conviene studiare questa materia..."
          onChange={e => setStudyPlan(e.target.value)} onBlur={() => studyPlan !== (info.studyPlan ?? '') && patch({ studyPlan: studyPlan.trim() || undefined })} />
      </div>

      {docs.length > 0 && (
        <div>
          <h4 className="cp-section-title" style={{ marginBottom: 8 }}><FileText size={16} /> Documenti analizzati</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...docs].reverse().map((d, i) => (
              <div key={i} className="cp-card">
                <div className="cp-card-body">
                  <span className="cp-card-title">{d.name}</span>
                  <span className="cp-card-meta">{new Date(d.at).toLocaleDateString('it-IT')} · {d.kind}</span>
                  {d.summary && <span className="cp-card-meta">{d.summary}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

