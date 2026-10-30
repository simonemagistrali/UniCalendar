import { useState, useEffect } from 'react';
import { Check, Trash2, Sparkles, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import type { Course } from '../../../core/types';

const COLORS = ['#1a73e8', '#d93025', '#188038', '#f29900', '#a142f4', '#e8710a', '#1967d2', '#c5221f', '#137333', '#b31412'];

interface Props {
  course: Course;
  onDeleted: () => void;
}

export function CourseSettingsTab({ course, onDeleted }: Props) {
  const updateCourse = useAppStore(s => s.updateCourse);
  const removeCourse = useAppStore(s => s.removeCourse);
  const repairCourses = useAppStore(s => s.repairCourses);

  const [name, setName] = useState(course.name);
  const [difficulty, setDifficulty] = useState(course.difficulty.toString());
  const [color, setColor] = useState(course.color);
  const [notesRevision, setNotesRevision] = useState(course.defaultStudyPreferences.requiresNotesRevision);
  const [exercises, setExercises] = useState(course.defaultStudyPreferences.requiresExercises);
  const [revisionTime, setRevisionTime] = useState(course.defaultStudyPreferences.estimatedRevisionTimePerLesson.toString());
  const [isCustomName, setIsCustomName] = useState(course.isCustomName ?? true);

  const [savedMsg, setSavedMsg] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(course.name);
    setDifficulty(course.difficulty.toString());
    setColor(course.color);
    setNotesRevision(course.defaultStudyPreferences.requiresNotesRevision);
    setExercises(course.defaultStudyPreferences.requiresExercises);
    setRevisionTime(course.defaultStudyPreferences.estimatedRevisionTimePerLesson.toString());
    setIsCustomName(course.isCustomName ?? true);
    setSavedMsg(false);
    setConfirmDelete(false);
  }, [course]);

  const handleSave = () => {
    if (!name.trim()) return;
    updateCourse(course.id, {
      name: name.trim(),
      difficulty: parseInt(difficulty) || 5,
      color,
      defaultStudyPreferences: {
        requiresNotesRevision: notesRevision,
        requiresExercises: exercises,
        estimatedRevisionTimePerLesson: parseInt(revisionTime) || 45,
      },
      isCustomName,
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  const handleDelete = () => {
    removeCourse(course.id);
    onDeleted();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="cp-field">
        <label>Nome Corso</label>
        <input
          className="cp-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Es: Analisi Matematica I"
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 4 }}>
          <input
            type="checkbox"
            checked={isCustomName}
            onChange={e => setIsCustomName(e.target.checked)}
          />
          <span>Salva come predefinito (protegge da modifiche automatiche di pulizia nomi)</span>
        </label>
        {course.originalName && course.originalName !== name && (
          <div style={{ fontSize: '0.76rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>Nome originale rilevato: <em>{course.originalName}</em></span>
            <button
              type="button"
              onClick={() => { setName(course.originalName!); setIsCustomName(false); }}
              style={{ background: 'none', border: 'none', color: '#1a73e8', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: '0.76rem' }}
            >
              Ripristina
            </button>
          </div>
        )}
      </div>

      <div className="cp-row">
        <div className="cp-field">
          <label>Difficoltà (1 - 10)</label>
          <input
            className="cp-input"
            type="number"
            min="1"
            max="10"
            value={difficulty}
            onChange={e => setDifficulty(e.target.value)}
          />
        </div>
        <div className="cp-field">
          <label>Stima revisione appunti per lezione (minuti)</label>
          <input
            className="cp-input"
            type="number"
            min="10"
            max="300"
            value={revisionTime}
            onChange={e => setRevisionTime(e.target.value)}
          />
        </div>
      </div>

      <div className="cp-field">
        <label>Colore del Corso</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <button
              key={c}
              type="button"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: c,
                border: color === c ? '3px solid var(--text-primary)' : '2px solid transparent',
                cursor: 'pointer',
              }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="cp-field">
        <label>Preferenze Generazione Attività di Studio</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={notesRevision}
              onChange={e => setNotesRevision(e.target.checked)}
            />
            <span>Genera automaticamente task di revisione appunti dopo le lezioni teoriche</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={exercises}
              onChange={e => setExercises(e.target.checked)}
            />
            <span>Genera task di esercizi dopo ogni lezione</span>
          </label>
        </div>
      </div>

      <div className="cp-toolbar" style={{ marginTop: 8 }}>
        <button className="btn btn-primary" onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={16} /> Salva Impostazioni Corso
        </button>
        {savedMsg && (
          <span style={{ fontSize: '0.85rem', color: '#188038', fontWeight: 600 }}>
            ✓ Impostazioni salvate!
          </span>
        )}
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '14px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h4 className="cp-section-title" style={{ color: 'var(--accent-danger)' }}>
          Zona Pericolo
        </h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
          Eliminando il corso verranno rimosse anche le informazioni memorizzate (indice, prove e calendario della materia).
        </p>
        {!confirmDelete ? (
          <div>
            <button
              className="btn btn-danger"
              onClick={() => setConfirmDelete(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Trash2 size={15} /> Elimina questo corso
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'rgba(217, 48, 37, 0.08)', padding: 10, borderRadius: 8 }}>
            <AlertCircle size={18} style={{ color: '#d93025' }} />
            <span style={{ fontSize: '0.85rem', color: '#d93025', fontWeight: 600 }}>Confermi l'eliminazione definitiva?</span>
            <button className="btn btn-danger" onClick={handleDelete} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
              Sì, Elimina
            </button>
            <button className="btn btn-ghost" onClick={() => setConfirmDelete(false)} style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
              Annulla
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

