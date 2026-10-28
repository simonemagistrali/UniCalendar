import { useState, useMemo } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { SemesterManager } from '../../../core/SemesterManager';
import { CheckSquare, Square, ArrowRight, Sparkles, BookOpen } from 'lucide-react';

interface SemesterWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SemesterWizardModal({ isOpen, onClose }: SemesterWizardModalProps) {
  const courses = useAppStore(s => s.courses);
  const semesters = useAppStore(s => s.semesters);
  const tasks = useAppStore(s => s.tasks);
  const closeActiveSemester = useAppStore(s => s.closeActiveSemester);
  const addSemester = useAppStore(s => s.addSemester);

  const activeSemester = useMemo(() => SemesterManager.getActive(semesters), [semesters]);

  // Default: all existing courses are selected to end (unless user unchecks annual ones)
  const [selectedEndCourseIds, setSelectedEndCourseIds] = useState<string[]>(() => courses.map(c => c.id));
  const [openTasksChoice, setOpenTasksChoice] = useState<'discard' | 'keep'>('discard');
  const [nextSemesterName, setNextSemesterName] = useState(() => SemesterManager.suggestName());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keep selected ids synced if courses change
  const toggleCourse = (courseId: string) => {
    setSelectedEndCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  const selectAll = () => setSelectedEndCourseIds(courses.map(c => c.id));
  const deselectAll = () => setSelectedEndCourseIds([]);

  const handleConfirm = () => {
    setIsSubmitting(true);
    try {
      // 1. Close current semester and archive completed courses
      closeActiveSemester({
        endCourseIds: selectedEndCourseIds,
        openTasks: openTasksChoice,
      });

      // 2. Open new semester
      const trimmedName = nextSemesterName.trim() || SemesterManager.suggestName();
      addSemester(trimmedName);

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeSemester ? `Concludi "${activeSemester.name}" & Inizia Nuovo Semestre` : 'Inizia un Nuovo Semestre'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Info Banner */}
        <div style={{
          padding: '0.85rem 1rem',
          borderRadius: '10px',
          background: 'rgba(99, 102, 241, 0.1)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'flex-start',
        }}>
          <Sparkles size={20} style={{ color: '#818cf8', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.45 }}>
            <strong>Cosa succede alla chiusura?</strong>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)' }}>
              Non perderai ciò che hai imparato! Per ogni corso concluso verrà creato un archivio permanente con le ore studiate, le attività completate e l'elenco di tutti gli argomenti affrontati.
            </p>
          </div>
        </div>

        {/* Course Selection */}
        {courses.length > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Seleziona i corsi terminati (da archiviare):
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={selectAll}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Tutti
                </button>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>•</span>
                <button
                  type="button"
                  onClick={deselectAll}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem' }}
                >
                  Nessuno
                </button>
              </div>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 0.6rem' }}>
              Deseleziona i corsi annuali che continueranno nel prossimo semestre: rimarranno attivi con i loro eventi e appunti.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              maxHeight: '190px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {courses.map(course => {
                const isSelected = selectedEndCourseIds.includes(course.id);
                const courseCompletedTasks = tasks.filter(t => t.courseId === course.id && t.status === 'done').length;

                return (
                  <div
                    key={course.id}
                    onClick={() => toggleCourse(course.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.8rem',
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      {isSelected ? (
                        <CheckSquare size={18} style={{ color: '#6366f1' }} />
                      ) : (
                        <Square size={18} style={{ color: 'var(--text-secondary)' }} />
                      )}
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: course.color || '#6366f1',
                        }}
                      />
                      <span style={{ fontWeight: 500, fontSize: '0.88rem' }}>{course.name}</span>
                    </div>

                    <span style={{
                      fontSize: '0.75rem',
                      color: isSelected ? 'var(--primary)' : 'var(--text-secondary)',
                      fontWeight: isSelected ? 600 : 400
                    }}>
                      {isSelected ? `Archivia (${courseCompletedTasks} task svolti)` : 'Continua nel prossimo'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Nessun corso attivo al momento. Verrà semplicemente creato il nuovo semestre.
          </div>
        )}

        {/* Open Tasks Choice */}
        {selectedEndCourseIds.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
              Task ancora aperti dei corsi archiviati:
            </label>
            <div style={{ display: 'flex', gap: '0.8rem', flexDirection: 'column' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="openTasks"
                  checked={openTasksChoice === 'discard'}
                  onChange={() => setOpenTasksChoice('discard')}
                />
                <span>Rimuovi dai task attivi (consigliato per ripartire puliti)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="radio"
                  name="openTasks"
                  checked={openTasksChoice === 'keep'}
                  onChange={() => setOpenTasksChoice('keep')}
                />
                <span>Mantieni nei task attivi (verranno scollegati dal corso)</span>
              </label>
            </div>
          </div>
        )}

        {/* New Semester Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <label style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            Nome del nuovo semestre:
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BookOpen size={18} style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              value={nextSemesterName}
              onChange={e => setNextSemesterName(e.target.value)}
              placeholder="Es: Secondo Semestre 2026/2027"
              className="settings-text-input"
              style={{ flex: 1, padding: '0.55rem 0.75rem', fontSize: '0.9rem' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Annulla
          </Button>
          <Button
            variant="primary"
            icon={<ArrowRight size={16} />}
            onClick={handleConfirm}
            disabled={isSubmitting || !nextSemesterName.trim()}
          >
            {isSubmitting ? 'Salvataggio...' : 'Conferma e Inizia'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
