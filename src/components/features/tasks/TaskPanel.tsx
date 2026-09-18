import { useEffect, useMemo, useState } from 'react';
import { CheckCircle, Clock, BookOpen, Zap } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { PriorityEngine } from '../../../core/PriorityEngine';
import { TaskManager } from '../../../core/TaskManager';
import { SchedulerEngine } from '../../../core/SchedulerEngine';
import { TravelManager } from '../../../core/TravelManager';
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

  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('todo');
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
    if (task.title.startsWith('Seguire/Recuperare lezione')) return 'FOLLOW_LESSON';
    if (task.title.startsWith('Sistemare appunti')) return 'NOTES';
    if (task.title.startsWith('Esercizi')) return 'EXERCISES';
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

  // Sort tasks by priority
  const sortedTasks = useMemo(() => {
    const courseMap = new Map(courses.map(c => [c.id, c]));
    return PriorityEngine.sortTasks(tasks, courseMap, events, preferences, performanceHistory);
  }, [tasks, courses, events, preferences, performanceHistory]);

  // Auto-generate study sessions
  useEffect(() => {
    const todoTasks = sortedTasks.filter(t => t.status !== 'done');
    if (todoTasks.length === 0) return;
    
    // Include travel events so the scheduler knows when travels happen
    const allEvents = [...events, ...TravelManager.generateTravelEvents(events, preferences)];
    
    const sessions = SchedulerEngine.generateSchedule(todoTasks, allEvents, preferences, new Date(), 14, performanceHistory);
    setStudySessions(sessions);
  }, [sortedTasks, events, preferences, performanceHistory]); // eslint-disable-line

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

  const filteredTasks = sortedTasks.filter(t => {
    if (filter === 'todo' && t.status === 'done') return false;
    if (filter === 'done' && t.status !== 'done') return false;
    
    if (typeFilter !== 'ALL' && getTaskType(t) !== typeFilter) return false;
    if (courseFilter !== 'ALL' && t.courseId !== courseFilter) return false;
    
    return true;
  });

  const todoCount = tasks.filter(t => t.status !== 'done').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

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
        </div>
      </div>

      <div className="task-filter-bar">
        {(['todo', 'all', 'done'] as const).map(f => (
          <button
            key={f}
            className={`task-filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f === 'todo' ? 'Da fare' : f === 'done' ? 'Completate' : 'Tutte'}
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
                : 'Nessuna attività. Importa il calendario o attendi la fine delle lezioni!'}
            </p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <TaskCard key={task.id} task={task} />
          ))
        )}
      </div>
    </div>
  );
}
