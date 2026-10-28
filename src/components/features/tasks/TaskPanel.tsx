import { useEffect, useMemo, useState } from 'react';
import { Clock, BookOpen, Zap, Eye, Sparkles, Trash2, CheckSquare } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { PriorityEngine } from '../../../core/PriorityEngine';
import { TaskManager } from '../../../core/TaskManager';
import { SchedulerEngine } from '../../../core/SchedulerEngine';
import { TravelManager } from '../../../core/TravelManager';
import { FutureProjectionEngine } from '../../../core/FutureProjectionEngine';
import { TaskCard } from './TaskCard';
import { TaskQuickAdd } from './TaskQuickAdd';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { getTaskKind } from '../../../core/taskKind';

export function TaskPanel({ dailyGoalOnly = false }: { dailyGoalOnly?: boolean }) {
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const preferences = useAppStore(s => s.preferences);
  const performanceHistory = useAppStore(s => s.performanceHistory);
  const addTasks = useAppStore(s => s.addTasks);
  const setEvents = useAppStore(s => s.setEvents);
  const setStudySessions = useAppStore(s => s.setStudySessions);
  const setTasks = useAppStore(s => s.setTasks);
  const cleanupDuplicates = useAppStore(s => s.cleanupDuplicates);
  const removeTasks = useAppStore(s => s.removeTasks);
  const removeTasksByFilter = useAppStore(s => s.removeTasksByFilter);

  const selectedDailyGoalValue = useAppStore(s => s.selectedDailyGoalValue);

  const completedTodayCount = useMemo(() => {
    const todayStr = new Date().toDateString();
    return tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).toDateString() === todayStr).length;
  }, [tasks]);

  const tasksLeftForToday = selectedDailyGoalValue !== null 
    ? Math.max(0, selectedDailyGoalValue - completedTodayCount) 
    : null;

  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done' | 'forecast'>('todo');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');
  const [sortDoneBy, setSortDoneBy] = useState<'completedAt' | 'createdAt'>('completedAt');
  const [cleanupMsg, setCleanupMsg] = useState('');

  // Bulk management and delete state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bulkCourseId, setBulkCourseId] = useState<string>('ALL');
  const [bulkType, setBulkType] = useState<string>('ALL');
  const [bulkStatus, setBulkStatus] = useState<string>('ALL');
  const [bulkOnlyAi, setBulkOnlyAi] = useState<boolean>(false);

  const TASK_TYPES = {
    ALL: 'Tutte le tipologie',
    FOLLOW_LESSON: 'Seguire/Recuperare lezione',
    NOTES: 'Sistemare appunti',
    EXERCISES: 'Esercizi',
    PROJECT: 'Progetto',
    OTHER: 'Altro'
  };

  const getTaskType = (task: typeof tasks[0]) => getTaskKind(task);

  // Auto-generate tasks from past events
  useEffect(() => {
    if (events.length === 0 || courses.length === 0) return;
    const { updatedEvents, newTasks } = TaskManager.generateTasksFromPastEvents(events, courses, tasks);
    if (newTasks.length > 0) {
      setEvents(updatedEvents);
      addTasks(newTasks);
    }
  }, [events, courses]); // eslint-disable-line

  // Generate future projection for phantom tasks
  const futureProjection = useMemo(() => {
    if (events.length === 0 || courses.length === 0) return null;
    return FutureProjectionEngine.project(events, courses, tasks, performanceHistory, 14);
  }, [events, courses, tasks, performanceHistory]);

  // Generate visible phantom tasks
  const phantomTasks = useMemo(() => {
    if (!futureProjection) return [];
    return FutureProjectionEngine.generateVisiblePhantomTasks(futureProjection, events);
  }, [futureProjection, events]);

  // Sort tasks by priority
  const sortedTasks = useMemo(() => {
    const courseMap = new Map(courses.map(c => [c.id, c]));
    return PriorityEngine.sortTasks(tasks, courseMap, events, preferences, performanceHistory, futureProjection || undefined);
  }, [tasks, courses, events, preferences, performanceHistory, futureProjection]);

  // Auto-generate study sessions
  useEffect(() => {
    const todoTasks = sortedTasks.filter(t => t.status !== 'done');
    if (todoTasks.length === 0) return;
    
    // Include travel events so the scheduler knows when travels happen
    const allEvents = [...events, ...TravelManager.generateTravelEvents(events, preferences)];
    
    const sessions = SchedulerEngine.generateSchedule(
      todoTasks, allEvents, preferences, new Date(), 14, performanceHistory, futureProjection || undefined
    );
    setStudySessions(sessions);
  }, [sortedTasks, events, preferences, performanceHistory, futureProjection]); // eslint-disable-line

  // Update task scores in store (for display)
  useEffect(() => {
    if (sortedTasks.length === 0) return;
    const changed = sortedTasks.some((t) => {
      const orig = tasks.find(o => o.id === t.id);
      return orig && orig.priorityScore !== t.priorityScore;
    });
    if (changed) {
      setTasks(sortedTasks);
    }
  }, [sortedTasks]); // eslint-disable-line

  // Ordine unico: identico a quello usato dallo Scheduler (PriorityEngine).
  const displaySortedTasks = sortedTasks;

  const filteredTasks = useMemo(() => {
    if (dailyGoalOnly) {
      const realTasks = displaySortedTasks.filter(t => t.status === 'todo' && !t.isPhantom);
      const limit = selectedDailyGoalValue !== null ? (tasksLeftForToday || 0) : 3;
      return realTasks.slice(0, limit);
    }

    if (filter === 'forecast') {
      // Show only phantom tasks
      return phantomTasks.filter(t => {
        if (typeFilter !== 'ALL' && getTaskType(t) !== typeFilter) return false;
        if (courseFilter !== 'ALL' && t.courseId !== courseFilter) return false;
        return true;
      });
    }

    let realTasks = displaySortedTasks.filter(t => {
      if (filter === 'todo' && t.status !== 'todo') return false;
      if (filter === 'in_progress' && t.status !== 'in_progress') return false;
      if (filter === 'done' && t.status !== 'done') return false;
      if (typeFilter !== 'ALL' && getTaskType(t) !== typeFilter) return false;
      if (courseFilter !== 'ALL' && t.courseId !== courseFilter) return false;
      return true;
    });

    if (filter === 'done') {
      realTasks = [...realTasks].sort((a, b) => {
        if (sortDoneBy === 'completedAt') {
          const timeA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
          const timeB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
          return timeB - timeA; // most recently completed first
        } else {
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeB - timeA; // newest tasks first
        }
      });
    }

    // In 'todo' view, append phantom tasks at the end
    if (filter === 'todo' && phantomTasks.length > 0) {
      const filteredPhantoms = phantomTasks.filter(t => {
        if (typeFilter !== 'ALL' && getTaskType(t) !== typeFilter) return false;
        if (courseFilter !== 'ALL' && t.courseId !== courseFilter) return false;
        return true;
      });
      return [...realTasks, ...filteredPhantoms];
    }

    return realTasks;
  }, [displaySortedTasks, phantomTasks, filter, typeFilter, courseFilter, sortDoneBy, dailyGoalOnly, selectedDailyGoalValue, tasksLeftForToday]);

  // Matching tasks calculation for the bulk delete modal
  const matchingBulkTasks = useMemo(() => {
    return tasks.filter(t => {
      if (bulkCourseId !== 'ALL' && t.courseId !== bulkCourseId) return false;
      if (bulkStatus !== 'ALL') {
        if (bulkStatus === 'todo' && t.status === 'done') return false;
        if (bulkStatus === 'done' && t.status !== 'done') return false;
      }
      if (bulkOnlyAi) {
        const isAi = t.isAiEnriched || 
                     t.description?.includes('Argomento:') || 
                     t.description?.includes('Capitoli/Libro:');
        if (!isAi) return false;
      }
      if (bulkType !== 'ALL') {
        const lower = t.title.toLowerCase();
        const isNotes = lower.includes('appunti') || lower.includes('notes') || lower.includes('ripasso');
        const isExercises = lower.includes('eserciz');
        const isFollow = lower.includes('seguire') || lower.includes('recuperare');
        if (bulkType === 'NOTES' && !isNotes) return false;
        if (bulkType === 'EXERCISES' && !isExercises) return false;
        if (bulkType === 'FOLLOW_LESSON' && !isFollow) return false;
        if (bulkType === 'PROJECT' && !t.isProjectTask) return false;
      }
      return true;
    });
  }, [tasks, bulkCourseId, bulkType, bulkStatus, bulkOnlyAi]);

  const handleExecuteBulkDelete = () => {
    if (matchingBulkTasks.length === 0) return;
    if (window.confirm(`Vuoi eliminare definitivamente i ${matchingBulkTasks.length} task selezionati dai filtri?`)) {
      const deleted = removeTasksByFilter({
        courseId: bulkCourseId,
        taskType: bulkType,
        onlyAiEnriched: bulkOnlyAi,
        status: bulkStatus
      });
      setIsDeleteModalOpen(false);
      setCleanupMsg(`✓ Eliminati ${deleted} task!`);
      setTimeout(() => setCleanupMsg(''), 3000);
    }
  };

  const toggleTaskSelect = (taskId: string) => {
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredTasks.filter(t => !t.isPhantom).map(t => t.id);
    setSelectedTaskIds(new Set(ids));
  };

  const deselectAll = () => {
    setSelectedTaskIds(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedTaskIds.size === 0) return;
    if (window.confirm(`Vuoi eliminare definitivamente i ${selectedTaskIds.size} task selezionati?`)) {
      removeTasks(Array.from(selectedTaskIds));
      setSelectedTaskIds(new Set());
      setIsSelectMode(false);
      setCleanupMsg(`✓ Eliminati ${selectedTaskIds.size} task!`);
      setTimeout(() => setCleanupMsg(''), 3000);
    }
  };

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const phantomCount = phantomTasks.length;

  return (
    <div className="task-panel">
      <div className="task-panel-header">
        <div className="task-panel-title">
          <BookOpen size={18} />
          <span>{dailyGoalOnly ? 'ATTIVITÀ DI OGGI' : 'COSE DA FARE'}</span>
        </div>
        {!dailyGoalOnly && (
          <div className="task-panel-counts">
            <span className="task-count-badge">{todoCount} da fare</span>
            {inProgressCount > 0 && <span className="task-count-badge" style={{ backgroundColor: '#10b981', color: 'white' }}>{inProgressCount} in corso</span>}
            <span className="task-count-badge task-count-done">{doneCount} fatte</span>
            {phantomCount > 0 && (
              <span className="task-count-badge task-count-phantom">{phantomCount} previste</span>
            )}
          </div>
        )}
      </div>

      {!dailyGoalOnly && (
        <>
          <div className="task-filter-bar">
            {(['todo', 'in_progress', 'done', 'all', 'forecast'] as const).map(f => (
              <button
                key={f}
                className={`task-filter-btn ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'todo' ? 'Da fare' : f === 'in_progress' ? 'In corso' : f === 'done' ? 'Completate' : f === 'forecast' ? '🔮 Previste' : 'Tutte'}
              </button>
            ))}
          </div>

          <div className="task-type-filter-bar" style={{ display: 'flex', gap: '8px' }}>
            <select 
              className="task-type-select" 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              {Object.entries(TASK_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select 
              className="task-type-select" 
              value={courseFilter} 
              onChange={(e) => setCourseFilter(e.target.value)}
            >
              <option value="ALL">Tutte le materie</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="task-action-btn"
                onClick={() => {
                  if (isSelectMode) deselectAll();
                  setIsSelectMode(!isSelectMode);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: isSelectMode ? 'var(--primary, #3b82f6)' : 'var(--bg-secondary)',
                  color: isSelectMode ? '#ffffff' : 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="Attiva la selezione multipla per eliminare attività a scelta"
              >
                <CheckSquare size={14} />
                <span>{isSelectMode ? 'Fine selezione' : 'Seleziona'}</span>
              </button>

              <button
                className="task-action-btn"
                onClick={() => setIsDeleteModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
                title="Elimina attività per materia, tipologia o create da AI"
              >
                <Trash2 size={14} />
                <span>Elimina Task...</span>
              </button>

              <button
                className="task-action-btn"
                onClick={() => {
                  const res = cleanupDuplicates();
                  if (res.removedTasks > 0 || res.removedEvents > 0) {
                    setCleanupMsg(`✓ Rimossi ${res.removedTasks} duplicati!`);
                    setTimeout(() => setCleanupMsg(''), 3500);
                  } else {
                    setCleanupMsg('Nessun duplicato');
                    setTimeout(() => setCleanupMsg(''), 2000);
                  }
                }}
                title="Rimuove automaticamente i task o eventi duplicati per la stessa data"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                  color: '#a855f7',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                <Sparkles size={14} />
                <span>{cleanupMsg || 'Ripulisci duplicati'}</span>
              </button>
            </div>

            {filter === 'done' && (
              <button 
                className="task-action-btn" 
                onClick={() => setSortDoneBy(s => s === 'completedAt' ? 'createdAt' : 'completedAt')}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 12px' }}
              >
                <Clock size={14} />
                {sortDoneBy === 'completedAt' ? 'Ordina: Data Completamento' : 'Ordina: Data Creazione'}
              </button>
            )}
          </div>

          {/* Selection Bar when active */}
          {isSelectMode && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              margin: '8px 0',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                Selezionati: {selectedTaskIds.size}
              </span>
              <button 
                type="button" 
                className="task-action-btn" 
                onClick={selectAllFiltered} 
                style={{ fontSize: '0.78rem', padding: '3px 8px' }}
              >
                Seleziona tutti ({filteredTasks.filter(t => !t.isPhantom).length})
              </button>
              <button 
                type="button" 
                className="task-action-btn" 
                onClick={deselectAll} 
                style={{ fontSize: '0.78rem', padding: '3px 8px' }}
              >
                Deseleziona
              </button>
              <button 
                type="button"
                className="task-action-btn"
                onClick={handleDeleteSelected}
                disabled={selectedTaskIds.size === 0}
                style={{
                  marginLeft: 'auto',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '0.8rem',
                  padding: '5px 14px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: selectedTaskIds.size === 0 ? 0.5 : 1,
                  cursor: selectedTaskIds.size === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                <Trash2 size={13} />
                <span>Elimina selezionati ({selectedTaskIds.size})</span>
              </button>
            </div>
          )}
          
          {filter === 'todo' && <TaskQuickAdd />}
        </>
      )}

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="task-empty">
            <Zap size={32} className="task-empty-icon" />
            <p>
              {dailyGoalOnly
                ? (selectedDailyGoalValue !== null && tasksLeftForToday === 0 
                    ? 'Hai completato l\'obiettivo di oggi! 🎉 Ottimo lavoro.' 
                    : 'Nessuna attività proposta per oggi.')
                : filter === 'done'
                ? 'Nessuna attività completata ancora.'
                : filter === 'in_progress'
                ? 'Nessuna attività in corso. Inizia un task!'
                : filter === 'forecast'
                ? 'Nessuna attività prevista. Aggiungi lezioni future al calendario!'
                : 'Nessuna attività. Importa il calendario o attendi la fine delle lezioni!'}
            </p>
          </div>
        ) : (
          <>
            {/* Normal rendering for other views */}
            {!dailyGoalOnly && filter !== 'todo' && (
              filteredTasks.map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  isSelectable={isSelectMode && !task.isPhantom}
                  isSelected={selectedTaskIds.has(task.id)}
                  onToggleSelect={() => toggleTaskSelect(task.id)}
                />
              ))
            )}
            
            {/* Render for 'todo' view where we highlight the daily goal */}
            {(filter === 'todo' || dailyGoalOnly) && (
              filteredTasks.map((task, idx) => {
                const isFirstPhantom = !dailyGoalOnly && task.isPhantom && (idx === 0 || !filteredTasks[idx - 1]?.isPhantom);
                
                // Determine if it is part of today's goal
                const isTodayGoal = dailyGoalOnly || (tasksLeftForToday !== null && idx < tasksLeftForToday && !task.isPhantom);

                return (
                  <div key={task.id}>
                    {isFirstPhantom && (
                      <div className="task-phantom-separator">
                        <Eye size={14} />
                        <span>Previste in futuro</span>
                      </div>
                    )}
                    
                    <div style={isTodayGoal ? { 
                      padding: '4px', 
                      border: '2px solid var(--accent-color, #10b981)', 
                      borderRadius: '16px', 
                      marginBottom: '8px',
                      background: 'rgba(168, 85, 129, 0.05)',
                      position: 'relative'
                    } : {}}>
                      {isTodayGoal && (selectedDailyGoalValue !== null) && (
                        <div style={{ 
                          position: 'absolute', 
                          top: '-10px', 
                          right: '16px', 
                          background: 'var(--accent-color, #10b981)', 
                          color: 'white', 
                          fontSize: '0.65rem', 
                          fontWeight: 'bold', 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          zIndex: 2,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}>
                          OBIETTIVO DI OGGI {completedTodayCount + idx + 1}/{selectedDailyGoalValue}
                        </div>
                      )}
                      <TaskCard 
                        task={task} 
                        isSelectable={isSelectMode && !task.isPhantom}
                        isSelected={selectedTaskIds.has(task.id)}
                        onToggleSelect={() => toggleTaskSelect(task.id)}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>

      {/* Bulk Delete Modal */}
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Gestisci ed Elimina Attività"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Seleziona i criteri per eliminare le attività in blocco (ad esempio create in eccesso o di una specifica materia).
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Materia:
            </label>
            <select 
              value={bulkCourseId} 
              onChange={e => setBulkCourseId(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">Tutte le materie</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Tipologia Attività:
            </label>
            <select 
              value={bulkType} 
              onChange={e => setBulkType(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">Tutte le tipologie</option>
              <option value="NOTES">Solo Sistemare Appunti / Note</option>
              <option value="EXERCISES">Solo Esercizi</option>
              <option value="FOLLOW_LESSON">Solo Seguire / Recuperare</option>
              <option value="PROJECT">Solo Progetto</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
              Stato:
            </label>
            <select 
              value={bulkStatus} 
              onChange={e => setBulkStatus(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">Tutti gli stati</option>
              <option value="todo">Solo Da fare (todo)</option>
              <option value="done">Solo Completati (done)</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.88rem' }}>
            <input 
              type="checkbox" 
              checked={bulkOnlyAi} 
              onChange={e => setBulkOnlyAi(e.target.checked)} 
              style={{ width: '16px', height: '16px' }}
            />
            <span>Elimina solo attività con note/argomenti AI</span>
          </label>

          <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#dc2626' }}>
              Attività che verranno eliminate: {matchingBulkTasks.length}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Questa azione è immediata e salverà uno snapshot per eventuale ripristino.
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <Button variant="ghost" onClick={() => setIsDeleteModalOpen(false)}>
              Annulla
            </Button>
            <Button 
              variant="danger" 
              onClick={handleExecuteBulkDelete}
              disabled={matchingBulkTasks.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Trash2 size={16} /> Elimina {matchingBulkTasks.length} attività
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
