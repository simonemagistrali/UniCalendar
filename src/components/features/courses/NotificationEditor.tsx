import { useState } from 'react';
import { Bell, Plus, Trash2, Check, X, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { AssessmentNotification } from '../../../core/types';

interface NotificationEditorProps {
  notifications: AssessmentNotification[];
  onChange: (notifications: AssessmentNotification[]) => void;
  hasDate: boolean;
}

const PRESET_DAYS = [
  { days: 0, label: 'Il giorno stesso' },
  { days: 1, label: '1 giorno prima' },
  { days: 2, label: '2 giorni prima' },
  { days: 3, label: '3 giorni prima' },
  { days: 7, label: '1 settimana prima' },
  { days: 14, label: '2 settimane prima' },
];

export function NotificationEditor({ notifications, onChange, hasDate }: NotificationEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [days, setDays] = useState(1);
  const [time, setTime] = useState('09:00');

  const handleAdd = () => {
    const newNotif: AssessmentNotification = {
      id: uuidv4(),
      daysBefore: days,
      time: time || '09:00',
    };
    onChange([...notifications, newNotif]);
    setIsAdding(false);
    setDays(1);
    setTime('09:00');
  };

  const handleRemove = (id: string) => {
    onChange(notifications.filter(n => n.id !== id));
  };

  if (!hasDate) {
    return (
      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '6px 8px', background: 'var(--bg-secondary)', borderRadius: 6 }}>
        Imposta prima una data per configurare le notifiche email.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Bell size={13} style={{ color: 'var(--accent-primary)' }} />
          Notifiche Email ({notifications.length})
        </label>
        {!isAdding && (
          <button
            type="button"
            className="cp-badge blue"
            style={{ cursor: 'pointer', border: 'none', padding: '2px 8px' }}
            onClick={() => setIsAdding(true)}
          >
            <Plus size={12} /> Aggiungi notifica
          </button>
        )}
      </div>

      {notifications.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {notifications.map(n => {
            const preset = PRESET_DAYS.find(p => p.days === n.daysBefore);
            const label = preset ? preset.label : `${n.daysBefore} giorni prima`;
            return (
              <div
                key={n.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '4px 8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 6,
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} style={{ color: 'var(--text-secondary)' }} />
                  <span><strong>{label}</strong> alle ore {n.time || '09:00'}</span>
                  {n.sentAt && (
                    <span style={{ fontSize: '0.7rem', color: '#188038', fontWeight: 600 }}>✓ Inviata</span>
                  )}
                </div>
                <button
                  type="button"
                  className="cp-icon-btn danger"
                  onClick={() => handleRemove(n.id)}
                  title="Rimuovi notifica"
                  style={{ padding: 2 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isAdding && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg-primary)', padding: 8, borderRadius: 8, border: '1px dashed var(--accent-primary)' }}>
          <select
            className="cp-select"
            value={days}
            onChange={e => setDays(parseInt(e.target.value) || 0)}
            style={{ padding: '4px 6px', fontSize: '0.8rem', flex: 1 }}
          >
            {PRESET_DAYS.map(p => (
              <option key={p.days} value={p.days}>{p.label}</option>
            ))}
            <option value={30}>1 mese prima</option>
          </select>
          <input
            type="time"
            className="cp-input"
            value={time}
            onChange={e => setTime(e.target.value)}
            style={{ padding: '4px 6px', fontSize: '0.8rem', width: 90 }}
          />
          <button
            type="button"
            className="cp-icon-btn"
            style={{ color: 'var(--accent-primary)' }}
            onClick={handleAdd}
            title="Conferma notifica"
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            className="cp-icon-btn"
            onClick={() => setIsAdding(false)}
            title="Annulla"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

