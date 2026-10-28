import { useMemo, useState } from 'react';
import {
  Brain,
  Clock,
  Activity,
  Sparkles,
  BookOpen,
  HeartPulse,
  Check,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { GlassPanel } from '../../ui/GlassPanel';
import { useAppStore } from '../../../store/useAppStore';
import { HabitAnalysisEngine } from '../../../core/HabitAnalysisEngine';
import { FutureProjectionEngine } from '../../../core/FutureProjectionEngine';

const KIND_LABELS: Record<string, string> = {
  FOLLOW_LESSON: 'Recupero lezioni',
  NOTES: 'Sistemazione appunti',
  EXERCISES: 'Esercizi pratici',
  PROJECT: 'Sessioni di progetto',
  PREP: 'Preparazione verifiche',
  OTHER: 'Altre attività',
};

export function HabitProfilePanel() {
  const tasks = useAppStore(s => s.tasks);
  const courses = useAppStore(s => s.courses);
  const events = useAppStore(s => s.events);
  const studySessions = useAppStore(s => s.studySessions);
  const performanceHistory = useAppStore(s => s.performanceHistory);
  const ankiHistory = useAppStore(s => s.ankiHistory);
  const preferences = useAppStore(s => s.preferences);
  const updatePreferences = useAppStore(s => s.updatePreferences);
  const updateCourse = useAppStore(s => s.updateCourse);

  const [appliedMsg, setAppliedMsg] = useState<string | null>(null);

  const flashMsg = (msg: string) => {
    setAppliedMsg(msg);
    setTimeout(() => setAppliedMsg(null), 3000);
  };

  const projection = useMemo(() => {
    if (events.length === 0 || courses.length === 0) return null;
    return FutureProjectionEngine.project(events, courses, tasks, performanceHistory, 14);
  }, [events, courses, tasks, performanceHistory]);

  const analysis = useMemo(() => {
    return HabitAnalysisEngine.analyzeAll(
      tasks,
      courses,
      events,
      studySessions,
      performanceHistory,
      ankiHistory,
      preferences,
      projection?.totalProjectedMinutes || 0
    );
  }, [tasks, courses, events, studySessions, performanceHistory, ankiHistory, preferences, projection]);

  const { chronotype, courseStrains, procrastination, decayedTopics, monteCarlo, wellbeing, smartTips } = analysis;

  const handleApplySuggestedStartTime = () => {
    if (!chronotype.suggestedStartTime) return;
    const nextHours = { ...preferences.dailyStudyHours };
    for (let d = 1; d <= 5; d++) {
      if (nextHours[d]) {
        nextHours[d] = { ...nextHours[d], start: chronotype.suggestedStartTime };
      }
    }
    updatePreferences({ dailyStudyHours: nextHours });
    flashMsg(`Orario feriale aggiornato alle ${chronotype.suggestedStartTime}`);
  };

  const handleApplyRecommendedBlock = () => {
    updatePreferences({ maxStudyBlockMinutes: procrastination.recommendedMaxBlockMinutes });
    flashMsg(`Durata massima blocco impostata a ${procrastination.recommendedMaxBlockMinutes} min`);
  };

  const handleSyncCourseDifficulty = (courseId: string, newDiff: number, courseName: string) => {
    updateCourse(courseId, { difficulty: Math.round(newDiff) });
    flashMsg(`Difficoltà di "${courseName}" allineata a ${Math.round(newDiff)}/10`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '24px' }}>
      {appliedMsg && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: 'var(--accent-success, #10b981)',
            fontWeight: 600,
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Check size={16} />
          <span>{appliedMsg}</span>
        </div>
      )}

      {/* SEZIONE 1: PANORAMICA ADATTIVA & CRONOTIPO */}
      <GlassPanel style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={20} color="var(--accent-primary)" />
              Profilo Cognitivo & Curva Circadiana
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Calcolato anche senza premere "Inizia" (tramite ricostruzione a ritroso e filtro anti-spunta serale cumulativa).
            </p>
          </div>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              background: 'rgba(59, 130, 246, 0.12)',
              color: 'var(--accent-primary, #2563eb)',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Cronotipo: {chronotype.chronotypeLabel}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          {chronotype.bands.map(band => {
            const isPeak = chronotype.peakBand?.id === band.id && band.taskCount > 0;
            const isDip = chronotype.dipBand?.id === band.id && band.taskCount > 0 && !isPeak;
            return (
              <div
                key={band.id}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  background: isPeak
                    ? 'rgba(16, 185, 129, 0.08)'
                    : isDip
                    ? 'rgba(245, 158, 11, 0.06)'
                    : 'var(--bg-secondary)',
                  border: isPeak
                    ? '1px solid rgba(16, 185, 129, 0.35)'
                    : '1px solid var(--border-light, rgba(0,0,0,0.08))',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{band.label}</span>
                  {isPeak && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#10b981' }}>PICCO</span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {band.rangeLabel}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700 }}>{band.focusIndex}/100</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {band.taskCount} task • Efficienza {Math.round(band.efficiencyScore * 100)}%
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(8, band.focusIndex))}%`,
                      height: '100%',
                      background: isPeak ? '#10b981' : 'var(--accent-primary, #3b82f6)',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {chronotype.suggestedStartTime && chronotype.startDriftMinutes && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '12px 14px',
              borderRadius: '10px',
              background: 'rgba(59, 130, 246, 0.08)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              fontSize: '0.85rem',
            }}
          >
            <div>
              <Clock size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Inizi a studiare in media <strong>{Math.abs(chronotype.startDriftMinutes)} min {chronotype.startDriftMinutes > 0 ? 'dopo' : 'prima'}</strong> rispetto all'orario impostato. Orario reale rilevato: <strong>{chronotype.suggestedStartTime}</strong>.
            </div>
            <button
              type="button"
              className="task-action-btn"
              onClick={handleApplySuggestedStartTime}
              style={{
                background: 'var(--accent-primary, #2563eb)',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Adatta orario a {chronotype.suggestedStartTime}
            </button>
          </div>
        )}
      </GlassPanel>

      {/* SEZIONE 2: DIFFICOLTÀ REALE E STIME BAYESIANE PER MATERIA */}
      <GlassPanel style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={20} color="var(--accent-primary)" />
          Difficoltà Reale vs Dichiarata & Calibrazione Tempi (EWMA Bayesiano)
        </h3>
        <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Confronta la difficoltà che hai impostato con quella dedotta dai tuoi sforamenti di tempo, rinvii automatici e pause.
        </p>

        {courseStrains.length === 0 ? (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Nessun corso attivo.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
            {courseStrains.map(cs => {
              const diffGap = cs.implicitDifficulty - cs.declaredDifficulty;
              const needsSync = Math.abs(diffGap) >= 1.5;
              return (
                <div
                  key={cs.courseId}
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'var(--bg-secondary)',
                    borderLeft: `4px solid ${cs.courseColor}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem' }}>{cs.courseName}</strong>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: diffGap >= 1.5 ? 'var(--accent-danger, #ef4444)' : 'var(--text-secondary)' }}>
                      Reale: {cs.implicitDifficulty}/10 (Impostata: {cs.declaredDifficulty})
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <div>
                      <div>Moltiplicatore</div>
                      <strong style={{ color: 'var(--text-primary)' }}>{cs.ewmaOverrunRatio}×</strong>
                    </div>
                    <div>
                      <div>Salti medi</div>
                      <strong style={{ color: 'var(--text-primary)' }}>{cs.avgSkipCount}×</strong>
                    </div>
                    <div>
                      <div>Latenza media</div>
                      <strong style={{ color: 'var(--text-primary)' }}>{cs.avgLatencyDays}g</strong>
                    </div>
                  </div>

                  {needsSync && (
                    <button
                      type="button"
                      className="task-action-btn"
                      onClick={() => handleSyncCourseDifficulty(cs.courseId, cs.implicitDifficulty, cs.courseName)}
                      style={{
                        marginTop: '4px',
                        fontSize: '0.78rem',
                        padding: '5px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Allinea difficoltà a {Math.round(cs.implicitDifficulty)}/10
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      {/* SEZIONE 3: PROCRASTINAZIONE, EFFETTO CASCATA ASSENZE & SOSTENIBILITÀ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
        <GlassPanel style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} color="var(--accent-primary)" />
            Analisi Attrito & Effetto Presenza
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Soglia fatica durata:</span>
              <strong>
                {procrastination.durationWallMinutes
                  ? `Oltre ${procrastination.durationWallMinutes} min`
                  : 'Nessun blocco rilevato'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Blocco studio ottimale:</span>
              <strong>{procrastination.recommendedMaxBlockMinutes} min</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Attività più rimandata:</span>
              <strong>
                {procrastination.mostAvoidedKind ? KIND_LABELS[procrastination.mostAvoidedKind] : 'Equilibrato'}
              </strong>
            </div>
            {procrastination.attendedFollowUpDelayDays !== null && procrastination.recoveredFollowUpDelayDays !== null && (
              <div style={{ padding: '8px 10px', borderRadius: '8px', background: 'var(--bg-secondary)', fontSize: '0.82rem' }}>
                📊 <strong>Effetto presenza:</strong> chiudi appunti/esercizi in{' '}
                <strong>{procrastination.attendedFollowUpDelayDays}g</strong> quando segui dal vivo, contro{' '}
                <strong>{procrastination.recoveredFollowUpDelayDays}g</strong> quando recuperi la lezione.
              </div>
            )}
            {procrastination.durationWallMinutes &&
              preferences.maxStudyBlockMinutes !== procrastination.recommendedMaxBlockMinutes && (
                <button
                  type="button"
                  className="task-action-btn"
                  onClick={handleApplyRecommendedBlock}
                  style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Imposta blocchi a {procrastination.recommendedMaxBlockMinutes} min
                </button>
              )}
          </div>
        </GlassPanel>

        <GlassPanel style={{ padding: '20px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HeartPulse size={18} color="var(--accent-primary)" />
            Ritmo Sostenibile, Burnout & Monte Carlo
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Probabilità successo ({monteCarlo.horizonLabel}):</span>
              <strong
                style={{
                  color:
                    monteCarlo.successProbabilityPct >= 75
                      ? 'var(--accent-success, #10b981)'
                      : monteCarlo.successProbabilityPct >= 45
                      ? 'var(--accent-warning, #f59e0b)'
                      : 'var(--accent-danger, #ef4444)',
                }}
              >
                {monteCarlo.successProbabilityPct}% (Mediana: {monteCarlo.p50DaysToCatchUp}g)
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Rischio Burnout (Boom-Bust):</span>
              <strong
                style={{
                  color:
                    wellbeing.burnoutRisk === 'low'
                      ? 'var(--accent-success, #10b981)'
                      : wellbeing.burnoutRisk === 'moderate'
                      ? 'var(--accent-warning, #f59e0b)'
                      : 'var(--accent-danger, #ef4444)',
                }}
              >
                {wellbeing.burnoutRisk === 'low'
                  ? 'Basso (Ritmo regolare)'
                  : wellbeing.burnoutRisk === 'moderate'
                  ? 'Moderato'
                  : 'Alto (Picchi seguiti da stop)'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px dashed var(--border-light)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Tetto giornaliero sostenibile:</span>
              <strong>{Math.round((wellbeing.sustainableDailyCapMinutes / 60) * 10) / 10} h / giorno</strong>
            </div>
            {wellbeing.sportBoostPct !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Impatto giorni di Sport sull'efficienza:</span>
                <strong style={{ color: wellbeing.sportBoostPct >= 0 ? 'var(--accent-success)' : 'inherit' }}>
                  {wellbeing.sportBoostPct >= 0 ? `+${wellbeing.sportBoostPct}%` : `${wellbeing.sportBoostPct}%`}
                </strong>
              </div>
            )}
          </div>
        </GlassPanel>
      </div>

      {/* SEZIONE 4: CURVA DELL'OBLIO DI EBBINGHAUS (ARGOMENTI DA RIPASSARE) */}
      <GlassPanel style={{ padding: '20px' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BookOpen size={19} color="var(--accent-primary)" />
          Curva dell'Oblio di Ebbinghaus (Ritenzione Mnemonica per Argomento)
        </h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
          Stima quanto ricordi di ogni argomento in base ai giorni trascorsi, alla presenza a lezione, agli esercizi svolti e alla costanza su Anki.
        </p>

        {decayedTopics.length === 0 ? (
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0 }}>
            Completa attività con argomenti associati (o importa il Syllabus) per tracciare la curva di ritenzione.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {decayedTopics.slice(0, 9).map(item => {
              const color =
                item.retentionPct < 50
                  ? '#ef4444'
                  : item.retentionPct < 75
                  ? '#f59e0b'
                  : '#10b981';
              return (
                <div
                  key={`${item.courseId}-${item.topic}`}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light, rgba(0,0,0,0.08))',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '0.86rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.topic}
                    </strong>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color }}>{item.retentionPct}%</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    {item.courseName} • {item.daysSinceReview}g fa (Stabilità: {item.memoryStrengthDays}g)
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassPanel>

      {/* SEZIONE 5: SUGGERIMENTI ADATTIVI ATTIVI */}
      {smartTips.length > 0 && (
        <GlassPanel style={{ padding: '18px 20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent-primary)" />
            Adattamenti Intelligenti Attivi
          </h3>
          <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            {smartTips.map((tip, i) => (
              <li key={i}>
                <TrendingUp size={13} style={{ display: 'inline', marginRight: '6px', color: 'var(--accent-primary)' }} />
                {tip}
              </li>
            ))}
          </ul>
        </GlassPanel>
      )}
    </div>
  );
}
