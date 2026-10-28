import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Mail, Sliders, BookOpen, Layers, Clock } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SemesterWizardModal } from '../components/features/semesters/SemesterWizardModal';
import { ArchivedSemestersView } from '../components/features/semesters/ArchivedSemestersView';
import { SemesterManager } from '../core/SemesterManager';
import type { DayStudyHours, TaskSortMode, StudyDistributionPreference } from '../core/types';

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
  const semesters = useAppStore(s => s.semesters);

  const activeSemester = useMemo(() => SemesterManager.getActive(semesters), [semesters]);

  // Existing study hours
  const [dailyHours, setDailyHours] = useState<Record<number, DayStudyHours>>(
    () => ({ ...preferences.dailyStudyHours })
  );
  const [daysBeforeExam, setDaysBeforeExam] = useState((preferences.daysBeforeExamToIncreasePriority || 14).toString());
  const [homeAddress, setHomeAddress] = useState(preferences.defaultHomeAddress || '');
  const [commuteTime, setCommuteTime] = useState((preferences.defaultCommuteTimeMinutes || 45).toString());
  const [isCommuteProductive, setIsCommuteProductive] = useState(preferences.isCommuteProductive || false);
  const [ankiAverageTime, setAnkiAverageTime] = useState((preferences.ankiAverageTimeSeconds || 15).toString());
  const [geminiApiKey, setGeminiApiKey] = useState(preferences.geminiApiKey || '');
  const [showApiKey, setShowApiKey] = useState(false);

  // New features: Study distribution & block sizes
  const [studyDistribution, setStudyDistribution] = useState<StudyDistributionPreference>(
    preferences.studyDistributionPreference || 'balanced'
  );
  const [maxStudyBlock, setMaxStudyBlock] = useState((preferences.maxStudyBlockMinutes || 90).toString());
  const [minStudyBlock, setMinStudyBlock] = useState((preferences.minStudyBlockMinutes || 25).toString());
  const [bufferTime, setBufferTime] = useState((preferences.bufferMinutes || 10).toString());
  const [dailyTaskGoal, setDailyTaskGoal] = useState((preferences.dailyTaskGoal || 5).toString());

  // New features: Task ordering & assessments
  const [taskSortMode, setTaskSortMode] = useState<TaskSortMode>(preferences.taskSortMode || 'oldest');
  const [autoQuizPrep, setAutoQuizPrep] = useState(preferences.autoQuizPrep ?? true);
  const [examPrepDays, setExamPrepDays] = useState((preferences.examPrepDays || 21).toString());

  // New features: Weekly summary email
  const [emailSummaryEnabled, setEmailSummaryEnabled] = useState(preferences.weeklySummary?.emailEnabled || false);
  const [summaryEmail, setSummaryEmail] = useState(preferences.weeklySummary?.email || '');
  const [summaryDay, setSummaryDay] = useState<'sunday_evening' | 'monday_morning'>(
    preferences.weeklySummary?.day === 1 ? 'monday_morning' : 'sunday_evening'
  );
  const [summaryHour, setSummaryHour] = useState((preferences.weeklySummary?.hour ?? 20).toString());

  // Semester wizard state
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);

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

  const handleToggleLunch = (dayId: number) => {
    setDailyHours(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        lunchBreak: {
          ...prev[dayId].lunchBreak,
          enabled: !(prev[dayId].lunchBreak?.enabled ?? true),
          start: prev[dayId].lunchBreak?.start || '13:00',
          end: prev[dayId].lunchBreak?.end || '14:00',
        }
      },
    }));
  };

  const handleLunchTimeChange = (dayId: number, field: 'start' | 'end', value: string) => {
    setDailyHours(prev => ({
      ...prev,
      [dayId]: {
        ...prev[dayId],
        lunchBreak: {
          ...prev[dayId].lunchBreak,
          enabled: prev[dayId].lunchBreak?.enabled ?? true,
          start: prev[dayId].lunchBreak?.start || '13:00',
          end: prev[dayId].lunchBreak?.end || '14:00',
          [field]: value
        }
      },
    }));
  };

  const handleSave = () => {
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

    updatePreferences({
      dailyStudyHours: dailyHours,
      daysBeforeExamToIncreasePriority: clamp(parseInt(daysBeforeExam) || 14, 1, 60),
      studyDistributionPreference: studyDistribution,
      maxStudyBlockMinutes: clamp(parseInt(maxStudyBlock) || 90, 20, 240),
      minStudyBlockMinutes: clamp(parseInt(minStudyBlock) || 25, 10, 120),
      bufferMinutes: clamp(parseInt(bufferTime) || 10, 0, 60),
      dailyTaskGoal: clamp(parseInt(dailyTaskGoal) || 5, 1, 50),
      taskSortMode,
      autoQuizPrep,
      examPrepDays: clamp(parseInt(examPrepDays) || 21, 7, 90),
      weeklySummary: {
        emailEnabled: emailSummaryEnabled,
        email: summaryEmail.trim(),
        day: summaryDay === 'sunday_evening' ? 0 : 1,
        hour: clamp(parseInt(summaryHour) || 20, 0, 23),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome',
      },
      defaultHomeAddress: homeAddress || undefined,
      defaultCommuteTimeMinutes: clamp(parseInt(commuteTime) || 45, 0, 300),
      isCommuteProductive,
      ankiAverageTimeSeconds: clamp(parseInt(ankiAverageTime) || 15, 1, 300),
      geminiApiKey: geminiApiKey.trim() || undefined,
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

        <h1 className="settings-title">Impostazioni & Personalizzazione</h1>

        <div className="settings-sections">
          {/* Gestione Semestri e Conoscenze */}
          <GlassPanel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <BookOpen size={20} style={{ color: 'var(--primary)' }} />
                <h2 className="settings-section-title" style={{ margin: 0 }}>Semestre & Archivio Conoscenze</h2>
              </div>
              <Button
                variant="primary"
                onClick={() => setIsSemesterModalOpen(true)}
                style={{ fontSize: '0.85rem', padding: '0.45rem 0.9rem' }}
              >
                Nuovo Semestre / Archivia
              </Button>
            </div>
            <p className="settings-section-desc">
              Semestre attivo:{' '}
              <strong style={{ color: 'var(--text-primary)' }}>
                {activeSemester ? activeSemester.name : 'Nessun semestre attivo impostato'}
              </strong>
              {activeSemester?.startDate && ` (Iniziato il ${new Date(activeSemester.startDate).toLocaleDateString('it-IT')})`}.
              Quando chiudi un semestre, tutto ciò che hai imparato (temi, lezioni, ore) resta salvato nell'archivio sottostante.
            </p>

            <div style={{ marginTop: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.6rem' }}>
                Storico Semestri Precedenti
              </h3>
              <ArchivedSemestersView />
            </div>
          </GlassPanel>

          {/* Organizzazione Studio & Settimana Tipo */}
          <GlassPanel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Sliders size={20} style={{ color: 'var(--primary)' }} />
              <h2 className="settings-section-title" style={{ margin: 0 }}>Organizzazione Studio & Settimana Tipo</h2>
            </div>
            <p className="settings-section-desc">
              Configura il ritmo delle tue sessioni e come distribuire teoria ed esercizi pratici durante la settimana.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              {/* Distribution Preference */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Modello Settimana Tipo
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: studyDistribution === 'balanced' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${studyDistribution === 'balanced' ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.06)'}`,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="studyDistribution"
                      checked={studyDistribution === 'balanced'}
                      onChange={() => setStudyDistribution('balanced')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        Bilanciata (Standard)
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Teoria, ripassi ed esercizi vengono distribuiti uniformemente su tutti i giorni disponibili.
                      </p>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.6rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    background: studyDistribution === 'weekdays_theory_weekend_exercises' ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${studyDistribution === 'weekdays_theory_weekend_exercises' ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255, 255, 255, 0.06)'}`,
                    cursor: 'pointer'
                  }}>
                    <input
                      type="radio"
                      name="studyDistribution"
                      checked={studyDistribution === 'weekdays_theory_weekend_exercises'}
                      onChange={() => setStudyDistribution('weekdays_theory_weekend_exercises')}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        Feriali Teoria & Appunti / Weekend Esercizi Pratici
                      </span>
                      <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Dal lunedì al venerdì lo scheduler privilegia assimilazione e appunti; sabato e domenica programma le sessioni di esercitazione prolungate.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Block durations & buffers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', marginTop: '0.5rem' }}>
                <div className="settings-inline-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <span className="settings-field-label" style={{ width: 'auto', fontSize: '0.82rem' }}>Blocco massimo di studio:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="30"
                      max="240"
                      step="5"
                      value={maxStudyBlock}
                      onChange={e => setMaxStudyBlock(e.target.value)}
                      className="settings-number-input"
                    />
                    <span className="settings-field-label">minuti</span>
                  </div>
                </div>

                <div className="settings-inline-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <span className="settings-field-label" style={{ width: 'auto', fontSize: '0.82rem' }}>Blocco minimo sessione:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="10"
                      max="120"
                      step="5"
                      value={minStudyBlock}
                      onChange={e => setMinStudyBlock(e.target.value)}
                      className="settings-number-input"
                    />
                    <span className="settings-field-label">minuti</span>
                  </div>
                </div>

                <div className="settings-inline-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <span className="settings-field-label" style={{ width: 'auto', fontSize: '0.82rem' }}>Pausa tra sessioni / lezioni:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      step="5"
                      value={bufferTime}
                      onChange={e => setBufferTime(e.target.value)}
                      className="settings-number-input"
                    />
                    <span className="settings-field-label">minuti</span>
                  </div>
                </div>

                <div className="settings-inline-field" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem' }}>
                  <span className="settings-field-label" style={{ width: 'auto', fontSize: '0.82rem' }}>Obiettivo task giornalieri:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={dailyTaskGoal}
                      onChange={e => setDailyTaskGoal(e.target.value)}
                      className="settings-number-input"
                    />
                    <span className="settings-field-label">task/giorno</span>
                  </div>
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* Ordinamento Task & Preparazione Verifiche */}
          <GlassPanel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Layers size={20} style={{ color: 'var(--primary)' }} />
              <h2 className="settings-section-title" style={{ margin: 0 }}>Ordinamento Task & Verifiche</h2>
            </div>
            <p className="settings-section-desc">
              Personalizza l'ordine della tua to-do list e la preparazione automatica per esami e quiz intermedi.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
              {/* Task Sort Mode */}
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.88rem', marginBottom: '0.4rem', color: 'var(--text-primary)' }}>
                  Criterio di ordinamento predefinito:
                </label>
                <select
                  value={taskSortMode}
                  onChange={e => setTaskSortMode(e.target.value as TaskSortMode)}
                  className="settings-text-input"
                  style={{ width: '100%', maxWidth: '380px', padding: '0.5rem 0.75rem', fontSize: '0.88rem' }}
                >
                  <option value="oldest">I più vecchi prima (Cronologico lezioni)</option>
                  <option value="smart">Punteggio Intelligente (Urgenza esami + ritardo + difficoltà)</option>
                  <option value="deadline">Scadenza più vicina</option>
                  <option value="shortest">Più veloci prima (Quick wins)</option>
                  <option value="course">Raggruppati per Corso</option>
                </select>
                <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
                  Puoi comunque cambiare al volo l'ordinamento in qualsiasi momento dal selettore rapido nel pannello attività.
                </span>
              </div>

              {/* Assessment & Quiz Automation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={autoQuizPrep}
                    onChange={e => setAutoQuizPrep(e.target.checked)}
                    style={{ width: '18px', height: '18px', marginTop: '2px' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      Generazione automatica ripasso per Quiz intermedi
                    </span>
                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Crea automaticamente una sessione focalizzata di ripasso mirata negli ultimi 3 giorni prima di ogni quiz o test intermedio.
                    </span>
                  </div>
                </label>

                <div className="settings-inline-field">
                  <span className="settings-field-label" style={{ width: '260px' }}>
                    Aumento progressivo priorità esami:
                  </span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={daysBeforeExam}
                    onChange={e => setDaysBeforeExam(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">giorni prima</span>
                </div>

                <div className="settings-inline-field">
                  <span className="settings-field-label" style={{ width: '260px' }}>
                    Finestra preparazione esami a fasi:
                  </span>
                  <input
                    type="number"
                    min="7"
                    max="90"
                    value={examPrepDays}
                    onChange={e => setExamPrepDays(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">giorni prima</span>
                </div>
              </div>
            </div>
          </GlassPanel>

          {/* Riepilogo Settimanale Automatico */}
          <GlassPanel>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
              <Mail size={20} style={{ color: 'var(--primary)' }} />
              <h2 className="settings-section-title" style={{ margin: 0 }}>Riepilogo Settimanale via Email</h2>
            </div>
            <p className="settings-section-desc">
              Ricevi ogni settimana un'email riepilogativa con le ore studiate, le materie affrontate, la progressione rispetto alla settimana precedente e il tasso di completamento.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={emailSummaryEnabled}
                  onChange={e => setEmailSummaryEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Invia riepilogo automatico</span>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    Schedulato tramite Firebase Cloud Functions
                  </span>
                </div>
              </label>

              {emailSummaryEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingLeft: '1.8rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Indirizzo email di destinazione:
                    </span>
                    <input
                      type="email"
                      value={summaryEmail}
                      onChange={e => setSummaryEmail(e.target.value)}
                      placeholder="la-tua-email@studenti.it"
                      className="settings-text-input"
                      style={{ maxWidth: '380px' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Momento di invio:
                      </span>
                      <select
                        value={summaryDay}
                        onChange={e => setSummaryDay(e.target.value as 'sunday_evening' | 'monday_morning')}
                        className="settings-text-input"
                        style={{ padding: '0.45rem 0.65rem' }}
                      >
                        <option value="sunday_evening">Domenica sera (Consigliato)</option>
                        <option value="monday_morning">Lunedì mattina</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Ora di invio:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Clock size={16} style={{ color: 'var(--text-secondary)' }} />
                        <input
                          type="number"
                          min="0"
                          max="23"
                          value={summaryHour}
                          onChange={e => setSummaryHour(e.target.value)}
                          className="settings-number-input"
                          style={{ width: '60px' }}
                        />
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>:00</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>

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
                      <div className="settings-day-times" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={config.lunchBreak?.enabled ?? true}
                              onChange={() => handleToggleLunch(day.id)}
                            />
                            Pausa:
                          </label>
                          {(config.lunchBreak?.enabled ?? true) && (
                            <>
                              <input
                                type="time"
                                value={config.lunchBreak?.start || '13:00'}
                                onChange={e => handleLunchTimeChange(day.id, 'start', e.target.value)}
                                className="settings-time-input"
                                style={{ padding: '0.2rem', fontSize: '0.85rem' }}
                              />
                              <span className="settings-time-sep">-</span>
                              <input
                                type="time"
                                value={config.lunchBreak?.end || '14:00'}
                                onChange={e => handleLunchTimeChange(day.id, 'end', e.target.value)}
                                className="settings-time-input"
                                style={{ padding: '0.2rem', fontSize: '0.85rem' }}
                              />
                            </>
                          )}
                        </div>
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

          {/* Anki Integration */}
          <GlassPanel>
            <h2 className="settings-section-title">Integrazione Anki</h2>
            <p className="settings-section-desc">
              Imposta il tempo medio in secondi per rispondere a una carta. Questo valore verrà usato per stimare il tempo totale di ripasso.
            </p>
            <div className="settings-inline-field">
              <span className="settings-field-label" style={{ width: '120px' }}>Tempo per carta:</span>
              <input
                type="number"
                min="1"
                max="300"
                value={ankiAverageTime}
                onChange={e => setAnkiAverageTime(e.target.value)}
                className="settings-number-input"
              />
              <span className="settings-field-label">secondi</span>
            </div>
          </GlassPanel>

          {/* AI Tools (Gemini) */}
          <GlassPanel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <h2 className="settings-section-title" style={{ margin: 0 }}>Strumenti AI (Google Gemini)</h2>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: geminiApiKey ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: geminiApiKey ? '#22c55e' : '#ef4444',
                fontWeight: 600
              }}>
                {geminiApiKey ? 'Attiva' : 'Non configurata'}
              </span>
            </div>
            <p className="settings-section-desc">
              Usata per l'analisi intelligente di calendari PDF/Excel e l'inserimento automatico di note e argomenti nelle lezioni e nei task.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  placeholder="Incolla la tua Gemini API Key..."
                  className="settings-text-input"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.85rem' }}
                />
                <Button
                  variant="secondary"
                  onClick={() => setShowApiKey(!showApiKey)}
                  style={{ padding: '0.5rem 0.8rem' }}
                >
                  {showApiKey ? 'Nascondi' : 'Mostra'}
                </Button>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Puoi generare una chiave gratuita (1.500 richieste/giorno) su{' '}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--primary)', textDecoration: 'underline' }}
                >
                  Google AI Studio
                </a>.
              </span>
            </div>
          </GlassPanel>

          {/* Privacy and Account */}
          <GlassPanel>
            <h2 className="settings-section-title">Privacy e Sicurezza</h2>
            <p className="settings-section-desc">
              Gestisci i tuoi dati e consulta i termini legali del servizio.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Button
                variant="secondary"
                onClick={() => navigate('/privacy')}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Leggi la Privacy Policy
              </Button>
            </div>
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

      {/* Semester Transition Wizard Modal */}
      <SemesterWizardModal
        isOpen={isSemesterModalOpen}
        onClose={() => setIsSemesterModalOpen(false)}
      />
    </div>
  );
}
