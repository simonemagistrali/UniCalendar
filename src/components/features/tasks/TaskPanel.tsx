import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, BookOpen, Zap, Eye } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { PriorityEngine } from '../../../core/PriorityEngine';
import { TaskManager } from '../../../core/TaskManager';
import { SchedulerEngine } from '../../../core/SchedulerEngine';
import { TravelManager } from '../../../core/TravelManager';
import { FutureProjectionEngine } from '../../../core/FutureProjectionEngine';
import { TaskCard } from './TaskCard';


export function TaskPanel() {
  const events = useAppStore(s => s.events);
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const preferences = useAppStore(s => s.preferences);
  const performanceHistory = useAppStore(s => s.performanceHistory);
  const addTasks = useAppStore(s => s.addTasks);
  const setEvents = useAppStore(s => s.setEvents);
  const setStudySessions = useAppStore(s => s.setStudySessions);
  const setTasks = useAppStore(s => s.setTasks);

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

  const TASK_TYPES = {
    ALL: 'Tutte le tipologie',
    FOLLOW_LESSON: 'Seguire/Recuperare lezione',
    NOTES: 'Sistemare appunti',
    EXERCISES: 'Esercizi',
    PROJECT: 'Progetto',
    OTHER: 'Altro'
  };

  const getTaskType = (task: typeof tasks[0]) => {
    if (task.isProjectTask) return 'PROJECT';
    if (task.title.startsWith('Seguire/Recuperare lezione') || task.title.includes('Recuperare:')) return 'FOLLOW_LESSON';
    if (task.title.startsWith('Sistemare appunti') || task.title.includes('Appunti:')) return 'NOTES';
    if (task.title.startsWith('Esercizi') || task.title.includes('Esercizi:')) return 'EXERCISES';
    return 'OTHER';
  };

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

  // Visual display sorting (Urgent > Date, Non-urgent > Date)
  const displaySortedTasks = useMemo(() => {
    return [...sortedTasks].sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (a.status !== 'in_progress' && b.status === 'in_progress') return 1;

      const aUrgent = a.priorityScore >= 100 ? 1 : 0;
      const bUrgent = b.priorityScore >= 100 ? 1 : 0;

      if (aUrgent !== bUrgent) {
        return bUrgent - aUrgent;
      }

      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });
  }, [sortedTasks]);

  const filteredTasks = useMemo(() => {
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
  }, [displaySortedTasks, phantomTasks, filter, typeFilter, courseFilter, sortDoneBy]);

  const todoCount = tasks.filter(t => t.status === 'todo').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;
  const phantomCount = phantomTasks.length;

  return (
    <div className="task-panel">
      <div className="task-panel-header">
        <div className="task-panel-title">
          <BookOpen size={18} />
          <span>COSE DA FARE</span>
        </div>
        <div className="task-panel-counts">
          <span className="task-count-badge">{todoCount} da fare</span>
          {inProgressCount > 0 && <span className="task-count-badge" style={{ backgroundColor: '#10b981', color: 'white' }}>{inProgressCount} in corso</span>}
          <span className="task-count-badge task-count-done">{doneCount} fatte</span>
          {phantomCount > 0 && (
            <span className="task-count-badge task-count-phantom">{phantomCount} previste</span>
          )}
        </div>
      </div>

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

        {filter === 'done' && (
          <button 
            className="task-action-btn" 
            onClick={() => setSortDoneBy(s => s === 'completedAt' ? 'createdAt' : 'completedAt')}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '4px 12px' }}
          >
            <Clock size={14} />
            {sortDoneBy === 'completedAt' ? 'Ordina: Data Completamento' : 'Ordina: Data Creazione'}
          </button>
        )}
      </div>

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="task-empty">
            <Zap size={32} className="task-empty-icon" />
            <p>
              {filter === 'done'
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
            {filter !== 'todo' && (
              filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
            
            {/* Render for 'todo' view where we highlight the daily goal */}
            {filter === 'todo' && (
              filteredTasks.map((task, idx) => {
                const isFirstPhantom = task.isPhantom && (idx === 0 || !filteredTasks[idx - 1]?.isPhantom);
                
                // Determine if it is part of today's goal
                const isTodayGoal = tasksLeftForToday !== null && idx < tasksLeftForToday && !task.isPhantom;

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
                      background: 'rgba(16, 185, 129, 0.05)',
                      position: 'relative'
                    } : {}}>
                      {isTodayGoal && (
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
                      <TaskCard task={task} />
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
