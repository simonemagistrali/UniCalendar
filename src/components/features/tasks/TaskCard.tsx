import { useState } from 'react';
import type { Task } from '../../../core/types';
import { useAppStore } from '../../../store/useAppStore';
import { Clock, Check, ChevronRight, AlertTriangle, SkipForward, RotateCcw, Eye, Play, Pause, Calendar, Trash2, Sparkles } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  isSelectable?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function TaskCard({ task, isSelectable = false, isSelected = false, onToggleSelect }: TaskCardProps) {
  const completeTask = useAppStore(s => s.completeTask);
  const updateTask = useAppStore(s => s.updateTask);
  const removeTask = useAppStore(s => s.removeTask);
  const courses = useAppStore(s => s.courses);
  const events = useAppStore(s => s.events);
  const [completeMode, setCompleteMode] = useState<'attended' | 'recovered' | 'normal' | null>(null);
  const [actualTime, setActualTime] = useState(task.estimatedDuration.toString());
  const [wasDistracted, setWasDistracted] = useState(false);
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [nowMs] = useState(() => Date.now());

  const course = courses.find(c => c.id === task.courseId);
  const isUrgent = task.priorityScore >= 100;
  const isDone = task.status === 'done';
  const isInProgress = task.status === 'in_progress';
  const isLessonTask = task.title.startsWith('Seguire/Recuperare lezione');

  // Resolve lesson date and time slot
  const relatedEvent = task.relatedEventId ? events.find(e => e.id === task.relatedEventId) : null;
  
  let rawDate = task.lessonDate;
  let rawTimeSlot = task.lessonTimeSlot;

  if (!rawDate && relatedEvent) {
    rawDate = relatedEvent.startTime.split('T')[0];
  }
  if (!rawTimeSlot && relatedEvent) {
    const s = new Date(relatedEvent.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const e = new Date(relatedEvent.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    rawTimeSlot = `${s} - ${e}`;
  }

  // Fallback regex from title if still missing
  if (!rawDate || !rawTimeSlot) {
    const timeMatch = task.title.match(/\((\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\s+([0-9:]+\s*-\s*[0-9:]+)\)/);
    if (timeMatch) {
      if (!rawDate) rawDate = timeMatch[1];
      if (!rawTimeSlot) rawTimeSlot = timeMatch[2];
    } else {
      const dateMatch = task.title.match(/\((\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})\)/);
      if (dateMatch && !rawDate) {
        rawDate = dateMatch[1];
      }
    }
  }

  // Format date nicely to DD/MM/YYYY
  const formatDisplayDate = (dStr?: string) => {
    if (!dStr) return null;
    if (dStr.includes('/')) return dStr;
    if (dStr.includes('-')) {
      const parts = dStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  const displayLessonDate = formatDisplayDate(rawDate);
  const displayLessonTime = rawTimeSlot;

  const displayTitle = task.title
    .replace('[Previsto] ', '')
    .replace('Sistemare appunti: Lezione: ', 'Appunti: ')
    .replace('Sistemare appunti: ', 'Appunti: ')
    .replace('Seguire/Recuperare lezione: ', 'Seguire: ')
    .replace(/\s*\(\d{4}-\d{2}-\d{2}(\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})?\)$/, '')
    .replace(/\s*\(\d{2}\/\d{2}\/\d{4}(\s+\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})?\)$/, '');

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
            <span className="task-title" title={task.title}>{displayTitle}</span>
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
          {(displayLessonDate || displayLessonTime) && (
            <div className="task-meta-item" style={{ color: 'var(--primary, #1a73e8)', fontWeight: 500, fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              <span>{displayLessonDate} {displayLessonTime && `(${displayLessonTime})`}</span>
            </div>
          )}
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
  const handleComplete = (customMinutes?: number, customOpts?: { durationConfidence?: number; wasDistracted?: boolean; isMultiDay?: boolean }) => {
    const finalMins = customMinutes ?? (parseInt(actualTime) || task.estimatedDuration);
    completeTask(task.id, finalMins, completeMode || 'normal', {
      durationConfidence: customOpts?.durationConfidence,
      wasDistracted: customOpts?.wasDistracted ?? wasDistracted,
      isMultiDay: customOpts?.isMultiDay ?? isMultiDay,
    });
    setCompleteMode(null);
    setWasDistracted(false);
    setIsMultiDay(false);
  };

  const handleStart = () => {
    updateTask(task.id, { status: 'in_progress', startedAt: new Date().toISOString() });
  };

  const handlePause = () => {
    updateTask(task.id, { 
      status: 'todo', 
      accumulatedTime: getTotalAccumulated(),
      startedAt: undefined,
      pauseCount: (task.pauseCount || 0) + 1,
    });
  };

  const handleOpenComplete = (mode: 'attended' | 'recovered' | 'normal') => {
    setCompleteMode(mode);
    setWasDistracted(false);
    setIsMultiDay(false);
    if (isInProgress || task.accumulatedTime) {
      setActualTime(Math.max(1, Math.round(getTotalAccumulated())).toString());
    } else {
      setActualTime(task.estimatedDuration.toString());
    }
  };

  const handleUncomplete = () => {
    updateTask(task.id, { 
      status: 'todo', 
      actualDuration: undefined, 
      completedAt: undefined, 
      completionMode: undefined,
      durationConfidence: undefined,
      wasDistracted: undefined,
      isMultiDay: undefined,
    });
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Vuoi eliminare l'attività:\n"${displayTitle}"?`)) {
      removeTask(task.id);
    }
  };

  return (
    <div className={`task-card ${isDone ? 'task-done' : ''} ${isUrgent ? 'task-urgent' : ''}`}>
      <div className="task-card-header">
        {isSelectable && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={{ width: '16px', height: '16px', cursor: 'pointer', marginRight: '8px', accentColor: 'var(--primary, #3b82f6)' }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Seleziona task"
          />
        )}
        <div className="task-card-left">
          {course && (
            <span className="task-course-dot" style={{ backgroundColor: course.color }} />
          )}
          <span className={`task-title ${isDone ? 'line-through' : ''}`} title={task.title}>{displayTitle}</span>
        </div>
        <div className="task-card-badges">
          {task.isAiEnriched && (
            <span className="task-badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#9333ea', border: '1px solid rgba(168, 85, 247, 0.3)' }} title="Note o argomento aggiunti tramite AI">
              <Sparkles size={10} /> AI
            </span>
          )}
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
            <span
              className="task-badge task-badge-normal"
              title={`Punteggio priorità: ${task.priorityScore}`}
            >
              {(() => {
                const reasons: string[] = [];
                if (task.assessmentPrep) {
                  const phaseLabels = { review: 'Ripasso', exercises: 'Esercizi prep', mock: 'Simulazione', final: 'Ripasso finale' };
                  reasons.push(task.assessmentPhase ? phaseLabels[task.assessmentPhase] : 'Prep. verifica');
                }
                if (task.deadline) {
                  const days = Math.ceil((new Date(task.deadline).getTime() - nowMs) / 86400000);
                  if (days >= 0 && days <= 14) reasons.push(`Scade tra ${days}g`);
                } else if (course) {
                  const nextExam = events.find(e => e.courseId === course.id && (e.type === 'exam' || e.type === 'quiz') && new Date(e.startTime).getTime() > nowMs);
                  if (nextExam) {
                    const days = Math.ceil((new Date(nextExam.startTime).getTime() - nowMs) / 86400000);
                    if (days >= 0 && days <= 21) reasons.push(`Esame tra ${days}g`);
                  }
                }
                if (task.postponedCount > 0) reasons.push(`Saltata ${task.postponedCount}×`);
                const ageDays = Math.floor((nowMs - new Date(task.createdAt).getTime()) / 86400000);
                if (ageDays >= 5 && reasons.length < 2) reasons.push(`Da ${ageDays}g`);
                return reasons.length > 0 ? reasons.slice(0, 2).join(' · ') : `P: ${task.priorityScore}`;
              })()}
            </span>
          )}
        </div>
      </div>

      {task.description && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 8px 0', padding: '6px 8px', borderRadius: '6px', background: 'var(--bg-secondary)', borderLeft: '3px solid var(--primary)', whiteSpace: 'pre-line', lineHeight: 1.4 }}>
          {task.description}
        </div>
      )}

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
        {(displayLessonDate || displayLessonTime) && (
          <div 
            className="task-meta-item task-meta-lesson-slot"
            style={{ 
              color: '#1d4ed8', 
              backgroundColor: 'rgba(59, 130, 246, 0.08)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}
            title="Data e fascia oraria della lezione corrispondente"
          >
            <Calendar size={12} />
            <span>
              {displayLessonDate ? `Lezione: ${displayLessonDate}` : 'Lezione'}
              {displayLessonDate && displayLessonTime ? ' • ' : ''}
              {displayLessonTime && <Clock size={11} style={{ display: 'inline', margin: '0 2px -1px 2px' }} />}
              {displayLessonTime}
            </span>
          </div>
        )}
        {task.deadline && (
          <div className="task-meta-item" style={{ color: '#ea4335', fontWeight: 500, fontSize: '0.75rem' }}>
            <Calendar size={12} />
            <span>Scadenza: {new Date(task.deadline).toLocaleDateString('it-IT')}</span>
          </div>
        )}
        {isDone && task.completedAt && (
          <div className="task-meta-item">
            <Calendar size={12} />
            <span>Completata: {new Date(task.completedAt).toLocaleDateString('it-IT')}</span>
          </div>
        )}
        {task.postponedCount > 0 && !isDone && (
          <div className="task-meta-item task-postponed" title="Attività in cima alla lista saltata per farne altre">
            <SkipForward size={12} />
            <span>Saltata {task.postponedCount}x</span>
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
              <button 
                className="task-action-btn" 
                onClick={handleDelete}
                title="Elimina definitivamente questa attività"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', marginLeft: 'auto' }}
              >
                <Trash2 size={13} /> Elimina
              </button>
            </>
          ) : (
            <div className="task-complete-form" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
              {/* Scelte rapide qualitative (1 clic) per quando non si ricorda il minuto esatto */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '2px' }}>Com'è andata?</span>
                <button
                  type="button"
                  className="task-action-btn"
                  onClick={() =>
                    handleComplete(Math.max(10, Math.round((task.estimatedDuration * 0.75) / 5) * 5), {
                      durationConfidence: 0.85,
                    })
                  }
                  title="Completa subito: circa il 25% più veloce del previsto"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  ⚡ Più veloce (~{Math.max(10, Math.round((task.estimatedDuration * 0.75) / 5) * 5)}m)
                </button>
                <button
                  type="button"
                  className="task-action-btn"
                  onClick={() => handleComplete(task.estimatedDuration, { durationConfidence: 0.9 })}
                  title="Completa subito: durata in linea con la stima"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  👌 Come previsto ({task.estimatedDuration}m)
                </button>
                <button
                  type="button"
                  className="task-action-btn"
                  onClick={() =>
                    handleComplete(Math.round((task.estimatedDuration * 1.35) / 5) * 5, {
                      durationConfidence: 0.85,
                    })
                  }
                  title="Completa subito: circa il 35% più lungo del previsto"
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                >
                  🐢 Più lungo (~{Math.round((task.estimatedDuration * 1.35) / 5) * 5}m)
                </button>
                <button
                  type="button"
                  className="task-action-btn"
                  onClick={() =>
                    handleComplete(task.estimatedDuration, {
                      durationConfidence: 0,
                      isMultiDay: true,
                    })
                  }
                  title="Chiude l'attività senza alterare le stime dei tempi o la curva degli orari"
                  style={{
                    fontSize: '0.75rem',
                    padding: '4px 8px',
                    backgroundColor: 'rgba(107, 114, 128, 0.12)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                  }}
                >
                  🤷 Non ricordo / Più giorni
                </button>
              </div>

              {/* Input preciso + opzioni distrazione/multi-giorno */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <label className="task-complete-label">Oppure minuti esatti:</label>
                <input
                  type="number"
                  value={actualTime}
                  onChange={(e) => setActualTime(e.target.value)}
                  className="task-complete-input"
                  min="1"
                />
                <button
                  type="button"
                  className="task-action-btn"
                  onClick={() => setWasDistracted(v => !v)}
                  title="Se ti sei distratto, il tempo extra NON aumenterà la difficoltà della materia"
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 8px',
                    backgroundColor: wasDistracted ? 'rgba(245, 158, 11, 0.18)' : 'transparent',
                    border: wasDistracted ? '1px solid #f59e0b' : '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    color: wasDistracted ? '#d97706' : 'var(--text-secondary)',
                  }}
                >
                  📱 Distratto
                </button>
                <button
                  type="button"
                  className="task-action-btn"
                  onClick={() => setIsMultiDay(v => !v)}
                  title="Se l'hai svolta in più giorni/sessioni, spalma il carico evitando falsi picchi"
                  style={{
                    fontSize: '0.74rem',
                    padding: '4px 8px',
                    backgroundColor: isMultiDay ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    border: isMultiDay ? '1px solid #3b82f6' : '1px solid var(--border-color, rgba(0,0,0,0.15))',
                    color: isMultiDay ? '#2563eb' : 'var(--text-secondary)',
                  }}
                >
                  📅 Più sessioni/giorni
                </button>
                <button className="task-action-btn task-confirm-btn" onClick={() => handleComplete()}>
                  <Check size={14} /> Conferma
                </button>
                <button className="task-action-btn task-cancel-btn" onClick={() => setCompleteMode(null)}>
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="task-card-actions">
          <button className="task-action-btn task-cancel-btn" onClick={handleUncomplete} style={{ opacity: 0.8 }}>
            <RotateCcw size={14} /> Segna da fare
          </button>
          <button 
            className="task-action-btn" 
            onClick={handleDelete}
            title="Elimina definitivamente questa attività"
            style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.25)', marginLeft: 'auto' }}
          >
            <Trash2 size={13} /> Elimina
          </button>
        </div>
      )}
    </div>
  );
}
