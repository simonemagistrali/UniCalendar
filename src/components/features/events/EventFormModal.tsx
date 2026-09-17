import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import type { EventType, LocationType, LessonType } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid';

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EventFormModal({ isOpen, onClose }: EventFormModalProps) {
  const addEvent = useAppStore(state => state.addEvent);
  const courses = useAppStore(state => state.courses);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<EventType>('lesson');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [courseId, setCourseId] = useState('');
  const [lessonType, setLessonType] = useState<LessonType>('theory');
  const [locationType, setLocationType] = useState<LocationType>('in_person');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !date || !startTime || !endTime) return;

    const start = new Date(`${date}T${startTime}`);
    const end = new Date(`${date}T${endTime}`);

    addEvent({
      id: uuidv4(),
      title,
      type,
      startTime: start,
      endTime: end,
      courseId: courseId || undefined,
      lessonType: type === 'lesson' ? lessonType : undefined,
      location: { type: locationType },
      isDone: false
    });

    // Reset and close
    setTitle('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nuovo Evento">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        <div>
          <label className="block text-sm font-medium mb-1">Titolo</label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tipo Evento</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value as EventType)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
            >
              <option value="lesson">Lezione</option>
              <option value="exam">Esame</option>
              <option value="generic">Generico</option>
              <option value="sport">Sport</option>
              <option value="travel">Viaggio</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Posizione</label>
            <select 
              value={locationType} 
              onChange={(e) => setLocationType(e.target.value as LocationType)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
            >
              <option value="in_person">In Presenza</option>
              <option value="remote">Remoto</option>
            </select>
          </div>
        </div>

        {type === 'lesson' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Corso (Opzionale)</label>
              <select 
                value={courseId} 
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
              >
                <option value="">-- Seleziona Corso --</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Tipo Lezione</label>
              <select 
                value={lessonType} 
                onChange={(e) => setLessonType(e.target.value as LessonType)}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
              >
                <option value="theory">Teoria</option>
                <option value="exercise">Esercitazione</option>
                <option value="theory_exercise">Teoria + Esercizi</option>
                <option value="lab">Laboratorio</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">Data</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">Inizio</label>
            <input 
              type="time" 
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">Fine</label>
            <input 
              type="time" 
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg px-3 py-2"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={onClose} type="button">Annulla</Button>
          <Button variant="primary" type="submit">Salva Evento</Button>
        </div>
      </form>
    </Modal>
  );
}
