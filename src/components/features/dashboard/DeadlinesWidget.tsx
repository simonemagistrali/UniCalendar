import { useMemo } from 'react';
import { ClipboardList, CheckSquare, Square, Calendar, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import type { CourseAssessment, Course } from '../../../core/types';
import { ASSESSMENT_LABELS } from '../../../core/CourseKnowledge';
import { GlassPanel } from '../../ui/GlassPanel';
import './DeadlinesWidget.css';

interface DeadlineItem {
  assessment: CourseAssessment;
  course: Course;
  isOverdue: boolean;
  sortKey: string;
}

export function DeadlinesWidget() {
  const courses = useAppStore(s => s.courses);
  const updateCourse = useAppStore(s => s.updateCourse);

  const pendingDeadlines = useMemo(() => {
    const list: DeadlineItem[] = [];
    const now = Date.now();

    for (const course of courses) {
      const assessments = course.info?.assessments ?? [];
      for (const a of assessments) {
        if (!a.done) {
          const dateStr = a.date ?? '9999-12-31';
          const timeStr = a.time ?? '23:59';
          const fullDateTime = `${dateStr}T${timeStr}:00`;
          const deadlineMs = a.date ? new Date(fullDateTime).getTime() : Infinity;
          const isOverdue = deadlineMs < now;

          list.push({
            assessment: a,
            course,
            isOverdue,
            sortKey: `${dateStr} ${timeStr}`,
          });
        }
      }
    }

    // Ordina dalla più vecchia (o scaduta) in poi; quelle senza data finiscono in fondo
    return list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [courses]);

  const handleToggle = (item: DeadlineItem) => {
    const currentCourse = courses.find(c => c.id === item.course.id);
    if (!currentCourse) return;

    const currentAssessments = currentCourse.info?.assessments ?? [];
    const updated = currentAssessments.map(a =>
      a.id === item.assessment.id ? { ...a, done: !a.done } : a
    );

    updateCourse(currentCourse.id, {
      info: {
        ...(currentCourse.info ?? {}),
        assessments: updated,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const overdueCount = pendingDeadlines.filter(d => d.isOverdue).length;

  return (
    <GlassPanel className="deadlines-widget">
      <div className="deadlines-widget-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ClipboardList size={18} style={{ color: 'var(--accent-primary)' }} />
          <h3 className="deadlines-widget-title">Scadenze & Prove</h3>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {overdueCount > 0 && (
            <span className="deadlines-overdue-pill">
              {overdueCount} scadut{overdueCount === 1 ? 'a' : 'e'}
            </span>
          )}
          <span className="deadlines-total-badge">
            {pendingDeadlines.length}
          </span>
        </div>
      </div>

      <div className="deadlines-widget-list">
        {pendingDeadlines.length === 0 ? (
          <div className="deadlines-empty">
            <Calendar size={28} style={{ opacity: 0.4, marginBottom: 4 }} />
            <span>Nessuna scadenza o prova in sospeso. Ottimo lavoro!</span>
          </div>
        ) : (
          pendingDeadlines.map(({ assessment, course, isOverdue }) => {
            const label = ASSESSMENT_LABELS[assessment.type] || 'Scadenza';
            return (
              <div
                key={`${course.id}-${assessment.id}`}
                className={`deadline-card ${isOverdue ? 'overdue' : ''}`}
              >
                <button
                  type="button"
                  className="deadline-toggle-btn"
                  onClick={() => handleToggle({ assessment, course, isOverdue, sortKey: '' })}
                  title="Segna come completata"
                >
                  {assessment.done ? (
                    <CheckSquare size={19} style={{ color: 'var(--accent-success)' }} />
                  ) : (
                    <Square size={19} />
                  )}
                </button>

                <div className="deadline-body">
                  <div className="deadline-main-line">
                    <span className="deadline-title">{assessment.title}</span>
                  </div>

                  <div className="deadline-meta-row">
                    <span
                      className="deadline-course-pill"
                      style={{
                        backgroundColor: `${course.color}18`,
                        color: course.color,
                        borderColor: `${course.color}35`,
                      }}
                    >
                      <span
                        className="deadline-course-dot"
                        style={{ backgroundColor: course.color }}
                      />
                      {course.name}
                    </span>

                    <span className="deadline-type-tag">{label}</span>

                    {assessment.weightPercent != null && (
                      <span className="deadline-weight-tag">
                        {assessment.weightPercent}%
                      </span>
                    )}

                    {isOverdue && (
                      <span className="deadline-overdue-tag">
                        <AlertCircle size={11} /> Scaduta
                      </span>
                    )}
                  </div>

                  <div className="deadline-date-row">
                    {assessment.date ? (
                      <span className="deadline-date-text">
                        {new Date(`${assessment.date}T00:00:00`).toLocaleDateString('it-IT', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                        {assessment.time ? ` • ${assessment.time}` : ''}
                      </span>
                    ) : (
                      <span className="deadline-date-text" style={{ fontStyle: 'italic' }}>
                        Data da definire
                      </span>
                    )}

                    {assessment.notes && (
                      <span className="deadline-notes" title={assessment.notes}>
                        {assessment.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </GlassPanel>
  );
}
