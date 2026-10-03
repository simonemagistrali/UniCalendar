import { useState } from 'react';
import type { Task } from '../../../core/types';
import { useAppStore } from '../../../store/useAppStore';
import { Clock, Check, ChevronRight, AlertTriangle, SkipForward, RotateCcw, Eye, Play, Pause, Calendar } from 'lucide-react';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const completeTask = useAppStore(s => s.completeTask);
  const updateTask = useAppStore(s => s.updateTask);
  const courses = useAppStore(s => s.courses);
  const [completeMode, setCompleteMode] = useState<'attended' | 'recovered' | 'normal' | null>(null);
  const [actualTime, setActualTime] = useState(task.estimatedDuration.toString());

  const course = courses.find(c => c.id === task.courseId);
  const isUrgent = task.priorityScore >= 100;
  const isDone = task.status === 'done';
  const isInProgress = task.status === 'in_progress';
  const isLessonTask = task.title.startsWith('Seguire/Recuperare lezione');

  const getTotalAccumulated = () => {
    let elapsed = 0;
    if (task.startedAt) {
      elapsed = (new Date().getTime() - new Date(task.startedAt).getTime()) / 60000;
    }
    return (task.accumulatedTime || 0) + elapsed;
  };

  // ─── Phantom Task Rendering ───
  if (task.isPhantom) {
    return (
      <div className="task-card task-phantom">
        <div className="task-card-header">
          <div className="task-card-left">
            {course && (
              <span className="task-course-dot" style={{ backgroundColor: course.color, opacity: 0.5 }} />
            )}
            <span className="task-title">{task.title.replace('[Previsto] ', '')}</span>
          </div>
          <div className="task-card-badges">
            <span className="task-badge task-badge-phantom">
              <Eye size={10} /> PREVISTO
            </span>
          </div>
        </div>

        <div className="task-card-meta">
          <div className="task-meta-item">
            <Clock size={12} />
            <span>Stima: ~{task.estimatedDuration} min</span>
          </div>
          {course && <span className="task-course-name">{course.name}</span>}
        </div>

        {task.phantomSourceLesson && (
          <div className="task-phantom-source">
            <Eye size={12} />
            <span>{task.phantomSourceLesson}</span>
          </div>
        )}
      </div>
    );
  }

  // ─── Normal Task Rendering ───
  const handleComplete = () => {
    completeTask(task.id, parseInt(actualTime) || task.estimatedDuration, completeMode || 'normal');
    updateTask(task.id, { startedAt: undefined, accumulatedTime: 0 }); // Clean up
    setCompleteMode(null);
  };

  const handleStart = () => {
    updateTask(task.id, { status: 'in_progress', startedAt: new Date().toISOString() });
  };

  const handlePause = () => {
    updateTask(task.id, { 
      status: 'todo', 
      accumulatedTime: getTotalAccumulated(),
      startedAt: undefined 
    });
  };

  const handleOpenComplete = (mode: 'attended' | 'recovered' | 'normal') => {
    setCompleteMode(mode);
    if (isInProgress || task.accumulatedTime) {
      setActualTime(Math.max(1, Math.round(getTotalAccumulated())).toString());
    } else {
      setActualTime(task.estimatedDuration.toString());
    }
  };

  const handlePostpone = () => {
    updateTask(task.id, { postponedCount: task.postponedCount + 1 });
  };

  const handleUncomplete = () => {
    updateTask(task.id, { 
      status: 'todo', 
      actualDuration: undefined, 
      completedAt: undefined, 
      completionMode: undefined 
    });
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
          {isInProgress && (
            <span className="task-badge" style={{ backgroundColor: '#10b981', color: 'white' }}>
              <Play size={10} /> IN CORSO
            </span>
          )}
          {isUrgent && !isDone && !isInProgress && (
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
        {isDone && task.completedAt && (
          <div className="task-meta-item">
            <Calendar size={12} />
            <span>Completata: {new Date(task.completedAt).toLocaleDateString('it-IT')}</span>
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

      {!isDone ? (
        <div className="task-card-actions">
          {!completeMode ? (
            <>
              {!isInProgress ? (
                <button className="task-action-btn" onClick={handleStart} style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <Play size={14} /> Inizia
                </button>
              ) : (
                <button className="task-action-btn" onClick={handlePause} style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                  <Pause size={14} /> Pausa
                </button>
              )}
              
              {isLessonTask ? (
                <>
                  <button className="task-action-btn task-complete-btn" onClick={() => handleOpenComplete('attended')}>
                    <Check size={14} /> Seguita
                  </button>
                  <button className="task-action-btn task-complete-btn" onClick={() => handleOpenComplete('recovered')} style={{ backgroundColor: '#f29900', color: 'white' }}>
                    <Check size={14} /> Recuperata
                  </button>
                </>
              ) : (
                <button className="task-action-btn task-complete-btn" onClick={() => handleOpenComplete('normal')}>
                  <Check size={14} /> Concludi
                </button>
              )}
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
              <button className="task-action-btn task-cancel-btn" onClick={() => setCompleteMode(null)}>
                Annulla
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="task-card-actions">
          <button className="task-action-btn task-cancel-btn" onClick={handleUncomplete} style={{ opacity: 0.8 }}>
            <RotateCcw size={14} /> Segna da fare
          </button>
        </div>
      )}
    </div>
  );
}
