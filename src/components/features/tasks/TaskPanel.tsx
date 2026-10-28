import { useEffect, useMemo, useState } from 'react';
import {
  Clock,
  BookOpen,
  Zap,
  Eye,
  Sparkles,
  Trash2,
  CheckSquare,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
  SlidersHorizontal,
} from 'lucide-react';
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
import { AssessmentPlanner } from '../../../core/AssessmentPlanner';
import type { TaskSortMode } from '../../../core/types';

const CONTROLS_COLLAPSED_STORAGE_KEY = 'unicalendar_task_controls_collapsed';

export function TaskPanel({ dailyGoalOnly = false }: { dailyGoalOnly?: boolean }) {
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const preferences = useAppStore(s => s.preferences);
  const updatePreferences = useAppStore(s => s.updatePreferences);
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
  const [moreOpen, setMoreOpen] = useState(false);

  // Stato riduci/espandi per il blocco controlli (persistito in localStorage)
  const [isControlsCollapsed, setIsControlsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CONTROLS_COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleControlsCollapsed = () => {
    setIsControlsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(CONTROLS_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  // Bulk management and delete state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bulkCourseId, setBulkCourseId] = useState<string>('ALL');
  const [bulkType, setBulkType] = useState<string>('ALL');
  const [bulkStatus, setBulkStatus] = useState<string>('ALL');
  const [bulkOnlyAi, setBulkOnlyAi] = useState<boolean>(false);

  const TASK_TYPES: Record<string, string> = {
    ALL: 'Tutte le tipologie',
    FOLLOW_LESSON: 'Seguire/Recuperare lezione',
    NOTES: 'Sistemare appunti',
    EXERCISES: 'Esercizi',
    PROJECT: 'Progetto',
    PREP: 'Preparazione esami/quiz',
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

  // Preparazione esami/quiz (a ritroso), archiviazione di quella scaduta, ricalibrazione progetti
  useEffect(() => {
    if (events.length === 0) return;
    const store = useAppStore.getState();

    const newPrep = AssessmentPlanner.generatePrepTasks(events, courses, store.tasks, store.preferences);
    if (newPrep.length > 0) addTasks(newPrep);

    const expired = AssessmentPlanner.expiredPrepTaskIds(useAppStore.getState().tasks);
    if (expired.length > 0) {
      const ids = new Set(expired);
      setTasks(useAppStore.getState().tasks.filter(t => !ids.has(t.id)));
    }

    const recalibrated = AssessmentPlanner.recalibrateProjectTasks(events, useAppStore.getState().tasks);
    if (recalibrated) setTasks(recalibrated);
  }, [events, courses, preferences.autoQuizPrep, preferences.examPrepDays]); // eslint-disable-line

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
      const effectiveGoal = selectedDailyGoalValue ?? preferences.dailyTaskGoal ?? 3;
      const limit = Math.max(0, effectiveGoal - completedTodayCount);
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
  }, [displaySortedTasks, phantomTasks, filter, typeFilter, courseFilter, sortDoneBy, dailyGoalOnly, selectedDailyGoalValue, preferences.dailyTaskGoal, completedTodayCount]);

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
      if (bulkType !== 'ALL' && getTaskKind(t) !== bulkType) return false;
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

  const filterLabel =
    filter === 'todo'
      ? 'Da fare'
      : filter === 'in_progress'
      ? 'In corso'
      : filter === 'done'
      ? 'Completate'
      : filter === 'forecast'
      ? '🔮 Previste'
      : 'Tutte';

  const activeCourseName = courseFilter !== 'ALL' ? courses.find(c => c.id === courseFilter)?.name : null;
  const activeTypeLabel = typeFilter !== 'ALL' ? TASK_TYPES[typeFilter] : null;
  const hasCustomFilter = filter !== 'todo' || typeFilter !== 'ALL' || courseFilter !== 'ALL';

  return (
    <div className={`task-panel ${isControlsCollapsed && !dailyGoalOnly ? 'task-panel-collapsed' : ''}`}>
      <div className="task-panel-header">
        <div className="task-panel-title-wrap">
          <div className="task-panel-title">
            <BookOpen size={18} />
            <span>{dailyGoalOnly ? 'ATTIVITÀ DI OGGI' : 'COSE DA FARE'}</span>
          </div>

          {!dailyGoalOnly && isControlsCollapsed && (
            <button
              type="button"
              className={`task-collapsed-summary-chip ${hasCustomFilter ? 'active' : ''}`}
              onClick={toggleControlsCollapsed}
              title="Clicca per espandere i filtri"
            >
              <span>{filterLabel}</span>
              {activeCourseName && <span>• {activeCourseName}</span>}
              {activeTypeLabel && <span>• {activeTypeLabel}</span>}
            </button>
          )}
        </div>

        {!dailyGoalOnly && (
          <div className="task-panel-header-right">
            <div className="task-panel-counts">
              <span className="task-count-badge">{todoCount} da fare</span>
              {inProgressCount > 0 && (
                <span className="task-count-badge" style={{ backgroundColor: '#10b981', color: 'white' }}>
                  {inProgressCount} in corso
                </span>
              )}
              <span className="task-count-badge task-count-done">{doneCount} fatte</span>
              {phantomCount > 0 && (
                <span className="task-count-badge task-count-phantom">{phantomCount} previste</span>
              )}
            </div>

            <button
              type="button"
              className={`task-collapse-toggle-btn ${isControlsCollapsed ? 'collapsed' : ''}`}
              onClick={toggleControlsCollapsed}
              aria-expanded={!isControlsCollapsed}
              title={isControlsCollapsed ? 'Espandi filtri e aggiunta rapida' : 'Riduci filtri per dare più spazio ai task'}
            >
              <SlidersHorizontal size={14} />
              <span className="task-collapse-toggle-text">
                {isControlsCollapsed ? 'Filtri' : 'Riduci'}
              </span>
              {isControlsCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          </div>
        )}
      </div>

      {!dailyGoalOnly && !isControlsCollapsed && (
        <div className="task-controls-collapsible">
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

          <div className="task-type-filter-bar">
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

            <select
              className="task-type-select"
              value={preferences.taskSortMode || 'oldest'}
              onChange={(e) => updatePreferences({ taskSortMode: e.target.value as TaskSortMode })}
              title="Come ordinare le attività da fare"
              aria-label="Ordina per"
            >
              <option value="oldest">Ordina: più vecchi prima</option>
              <option value="smart">Ordina: intelligente</option>
              <option value="deadline">Ordina: scadenza</option>
              <option value="shortest">Ordina: più brevi prima</option>
              <option value="course">Ordina: per materia</option>
            </select>

            <div className="task-more">
              <button
                className="task-more-btn"
                onClick={() => setMoreOpen(o => !o)}
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                title="Altre azioni"
              >
                <MoreHorizontal size={16} /> <span>Altro</span>
              </button>
              {moreOpen && (
                <div className="task-more-menu" role="menu">
                  <button
                    role="menuitem"
                    className="task-more-item"
                    onClick={() => {
                      if (isSelectMode) deselectAll();
                      setIsSelectMode(!isSelectMode);
                      setMoreOpen(false);
                    }}
                  >
                    <CheckSquare size={15} /> {isSelectMode ? 'Fine selezione' : 'Seleziona più attività'}
                  </button>
                  <button
                    role="menuitem"
                    className="task-more-item danger"
                    onClick={() => { setIsDeleteModalOpen(true); setMoreOpen(false); }}
                  >
                    <Trash2 size={15} /> Elimina in blocco…
                  </button>
                  <button
                    role="menuitem"
                    className="task-more-item"
                    onClick={() => {
                      const res = cleanupDuplicates();
                      setCleanupMsg(res.removedTasks > 0 || res.removedEvents > 0 ? `✓ Rimossi ${res.removedTasks} duplicati` : 'Nessun duplicato');
                      setTimeout(() => setCleanupMsg(''), 3000);
                      setMoreOpen(false);
                    }}
                  >
                    <Sparkles size={15} /> Rimuovi duplicati
                  </button>
                </div>
              )}
              {cleanupMsg && <span style={{ marginLeft: 8, fontSize: '0.8rem' }}>{cleanupMsg}</span>}
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
              margin: '4px 0',
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
        </div>
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
              <option value="PREP">Solo Preparazione Esami / Quiz</option>
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
