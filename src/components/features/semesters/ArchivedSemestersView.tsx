import { useState } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { Archive, ChevronDown, ChevronUp, BookOpen, Clock, CheckCircle2, Tag } from 'lucide-react';


export function ArchivedSemestersView() {
  const semesters = useAppStore(s => s.semesters);
  const archived = semesters.filter(s => s.status === 'archived' && s.archive);

  const [expandedSemesterId, setExpandedSemesterId] = useState<string | null>(null);

  if (archived.length === 0) {
    return (
      <div style={{
        padding: '1rem',
        borderRadius: '8px',
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px dashed rgba(255, 255, 255, 0.1)',
        textAlign: 'center',
        color: 'var(--text-secondary)',
        fontSize: '0.85rem'
      }}>
        Nessun semestre archiviato finora. Quando chiudi un semestre, lo storico delle tue ore, dei task e degli argomenti appresi apparirà qui.
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedSemesterId(prev => prev === id ? null : id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {archived.map(sem => {
        const isExpanded = expandedSemesterId === sem.id;
        const arch = sem.archive!;
        const hours = Math.round(arch.totalMinutes / 60);

        return (
          <div
            key={sem.id}
            style={{
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              overflow: 'hidden',
              transition: 'border-color 0.2s ease',
            }}
          >
            {/* Header / Summary Bar */}
            <div
              onClick={() => toggleExpand(sem.id)}
              style={{
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: isExpanded ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Archive size={18} style={{ color: 'var(--primary)' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    {sem.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {sem.endDate ? `Chiuso il ${new Date(sem.endDate).toLocaleDateString('it-IT')}` : 'Archiviato'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Clock size={14} /> {hours}h
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={14} /> {arch.tasksCompleted} task
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <BookOpen size={14} /> {arch.courses.length} corsi
                  </span>
                </div>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {/* Expanded Content: Courses & Learned Topics */}
            {isExpanded && (
              <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Competenze e Temi Appresi nel Semestre
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {arch.courses.map(course => (
                    <div
                      key={course.id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                          {course.name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {Math.round(course.minutes / 60)}h • {course.tasksCompleted} attività completate
                        </span>
                      </div>

                      {/* Topics */}
                      {course.topics && course.topics.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                          {course.topics.map((topic, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'rgba(99, 102, 241, 0.12)',
                                color: '#a5b4fc',
                                border: '1px solid rgba(99, 102, 241, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                              }}
                            >
                              <Tag size={10} />
                              {topic}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                          Nessun argomento specifico etichettato per questo corso.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
