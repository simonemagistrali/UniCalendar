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

  const [filter, setFilter] = useState<'all' | 'todo' | 'done' | 'forecast'>('todo');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [courseFilter, setCourseFilter] = useState<string>('ALL');

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

  const filteredTasks = useMemo(() => {
    if (filter === 'forecast') {
      // Show only phantom tasks
      return phantomTasks.filter(t => {
        if (typeFilter !== 'ALL' && getTaskType(t) !== typeFilter) return false;
        if (courseFilter !== 'ALL' && t.courseId !== courseFilter) return false;
        return true;
      });
    }

    const realTasks = sortedTasks.filter(t => {
      if (filter === 'todo' && t.status === 'done') return false;
      if (filter === 'done' && t.status !== 'done') return false;
      if (typeFilter !== 'ALL' && getTaskType(t) !== typeFilter) return false;
      if (courseFilter !== 'ALL' && t.courseId !== courseFilter) return false;
      return true;
    });

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
  }, [sortedTasks, phantomTasks, filter, typeFilter, courseFilter]);

  const todoCount = tasks.filter(t => t.status !== 'done').length;
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
          <span className="task-count-badge task-count-done">{doneCount} fatte</span>
          {phantomCount > 0 && (
            <span className="task-count-badge task-count-phantom">{phantomCount} previste</span>
          )}
        </div>
      </div>

      <div className="task-filter-bar">
        {(['todo', 'all', 'done', 'forecast'] as const).map(f => (
          <button
            key={f}
            className={`task-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'todo' ? 'Da fare' : f === 'done' ? 'Completate' : f === 'forecast' ? '🔮 Previste' : 'Tutte'}
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
      </div>

      <div className="task-list">
        {filteredTasks.length === 0 ? (
          <div className="task-empty">
            <Zap size={32} className="task-empty-icon" />
            <p>
              {filter === 'done'
                ? 'Nessuna attività completata ancora.'
                : filter === 'forecast'
                ? 'Nessuna attività prevista. Aggiungi lezioni future al calendario!'
                : 'Nessuna attività. Importa il calendario o attendi la fine delle lezioni!'}
            </p>
          </div>
        ) : (
          <>
            {/* Separator before phantom tasks in 'todo' view */}
            {filter === 'todo' && phantomTasks.length > 0 && (
              filteredTasks.map((task, idx) => {
                const isFirstPhantom = task.isPhantom && (idx === 0 || !filteredTasks[idx - 1]?.isPhantom);
                return (
                  <div key={task.id}>
                    {isFirstPhantom && (
                      <div className="task-phantom-separator">
                        <Eye size={14} />
                        <span>Previste in futuro</span>
                      </div>
                    )}
                    <TaskCard task={task} />
                  </div>
                );
              })
            )}
            {/* Normal rendering for other views */}
            {filter !== 'todo' && (
              filteredTasks.map(task => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
