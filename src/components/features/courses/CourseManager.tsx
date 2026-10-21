import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Sparkles } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { Modal } from '../../ui/Modal';
import type { Course } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid';

interface CourseManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = ['#1a73e8', '#d93025', '#188038', '#f29900', '#a142f4', '#e8710a', '#1967d2', '#c5221f', '#137333', '#b31412'];

export function CourseManager({ isOpen, onClose }: CourseManagerProps) {
  const courses = useAppStore(s => s.courses);
  const addCourse = useAppStore(s => s.addCourse);
  const updateCourse = useAppStore(s => s.updateCourse);
  const removeCourse = useAppStore(s => s.removeCourse);
  const repairCourses = useAppStore(s => s.repairCourses);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [repairMsg, setRepairMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const res = repairCourses();
      if (res.changed) {
        setRepairMsg('Duplicati rimossi e corsi unificati!');
        const timer = setTimeout(() => setRepairMsg(null), 4000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, repairCourses]);

  // Form state
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('5');
  const [color, setColor] = useState(COLORS[0]);
  const [notesRevision, setNotesRevision] = useState(true);
  const [exercises, setExercises] = useState(false);
  const [revisionTime, setRevisionTime] = useState('45');
  const [isCustomName, setIsCustomName] = useState(true);

  const resetForm = () => {
    setName('');
    setDifficulty('5');
    setColor(COLORS[0]);
    setNotesRevision(true);
    setExercises(false);
    setRevisionTime('45');
    setIsCustomName(true);
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const existing = editingId ? courses.find(c => c.id === editingId) : undefined;
    const nameChanged = existing && existing.name !== name.trim();
    const originalName = existing?.originalName || (nameChanged ? existing?.name : undefined);

    const courseData = {
      name: name.trim(),
      difficulty: parseInt(difficulty) || 5,
      color,
      defaultStudyPreferences: {
        requiresNotesRevision: notesRevision,
        requiresExercises: exercises,
        estimatedRevisionTimePerLesson: parseInt(revisionTime) || 45,
      },
      isCustomName,
      originalName,
    };

    if (editingId) {
      updateCourse(editingId, courseData);
    } else {
      addCourse({ ...courseData, id: uuidv4() });
    }
    resetForm();
  };

  const startEdit = (course: Course) => {
    setEditingId(course.id);
    setName(course.name);
    setDifficulty(course.difficulty.toString());
    setColor(course.color);
    setNotesRevision(course.defaultStudyPreferences.requiresNotesRevision);
    setExercises(course.defaultStudyPreferences.requiresExercises);
    setRevisionTime(course.defaultStudyPreferences.estimatedRevisionTimePerLesson.toString());
    setIsCustomName(course.isCustomName ?? true);
    setIsAdding(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Gestione Corsi">
      <div className="course-manager">
        {/* Course List */}
        <div className="course-list">
          {courses.length === 0 && !isAdding && (
            <p className="course-empty-msg">
              Nessun corso aggiunto. Aggiungine uno o importa un calendario.
            </p>
          )}
          {courses.map(c => (
            <div key={c.id} className="course-item">
              <div className="course-item-left">
                <span className="course-dot" style={{ backgroundColor: c.color }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="course-name">{c.name}</span>
                    {c.isCustomName && (
                      <span
                        className="course-custom-badge"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.68rem',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(26, 115, 232, 0.12)',
                          color: '#1a73e8',
                          fontWeight: 600,
                          border: '1px solid rgba(26, 115, 232, 0.25)',
                        }}
                        title="Nome predefinito impostato a mano. Protetto da modifiche automatiche all'apertura."
                      >
                        <Check size={10} /> Predefinito
                      </span>
                    )}
                  </div>
                  <span className="course-detail">Difficoltà: {c.difficulty}/10 · Revisione: {c.defaultStudyPreferences.estimatedRevisionTimePerLesson} min</span>
                </div>
              </div>
              <div className="course-item-actions">
                <button onClick={() => startEdit(c)} className="course-action-btn" title="Modifica corso">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => removeCourse(c.id)} className="course-action-btn course-delete-btn" title="Elimina corso">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add/Edit Form */}
        {isAdding ? (
          <div className="course-form">
            <div className="course-form-row">
              <div className="course-form-field" style={{ flex: 2 }}>
                <label>Nome Corso</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es: Analisi Matematica I" />
                <label
                  className="course-checkbox"
                  style={{
                    marginTop: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary, #5f6368)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isCustomName}
                    onChange={e => setIsCustomName(e.target.checked)}
                  />
                  <span>Salva come predefinito (blocca modifiche automatiche all'apertura)</span>
                </label>
                {editingId && (() => {
                  const orig = courses.find(c => c.id === editingId)?.originalName;
                  if (orig && orig !== name) {
                    return (
                      <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>Nome rilevato: <em>{orig}</em></span>
                        <button
                          type="button"
                          onClick={() => { setName(orig); setIsCustomName(false); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#1a73e8',
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                            fontSize: '0.76rem',
                          }}
                        >
                          Ripristina nome rilevato
                        </button>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="course-form-field">
                <label>Difficoltà (1-10)</label>
                <input type="number" value={difficulty} onChange={e => setDifficulty(e.target.value)} min="1" max="10" />
              </div>
            </div>

            <div className="course-form-field">
              <label>Colore</label>
              <div className="course-color-picker">
                {COLORS.map(c => (
                  <button
                    key={c}
                    className={`course-color-btn ${color === c ? 'active' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            <div className="course-form-field">
              <label>Preferenze di Studio</label>
              <div className="course-prefs">
                <label className="course-checkbox">
                  <input type="checkbox" checked={notesRevision} onChange={e => setNotesRevision(e.target.checked)} />
                  Richiede revisione appunti
                </label>
                <label className="course-checkbox">
                  <input type="checkbox" checked={exercises} onChange={e => setExercises(e.target.checked)} />
                  Richiede esercitazione
                </label>
              </div>
            </div>

            <div className="course-form-field">
              <label>Tempo stimato revisione per lezione (min)</label>
              <input type="number" value={revisionTime} onChange={e => setRevisionTime(e.target.value)} min="10" max="300" />
            </div>

            <div className="course-form-actions">
              <button className="task-action-btn task-confirm-btn" onClick={handleSave}>
                <Check size={14} /> {editingId ? 'Aggiorna' : 'Aggiungi'}
              </button>
              <button className="task-action-btn task-cancel-btn" onClick={resetForm}>
                <X size={14} /> Annulla
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="course-add-btn" onClick={() => setIsAdding(true)} style={{ flex: 1 }}>
                <Plus size={16} /> Aggiungi Corso
              </button>
              <button
                type="button"
                className="course-repair-btn"
                onClick={() => {
                  const res = repairCourses();
                  setRepairMsg(res.changed ? 'Doppioni rimossi e corsi unificati con successo!' : 'Tutti i corsi sono corretti e senza doppioni');
                  setTimeout(() => setRepairMsg(null), 3500);
                }}
                title="Rimuove i corsi doppioni e corregge eventuali nomi troncati"
              >
                <Sparkles size={15} /> Unifica e Ripara
              </button>
            </div>
            {repairMsg && (
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                backgroundColor: 'rgba(24, 128, 56, 0.12)',
                color: '#188038',
                border: '1px solid rgba(24, 128, 56, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Check size={14} />
                <span>{repairMsg}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
