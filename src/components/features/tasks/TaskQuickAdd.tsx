import React, { useState } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '../../../store/useAppStore';
import { Task } from '../../../core/types';
import './TaskQuickAdd.css';

export function TaskQuickAdd() {
  const [title, setTitle] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [courseId, setCourseId] = useState<string>('none');
  const [deadline, setDeadline] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState<number>(30);

  const addTask = useAppStore(s => s.addTask);
  const courses = useAppStore(s => s.courses);

  const handleAdd = () => {
    if (!title.trim()) return;

    const newTask: Task = {
      id: 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: title.trim(),
      status: 'todo',
      priorityScore: 50,
      estimatedDuration,
      createdAt: new Date().toISOString(),
      dependencies: [],
      postponedCount: 0,
      courseId: courseId !== 'none' ? courseId : undefined,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
    };

    addTask(newTask);
    
    // reset
    setTitle('');
    setCourseId('none');
    setDeadline('');
    setEstimatedDuration(30);
    setExpanded(false);
  };

  return (
    <div className="task-quick-add">
      <div className="task-quick-add-main">
        <input 
          type="text" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          placeholder="Aggiungi una nuova attività (es. Leggere capitolo 2)..."
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button className="btn-icon task-quick-add-expand" onClick={() => setExpanded(!expanded)} title="Altre opzioni">
          <MoreHorizontal size={18} />
        </button>
        <button className="btn btn-primary task-quick-add-btn" onClick={handleAdd} disabled={!title.trim()}>
          <Plus size={18} /> Aggiungi
        </button>
      </div>

      {expanded && (
        <div className="task-quick-add-extra">
          <div className="form-group">
            <label>Materia (Opzionale)</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}>
              <option value="none">Nessuna materia</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Scadenza (Opzionale)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Durata stimata (minuti)</label>
            <input type="number" value={estimatedDuration} onChange={e => setEstimatedDuration(Number(e.target.value) || 30)} min="5" step="5" />
          </div>
        </div>
      )}
    </div>
  );
}
