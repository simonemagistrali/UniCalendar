import { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  BrainCircuit, 
  Target, 
  Sparkles, 
  ArrowRight, 
  CheckCircle2, 
  TrendingUp, 
  Flame, 
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { authService } from '../core/mockBackend';

type FeaturePreviewTab = 'priority' | 'anki' | 'calendar' | 'stats';

export function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState<FeaturePreviewTab>('priority');

  // Interactive demo state in Priority preview
  const [demoTasks, setDemoTasks] = useState([
    { id: '1', title: 'Teorema di Cauchy e Successioni', course: 'Analisi Matematica I', urgency: 'Oggi', score: '9.8', done: false },
    { id: '2', title: 'Normalizzazione 3NF e Boyce-Codd', course: 'Basi di Dati', urgency: 'Domani', score: '8.4', done: true },
    { id: '3', title: 'Circuiti sequenziali e flip-flop', course: 'Architettura degli Elaboratori', urgency: 'In scadenza', score: '6.9', done: false },
  ]);

  // Interactive flashcard flip in Anki tab
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardRating, setCardRating] = useState<string | null>(null);

  // Auto rotate preview tabs
  useEffect(() => {
    const tabs: FeaturePreviewTab[] = ['priority', 'anki', 'calendar', 'stats'];
    const timer = setInterval(() => {
      setActiveTab((curr) => {
        const nextIndex = (tabs.indexOf(curr) + 1) % tabs.length;
        return tabs[nextIndex];
      });
      setCardFlipped(false);
      setCardRating(null);
    }, 6000);

    return () => clearInterval(timer);
  }, []);

  const handleToggleTask = (id: string) => {
    setDemoTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

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
        setError('Login annullato. Riprova.');
      } else {
        setError('Errore durante il login. Verifica la configurazione Firebase.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!showLogin) {
    const completedCount = demoTasks.filter(t => t.done).length;
    const progressPercent = Math.round((completedCount / demoTasks.length) * 100);

    return (
      <div className="landing-page">
        {/* Header Bar */}
        <header className="landing-topbar">
          <div className="landing-brand">
            <img src="/icon.png" alt="UniCalendar Logo" className="landing-app-logo" />
            <span className="landing-brand-text">UniCalendar</span>
          </div>
          <div className="landing-topbar-actions">
            <Button variant="primary" onClick={() => setShowLogin(true)}>
              Accedi <ArrowRight size={16} />
            </Button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="landing-hero">
          <div className="landing-badge">
            <Sparkles size={16} />
            <span>Organizzazione accademica intelligente</span>
          </div>
          
          <h1 className="landing-title">
            Studia in modo <span>Intelligente</span>, non di più.
          </h1>
          
          <p className="landing-description">
            UniCalendar pianifica la tua preparazione per ogni esame: calcola le priorità giornaliere in automatico, sincronizza il tuo orario accademico e integra flashcard Anki con ripetizione dilazionata.
          </p>
          
          <div className="landing-cta">
            <Button variant="primary" className="landing-btn-start" onClick={() => setShowLogin(true)}>
              Accedi con Google <ArrowRight size={18} />
            </Button>
          </div>
        </section>

        {/* Live Interactive App Showcase (Matching Home design language) */}
        <section className="landing-showcase-section">
          <GlassPanel className="landing-showcase-container">
            {/* Window / App Bar */}
            <div className="showcase-nav-tabs">
              <button 
                className={`showcase-tab ${activeTab === 'priority' ? 'active' : ''}`}
                onClick={() => { setActiveTab('priority'); setCardFlipped(false); }}
              >
                <Target size={16} />
                <span>Attività e Priorità</span>
              </button>
              <button 
                className={`showcase-tab ${activeTab === 'anki' ? 'active' : ''}`}
                onClick={() => { setActiveTab('anki'); setCardFlipped(false); }}
              >
                <BrainCircuit size={16} />
                <span>Anki Spaced Repetition</span>
              </button>
              <button 
                className={`showcase-tab ${activeTab === 'calendar' ? 'active' : ''}`}
                onClick={() => { setActiveTab('calendar'); setCardFlipped(false); }}
              >
                <CalendarIcon size={16} />
                <span>Calendario Lezioni</span>
              </button>
              <button 
                className={`showcase-tab ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={() => { setActiveTab('stats'); setCardFlipped(false); }}
              >
                <TrendingUp size={16} />
                <span>Proiezioni & Statistiche</span>
              </button>
            </div>

            {/* Showcase Stage Body */}
            <div className="showcase-body">
              {activeTab === 'priority' && (
                <div className="showcase-pane fade-in">
                  <div className="showcase-pane-header">
                    <div>
                      <h4 className="showcase-pane-title">Priorità Calcolate di Oggi</h4>
                      <p className="showcase-pane-desc">L'algoritmo riordina automaticamente gli argomenti in base ai giorni all'esame, alla complessità e allo stato di ripasso.</p>
                    </div>
                    <div className="showcase-metric-chip">
                      <Flame size={16} className="text-orange" />
                      <span>{completedCount}/{demoTasks.length} Completati ({progressPercent}%)</span>
                    </div>
                  </div>

                  <div className="showcase-task-list">
                    {demoTasks.map(task => (
                      <div 
                        key={task.id} 
                        className={`showcase-task-row ${task.done ? 'task-done' : ''}`}
                        onClick={() => handleToggleTask(task.id)}
                      >
                        <div className={`showcase-checkbox ${task.done ? 'checked' : ''}`}>
                          {task.done && <CheckCircle2 size={16} />}
                        </div>
                        <div className="showcase-task-info">
                          <span className="showcase-task-name">{task.title}</span>
                          <span className="showcase-task-sub">{task.course} • Priorità score: <strong>{task.score}</strong></span>
                        </div>
                        <span className={`showcase-tag ${task.done ? 'tag-done' : 'tag-urgent'}`}>
                          {task.done ? 'Completato' : task.urgency}
                        </span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="showcase-hint">
                    <Sparkles size={14} />
                    <span>Suggerimento: tocca le attività per simulare il completamento del programma di oggi.</span>
                  </div>
                </div>
              )}

              {activeTab === 'anki' && (
                <div className="showcase-pane fade-in">
                  <div className="showcase-pane-header">
                    <div>
                      <h4 className="showcase-pane-title">Ripetizione Dilazionata (Algoritmo SM-2)</h4>
                      <p className="showcase-pane-desc">Fissa i concetti chiave prima dell'esame senza dimenticarli: UniCalendar calcola l'intervallo ideale di ripasso.</p>
                    </div>
                    <div className="showcase-deck-counters">
                      <span className="deck-pill new">Nuove: 8</span>
                      <span className="deck-pill due">In ripasso: 14</span>
                    </div>
                  </div>

                  <div className="showcase-anki-card" onClick={() => setCardFlipped(!cardFlipped)}>
                    <div className="showcase-card-header">
                      <span className="showcase-card-course">Sistemi Operativi</span>
                      <span className="showcase-card-flip-prompt">
                        <RotateCcw size={12} /> {cardFlipped ? 'Mostra domanda' : 'Tocca per girare'}
                      </span>
                    </div>
                    
                    {!cardFlipped ? (
                      <div className="showcase-card-question">
                        <h5>Qual è la differenza principale tra Semaforo e Mutex?</h5>
                        <p className="showcase-subtext">Concetto fondamentale di sincronizzazione dei processi.</p>
                      </div>
                    ) : (
                      <div className="showcase-card-answer">
                        <h5>Risposta corretta:</h5>
                        <p>Il <strong>Mutex</strong> ha ownership (solo il thread che lo acquisisce può rilasciarlo). Il <strong>Semaforo</strong> è un meccanismo di segnalazione generale tra thread.</p>
                        
                        <div className="showcase-anki-buttons" onClick={e => e.stopPropagation()}>
                          <button className={`anki-action-btn btn-again ${cardRating === 'again' ? 'selected' : ''}`} onClick={() => setCardRating('again')}>
                            Ripeti <small>&lt; 1 min</small>
                          </button>
                          <button className={`anki-action-btn btn-hard ${cardRating === 'hard' ? 'selected' : ''}`} onClick={() => setCardRating('hard')}>
                            Difficile <small>10 min</small>
                          </button>
                          <button className={`anki-action-btn btn-good ${cardRating === 'good' ? 'selected' : ''}`} onClick={() => setCardRating('good')}>
                            Buono <small>1 giorno</small>
                          </button>
                          <button className={`anki-action-btn btn-easy ${cardRating === 'easy' ? 'selected' : ''}`} onClick={() => setCardRating('easy')}>
                            Facile <small>4 giorni</small>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="showcase-pane fade-in">
                  <div className="showcase-pane-header">
                    <div>
                      <h4 className="showcase-pane-title">Sincronizzazione Orari & Lezioni</h4>
                      <p className="showcase-pane-desc">Importa file orario (.ics) della tua Università e vedi esattamente il tempo reale disponibile per lo studio.</p>
                    </div>
                  </div>

                  <div className="showcase-calendar-preview">
                    <div className="showcase-cal-col">
                      <div className="cal-col-header">Lunedì</div>
                      <div className="cal-event-card lecture">
                        <span className="cal-time">09:00 - 11:00</span>
                        <strong>Lezione: Calcolo Numerico</strong>
                        <span className="cal-location">Aula 3B • Prof. Rossi</span>
                      </div>
                      <div className="cal-event-card study">
                        <span className="cal-time">14:00 - 16:30</span>
                        <strong>Sessione Studio</strong>
                        <span className="cal-location">25 pag. Algoritmi</span>
                      </div>
                    </div>

                    <div className="showcase-cal-col current-day">
                      <div className="cal-col-header active">Martedì (Oggi)</div>
                      <div className="cal-event-card lecture active-lecture">
                        <span className="cal-time">10:00 - 13:00</span>
                        <strong>Lab: Reti di Calcolatori</strong>
                        <span className="cal-location">Lab Turing</span>
                      </div>
                      <div className="cal-event-card anki-session">
                        <span className="cal-time">16:00 - 17:00</span>
                        <strong>Ripasso Anki (35 carte)</strong>
                        <span className="cal-location">Biblioteca</span>
                      </div>
                    </div>

                    <div className="showcase-cal-col">
                      <div className="cal-col-header">Mercoledì</div>
                      <div className="cal-event-card study">
                        <span className="cal-time">09:30 - 12:30</span>
                        <strong>Simulazione Prova d'Esame</strong>
                        <span className="cal-location">Esercizi tema 2025</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'stats' && (
                <div className="showcase-pane fade-in">
                  <div className="showcase-pane-header">
                    <div>
                      <h4 className="showcase-pane-title">Predizione Completamento & Readiness</h4>
                      <p className="showcase-pane-desc">Previsione statistica che ti indica se sei in pari con il programma prima della data d'appello.</p>
                    </div>
                  </div>

                  <div className="showcase-stats-grid">
                    <div className="stat-card-preview">
                      <span className="stat-label">Ritmo Giornaliero</span>
                      <strong className="stat-val">18.5 <small>pag/giorno</small></strong>
                      <span className="stat-status text-success">Ottimo passo (+12%)</span>
                    </div>
                    <div className="stat-card-preview">
                      <span className="stat-label">Pagine Rimanenti</span>
                      <strong className="stat-val">142 <small>/ 380</small></strong>
                      <span className="stat-status">Progresso 63%</span>
                    </div>
                    <div className="stat-card-preview">
                      <span className="stat-label">Completamento Previsto</span>
                      <strong className="stat-val text-primary">4 giorni prima</strong>
                      <span className="stat-status text-success">Margine per ripasso</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassPanel>
        </section>

        {/* 3 Core Pillars (Clean Google/Material Style matching the app) */}
        <section className="landing-features">
          <GlassPanel className="feature-card">
            <div className="feature-icon"><Target size={26} /></div>
            <h3>Priorità Automatiche</h3>
            <p>Non sai da dove iniziare? L'app calcola per te su cosa devi concentrarti oggi per non restare indietro con i crediti formativi (CFU).</p>
          </GlassPanel>

          <GlassPanel className="feature-card">
            <div className="feature-icon"><CalendarIcon size={26} /></div>
            <h3>Pianificazione Smart</h3>
            <p>Distribuisci il carico di studio in base ai giorni disponibili e alle pagine da preparare. Importa i calendari .ICS dell'Ateneo in un clic.</p>
          </GlassPanel>

          <GlassPanel className="feature-card">
            <div className="feature-icon"><BrainCircuit size={26} /></div>
            <h3>Metodo Spaced Repetition</h3>
            <p>Massimizza la memorizzazione a lungo termine con il sistema di ripetizione dilazionata integrato (stile Anki) sincronizzato per corso.</p>
          </GlassPanel>
        </section>

        {/* Cloud & Security note */}
        <section className="landing-security-note">
          <div className="security-note-content">
            <ShieldCheck size={20} className="text-success" />
            <span>Sincronizzazione su Google Firebase con crittografia end-to-end locale. I tuoi dati restano privati e sicuri.</span>
          </div>
        </section>

        {/* Footer */}
        <footer className="landing-footer-simple">
          <span>UniCalendar • Il gestionale per lo studio universitario</span>
          <div className="landing-footer-links">
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }}>Privacy Policy</a>
            <span>•</span>
            <a href="#" onClick={(e) => { e.preventDefault(); setShowLogin(true); }}>Accedi</a>
          </div>
        </footer>
      </div>
    );
  }

  // Login View
  return (
    <div className="login-page">
      <GlassPanel className="login-card fade-in">
        <div className="login-icon-wrapper" style={{ background: 'transparent' }}>
          <img src="/icon.png" alt="UniCalendar Logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
        </div>
        <h1 className="login-title">Bentornato</h1>
        <p className="login-subtitle">
          Accedi al tuo account UniCalendar per riprendere lo studio.
        </p>

        {error && (
          <div className="login-error">{error}</div>
        )}

        <Button
          variant="primary"
          className="login-btn"
          onClick={handleLogin}
          disabled={isLoading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {isLoading ? 'Accesso in corso...' : 'Accedi con Google'}
        </Button>
        
        <div style={{ marginTop: '16px' }}>
          <Button variant="secondary" className="login-btn" onClick={() => setShowLogin(false)} disabled={isLoading}>
            Torna alla pagina iniziale
          </Button>
        </div>

        <p className="login-footer">
          I tuoi dati vengono sincronizzati in modo sicuro su cloud con crittografia.
          <br />
          Continuando accetti la nostra{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }} style={{ color: 'var(--accent-primary)', textDecoration: 'underline' }}>
            Privacy Policy
          </a>.
        </p>
      </GlassPanel>
    </div>
  );
}
