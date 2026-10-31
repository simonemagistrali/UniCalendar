import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  BrainCircuit, 
  Target, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Flame, 
  Play, 
  Pause, 
  Layers, 
  GraduationCap, 
  BarChart3, 
  ShieldCheck, 
  ChevronRight,
  Zap,
  Sparkle
} from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { authService } from '../core/mockBackend';

type FeatureTab = 'priority' | 'anki' | 'calendar' | 'analytics';

export function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [activeTab, setActiveTab] = useState<FeatureTab>('priority');
  const [isPlayingDemo, setIsPlayingDemo] = useState(true);

  // Interactive state for Mock Flashcard in Hero/Anki tab
  const [cardFlipped, setCardFlipped] = useState(false);
  const [_cardRating, setCardRating] = useState<string | null>(null);

  // Interactive state for Priority Task Completion in preview
  const [completedDemoTasks, setCompletedDemoTasks] = useState<Record<string, boolean>>({
    task1: false,
    task2: true,
  });

  // Auto rotate tabs if demo is playing
  useEffect(() => {
    if (!isPlayingDemo) return;
    const tabs: FeatureTab[] = ['priority', 'anki', 'calendar', 'analytics'];
    const timer = setInterval(() => {
      setActiveTab((prev) => {
        const nextIndex = (tabs.indexOf(prev) + 1) % tabs.length;
        return tabs[nextIndex];
      });
      setCardFlipped(false);
      setCardRating(null);
    }, 7000);

    return () => clearInterval(timer);
  }, [isPlayingDemo]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await authService.loginWithGoogle();
      navigate('/home');
    } catch (err: unknown) {
      console.error('Login failed', err);
      const authErr = err as { code?: string };
      if (authErr?.code === 'auth/popup-closed-by-user') {
        setError('Login annullato. Riprova quando vuoi.');
      } else {
        setError('Errore durante il login. Verifica la connessione o riprova.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTask = (id: string) => {
    setCompletedDemoTasks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  return (
    <div className="landing-container">
      {/* Dynamic Background Glows & Floating Elements */}
      <div className="landing-bg-glows" aria-hidden="true">
        <div className="glow-sphere glow-1" />
        <div className="glow-sphere glow-2" />
        <div className="glow-sphere glow-3" />
        <div className="grid-overlay" />
      </div>

      {/* Top Navbar */}
      <header className="landing-nav">
        <div className="nav-brand">
          <div className="brand-logo-glow">
            <Calendar className="brand-icon" size={24} />
          </div>
          <span className="brand-name">UniCalendar</span>
          <span className="badge-beta">v2.0 Smart Study</span>
        </div>

        <div className="nav-actions">
          <a href="#features" className="nav-link">Funzionalità</a>
          <a href="#interactive-preview" className="nav-link">Demo Live</a>
          <a href="#security" className="nav-link">Privacy & Cloud</a>
          <Button 
            variant="primary" 
            className="nav-cta-btn"
            onClick={() => setShowLoginModal(true)}
          >
            Accedi / Registrati <ArrowRight size={16} />
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-pill-badge">
            <Sparkles size={16} className="text-amber-400 animate-spin-slow" />
            <span>Algoritmo di Apprendimento Dinamico & Spaced Repetition</span>
          </div>

          <h1 className="hero-headline">
            La piattaforma che trasforma la tua sessione esami da <span className="text-gradient-fire">caotica</span> a <span className="text-gradient-magic">inarrestabile</span>.
          </h1>

          <p className="hero-subtext">
            Smetti di chiederti da dove iniziare o quanto devi studiare oggi. UniCalendar ricalcola carichi, scadenze, flashcard Anki e lezioni universitarie in tempo reale.
          </p>

          <div className="hero-button-group">
            <button 
              className="glow-hero-btn"
              onClick={() => setShowLoginModal(true)}
            >
              <span>Entra con Google</span>
              <ArrowRight size={18} />
            </button>
            <a href="#interactive-preview" className="secondary-hero-btn">
              <Play size={16} /> Guarda come funziona
            </a>
          </div>

          {/* Social Proof & Metrics */}
          <div className="hero-stats">
            <div className="stat-pill">
              <Flame size={20} className="text-orange-500" />
              <div>
                <strong>+42%</strong>
                <span>Ritenzione nozioni</span>
              </div>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <Clock size={20} className="text-blue-500" />
              <div>
                <strong>-12h/sett</strong>
                <span>Pianificazione manuale</span>
              </div>
            </div>
            <div className="stat-divider" />
            <div className="stat-pill">
              <ShieldCheck size={20} className="text-emerald-500" />
              <div>
                <strong>100% Crittografato</strong>
                <span>Zero tracking invasivo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Interactive Hero Preview Board */}
        <div className="hero-mockup-wrapper">
          <div className="hero-mockup-card">
            <div className="mockup-window-header">
              <div className="mockup-dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="mockup-title-bar">
                <span>unicalendar.app / dashboard-live</span>
              </div>
              <div className="mockup-live-indicator">
                <span className="pulse-dot" /> LIVE ENGINE
              </div>
            </div>

            <div className="mockup-body">
              {/* Daily Focus Bar */}
              <div className="mockup-focus-banner">
                <div className="focus-info">
                  <span className="focus-label">FOCUS DEL GIORNO</span>
                  <h4>Analisi Matematica I & Basi di Dati</h4>
                </div>
                <div className="focus-streak">
                  <Flame size={18} className="text-orange-500 fill-orange-500" />
                  <span>Streak 14 gg</span>
                </div>
              </div>

              {/* Dynamic Priority Widget */}
              <div className="mockup-task-list">
                <div className="mockup-section-title">
                  <span>Task Prioritari Calcolati</span>
                  <span className="priority-tag high">Urgente</span>
                </div>

                <div 
                  className={`mockup-task-item ${completedDemoTasks['task1'] ? 'done' : ''}`}
                  onClick={() => toggleTask('task1')}
                >
                  <div className={`mockup-checkbox ${completedDemoTasks['task1'] ? 'checked' : ''}`}>
                    {completedDemoTasks['task1'] && <CheckCircle2 size={16} />}
                  </div>
                  <div className="mockup-task-text">
                    <span className="task-title">Teorema di Cauchy e Successioni</span>
                    <span className="task-meta">Analisi 1 • 45 min • Ripasso Anki #3</span>
                  </div>
                  <span className="task-badge danger">Oggi</span>
                </div>

                <div 
                  className={`mockup-task-item ${completedDemoTasks['task2'] ? 'done' : ''}`}
                  onClick={() => toggleTask('task2')}
                >
                  <div className={`mockup-checkbox ${completedDemoTasks['task2'] ? 'checked' : ''}`}>
                    {completedDemoTasks['task2'] && <CheckCircle2 size={16} />}
                  </div>
                  <div className="mockup-task-text">
                    <span className="task-title">Normalizzazione 3NF e Boyce-Codd</span>
                    <span className="task-meta">Basi di Dati • 15 Esercizi guidati</span>
                  </div>
                  <span className="task-badge success">Completato</span>
                </div>

                {/* Progress bar */}
                <div className="mockup-daily-progress">
                  <div className="progress-header">
                    <span>Obiettivo giornaliero: 25 / 35 pagine</span>
                    <span>71%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: '71%' }} />
                  </div>
                </div>
              </div>

              {/* Mini Anki Card Preview */}
              <div className="mockup-anki-preview">
                <div className="anki-preview-header">
                  <BrainCircuit size={16} className="text-purple-400" />
                  <span>Ripetizione Dilazionata (SM-2 Algorithm)</span>
                </div>
                <div 
                  className={`anki-card-mini ${cardFlipped ? 'flipped' : ''}`}
                  onClick={() => setCardFlipped(!cardFlipped)}
                >
                  <div className="card-inner">
                    <div className="card-face card-front">
                      <span className="card-subject">Sistemi Operativi</span>
                      <p className="card-q">Differenza tra Mutex e Semaforo Binario?</p>
                      <span className="card-hint">Tocca per girare la carta ↺</span>
                    </div>
                    <div className="card-face card-back">
                      <span className="card-subject text-emerald-400">Risposta</span>
                      <p className="card-a">Il mutex ammette ownership (chi acquisisce deve rilasciare), il semaforo gestisce segnalazione tra thread.</p>
                      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                        <button className="anki-btn red" onClick={() => setCardRating('again')}>Ripeti (1m)</button>
                        <button className="anki-btn yellow" onClick={() => setCardRating('hard')}>Difficile (1d)</button>
                        <button className="anki-btn green" onClick={() => setCardRating('good')}>Facile (4d)</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Interactive Feature Demo Showcase Section */}
      <section id="interactive-preview" className="interactive-showcase-section">
        <div className="section-header">
          <div className="section-badge">ESPLORA LE FUNZIONALITÀ REALI</div>
          <h2 className="section-title">Costruito per come lavora veramente la mente di uno studente</h2>
          <p className="section-subtitle">
            Dimentica le to-do list generiche o i calendari statici. Scopri le 4 componenti integrate dell'ecosistema UniCalendar.
          </p>

          {/* Feature Tab Selector */}
          <div className="tab-switcher">
            <button 
              className={`tab-btn ${activeTab === 'priority' ? 'active' : ''}`}
              onClick={() => { setActiveTab('priority'); setIsPlayingDemo(false); }}
            >
              <Target size={18} />
              <span>Priority Engine</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'anki' ? 'active' : ''}`}
              onClick={() => { setActiveTab('anki'); setIsPlayingDemo(false); }}
            >
              <BrainCircuit size={18} />
              <span>Anki Flashcards & SM-2</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
              onClick={() => { setActiveTab('calendar'); setIsPlayingDemo(false); }}
            >
              <Calendar size={18} />
              <span>Lezioni & Orari Universitari</span>
            </button>
            <button 
              className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => { setActiveTab('analytics'); setIsPlayingDemo(false); }}
            >
              <BarChart3 size={18} />
              <span>Previsioni & Proiezione Esami</span>
            </button>

            <button 
              className="tab-play-toggle" 
              onClick={() => setIsPlayingDemo(!isPlayingDemo)}
              title={isPlayingDemo ? "Pausa carosello" : "Riproduci carosello"}
            >
              {isPlayingDemo ? <Pause size={14} /> : <Play size={14} />}
            </button>
          </div>
        </div>

        {/* Tab Content Display with Live Animations */}
        <div className="showcase-stage">
          {activeTab === 'priority' && (
            <div className="showcase-tab-content fade-in-scale">
              <div className="showcase-text">
                <div className="feature-icon-pill bg-blue-500/10 text-blue-400">
                  <Target size={24} />
                </div>
                <h3>Algoritmo di Priorità Intelligente</h3>
                <p>
                  Non devi più decidere ogni mattina cosa fare. UniCalendar analizza in tempo reale:
                </p>
                <ul className="feature-checklist">
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Giorni rimanenti all'appello d'esame</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Coefficiente di difficoltà del corso (CFU + complessità)</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Curve di decadimento della memoria per le ripetizioni</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Ribilanciamento istantaneo se salti una sessione</li>
                </ul>
                <div className="showcase-cta">
                  <Button variant="primary" onClick={() => setShowLoginModal(true)}>
                    Prova con i tuoi corsi <ChevronRight size={16} />
                  </Button>
                </div>
              </div>

              <div className="showcase-visual">
                <div className="visual-board-wrapper">
                  <div className="board-header">
                    <span>Priority Score Calculation Engine</span>
                    <span className="live-badge">CALCULATED</span>
                  </div>
                  <div className="priority-simulation">
                    <div className="sim-row high">
                      <div className="sim-rank">#1</div>
                      <div className="sim-details">
                        <span className="sim-title">Fisica II - Elettromagnetismo</span>
                        <div className="sim-bar-bg"><div className="sim-bar-fill" style={{ width: '92%' }}></div></div>
                      </div>
                      <div className="sim-score">9.8 <span>/ 10</span></div>
                    </div>

                    <div className="sim-row medium">
                      <div className="sim-rank">#2</div>
                      <div className="sim-details">
                        <span className="sim-title">Algoritmi & Strutture Dati</span>
                        <div className="sim-bar-bg"><div className="sim-bar-fill" style={{ width: '74%' }}></div></div>
                      </div>
                      <div className="sim-score">7.4 <span>/ 10</span></div>
                    </div>

                    <div className="sim-row normal">
                      <div className="sim-rank">#3</div>
                      <div className="sim-details">
                        <span className="sim-title">Economia & Gestione Aziendale</span>
                        <div className="sim-bar-bg"><div className="sim-bar-fill" style={{ width: '45%' }}></div></div>
                      </div>
                      <div className="sim-score">4.5 <span>/ 10</span></div>
                    </div>

                    <div className="sim-note">
                      <Zap size={14} className="text-amber-400" />
                      <span>Se salti oggi lo studio di Fisica, il suo punteggio salirà automaticamente al 10.0 domani mattina.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'anki' && (
            <div className="showcase-tab-content fade-in-scale">
              <div className="showcase-text">
                <div className="feature-icon-pill bg-purple-500/10 text-purple-400">
                  <BrainCircuit size={24} />
                </div>
                <h3>Spaced Repetition & Generazione Automatica</h3>
                <p>
                  Imparare non significa rileggere 10 volte lo stesso capitolo. UniCalendar integra il motore Anki nativo:
                </p>
                <ul className="feature-checklist">
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Algoritmo SM-2 scientificamente provato</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Deck separati per corso con statistiche di ritenzione</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Calcolo dell'intervallo ideale per consolidare nella memoria a lungo termine</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Flashcard invertibili e domande a risposta multipla</li>
                </ul>
                <div className="showcase-cta">
                  <Button variant="primary" onClick={() => setShowLoginModal(true)}>
                    Inizia a creare il tuo Deck <ChevronRight size={16} />
                  </Button>
                </div>
              </div>

              <div className="showcase-visual">
                <div className="visual-board-wrapper anki-visual">
                  <div className="board-header">
                    <span>Anki SuperMemo-2 Spaced Repetition</span>
                    <span className="live-badge bg-purple-500/20 text-purple-300">STUDY MODE</span>
                  </div>

                  <div className="sim-anki-deck">
                    <div className="deck-stats-row">
                      <div className="deck-badge new">Nuove: 12</div>
                      <div className="deck-badge learning">In corso: 8</div>
                      <div className="deck-badge due">Da Ripetere: 24</div>
                    </div>

                    <div className="interactive-anki-box">
                      <div className="anki-question-badge">DOMANDA ATTIVA</div>
                      <p className="anki-big-question">Qual è la complessità temporale nel caso medio del QuickSort?</p>
                      
                      <div className="anki-solution-revealed">
                        <span className="ans-tag">Risposta Attesa:</span>
                        <p className="ans-text"><strong>O(n log n)</strong>, grazie al partizionamento divide-et-impera su pivot bilanciati.</p>
                      </div>

                      <div className="anki-interval-buttons">
                        <div className="interval-btn-col">
                          <span className="interval-time">&lt; 1 min</span>
                          <button className="int-btn red">Ripeti</button>
                        </div>
                        <div className="interval-btn-col">
                          <span className="interval-time">10 min</span>
                          <button className="int-btn orange">Difficile</button>
                        </div>
                        <div className="interval-btn-col">
                          <span className="interval-time">1 giorno</span>
                          <button className="int-btn blue">Buono</button>
                        </div>
                        <div className="interval-btn-col">
                          <span className="interval-time">4 giorni</span>
                          <button className="int-btn green">Facile</button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calendar' && (
            <div className="showcase-tab-content fade-in-scale">
              <div className="showcase-text">
                <div className="feature-icon-pill bg-emerald-500/10 text-emerald-400">
                  <Calendar size={24} />
                </div>
                <h3>Sincronizzazione Orari & Lezioni Universitarie</h3>
                <p>
                  Collega i tuoi impegni accademici senza conflitti. UniCalendar sa quando sei in aula e calcola il tempo reale rimasto per lo studio:
                </p>
                <ul className="feature-checklist">
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Importazione automatica da file .ICS / Google Calendar</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Tracciamento presenze e percentuale di frequenza lezioni</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Blocco automatico degli slot di tempo per le pause e il riposo</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Notifiche prima delle lezioni e compiti</li>
                </ul>
                <div className="showcase-cta">
                  <Button variant="primary" onClick={() => setShowLoginModal(true)}>
                    Importa il tuo Calendario <ChevronRight size={16} />
                  </Button>
                </div>
              </div>

              <div className="showcase-visual">
                <div className="visual-board-wrapper calendar-visual">
                  <div className="board-header">
                    <span>Orario Settimanale Dinamico</span>
                    <span className="live-badge bg-emerald-500/20 text-emerald-300">SETTIMANA 44</span>
                  </div>

                  <div className="sim-calendar-grid">
                    <div className="cal-day">
                      <span className="day-name">LUN</span>
                      <div className="cal-slot lecture">
                        <span className="slot-time">09:00 - 11:00</span>
                        <strong>Lezione: Calcolo Numerico</strong>
                        <span className="slot-room">Aula 3B</span>
                      </div>
                      <div className="cal-slot study">
                        <span className="slot-time">14:00 - 16:30</span>
                        <strong>Sessione Studio Autonomo</strong>
                        <span className="slot-room">25 Pagine</span>
                      </div>
                    </div>

                    <div className="cal-day">
                      <span className="day-name active-day">OGGI (MAR)</span>
                      <div className="cal-slot lecture active-now">
                        <span className="slot-time">10:00 - 13:00</span>
                        <strong>Lab: Reti di Calcolatori</strong>
                        <span className="slot-room">Lab Turing • In corso</span>
                      </div>
                      <div className="cal-slot anki-slot">
                        <span className="slot-time">17:00 - 18:00</span>
                        <strong>Deck Anki: Protocolli TCP/IP</strong>
                        <span className="slot-room">35 Carte</span>
                      </div>
                    </div>

                    <div className="cal-day">
                      <span className="day-name">MER</span>
                      <div className="cal-slot study">
                        <span className="slot-time">09:30 - 12:30</span>
                        <strong>Simulazione Prova d'Esame</strong>
                        <span className="slot-room">Biblioteca Centrale</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="showcase-tab-content fade-in-scale">
              <div className="showcase-text">
                <div className="feature-icon-pill bg-amber-500/10 text-amber-400">
                  <BarChart3 size={24} />
                </div>
                <h3>Proiezioni & Predizione Esame</h3>
                <p>
                  Saprai in anticipo con precisione matematica se sei in pari con il programma o se rischi di arrivare impreparato:
                </p>
                <ul className="feature-checklist">
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Ritmo giornaliero necessario (pagine/giorno per arrivare sereni)</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Probabilità di completamento del programma entro la data dell'appello</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Analisi dello storico delle tue performance per stimare i tempi di studio reali</li>
                  <li><CheckCircle2 size={16} className="text-emerald-400" /> Grafici di completamento per capitoli e CFU</li>
                </ul>
                <div className="showcase-cta">
                  <Button variant="primary" onClick={() => setShowLoginModal(true)}>
                    Guarda le tue statistiche <ChevronRight size={16} />
                  </Button>
                </div>
              </div>

              <div className="showcase-visual">
                <div className="visual-board-wrapper analytics-visual">
                  <div className="board-header">
                    <span>Future Projection & Readiness Index</span>
                    <span className="live-badge bg-amber-500/20 text-amber-300">PREDICTION: ON TRACK</span>
                  </div>

                  <div className="sim-analytics">
                    <div className="analytics-kpi-row">
                      <div className="kpi-box">
                        <span className="kpi-label">Pagine Rimanenti</span>
                        <h4 className="kpi-val">142 <span>/ 380</span></h4>
                      </div>
                      <div className="kpi-box">
                        <span className="kpi-label">Velocità Media</span>
                        <h4 className="kpi-val text-emerald-400">18.5 <span>pag/giorno</span></h4>
                      </div>
                      <div className="kpi-box">
                        <span className="kpi-label">Data Completamento Prevista</span>
                        <h4 className="kpi-val text-blue-400">4 gg prima</h4>
                      </div>
                    </div>

                    <div className="sim-chart-container">
                      <div className="chart-legend">
                        <span className="legend-item target">—— Obiettivo Ideale</span>
                        <span className="legend-item actual">—— Il Tuo Ritmo Reale (Superiore)</span>
                      </div>
                      <div className="sim-svg-chart">
                        <svg viewBox="0 0 400 120" className="chart-svg">
                          {/* Ideal Pace Line */}
                          <path d="M 10 100 Q 150 70 390 20" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeDasharray="5,5" />
                          {/* Actual Progress Line */}
                          <path d="M 10 100 Q 140 60 260 30" fill="none" stroke="#38bdf8" strokeWidth="3" />
                          {/* Projected Line */}
                          <path d="M 260 30 Q 320 15 390 10" fill="none" stroke="#4ade80" strokeWidth="3" strokeDasharray="4,4" />
                          {/* Current Day Marker */}
                          <circle cx="260" cy="30" r="5" fill="#38bdf8" />
                        </svg>
                      </div>
                      <div className="chart-footer-note">
                        <Sparkle size={14} className="text-emerald-400" />
                        <span>Ottimo lavoro! Con questo ritmo avrai 4 giorni completi dedicati solo al ripasso generale.</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feature Grid: Full Capabilities */}
      <section id="features" className="full-features-section">
        <div className="section-header text-center">
          <div className="section-badge">TUTTI GLI STRUMENTI IN UN'UNICA APP</div>
          <h2 className="section-title">Perché migliaia di studenti scelgono UniCalendar</h2>
        </div>

        <div className="features-bento-grid">
          <div className="bento-card bento-wide">
            <div className="bento-icon-box bg-blue-500/10 text-blue-400">
              <Layers size={24} />
            </div>
            <h3>Pianificazione Adattiva Continua</h3>
            <p>Se oggi hai un imprevisto o non riesci a studiare, UniCalendar non ti fa sentire in colpa: ridistribuisce in modo intelligente le pagine mancanti sui giorni successivi in frazioni di secondo.</p>
          </div>

          <div className="bento-card">
            <div className="bento-icon-box bg-purple-500/10 text-purple-400">
              <BrainCircuit size={24} />
            </div>
            <h3>Anki Flashcards Integrate</h3>
            <p>Non serve usare altre app separate. Crea e sfoglia le tue carte di memoria collegate direttamente al capitolo del corso.</p>
          </div>

          <div className="bento-card">
            <div className="bento-icon-box bg-amber-500/10 text-amber-400">
              <TrendingUp size={24} />
            </div>
            <h3>Previsione Scadenze & Esami</h3>
            <p>Visualizza chiaramente la linea del tempo fino al giorno della prova d'esame. Zero sorprese dell'ultimo minuto.</p>
          </div>

          <div className="bento-card">
            <div className="bento-icon-box bg-emerald-500/10 text-emerald-400">
              <ShieldCheck size={24} />
            </div>
            <h3>Crittografia Client-Side</h3>
            <p>I tuoi dati di studio e i tuoi appunti personali sono protetti con crittografia AES e memorizzati nel cloud Firebase in totale sicurezza.</p>
          </div>

          <div className="bento-card bento-wide">
            <div className="bento-icon-box bg-indigo-500/10 text-indigo-400">
              <GraduationCap size={24} />
            </div>
            <h3>Gestione Completa del Piano di Studi Universitario</h3>
            <p>Inserisci i corsi del semestre, specifica crediti formativi (CFU), orari delle lezioni in aula, testi consigliati e monitora la tua media ponderata.</p>
          </div>
        </div>
      </section>

      {/* Security & Cloud Section */}
      <section id="security" className="security-section">
        <GlassPanel className="security-banner">
          <div className="security-content">
            <div className="security-icon-circle">
              <ShieldCheck size={36} className="text-emerald-400" />
            </div>
            <div>
              <h3>Privacy Massima & Backup Automatico nel Cloud</h3>
              <p>
                Nessuna vendita di dati personali né pubblicità. Connessione sicura Google Firebase OAuth 2.0 con crittografia end-to-end locale. I tuoi dati restano tuoi, sincronizzati ovunque.
              </p>
            </div>
          </div>
          <button className="security-btn" onClick={() => setShowLoginModal(true)}>
            Inizia Ora Gratis
          </button>
        </GlassPanel>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-left">
            <div className="footer-brand">
              <Calendar size={20} className="text-blue-400" />
              <span>UniCalendar</span>
            </div>
            <p className="footer-tagline">
              Lo studio intelligente per universitari ambiziosi.
            </p>
          </div>
          <div className="footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacy Policy</a>
            <span>•</span>
            <button className="footer-login-link" onClick={() => setShowLoginModal(true)}>Accedi</button>
          </div>
        </div>
      </footer>

      {/* Login / Auth Modal Overlay */}
      {showLoginModal && (
        <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
          <div className="modal-card fade-in" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowLoginModal(false)}>✕</button>

            <div className="modal-icon-wrapper">
              <Calendar size={40} className="text-blue-500" />
            </div>

            <h2 className="modal-title">Accedi a UniCalendar</h2>
            <p className="modal-subtitle">
              Sincronizza i tuoi corsi, le flashcard e la pianificazione su tutti i tuoi dispositivi.
            </p>

            {error && (
              <div className="modal-error-box">
                {error}
              </div>
            )}

            <button 
              className="google-auth-btn"
              onClick={handleLogin}
              disabled={isLoading}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <span>{isLoading ? 'Accesso in corso...' : 'Continua con Google'}</span>
            </button>

            <div className="modal-privacy-note">
              Facendo l'accesso accetti la nostra{' '}
              <a href="#" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>
                Informativa sulla Privacy
              </a>.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
