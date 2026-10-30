import { useEffect, useState } from 'react';
import { Sparkles, FileText } from 'lucide-react';
import type { Course } from '../../../core/types';
import { useInfoPatch } from './courseHooks';

interface Props {
  course: Course;
  onAnalyze: () => void;
}

export function CourseOverviewTab({ course, onAnalyze }: Props) {
  const patch = useInfoPatch(course);
  const events = useAppStore(s => s.events);
  const info = course.info ?? {};

  const [overview, setOverview] = useState(info.overview ?? '');
  const [grading, setGrading] = useState(info.gradingSummary ?? '');
  const [studyPlan, setStudyPlan] = useState(info.studyPlan ?? '');

  useEffect(() => { setOverview(info.overview ?? ''); }, [course.id, info.overview]);
  useEffect(() => { setGrading(info.gradingSummary ?? ''); }, [course.id, info.gradingSummary]);
  useEffect(() => { setStudyPlan(info.studyPlan ?? ''); }, [course.id, info.studyPlan]);

  const topics = info.topics ?? [];
  const studied = topics.filter(t => t.studied).length;
  const assessments = info.assessments ?? [];
  const planLessons = info.lessonPlan ?? [];
  const calendarEvents = events.filter(e => e.courseId === course.id && (e.type === 'lesson' || (!e.courseId && e.title.toLowerCase().includes(course.name.toLowerCase()))));
  const totalLessonsCount = Math.max(planLessons.length, calendarEvents.length);
  const docs = info.documents ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

