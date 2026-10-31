import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, GraduationCap, Archive, Download, Upload, Sparkles } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Button } from '../components/ui/Button';
import { GlassPanel } from '../components/ui/GlassPanel';
import { SemesterManager } from '../core/SemesterManager';
import { SemesterWizardModal } from '../components/features/semesters/SemesterWizardModal';
import { ArchivedSemestersView } from '../components/features/semesters/ArchivedSemestersView';
import type { DayStudyHours, TaskSortMode } from '../core/types';

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
  const user = useAppStore(s => s.user);

  const [dailyHours, setDailyHours] = useState<Record<number, DayStudyHours>>(
    () => ({ ...preferences.dailyStudyHours })
  );
  const [daysBeforeExam, setDaysBeforeExam] = useState((preferences.daysBeforeExamToIncreasePriority ?? 14).toString());
  const [examPrepDays, setExamPrepDays] = useState((preferences.examPrepDays ?? 21).toString());
  const [autoQuizPrep, setAutoQuizPrep] = useState<boolean>(preferences.autoQuizPrep ?? true);
  const [taskSortMode, setTaskSortMode] = useState<TaskSortMode>(preferences.taskSortMode ?? 'oldest');
  const [studyDistribution, setStudyDistribution] = useState<'balanced' | 'weekdays_theory_weekend_exercises'>(
    preferences.studyDistributionPreference ?? 'balanced'
  );
  const [dailyTaskGoal, setDailyTaskGoal] = useState((preferences.dailyTaskGoal ?? 3).toString());
  const [maxStudyBlock, setMaxStudyBlock] = useState((preferences.maxStudyBlockMinutes ?? 120).toString());
  const [minStudyBlock, setMinStudyBlock] = useState((preferences.minStudyBlockMinutes ?? 15).toString());
  const [bufferMinutes, setBufferMinutes] = useState((preferences.bufferMinutes ?? 10).toString());

  // Weekly Summary Email preferences
  const [weeklyEmailEnabled, setWeeklyEmailEnabled] = useState<boolean>(preferences.weeklySummary?.emailEnabled ?? false);
  const [weeklyEmailAddr, setWeeklyEmailAddr] = useState<string>(preferences.weeklySummary?.email || user?.email || '');
  const [weeklyDay, setWeeklyDay] = useState<number>(preferences.weeklySummary?.day ?? 0);
  const [weeklyHour, setWeeklyHour] = useState<number>(preferences.weeklySummary?.hour ?? 20);

  const [homeAddress, setHomeAddress] = useState(preferences.defaultHomeAddress || '');
  const [commuteTime, setCommuteTime] = useState((preferences.defaultCommuteTimeMinutes || 45).toString());
  const [isCommuteProductive, setIsCommuteProductive] = useState(preferences.isCommuteProductive || false);
  const [ankiAverageTime, setAnkiAverageTime] = useState((preferences.ankiAverageTimeSeconds || 15).toString());
  const [saved, setSaved] = useState(false);

  // Semester Wizard state
  const [isSemesterModalOpen, setIsSemesterModalOpen] = useState(false);

  // Backup Notice
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const activeSemester = SemesterManager.getActive(semesters);

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
    const goalVal = clamp(parseInt(dailyTaskGoal) || 3, 1, 20);
    const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Rome';

    updatePreferences({
      dailyStudyHours: dailyHours,
      daysBeforeExamToIncreasePriority: clamp(parseInt(daysBeforeExam) || 14, 1, 60),
      examPrepDays: clamp(parseInt(examPrepDays) || 21, 3, 60),
      autoQuizPrep,
      taskSortMode,
      studyDistributionPreference: studyDistribution,
      dailyTaskGoal: goalVal,
      maxStudyBlockMinutes: clamp(parseInt(maxStudyBlock) || 120, 25, 240),
      minStudyBlockMinutes: clamp(parseInt(minStudyBlock) || 15, 10, 60),
      bufferMinutes: clamp(parseInt(bufferMinutes) || 10, 0, 60),
      weeklySummary: {
        emailEnabled: weeklyEmailEnabled,
        email: weeklyEmailAddr.trim() || undefined,
        day: clamp(weeklyDay, 0, 6),
        hour: clamp(weeklyHour, 0, 23),
        timeZone: detectedTz,
      },
      defaultHomeAddress: homeAddress || undefined,
      defaultCommuteTimeMinutes: clamp(parseInt(commuteTime) || 45, 0, 300),
      isCommuteProductive,
      ankiAverageTimeSeconds: clamp(parseInt(ankiAverageTime) || 15, 1, 300),
    });
    useAppStore.getState().setDailyGoal(useAppStore.getState().selectedDailyGoalType, goalVal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleExportBackup = () => {
    const state = useAppStore.getState();
    const payload = {
      exportedAt: new Date().toISOString(),
      events: state.events,
      tasks: state.tasks,
      courses: state.courses,
      preferences: state.preferences,
      performanceHistory: state.performanceHistory,
      studySessions: state.studySessions,
      ankiHistory: state.ankiHistory,
      semesters: state.semesters,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unicalendar-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMsg('✓ Backup esportato con successo!');
    setTimeout(() => setBackupMsg(null), 3000);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        if (!Array.isArray(data.courses) || !Array.isArray(data.tasks)) {
          alert('File di backup non valido.');
          return;
        }
        if (window.confirm('Ripristinare questo backup? I dati attuali verranno sostituiti (potrai comunque usare Annulla).')) {
          const store = useAppStore.getState();
          store.saveSnapshot();
          useAppStore.setState({
            courses: data.courses || [],
            events: data.events || [],
            tasks: data.tasks || [],
            studySessions: data.studySessions || [],
            performanceHistory: data.performanceHistory || store.performanceHistory,
            ankiHistory: data.ankiHistory || store.ankiHistory,
            semesters: data.semesters || store.semesters,
          });
          if (data.preferences) store.updatePreferences(data.preferences);
          setBackupMsg('✓ Backup ripristinato!');
          setTimeout(() => setBackupMsg(null), 3500);
        }
      } catch {
        alert('Errore nella lettura del file JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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

          {/* Pianificazione, Esercizi e Ordinamento */}
          <GlassPanel>
            <h2 className="settings-section-title">Pianificazione, Esercizi e Priorità</h2>
            <p className="settings-section-desc">
              Personalizza l'ordine delle attività, la distribuzione settimanale tra teoria ed esercizi e la preparazione agli esami.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
              <div className="settings-inline-field" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span className="settings-field-label" style={{ fontWeight: 600 }}>Modalità di ordinamento attività:</span>
                <select
                  value={taskSortMode}
                  onChange={e => setTaskSortMode(e.target.value as TaskSortMode)}
                  className="task-type-select"
                  style={{ minWidth: '240px', padding: '8px 10px' }}
                >
                  <option value="oldest">Più vecchi prima (azzera arretrato)</option>
                  <option value="smart">Intelligente (urgenza esami, recuperi e difficoltà)</option>
                  <option value="deadline">Per scadenza (esami e consegne più vicine)</option>
                  <option value="shortest">Più brevi prima (vittorie rapide)</option>
                  <option value="course">Raggruppa per materia</option>
                </select>
              </div>

              <div className="settings-inline-field" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span className="settings-field-label" style={{ fontWeight: 600 }}>Routine settimanale (Teoria vs Esercizi):</span>
                <select
                  value={studyDistribution}
                  onChange={e => setStudyDistribution(e.target.value as 'balanced' | 'weekdays_theory_weekend_exercises')}
                  className="task-type-select"
                  style={{ minWidth: '240px', padding: '8px 10px' }}
                >
                  <option value="balanced">Bilanciata (in base all'ordine delle attività)</option>
                  <option value="weekdays_theory_weekend_exercises">Feriali: Teoria/Appunti · Weekend: Esercizi</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '4px' }}>
                <div className="settings-inline-field">
                  <span className="settings-field-label">Obiettivo giornaliero:</span>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={dailyTaskGoal}
                    onChange={e => setDailyTaskGoal(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">attività</span>
                </div>

                <div className="settings-inline-field">
                  <span className="settings-field-label">Aumento priorità esame:</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={daysBeforeExam}
                    onChange={e => setDaysBeforeExam(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">gg prima</span>
                </div>

                <div className="settings-inline-field">
                  <span className="settings-field-label">Finestra prep. esame:</span>
                  <input
                    type="number"
                    min="3"
                    max="60"
                    value={examPrepDays}
                    onChange={e => setExamPrepDays(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">giorni</span>
                </div>

                <div className="settings-inline-field">
                  <span className="settings-field-label">Blocco studio max:</span>
                  <input
                    type="number"
                    min="25"
                    max="240"
                    step="5"
                    value={maxStudyBlock}
                    onChange={e => setMaxStudyBlock(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">min</span>
                </div>

                <div className="settings-inline-field">
                  <span className="settings-field-label">Blocco studio min:</span>
                  <input
                    type="number"
                    min="10"
                    max="60"
                    step="5"
                    value={minStudyBlock}
                    onChange={e => setMinStudyBlock(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">min</span>
                </div>

                <div className="settings-inline-field">
                  <span className="settings-field-label">Pausa tra blocchi:</span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    step="5"
                    value={bufferMinutes}
                    onChange={e => setBufferMinutes(e.target.value)}
                    className="settings-number-input"
                  />
                  <span className="settings-field-label">min</span>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={autoQuizPrep}
                  onChange={e => setAutoQuizPrep(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Preparazione automatica per i Quiz intermedi</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Genera automaticamente 1–2 sessioni di ripasso mirato leggero prima di ogni quiz in calendario
                  </span>
                </div>
              </label>
            </div>
          </GlassPanel>

          {/* Riepilogo Settimanale via Email */}
          <GlassPanel>
            <h2 className="settings-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={20} /> Riepilogo Settimanale (In-App & Email)
            </h2>
            <p className="settings-section-desc">
              Ogni settimana trovi il riepilogo completo in Statistiche (condivisibile o apribile via email). Se attivi l'invio automatico, la Cloud Function di Firebase ti invierà il report nel giorno e nell'ora scelti.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={weeklyEmailEnabled}
                  onChange={e => setWeeklyEmailEnabled(e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Invia riepilogo settimanale automatico via Email</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Include attività svolte, ore studiate, confronto con la settimana precedente e materia più studiata
                  </span>
                </div>
              </label>

              {weeklyEmailEnabled && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '0.5rem' }}>
                  <div className="settings-inline-field" style={{ flexWrap: 'wrap', gap: '8px' }}>
                    <span className="settings-field-label" style={{ minWidth: '140px' }}>Email destinatario:</span>
                    <input
                      type="email"
                      value={weeklyEmailAddr}
                      onChange={e => setWeeklyEmailAddr(e.target.value)}
                      placeholder={user?.email || 'tua@email.it'}
                      className="settings-text-input"
                      style={{ flex: 1, minWidth: '220px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div className="settings-inline-field">
                      <span className="settings-field-label">Giorno:</span>
                      <select
                        value={weeklyDay}
                        onChange={e => setWeeklyDay(parseInt(e.target.value))}
                        className="task-type-select"
                        style={{ padding: '6px 10px' }}
                      >
                        {DAYS_OF_WEEK.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="settings-inline-field">
                      <span className="settings-field-label">Ora:</span>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={weeklyHour}
                        onChange={e => setWeeklyHour(parseInt(e.target.value) || 0)}
                        className="settings-number-input"
                      />
                      <span className="settings-field-label">:00</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>

          {/* Gestione Semestre */}
          <GlassPanel>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '0.5rem' }}>
              <h2 className="settings-section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <GraduationCap size={20} /> Gestione Semestri e Competenze Apprese
              </h2>
              {activeSemester && (
                <span style={{
                  fontSize: '0.78rem',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  fontWeight: 600
                }}>
                  Attivo: {activeSemester.name}
                </span>
              )}
            </div>
            <p className="settings-section-desc">
              Quando inizi un nuovo semestre puoi archiviare i corsi conclusi salvando un riepilogo completo (ore studiate, attività fatte e argomenti affrontati) e mantendo i corsi annuali. Lo storico prestazioni resta attivo per migliorare le stime future.
            </p>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '1rem', marginBottom: '1rem' }}>
              <Button variant="primary" onClick={() => setIsSemesterModalOpen(true)} icon={<Archive size={16} />}>
                Chiudi semestre e inizia nuovo…
              </Button>
            </div>

            <ArchivedSemestersView />
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
              <h2 className="settings-section-title" style={{ margin: 0 }}>Assistente AI (Google Gemini)</h2>
              <span style={{
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                fontWeight: 600
              }}>
                Gestito dal Server
              </span>
            </div>
            <p className="settings-section-desc">
              Le funzioni di estrazione e analisi intelligente (calendario, indice, prove e scadenze) utilizzano il servizio Google Gemini protetto sul server. La chiave API è gestita centralmente e non viene mai esposta al client.
            </p>
          </GlassPanel>

          {/* Backup e Privacy */}
          <GlassPanel>
            <h2 className="settings-section-title">Pulizia Sicura Dati, Backup e Privacy</h2>
            <p className="settings-section-desc">
              Rimuovi i task ridondanti o orfani (es. i vecchi task "Seguire/Recuperare lezione" o i doppioni generati in passato) mantenendo intatto il calendario e tutte le analisi delle prestazioni.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Button
                variant="primary"
                icon={<Sparkles size={16} />}
                onClick={() => {
                  const res = useAppStore.getState().cleanupNoisyTasks({
                    removeFollowLessonTasks: true,
                    removeOrphanLessonTasks: true,
                    deduplicate: true,
                  });
                  setBackupMsg(
                    res.removedTasks > 0 || res.removedEvents > 0
                      ? `✓ Pulizia completata: rimossi ${res.removedTasks} task superflui e ${res.removedEvents} eventi duplicati (puoi annullare con Undo).`
                      : '✓ I tuoi dati sono già puliti!'
                  );
                  setTimeout(() => setBackupMsg(null), 5000);
                }}
              >
                Pulisci Task Superflui & Doppioni
              </Button>
              <Button variant="secondary" onClick={handleExportBackup} icon={<Download size={16} />}>
                Esporta Backup JSON
              </Button>
              <label className="task-more-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', cursor: 'pointer' }}>
                <Upload size={16} />
                <span>Importa Backup JSON</span>
                <input type="file" accept=".json" onChange={handleImportBackup} style={{ display: 'none' }} />
              </label>
              <Button
                variant="secondary"
                onClick={() => navigate('/privacy')}
              >
                Leggi la Privacy Policy
              </Button>
            </div>
            {backupMsg && (
              <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#10b981', fontWeight: 600 }}>
                {backupMsg}
              </div>
            )}
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

      {/* Modal Wizard Nuovo Semestre */}
      <SemesterWizardModal
        isOpen={isSemesterModalOpen}
        onClose={() => setIsSemesterModalOpen(false)}
      />
    </div>
  );
}
