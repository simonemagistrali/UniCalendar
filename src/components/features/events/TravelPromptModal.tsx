import { useState } from "react";
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useAppStore } from '../../../store/useAppStore';
import type { CalendarEvent } from '../../../core/types';
import { v4 as uuidv4 } from 'uuid';
import { subMinutes } from 'date-fns';

interface TravelPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEvent: CalendarEvent | null;
}

export function TravelPromptModal({ isOpen, onClose, targetEvent }: TravelPromptModalProps) {
  const addEvent = useAppStore(state => state.addEvent);
  const [travelDuration, setTravelDuration] = useState('30');
  const [isStudyTime, setIsStudyTime] = useState(false);

  if (!targetEvent) return null;

  const handleSave = () => {
    const duration = parseInt(travelDuration);
    if (!isNaN(duration) && duration > 0) {
      const travelStart = subMinutes(targetEvent.startTime, duration);
      
      addEvent({
        id: uuidv4(),
        title: `Viaggio per ${targetEvent.title}`,
        type: 'travel',
        startTime: new Date(travelStart).toISOString(),
        endTime: new Date(targetEvent.startTime).toISOString(),
        isDone: false
      });

      if (isStudyTime) {
        useAppStore.getState().addTask({
          id: uuidv4(),
          title: `Ripasso in viaggio per ${targetEvent.title}`,
          status: 'todo',
          priorityScore: 20,
          estimatedDuration: duration,
          createdAt: new Date().toISOString(),
          deadline: new Date(targetEvent.startTime).toISOString(),
          dependencies: [],
          postponedCount: 0
        });
      }
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Aggiungi Evento Viaggio">
      <div className="event-form">
        <p className="import-desc">
          Hai aggiunto un evento in presenza presso <strong>{targetEvent.location?.address || "un'altra sede"}</strong>. Vuoi bloccare del tempo per il viaggio?
        </p>

        <div className="form-field">
          <label>Durata stimata viaggio (minuti)</label>
          <input 
            type="number" 
            value={travelDuration}
            onChange={(e) => setTravelDuration(e.target.value)}
            min="5"
            step="5"
          />
        </div>

        <div className="form-checkbox">
          <input 
            type="checkbox" 
            id="study-travel"
            checked={isStudyTime}
            onChange={(e) => setIsStudyTime(e.target.checked)}
          />
          <label htmlFor="study-travel">
            Considera questo tempo come studio (es. leggere appunti sul treno)
          </label>
        </div>

        <div className="form-actions">
          <Button variant="ghost" onClick={onClose} type="button">Salta</Button>
          <Button variant="primary" onClick={handleSave} type="button">Aggiungi Viaggio</Button>
        </div>
      </div>
    </Modal>
  );
}
