import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Chart, Line } from 'react-chartjs-2';
import {
  Brain,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  Repeat,
  Zap,
  TrendingUp,
  TrendingDown,
  Layers,
  Info,
} from 'lucide-react';
import { ankiService } from '../core/anki';
import { useAppStore } from '../store/useAppStore';
import { GlassPanel } from '../components/ui/GlassPanel';
import {
  getLatestSnapshot,
  getEffectiveSpeed,
  estimateMinutes,
  getAnkiTrendStats,
} from '../core/ankiStats';
import './AnkiDashboard.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export function AnkiDashboard() {
  const preferences = useAppStore(s => s.preferences);
  const ankiHistory = useAppStore(s => s.ankiHistory);
  const recordAnkiSync = useAppStore(s => s.recordAnkiSync);

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRangeDays, setSelectedRangeDays] = useState<number>(30);
  const [activeChartTab, setActiveChartTab] = useState<'cards' | 'speed'>('cards');

  // Ultimo snapshot salvato (disponibile sempre, anche offline!)
  const latestSaved = useMemo(() => {
    return getLatestSnapshot(ankiHistory) || (ankiHistory.length > 0 ? ankiHistory[ankiHistory.length - 1] : null);
  }, [ankiHistory]);

  // Calcolo della velocità effettiva (media ponderata storico -> collezione -> preferenze manuali)
  const speedInfo = useMemo(() => {
    return getEffectiveSpeed(ankiHistory, preferences);
  }, [ankiHistory, preferences]);

  // Sincronizzazione con Anki desktop
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fullSnapshot = await ankiService.fetchFullSnapshot();
      if (!fullSnapshot) {
        setIsConnected(false);
        setIsLoading(false);
        return;
      }

      setIsConnected(true);

      // Calcola tempo necessario usando SIA carte nuove SIA carte da ripassare
      const estMinutes = estimateMinutes(fullSnapshot.today, speedInfo.seconds);

      const snapshotToSave = {
        ...fullSnapshot.today,
        estimatedMinutes: estMinutes,
        collectionAvgSeconds: fullSnapshot.collectionAvgSeconds ?? undefined,
      };

      recordAnkiSync(snapshotToSave, fullSnapshot.reviewsByDay);
    } catch {
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, [recordAnkiSync, speedInfo.seconds]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 45 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Statistiche correnti: usa i dati più recenti salvati (o default a 0)
  const currentReviewDue = latestSaved?.reviewDue ?? 0;
  const currentLearnDue = latestSaved?.learnDue ?? 0;
  const currentNewCards = latestSaved?.newToday ?? latestSaved?.newTotal ?? 0;
  const totalCardsToReview = currentReviewDue + currentLearnDue;

  // TOTALE CARTE DA FARE OGGI: include sia quelle da ripassare che quelle nuove
  const totalCardsDue = (latestSaved?.remaining !== undefined && latestSaved.remaining > 0)
    ? Math.max(latestSaved.remaining, totalCardsToReview + currentNewCards)
    : (totalCardsToReview + currentNewCards);

  // TEMPO PREVISTO: calcolato usando come numero di carte sia quelle nuove che quelle da ripassare
  const estimatedTimeMinutes = latestSaved?.estimatedMinutes
    ?? estimateMinutes({ remaining: totalCardsDue, reviewDue: currentReviewDue, learnDue: currentLearnDue, newToday: currentNewCards }, speedInfo.seconds);

  const studiedToday = latestSaved?.studied ?? 0;
  const studyMinutesToday = latestSaved?.studyMinutes;

  // Statistiche andamento nel tempo (per grafici e KPI)
  const trendStats = useMemo(() => {
    return getAnkiTrendStats(ankiHistory, selectedRangeDays);
  }, [ankiHistory, selectedRangeDays]);

  // Opzioni grafici Chart.js
  const cardsChartData = useMemo(() => {
    return {
      labels: trendStats.chartDays.map(d => d.label),
      datasets: [
        {
          type: 'bar' as const,
          label: 'Carte Studiate',
          data: trendStats.chartDays.map(d => d.studied),
          backgroundColor: 'rgba(16, 185, 129, 0.75)',
          hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
          borderRadius: 6,
          borderSkipped: false,
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: 'Carte in Coda / Rimaste',
          data: trendStats.chartDays.map(d => d.remaining ?? null),
          borderColor: '#818cf8',
          backgroundColor: 'rgba(129, 140, 248, 0.1)',
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointBackgroundColor: '#818cf8',
          pointRadius: 3,
          pointHoverRadius: 6,
          yAxisID: 'y',
          spanGaps: true,
        },
      ],
    };
  }, [trendStats]);

  const speedChartData = useMemo(() => {
    const validSpeeds = trendStats.chartDays.map(d => d.avgSecondsPerCard ?? null);
    return {
      labels: trendStats.chartDays.map(d => d.label),
      datasets: [
        {
          label: 'Velocità Giornaliera (s/carta)',
          data: validSpeeds,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          fill: true,
          tension: 0.35,
          borderWidth: 2.5,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 7,
          spanGaps: true,
        },
        {
          label: `Media Periodo (${speedInfo.seconds.toFixed(1)}s)`,
          data: trendStats.chartDays.map(() => speedInfo.seconds),
          borderColor: 'rgba(255, 255, 255, 0.25)',
          borderDash: [5, 5],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        },
      ],
    };
  }, [trendStats, speedInfo.seconds]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          font: { family: 'inherit', size: 12 },
          usePointStyle: true,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: '#cbd5e1',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)', maxRotation: 45, font: { size: 11 } },
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: 'rgba(255, 255, 255, 0.6)', font: { size: 11 } },
        beginAtZero: true,
      },
    },
  };

  const hasHistory = ankiHistory.length > 0;
  const isOffline = isConnected === false;

  const speedSourceLabel = {
    today: 'Rilevata oggi da Anki',
    history: 'Media ponderata ultimi 14gg',
    collection: 'Media statistiche collezione',
    manual: 'Stima manuale (impostazioni)',
  }[speedInfo.source];

  return (
    <div className="anki-dashboard-container">
      {/* Header principale */}
      <div className="anki-header-section">
        <div className="anki-title-group">
          <div className="anki-main-icon">
            <Brain size={32} />
          </div>
          <div>
            <h2>Anki Studio</h2>
            <p className="text-muted">Monitora e gestisci le tue sessioni di ripasso spaziato</p>
          </div>
        </div>

        <div className="anki-controls">
          <div
            className={`connection-badge ${isConnected ? 'online' : isOffline ? 'offline' : 'checking'}`}
            title={isConnected ? 'Connesso ad Anki Desktop' : 'Anki non raggiungibile (mostro i dati salvati)'}
          >
            <span className="dot"></span>
            {isConnected
              ? 'Connesso'
              : hasHistory
              ? 'Offline (Dati salvati)'
              : 'Disconnesso'}
          </div>

          <button
            className="refresh-button"
            onClick={fetchData}
            disabled={isLoading}
            title="Sincronizza subito con Anki desktop"
          >
            <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
            {isLoading ? 'Sincronizzazione...' : 'Aggiorna'}
          </button>
        </div>
      </div>

      {/* Banner informativa modalità offline quando ci sono dati salvati */}
      {isOffline && hasHistory && (
        <div className="anki-offline-notice">
          <Info size={18} />
          <span>
            <strong>Modalità Offline:</strong> visualizzi i dati salvati dell'ultima sincronizzazione{' '}
            {latestSaved?.updatedAt && (
              <>({new Date(latestSaved.updatedAt).toLocaleDateString('it-IT')} alle{' '}
              {new Date(latestSaved.updatedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })})</>
            )}. Apri Anki desktop per aggiornare automaticamente in tempo reale.
          </span>
        </div>
      )}

      {/* Se Anki non è connesso E non abbiamo mai sincronizzato alcun dato */}
      {isOffline && !hasHistory ? (
        <div className="anki-state-message error">
          <AlertCircle size={48} className="text-error mb-4" />
          <h3>Anki non raggiungibile</h3>
          <p>
            Assicurati che l'app desktop <strong>Anki</strong> sia aperta sul computer e che l'add-on{' '}
            <strong>AnkiConnect</strong> (codice <code>2055492159</code>) sia installato.
          </p>
          <p className="text-sm text-muted mt-2">
            Non appena aprirai Anki, UniCalendar salverà automaticamente i dati in modo che rimangano disponibili anche quando Anki verrà chiuso.
          </p>
          <button className="refresh-button mt-4" onClick={fetchData} disabled={isLoading}>
            <RefreshCw size={18} className={isLoading ? 'spinning' : ''} />
            Riprova Connessione
          </button>
        </div>
      ) : (
        <>
          {/* Griglia Statistiche Principali di Oggi */}
          <div className="anki-stats-grid">
            {/* Carte da Ripassare */}
            <GlassPanel className="stat-card accent-blue">
              <div className="stat-icon-wrapper">
                <Repeat size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{totalCardsToReview}</span>
                <span className="stat-label">Carte da Ripassare</span>
                <span className="stat-sublabel">
                  {currentReviewDue} in ripasso + {currentLearnDue} in apprendimento
                </span>
              </div>
            </GlassPanel>

            {/* Carte Nuove */}
            <GlassPanel className="stat-card accent-purple">
              <div className="stat-icon-wrapper">
                <BookOpen size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-value">{currentNewCards}</span>
                <span className="stat-label">Carte Nuove</span>
                <span className="stat-sublabel">
                  {latestSaved?.newTotal && latestSaved.newTotal > currentNewCards
                    ? `${currentNewCards} oggi (${latestSaved.newTotal} totali nel mazzo)`
                    : 'Da introdurre per la prima volta oggi'}
                </span>
              </div>
            </GlassPanel>

            {/* Tempo Previsto Oggi: calcolato su nuove + ripasso */}
            <GlassPanel className="stat-card accent-orange">
              <div className="stat-icon-wrapper">
                <Clock size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-value">
                  {estimatedTimeMinutes} <span className="text-sm">min</span>
                </span>
                <span className="stat-label">Tempo Previsto Oggi</span>
                <span className="stat-sublabel">
                  Per completare le <strong>{totalCardsDue} carte</strong> ({totalCardsToReview} ripasso + {currentNewCards} nuove)
                </span>
              </div>
            </GlassPanel>

            {/* Velocità Media */}
            <GlassPanel className="stat-card accent-green">
              <div className="stat-icon-wrapper">
                <Zap size={24} />
              </div>
              <div className="stat-content">
                <span className="stat-value">
                  {speedInfo.seconds.toFixed(1)} <span className="text-sm">s</span>
                </span>
                <span className="stat-label">Velocità Media</span>
                <span className="stat-sublabel" title={speedSourceLabel}>
                  {speedSourceLabel}
                </span>
              </div>
            </GlassPanel>

            {/* Progressi di Oggi (Full Width Banner) */}
            <GlassPanel className="stat-card accent-teal anki-today-banner">
              <div className="today-banner-left">
                <div className="stat-icon-wrapper banner-icon">
                  <CheckCircle2 size={30} />
                </div>
                <div>
                  <h3 className="banner-title">Progressi di Oggi</h3>
                  <p className="banner-description">
                    {studiedToday > 0 ? (
                      <>
                        Hai completato <strong>{studiedToday} carte</strong> oggi
                        {studyMinutesToday ? ` in ~${studyMinutesToday} minuti di studio effettivo` : ''}!
                        {totalCardsDue > 0 ? ` Restano ${totalCardsDue} carte in coda.` : ' Coda completata! 🎉'}
                      </>
                    ) : (
                      'Nessuna carta ancora completata oggi. Apri Anki per iniziare!'
                    )}
                  </p>
                </div>
              </div>
              <div className="today-banner-right">
                <span className="today-studied-count">{studiedToday}</span>
                <span className="today-studied-label">completate</span>
              </div>
            </GlassPanel>
          </div>

          {/* ═══════════════════════════════════════════════════════ */}
          {/* SEZIONE: ANDAMENTO DELLO STUDIO NEL TEMPO              */}
          {/* ═══════════════════════════════════════════════════════ */}
          <div className="anki-trends-section">
            <div className="trends-header">
              <div>
                <h3 className="trends-title">Andamento dello Studio nel Tempo</h3>
                <p className="text-muted text-sm">
                  Analisi storica del numero di carte studiate e dell'evoluzione della tua velocità di risposta
                </p>
              </div>

              {/* Selettore finestra temporale */}
              <div className="range-pills">
                {[7, 14, 30, 90].map(days => (
                  <button
                    key={days}
                    className={`range-pill ${selectedRangeDays === days ? 'active' : ''}`}
                    onClick={() => setSelectedRangeDays(days)}
                  >
                    {days}gg
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Summary dell'andamento */}
            <div className="trends-kpi-grid">
              <div className="trend-kpi-card">
                <span className="trend-kpi-label">Carte Totali nel Periodo</span>
                <span className="trend-kpi-val text-primary">{trendStats.totalStudied}</span>
                <span className="trend-kpi-sub">in {trendStats.activeDaysCount} giorni attivi</span>
              </div>

              <div className="trend-kpi-card">
                <span className="trend-kpi-label">Media Giornaliera</span>
                <span className="trend-kpi-val">{trendStats.dailyAverage}</span>
                <span className="trend-kpi-sub">carte / giorno attivo</span>
              </div>

              <div className="trend-kpi-card">
                <span className="trend-kpi-label">Velocità Media del Periodo</span>
                <span className="trend-kpi-val">
                  {trendStats.avgSpeedSeconds ? `${trendStats.avgSpeedSeconds}s` : `${speedInfo.seconds.toFixed(1)}s`}
                </span>
                <span className="trend-kpi-sub">per carta</span>
              </div>

              <div className="trend-kpi-card">
                <span className="trend-kpi-label">Tendenza Velocità</span>
                <div className="trend-kpi-trend">
                  {trendStats.speedDeltaPercent !== null ? (
                    trendStats.speedDeltaPercent < 0 ? (
                      <span className="trend-badge positive">
                        <TrendingUp size={16} /> +{Math.abs(trendStats.speedDeltaPercent)}% più veloce
                      </span>
                    ) : (
                      <span className="trend-badge neutral">
                        <TrendingDown size={16} /> +{trendStats.speedDeltaPercent}% tempo
                      </span>
                    )
                  ) : (
                    <span className="trend-badge neutral">Dati in raccolta</span>
                  )}
                </div>
                <span className="trend-kpi-sub">rispetto a inizio periodo</span>
              </div>
            </div>

            {/* Grafici Tab Toggle */}
            <div className="chart-tabs-bar">
              <button
                className={`chart-tab-btn ${activeChartTab === 'cards' ? 'active' : ''}`}
                onClick={() => setActiveChartTab('cards')}
              >
                <Layers size={16} />
                Volume Carte (Studiate vs In Coda)
              </button>
              <button
                className={`chart-tab-btn ${activeChartTab === 'speed' ? 'active' : ''}`}
                onClick={() => setActiveChartTab('speed')}
              >
                <Zap size={16} />
                Evoluzione Velocità (s/carta)
              </button>
            </div>

            {/* Contenitore Grafico */}
            <GlassPanel className="anki-chart-panel">
              <div style={{ height: 340, width: '100%' }}>
                {activeChartTab === 'cards' ? (
                  <Chart type="bar" data={cardsChartData} options={chartOptions} />
                ) : (
                  <Line data={speedChartData} options={chartOptions} />
                )}
              </div>
              <div className="chart-caption">
                {activeChartTab === 'cards' ? (
                  <span>
                    💡 Le barre verdi mostrano le carte studiate ogni giorno, mentre la linea viola evidenzia il carico di carte che avevi ancora da completare.
                  </span>
                ) : (
                  <span>
                    ⚡ Mostra come cambia il tempo impiegato per carta: man mano che memorizzi i concetti la linea tende a scendere, riducendo il tempo totale di ripasso.
                  </span>
                )}
              </div>
            </GlassPanel>
          </div>
        </>
      )}
    </div>
  );
}
