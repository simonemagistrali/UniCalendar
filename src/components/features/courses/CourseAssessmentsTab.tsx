import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, CalendarPlus, Link2Off, CalendarCheck } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useAppStore } from '../../../store/useAppStore';
import type { AssessmentType, Course, CourseAssessment } from '../../../core/types';
import { ASSESSMENT_LABELS, createAssessmentEvent, sortAssessments } from '../../../core/CourseKnowledge';
import { useInfoPatch, fmtDate } from './courseHooks';

const TYPES = Object.keys(ASSESSMENT_LABELS) as AssessmentType[];
const BADGE: Record<AssessmentType, string> = { quiz: 'orange', lab: 'purple', exam: 'red', oral: 'red', project: 'blue', deadline: 'red', other: 'gray' };

interface Draft { type: AssessmentType; title: string; date: string; time: string; weight: string; notes: string; linkedEventId: string }
const emptyDraft: Draft = { type: 'quiz', title: '', date: '', time: '', weight: '', notes: '', linkedEventId: '' };

export function CourseAssessmentsTab({ course }: { course: Course }) {
  const patch = useInfoPatch(course);
  const events = useAppStore(s => s.events);
  const addEvent = useAppStore(s => s.addEvent);

  const list = sortAssessments(course.info?.assessments ?? []);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const eventById = new Map(events.map(e => [e.id, e]));
  const linkable = events.filter(e => e.courseId === course.id && e.type !== 'lesson' && e.type !== 'travel' && e.type !== 'meal');
  const totalWeight = list.reduce((s, a) => s + (a.weightPercent ?? 0), 0);

  const save = (items: CourseAssessment[]) => patch({ assessments: sortAssessments(items) });

  const openNew = () => { setDraft(emptyDraft); setEditingId(null); setFormOpen(true); };
  const openEdit = (a: CourseAssessment) => {
    setDraft({ type: a.type, title: a.title, date: a.date ?? '', time: a.time ?? '', weight: a.weightPercent?.toString() ?? '', notes: a.notes ?? '', linkedEventId: a.linkedEventId ?? '' });
    setEditingId(a.id);
    setFormOpen(true);
  };
  const closeForm = () => { setFormOpen(false); setEditingId(null); setDraft(emptyDraft); };

  const submit = () => {
    if (!draft.title.trim()) return;
    const weight = parseFloat(draft.weight);
    const base = {
      type: draft.type,
      title: draft.title.trim(),
      date: draft.date || undefined,
      time: draft.time || undefined,
      weightPercent: Number.isFinite(weight) && weight > 0 ? weight : undefined,
      notes: draft.notes.trim() || undefined,
      linkedEventId: draft.linkedEventId || undefined,
    };
    if (editingId) save(list.map(a => (a.id === editingId ? { ...a, ...base } : a)));
    else save([...list, { id: uuidv4(), done: false, source: 'manual', ...base }]);
    closeForm();
  };

  const toggleDone = (a: CourseAssessment) => save(list.map(x => (x.id === a.id ? { ...x, done: !x.done } : x)));
  const remove = (a: CourseAssessment) => save(list.filter(x => x.id !== a.id));
  const unlink = (a: CourseAssessment) => save(list.map(x => (x.id === a.id ? { ...x, linkedEventId: undefined } : x)));

  const createEvent = (a: CourseAssessment) => {
    const ev = createAssessmentEvent(a, course);
    if (!ev) return;
    addEvent(ev);
    save(list.map(x => (x.id === a.id ? { ...x, linkedEventId: ev.id } : x)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cp-toolbar">
        <h4 className="cp-section-title" style={{ flex: 1 }}>Valutazione e scadenze</h4>
        {totalWeight > 0 && (
          <span className={`cp-badge ${Math.round(totalWeight) === 100 ? 'green' : 'orange'}`} title="Somma dei pesi indicati">Pesi: {totalWeight}%</span>
        )}
        <button className="btn btn-secondary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Aggiungi</button>
      </div>

      {course.info?.gradingSummary && <div style={{ fontSize: '0.86rem', color: 'var(--text-secondary)' }}>Composizione: <strong>{course.info.gradingSummary}</strong></div>}

      {formOpen && (
        <div className="cp-form">
          <div className="cp-row">
            <div className="cp-field" style={{ flex: '0 0 150px' }}>
              <label>Tipo</label>
              <select className="cp-select" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as AssessmentType })}>
                {TYPES.map(t => <option key={t} value={t}>{ASSESSMENT_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="cp-field" style={{ flex: 2 }}>
              <label>Titolo</label>
              <input className="cp-input" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Es. Quiz 1, Esame scritto, Consegna progetto" />
            </div>
          </div>
          <div className="cp-row">
            <div className="cp-field"><label>Data</label><input className="cp-input" type="date" value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></div>
            <div className="cp-field"><label>Ora</label><input className="cp-input" type="time" value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></div>
            <div className="cp-field"><label>Peso sul voto (%)</label><input className="cp-input" type="number" min="0" max="100" value={draft.weight} onChange={e => setDraft({ ...draft, weight: e.target.value })} /></div>
          </div>
          <div className="cp-field">
            <label>Evento del calendario collegato</label>
            <select className="cp-select" value={draft.linkedEventId} onChange={e => setDraft({ ...draft, linkedEventId: e.target.value })}>
              <option value="">Nessuno</option>
              {linkable.map(e => <option key={e.id} value={e.id}>{e.title} — {new Date(e.startTime).toLocaleDateString('it-IT')}</option>)}
            </select>
          </div>
          <div className="cp-field"><label>Note</label><input className="cp-input" value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Argomenti, materiale consentito, modalità..." /></div>
          <div className="cp-toolbar">
            <button className="btn btn-primary" onClick={submit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={15} /> {editingId ? 'Aggiorna' : 'Aggiungi'}</button>
            <button className="btn btn-ghost" onClick={closeForm} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><X size={15} /> Annulla</button>
          </div>
        </div>
      )}

      {list.length === 0 && !formOpen && (
        <div className="cp-empty">Nessuna prova o scadenza. Aggiungile a mano oppure carica un documento con l'AI (es. il regolamento d'esame).</div>
      )}

      {list.map(a => {
        const linked = a.linkedEventId ? eventById.get(a.linkedEventId) : undefined;
        const overdue = !a.done && a.date && new Date(`${a.date}T23:59:59`).getTime() < Date.now();
        return (
          <div key={a.id} className={`cp-card ${a.done ? 'done' : ''}`}>
            <input type="checkbox" checked={!!a.done} onChange={() => toggleDone(a)} style={{ marginTop: 4, width: 18, height: 18 }} title="Segna come svolta/consegnata" />
            <div className="cp-card-body">
              <span className="cp-card-title">{a.title}</span>
              <span className="cp-card-meta">
                <span className={`cp-badge ${BADGE[a.type]}`}>{ASSESSMENT_LABELS[a.type]}</span>
                {a.date ? <span>{fmtDate(a.date)}{a.time ? ` · ${a.time}` : ''}</span> : <span>data da definire</span>}
                {a.weightPercent != null && <span>peso {a.weightPercent}%</span>}
                {overdue && <span className="cp-badge red">scaduta</span>}
                {a.source === 'ai' && <span className="cp-badge purple">AI</span>}
                {linked && <span className="cp-badge green"><CalendarCheck size={11} /> In calendario</span>}
              </span>
              {a.notes && <span className="cp-card-meta">{a.notes}</span>}
            </div>
            <div className="cp-card-actions">
              {linked ? (
                <button className="cp-icon-btn" title="Scollega dal calendario" onClick={() => unlink(a)}><Link2Off size={15} /></button>
              ) : a.date ? (
                <button className="cp-icon-btn" title="Aggiungi al calendario" onClick={() => createEvent(a)}><CalendarPlus size={15} /></button>
              ) : null}
              <button className="cp-icon-btn" title="Modifica" onClick={() => openEdit(a)}><Edit2 size={15} /></button>
              <button className="cp-icon-btn danger" title="Elimina" onClick={() => remove(a)}><Trash2 size={15} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

