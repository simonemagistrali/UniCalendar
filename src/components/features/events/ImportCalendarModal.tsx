import React, { useState } from 'react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import { v4 as uuidv4 } from 'uuid';
import { addDays, setHours, setMinutes } from 'date-fns';

interface ImportCalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportCalendarModal({ isOpen, onClose }: ImportCalendarModalProps) {
  const addCourse = useAppStore(state => state.addCourse);
  const addEvent = useAppStore(state => state.addEvent);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Simulate file reading and parsing
      setIsImporting(true);
      setTimeout(() => {
        const courseId = uuidv4();
        addCourse({
          id: courseId,
          name: 'Chimica (Importato)',
          difficulty: 6,
          color: 'var(--accent-success)',
          defaultStudyPreferences: {
            requiresNotesRevision: true,
            requiresExercises: true,
            estimatedRevisionTimePerLesson: 60
          }
        });

        // Add a mock lesson for tomorrow
        const tomorrow = addDays(new Date(), 1);
        addEvent({
          id: uuidv4(),
          title: 'Lezione Chimica',
          type: 'lesson',
          startTime: setMinutes(setHours(tomorrow, 9), 0),
          endTime: setMinutes(setHours(tomorrow, 11), 0),
          courseId: courseId,
          lessonType: 'theory',
          location: { type: 'in_person' },
          isDone: false
        });

        setIsImporting(false);
        onClose();
        alert('Calendario importato con successo! (Mock)');
      }, 1500);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Importa Calendario">
      <div className="flex flex-col gap-6 p-4">
        <p className="text-sm text-[var(--text-secondary)]">
          Carica il file `.ics` o `.csv` scaricato dal portale della tua Università o esportato da Google Calendar.
          UniCalendar analizzerà automaticamente gli eventi per estrarre i tuoi corsi e le lezioni.
        </p>

        <div className="border-2 border-dashed border-[var(--border-color)] rounded-xl p-8 text-center flex flex-col items-center gap-4 hover:border-[var(--accent-primary)] transition-colors">
          <input 
            type="file" 
            accept=".ics,.csv" 
            onChange={handleFileChange} 
            className="hidden" 
            id="file-upload" 
            disabled={isImporting}
          />
          <label 
            htmlFor="file-upload" 
            className={`cursor-pointer px-6 py-2 rounded-lg font-medium ${isImporting ? 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]' : 'bg-[var(--accent-primary)] text-white hover:bg-opacity-90'}`}
          >
            {isImporting ? 'Importazione in corso...' : 'Scegli file...'}
          </label>
        </div>
      </div>
    </Modal>
  );
}
