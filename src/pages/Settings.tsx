import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import type { DayStudyHours } from '../core/types';

const DAYS_OF_WEEK = [
  { id: 1, name: 'Lunedì' },
  { id: 2, name: 'Martedì' },
  { id: 3, name: 'Mercoledì' },
  { id: 4, name: 'Giovedì' },
  { id: 5, name: 'Venerdì' },
  { id: 6, name: 'Sabato' },
  { id: 0, name: 'Domenica' },
];

export function Settings() {
  const navigate = useNavigate();
  const preferences = useAppStore(s => s.preferences);
  const updatePreferences = useAppStore(s => s.updatePreferences);

  const [dailyHours, setDailyHours] = useState<Record<number, DayStudyHours>>(
    () => ({ ...preferences.dailyStudyHours })
  );
  const [daysBeforeExam, setDaysBeforeExam] = useState(preferences.daysBeforeExamToIncreasePriority.toString());
  const [homeAddress, setHomeAddress] = useState(preferences.defaultHomeAddress || '');
  const [commuteTime, setCommuteTime] = useState((preferences.defaultCommuteTimeMinutes || 45).toString());
  const [isCommuteProductive, setIsCommuteProductive] = useState(preferences.isCommuteProductive || false);
  const [saved, setSaved] = useState(false);

  const handleToggleDay = (dayId: number) => {
    setDailyHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], enabled: !prev[dayId].enabled },
    }));
  };

  const handleDayTimeChange = (dayId: number, field: 'start' | 'end', value: string) => {
    setDailyHours(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [field]: value },
    }));
  };

  const handleSave = () => {
    updatePreferences({
      dailyStudyHours: dailyHours,
      daysBeforeExamToIncreasePriority: parseInt(daysBeforeExam) || 14,
      defaultHomeAddress: homeAddress || undefined,
      defaultCommuteTimeMinutes: parseInt(commuteTime) || 45,
      isCommuteProductive,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <button onClick={() => navigate('/home')} className="settings-back-btn">
          <ArrowLeft size={20} />
          Torna alla Home
        </button>

        <h1 className="settings-title">Impostazioni Studio</h1>

        <div className="settings-sections">
          {/* Per-Day Study Hours */}
          <GlassPanel>
            <h2 className="settings-section-title">Orari di Studio per Giorno</h2>
            <p className="settings-section-desc">
              Definisci per ogni giorno se vuoi studiare e in quale fascia oraria.
              I giorni disabilitati non avranno sessioni di studio programmate.
            </p>

            <div className="settings-days-grid">
              {DAYS_OF_WEEK.map(day => {
                const config = dailyHours[day.id];
                return (
                  <div key={day.id} className={`settings-day-row ${!config.enabled ? 'disabled' : ''}`}>
                    <button
                      className={`settings-day-toggle ${config.enabled ? 'active' : ''}`}
                      onClick={() => handleToggleDay(day.id)}
                    >
                      {day.name}
                    </button>
                    {config.enabled && (
                      <div className="settings-day-times">
                        <input
                          type="time"
                          value={config.start}
                          onChange={e => handleDayTimeChange(day.id, 'start', e.target.value)}
                          className="settings-time-input"
                        />
                        <span className="settings-time-sep">—</span>
                        <input
                          type="time"
                          value={config.end}
                          onChange={e => handleDayTimeChange(day.id, 'end', e.target.value)}
                          className="settings-time-input"
                        />
                      </div>
                    )}
                    {!config.enabled && (
                      <span className="settings-day-off">Riposo</span>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassPanel>

          {/* Exam Priority */}
          <GlassPanel>
            <h2 className="settings-section-title">Priorità Esami</h2>
            <p className="settings-section-desc">
              Quanti giorni prima di un esame vuoi che la priorità delle task inizi a salire progressivamente?
            </p>
            <div className="settings-inline-field">
              <input
                type="number"
                min="1"
                max="60"
                value={daysBeforeExam}
                onChange={e => setDaysBeforeExam(e.target.value)}
                className="settings-number-input"
              />
              <span className="settings-field-label">giorni</span>
            </div>
          </GlassPanel>

          {/* Home Address */}
          <GlassPanel>
            <h2 className="settings-section-title">Spostamenti e Casa</h2>
            <p className="settings-section-desc">
              Inserisci l'indirizzo di casa e il tempo medio di spostamento verso l'università (in minuti).
            </p>
            <div className="settings-address-group" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
              <input
                type="text"
                value={homeAddress}
                onChange={e => setHomeAddress(e.target.value)}
                placeholder="Es: Via Roma 1, Milano"
                className="settings-text-input"
              />
              <div className="settings-inline-field">
                <span className="settings-field-label" style={{ width: '120px' }}>Tempo medio:</span>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={commuteTime}
                  onChange={e => setCommuteTime(e.target.value)}
                  className="settings-number-input"
                />
                <span className="settings-field-label">minuti</span>
              </div>
            </div>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={isCommuteProductive}
                onChange={e => setIsCommuteProductive(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Viaggio Produttivo</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Posso studiare o ripassare durante il tragitto (es. in treno)</span>
              </div>
            </label>
          </GlassPanel>

          {/* Save */}
          <div className="settings-save-row">
            {saved && <span className="settings-saved-msg">✓ Salvato!</span>}
            <Button
              variant="primary"
              icon={<Save size={18} />}
              onClick={handleSave}
              className="settings-save-btn"
            >
              Salva Impostazioni
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
