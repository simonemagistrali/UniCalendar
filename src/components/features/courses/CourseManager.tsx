import { useState } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
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

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState('5');
  const [color, setColor] = useState(COLORS[0]);
  const [notesRevision, setNotesRevision] = useState(true);
  const [exercises, setExercises] = useState(false);
  const [revisionTime, setRevisionTime] = useState('45');

  const resetForm = () => {
    setName('');
    setDifficulty('5');
    setColor(COLORS[0]);
    setNotesRevision(true);
    setExercises(false);
    setRevisionTime('45');
    setIsAdding(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const courseData = {
      name: name.trim(),
      difficulty: parseInt(difficulty) || 5,
      color,
      defaultStudyPreferences: {
        requiresNotesRevision: notesRevision,
        requiresExercises: exercises,
        estimatedRevisionTimePerLesson: parseInt(revisionTime) || 45,
      },
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
    setIsAdding(true);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => { resetForm(); onClose(); }} title="Gestione Corsi">
      <div className="course-manager">
        {/* Course List */}
        <div className="course-list">
          {courses.length === 0 && !isAdding && (
            <p className="text-sm text-[var(--text-secondary)] text-center p-4">
              Nessun corso aggiunto. Aggiungine uno o importa un calendario.
            </p>
          )}
          {courses.map(c => (
            <div key={c.id} className="course-item">
              <div className="course-item-left">
                <span className="course-dot" style={{ backgroundColor: c.color }} />
                <div>
                  <span className="course-name">{c.name}</span>
                  <span className="course-detail">Difficoltà: {c.difficulty}/10 · Revisione: {c.defaultStudyPreferences.estimatedRevisionTimePerLesson} min</span>
                </div>
              </div>
              <div className="course-item-actions">
                <button onClick={() => startEdit(c)} className="course-action-btn">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => removeCourse(c.id)} className="course-action-btn course-delete-btn">
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
          <button className="course-add-btn" onClick={() => setIsAdding(true)}>
            <Plus size={16} /> Aggiungi Corso
          </button>
        )}
      </div>
    </Modal>
  );
}
