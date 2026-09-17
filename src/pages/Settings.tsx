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
            <h2 className="settings-section-title">Indirizzo Casa</h2>
            <p className="settings-section-desc">
              Inserisci dove abiti per ricevere suggerimenti su spostamenti quando le lezioni sono in posti diversi.
            </p>
            <input
              type="text"
              value={homeAddress}
              onChange={e => setHomeAddress(e.target.value)}
              placeholder="Es: Via Roma 1, Milano"
              className="settings-text-input"
            />
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
