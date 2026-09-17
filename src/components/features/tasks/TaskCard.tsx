import { useState } from 'react';
import type { Task } from '../../../core/types';
import { useAppStore } from '../../../store/useAppStore';
import { Clock, Check, ChevronRight, AlertTriangle, SkipForward } from 'lucide-react';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const completeTask = useAppStore(s => s.completeTask);
  const updateTask = useAppStore(s => s.updateTask);
  const courses = useAppStore(s => s.courses);
  const [showComplete, setShowComplete] = useState(false);
  const [actualTime, setActualTime] = useState(task.estimatedDuration.toString());

  const course = courses.find(c => c.id === task.courseId);
  const isUrgent = task.priorityScore > 80;
  const isDone = task.status === 'done';

  const handleComplete = () => {
    completeTask(task.id, parseInt(actualTime) || task.estimatedDuration);
    setShowComplete(false);
  };

  const handlePostpone = () => {
    updateTask(task.id, { postponedCount: task.postponedCount + 1 });
  };

  return (
    <div className={`task-card ${isDone ? 'task-done' : ''} ${isUrgent ? 'task-urgent' : ''}`}>
      <div className="task-card-header">
        <div className="task-card-left">
          {course && (
            <span className="task-course-dot" style={{ backgroundColor: course.color }} />
          )}
          <span className={`task-title ${isDone ? 'line-through' : ''}`}>{task.title}</span>
        </div>
        <div className="task-card-badges">
          {isUrgent && !isDone && (
            <span className="task-badge task-badge-urgent">
              <AlertTriangle size={10} /> URGENTE
            </span>
          )}
          {isDone && (
            <span className="task-badge task-badge-done">
              <Check size={10} /> FATTO
            </span>
          )}
          {!isDone && !isUrgent && (
            <span className="task-badge task-badge-normal">
              P: {task.priorityScore}
            </span>
          )}
        </div>
      </div>

      <div className="task-card-meta">
        <div className="task-meta-item">
          <Clock size={12} />
          <span>Stima: {task.estimatedDuration} min</span>
        </div>
        {task.actualDuration && (
          <div className="task-meta-item">
            <Check size={12} />
            <span>Reale: {task.actualDuration} min</span>
          </div>
        )}
        {task.postponedCount > 0 && !isDone && (
          <div className="task-meta-item task-postponed">
            <SkipForward size={12} />
            <span>Rimandato {task.postponedCount}x</span>
          </div>
        )}
        {course && <span className="task-course-name">{course.name}</span>}
      </div>

      {task.dependencies.length > 0 && !isDone && (
        <div className="task-deps-note">
          <ChevronRight size={12} />
          <span>Richiede {task.dependencies.length} task propedeutic{task.dependencies.length > 1 ? 'he' : 'a'}</span>
        </div>
      )}

      {!isDone && (
        <div className="task-card-actions">
          {!showComplete ? (
            <>
              <button className="task-action-btn task-complete-btn" onClick={() => setShowComplete(true)}>
                <Check size={14} /> Completa
              </button>
              <button className="task-action-btn task-postpone-btn" onClick={handlePostpone}>
                <SkipForward size={14} /> Rimanda
              </button>
            </>
          ) : (
            <div className="task-complete-form">
              <label className="task-complete-label">Tempo effettivo (min):</label>
              <input
                type="number"
                value={actualTime}
                onChange={(e) => setActualTime(e.target.value)}
                className="task-complete-input"
                min="1"
              />
              <button className="task-action-btn task-confirm-btn" onClick={handleComplete}>
                <Check size={14} /> Conferma
              </button>
              <button className="task-action-btn task-cancel-btn" onClick={() => setShowComplete(false)}>
                Annulla
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
