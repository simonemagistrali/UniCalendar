import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X, CheckSquare, Square } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { Course, CourseTopic } from '../../../core/types';
import { useInfoPatch } from './courseHooks';

interface Draft {
  title: string;
  part: string;
  details: string;
}
const emptyDraft: Draft = { title: '', part: '', details: '' };

export function CourseTopicsTab({ course }: { course: Course }) {
  const patch = useInfoPatch(course);
  const topics = course.info?.topics ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [filterPart, setFilterPart] = useState<string>('ALL');

  const studiedCount = topics.filter(t => t.studied).length;
  const progressPct = topics.length > 0 ? Math.round((studiedCount / topics.length) * 100) : 0;

  const parts = Array.from(new Set(topics.map(t => t.part?.trim()).filter(Boolean))) as string[];

  const save = (items: CourseTopic[]) => patch({ topics: items });

  const openNew = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (t: CourseTopic) => {
    setDraft({
      title: t.title,
      part: t.part ?? '',
      details: t.details ?? '',
    });
    setEditingId(t.id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  };

  const submit = () => {
    if (!draft.title.trim()) return;
    const base = {
      title: draft.title.trim(),
      part: draft.part.trim() || undefined,
      details: draft.details.trim() || undefined,
    };
    if (editingId) {
      save(topics.map(t => (t.id === editingId ? { ...t, ...base } : t)));
    } else {
      save([...topics, { id: uuidv4(), studied: false, source: 'manual', ...base }]);
    }
    closeForm();
  };

  const toggleStudied = (t: CourseTopic) => {
    save(topics.map(x => (x.id === t.id ? { ...x, studied: !x.studied } : x)));
  };

  const remove = (t: CourseTopic) => {
    save(topics.filter(x => x.id !== t.id));
  };

  const filtered = topics.filter(t => {
    if (filterPart === 'ALL') return true;
    if (filterPart === 'NONE') return !t.part;
    return t.part === filterPart;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="cp-toolbar">
        <h4 className="cp-section-title" style={{ flex: 1 }}>Indice degli argomenti del corso</h4>
        {topics.length > 0 && (
          <span className="cp-badge green" style={{ fontSize: '0.8rem' }}>
            {studiedCount} di {topics.length} studiati ({progressPct}%)
          </span>
        )}
        <button className="btn btn-secondary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={15} /> Aggiungi
        </button>
      </div>

      {topics.length > 0 && (
        <div className="cp-progress" title={`Completamento programma: ${progressPct}%`}>
          <div style={{ width: `${progressPct}%` }} />
        </div>
      )}

      {parts.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Filtra modulo:</span>
          <button
            className={`cp-badge ${filterPart === 'ALL' ? 'blue' : 'gray'}`}
            style={{ cursor: 'pointer', border: 'none' }}
            onClick={() => setFilterPart('ALL')}
          >
            Tutti ({topics.length})
          </button>
          {parts.map(p => (
            <button
              key={p}
              className={`cp-badge ${filterPart === p ? 'blue' : 'gray'}`}
              style={{ cursor: 'pointer', border: 'none' }}
              onClick={() => setFilterPart(p)}
            >
              {p} ({topics.filter(t => t.part === p).length})
            </button>
          ))}
          {topics.some(t => !t.part) && (
            <button
              className={`cp-badge ${filterPart === 'NONE' ? 'blue' : 'gray'}`}
              style={{ cursor: 'pointer', border: 'none' }}
              onClick={() => setFilterPart('NONE')}
            >
              Generale ({topics.filter(t => !t.part).length})
            </button>
          )}
        </div>
      )}

      {formOpen && (
        <div className="cp-form">
          <div className="cp-row">
            <div className="cp-field" style={{ flex: 1 }}>
              <label>Modulo / Macro-argomento (opzionale)</label>
              <input
                className="cp-input"
                value={draft.part}
                onChange={e => setDraft({ ...draft, part: e.target.value })}
                placeholder="Es. Modulo 1: Basi dati relazionali"
                list="course-parts-list"
              />
              <datalist id="course-parts-list">
                {parts.map(p => <option key={p} value={p} />)}
              </datalist>
            </div>
            <div className="cp-field" style={{ flex: 2 }}>
              <label>Titolo argomento</label>
              <input
                className="cp-input"
                value={draft.title}
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                placeholder="Es. Normalizzazione e forme normali (1NF, 2NF, 3NF)"
              />
            </div>
          </div>
          <div className="cp-field">
            <label>Dettagli, concetti chiave o capitoli del libro</label>
            <textarea
              className="cp-textarea"
              style={{ minHeight: 60 }}
              value={draft.details}
              onChange={e => setDraft({ ...draft, details: e.target.value })}
              placeholder="Capitoli da studiare, formule chiave, teoremi..."
            />
          </div>
          <div className="cp-toolbar">
            <button className="btn btn-primary" onClick={submit} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Check size={15} /> {editingId ? 'Aggiorna' : 'Aggiungi'}
            </button>
            <button className="btn btn-ghost" onClick={closeForm} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={15} /> Annulla
            </button>
          </div>
        </div>
      )}

      {topics.length === 0 && !formOpen && (
        <div className="cp-empty">
          Nessun argomento nell'indice. Puoi aggiungerli a mano oppure estrarre il programma completo dal PDF/Syllabus con l'AI.
        </div>
      )}

      {filtered.map(t => (
        <div key={t.id} className={`cp-card ${t.studied ? 'done' : ''}`}>
          <button
            className="cp-icon-btn"
            style={{ color: t.studied ? '#188038' : 'var(--text-secondary)', padding: 0 }}
            onClick={() => toggleStudied(t)}
            title={t.studied ? 'Segna come da ripassare' : 'Segna come studiato'}
          >
            {t.studied ? <CheckSquare size={20} /> : <Square size={20} />}
          </button>
          <div className="cp-card-body">
            <span className="cp-card-title">{t.title}</span>
            <span className="cp-card-meta">
              {t.part && <span className="cp-badge purple">{t.part}</span>}
              {t.studied && <span className="cp-badge green">Studiato</span>}
              {t.source === 'ai' && <span className="cp-badge blue">AI</span>}
            </span>
            {t.details && <span className="cp-card-meta" style={{ whiteSpace: 'pre-line' }}>{t.details}</span>}
          </div>
          <div className="cp-card-actions">
            <button className="cp-icon-btn" title="Modifica" onClick={() => openEdit(t)}>
              <Edit2 size={15} />
            </button>
            <button className="cp-icon-btn danger" title="Elimina" onClick={() => remove(t)}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

