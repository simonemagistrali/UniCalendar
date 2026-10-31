import { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  Target, 
  Sparkles, 
  ArrowRight, 
  Check, 
  Play, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight, 
  CheckSquare, 
  ShieldCheck, 
  BookOpen, 
  Wrench, 
  BarChart2, 
  Flame,
  Coffee
} from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { authService } from '../core/mockBackend';

type ActiveMockTab = 'calendar' | 'tasks' | 'catchup' | 'anki';

export function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveMockTab>('calendar');

  // Interactive Task state in "tasks" tab
  const [taskState, setTaskState] = useState([
    {
      id: '1',
      title: 'Seguire: Teorema spettrale e diagonalizzazione',
      course: 'Geometria e Algebra Lineare',
      color: '#4285f4',
      duration: 90,
      priority: 120,
      status: 'in_progress' as 'todo' | 'in_progress' | 'done',
      tag: 'IN CORSO',
      timeSlot: '09:00 - 10:30',
      isAi: true,
    },
    {
      id: '2',
      title: 'Esercizi Normalizzazione Boyce-Codd e 3NF',
      course: 'Basi di Dati',
      color: '#34a853',
      duration: 60,
      priority: 105,
      status: 'todo' as 'todo' | 'in_progress' | 'done',
      tag: 'URGENTE',
      timeSlot: 'Esame tra 8g',
      isAi: false,
    },
    {
      id: '3',
      title: 'Sistemare appunti: Scheduling CPU a priorità',
      course: 'Sistemi Operativi',
      color: '#ea4335',
      duration: 45,
      priority: 75,
      status: 'done' as 'todo' | 'in_progress' | 'done',
      tag: 'FATTO',
      timeSlot: '14:30 - 15:15',
      isAi: false,
    },
    {
      id: '4',
      title: 'Prep. esame: Simulazione prova d\'esame 2024',
      course: 'Analisi Matematica I',
      color: '#a142f4',
      duration: 120,
      priority: 95,
      status: 'todo' as 'todo' | 'in_progress' | 'done',
      tag: 'Scade tra 4g',
      isAi: false,
    }
  ]);

  // Toggle tasks in the interactive TaskPanel mock
  const handleToggleTaskStatus = (id: string) => {
    setTaskState(prev => prev.map(t => {
      if (t.id === id) {
        if (t.status === 'todo') return { ...t, status: 'in_progress', tag: 'IN CORSO' };
        if (t.status === 'in_progress') return { ...t, status: 'done', tag: 'FATTO' };
        return { ...t, status: 'todo', tag: 'DA FARE' };
      }
      return t;
    }));
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
    return (
      <div className="landing-page">
        {/* Topbar matching UniCalendar Layout */}
        <header className="landing-topbar">
          <div className="landing-brand">
            <img src="/icon.png" alt="UniCalendar Logo" className="landing-app-logo" />
            <span className="landing-brand-text">UniCalendar</span>
          </div>
          <div className="landing-topbar-actions">
            <Button variant="primary" onClick={() => setShowLogin(true)}>
              Accedi con Google <ArrowRight size={16} />
            </Button>
          </div>
        </header>

        {/* Hero Presentation */}
        <section className="landing-hero">
          <div className="landing-badge">
            <Sparkles size={16} />
            <span>La piattaforma integrata per gli studenti universitari</span>
          </div>
          
          <h1 className="landing-title">
            Studia in modo <span>Intelligente</span>, non di più.
          </h1>
          
          <p className="landing-description">
            UniCalendar pianifica l'intera sessione d'esami: calcola l'algoritmo delle priorità, incastra i viaggi e le lezioni in aula, e ti dice esattamente se sei in pari col professore.
          </p>
          
          <div className="landing-cta">
            <Button variant="primary" className="landing-btn-start" onClick={() => setShowLogin(true)}>
              Inizia Ora con Google <ArrowRight size={18} />
            </Button>
          </div>
        </section>

        {/* Realistic Interactive App Window Replica */}
        <section className="landing-showcase-section">
          <div className="real-app-window">
            {/* Real App Header Bar */}
            <div className="real-window-topbar">
              <div className="real-window-brand">
                <img src="/icon.png" alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />
                <span className="real-window-title">
                  {activeTab === 'calendar' && 'Calendario Orario Settimanale'}
                  {activeTab === 'tasks' && 'Pannello Attività & Priorità Intelligenti'}
                  {activeTab === 'catchup' && 'Stato di Recupero: Prof vs Io'}
                  {activeTab === 'anki' && 'Dashboard Anki Desktop Sincronizzata'}
                </span>
              </div>
              <div className="real-window-tabs">
                <button 
                  className={`real-tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
                  onClick={() => setActiveTab('calendar')}
                >
                  <CalendarIcon size={15} />
                  <span>Calendario</span>
                </button>
                <button 
                  className={`real-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('tasks')}
                >
                  <CheckSquare size={15} />
                  <span>Attività</span>
                </button>
                <button 
                  className={`real-tab-btn ${activeTab === 'catchup' ? 'active' : ''}`}
                  onClick={() => setActiveTab('catchup')}
                >
                  <TrendingUp size={15} />
                  <span>In Pari col Prof</span>
                </button>
                <button 
                  className={`real-tab-btn ${activeTab === 'anki' ? 'active' : ''}`}
                  onClick={() => setActiveTab('anki')}
                >
                  <img src="https://upload.wikimedia.org/wikipedia/commons/3/3d/Anki-icon.svg" alt="" style={{ width: 14, height: 14 }} />
                  <span>Anki</span>
                </button>
              </div>
            </div>

            {/* TAB 1: CALENDAR VIEW (True Calendar + Mini Sidebar Widget) */}
            {activeTab === 'calendar' && (
              <div className="real-body-calendar fade-in">
                <div className="calendar-main-pane">
                  {/* Calendar Top Controls */}
                  <div className="real-cal-header">
                    <div className="real-cal-title-group">
                      <h3 className="real-cal-month">Novembre 2026</h3>
                      <div className="real-cal-nav-group">
                        <button className="real-cal-nav-btn"><ChevronLeft size={16} /></button>
                        <button className="real-cal-today-btn">Oggi</button>
                        <button className="real-cal-nav-btn"><ChevronRight size={16} /></button>
                      </div>
                    </div>
                    <div className="real-cal-view-badge">
                      Vista Settimana (Orari & Slot Studio)
                    </div>
                  </div>

                  {/* 3-Day Column Grid matching Calendar.tsx */}
                  <div className="real-week-columns">
                    {/* Lunedì */}
                    <div className="real-day-column">
                      <div className="real-day-header">
                        <span className="real-day-label">LUN</span>
                        <span className="real-day-num">2</span>
                      </div>
                      <div className="real-events-stack">
                        {/* Travel In Event */}
                        <div className="real-event-box travel">
                          <span className="event-time">08:15 - 08:45</span>
                          <strong>🚆 Treno / Spostamento verso Uni</strong>
                        </div>
                        {/* Lecture Event */}
                        <div className="real-event-box lecture" style={{ borderLeftColor: '#4285f4' }}>
                          <span className="event-time">09:00 - 11:00</span>
                          <strong>Analisi Matematica I</strong>
                          <span className="event-loc">Aula Magna • Prof. De Rossi</span>
                        </div>
                        {/* Buffer / Pausa */}
                        <div className="real-event-box buffer">
                          <span className="event-time">13:00 - 14:00</span>
                          <span><Coffee size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Pausa pranzo</span>
                        </div>
                        {/* Study Session generated by scheduler */}
                        <div className="real-event-box study" style={{ borderLeftColor: '#4285f4' }}>
                          <span className="event-time">14:30 - 16:30</span>
                          <strong>Studio: Limiti e Continuità</strong>
                          <span className="event-loc">Slot schedulato (120 min)</span>
                        </div>
                      </div>
                    </div>

                    {/* Martedì (Active Today) */}
                    <div className="real-day-column today">
                      <div className="real-day-header active">
                        <span className="real-day-label">MAR</span>
                        <span className="real-day-num active">3 (Oggi)</span>
                      </div>
                      <div className="real-events-stack">
                        <div className="real-event-box lecture" style={{ borderLeftColor: '#34a853' }}>
                          <span className="event-time">10:00 - 13:00</span>
                          <strong>Basi di Dati (Laboratorio)</strong>
                          <span className="event-loc">Lab Turing 2 • Esercizi SQL</span>
                        </div>
                        {/* Urgent Task Card placed on calendar */}
                        <div className="real-event-box study active-task" style={{ borderLeftColor: '#ea4335' }}>
                          <span className="event-time">15:00 - 16:30</span>
                          <strong>Studio: Transazioni ACID e Concorrenza</strong>
                          <span className="event-loc">Priorità automatica calcolata</span>
                        </div>
                        <div className="real-event-box anki-session" style={{ borderLeftColor: '#818cf8' }}>
                          <span className="event-time">17:00 - 17:45</span>
                          <strong>Deck Anki: Concetti Basi di Dati</strong>
                          <span className="event-loc">35 carte in coda</span>
                        </div>
                      </div>
                    </div>

                    {/* Mercoledì */}
                    <div className="real-day-column">
                      <div className="real-day-header">
                        <span className="real-day-label">MER</span>
                        <span className="real-day-num">4</span>
                      </div>
                      <div className="real-events-stack">
                        <div className="real-event-box lecture" style={{ borderLeftColor: '#ea4335' }}>
                          <span className="event-time">11:00 - 13:00</span>
                          <strong>Sistemi Operativi</strong>
                          <span className="event-loc">Aula 3B</span>
                        </div>
                        <div className="real-event-box deadline" style={{ borderLeftColor: '#d93025' }}>
                          <span className="event-time">23:59</span>
                          <strong>⚠️ Scadenza Consegna Progetto 1</strong>
                          <span className="event-loc">Caricamento su portale</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Real Calendar Right Sidebar (Deadlines & CatchUp Mini) */}
                <div className="calendar-side-pane">
                  {/* Deadlines Widget Replica */}
                  <div className="side-widget-box">
                    <div className="side-widget-header">
                      <span className="side-widget-title">Scadenze e Verifiche</span>
                      <span className="side-badge">2 in arrivo</span>
                    </div>
                    <div className="side-deadlines-list">
                      <div className="side-deadline-item urgent">
                        <div className="deadline-bullet" style={{ background: '#d93025' }} />
                        <div className="deadline-texts">
                          <strong>Parziale Scritto Basi di Dati</strong>
                          <span>12 Nov 2026 • tra 9 giorni</span>
                        </div>
                      </div>
                      <div className="side-deadline-item">
                        <div className="deadline-bullet" style={{ background: '#f29900' }} />
                        <div className="deadline-texts">
                          <strong>Consegna Relazione Lab</strong>
                          <span>18 Nov 2026 • tra 15 giorni</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* CatchUp Mini Widget Replica */}
                  <div className="side-widget-box">
                    <div className="side-widget-header">
                      <span className="side-widget-title">Recupero Corsi</span>
                      <span className="side-badge text-success">85% in pari</span>
                    </div>
                    <div className="side-catchup-item">
                      <div className="course-name-row">
                        <span className="course-dot" style={{ background: '#4285f4' }} />
                        <strong>Analisi Matematica</strong>
                      </div>
                      <span className="course-gap in-sync">In pari col prof! ✨</span>
                    </div>
                    <div className="side-catchup-item">
                      <div className="course-name-row">
                        <span className="course-dot" style={{ background: '#34a853' }} />
                        <strong>Basi di Dati</strong>
                      </div>
                      <span className="course-gap behind">1 lezione da recuperare</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TASK PANEL & PRIORITY ENGINE (Real TaskCard.tsx Replica) */}
            {activeTab === 'tasks' && (
              <div className="real-body-tasks fade-in">
                <div className="tasks-control-bar">
                  <div className="daily-goal-banner">
                    <Flame size={18} className="text-orange" />
                    <span><strong>Obiettivo Giornaliero:</strong> 1 completato su 3 previsti per oggi</span>
                  </div>
                  <div className="task-filters-row">
                    <span className="filter-pill active">Da Fare ({taskState.filter(t => t.status !== 'done').length})</span>
                    <span className="filter-pill">Completati ({taskState.filter(t => t.status === 'done').length})</span>
                    <span className="filter-pill">Tutti i Corsi</span>
                  </div>
                </div>

                <div className="real-tasks-list">
                  {taskState.map(task => (
                    <div 
                      key={task.id} 
                      className={`real-task-card ${task.status === 'done' ? 'is-done' : ''}`}
                      onClick={() => handleToggleTaskStatus(task.id)}
                    >
                      <div className="task-card-main-row">
                        <div className="task-checkbox-wrapper">
                          <input 
                            type="checkbox" 
                            checked={task.status === 'done'} 
                            onChange={() => handleToggleTaskStatus(task.id)}
                            className="real-task-chk" 
                          />
                        </div>
                        <div className="task-info-block">
                          <div className="task-title-line">
                            <span className="task-course-dot" style={{ backgroundColor: task.color }} />
                            <strong className={`task-title-text ${task.status === 'done' ? 'line-through' : ''}`}>
                              {task.title}
                            </strong>
                          </div>
                          <div className="task-meta-line">
                            <span>{task.course}</span>
                            <span>•</span>
                            <span><Clock size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /> {task.duration} min</span>
                            <span>•</span>
                            <span className="priority-score-text">Punteggio Priorità: <strong>{task.priority}</strong></span>
                          </div>
                        </div>

                        <div className="task-badge-container">
                          {task.isAi && (
                            <span className="task-badge ai-badge">
                              <Sparkles size={11} /> AI
                            </span>
                          )}
                          {task.status === 'in_progress' && (
                            <span className="task-badge in-progress-badge">
                              <Play size={10} /> IN CORSO
                            </span>
                          )}
                          {task.status === 'todo' && task.priority >= 100 && (
                            <span className="task-badge urgent-badge">
                              <AlertTriangle size={11} /> URGENTE
                            </span>
                          )}
                          {task.status === 'todo' && task.priority < 100 && (
                            <span className="task-badge normal-badge">
                              {task.tag}
                            </span>
                          )}
                          {task.status === 'done' && (
                            <span className="task-badge done-badge">
                              <Check size={11} /> FATTO
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="tasks-explainer-footer">
                  <Sparkles size={14} className="text-primary" />
                  <span>UniCalendar ricalcola i punteggi di priorità ogni volta che completi o salti un task, garantendo di non accumulare ritardi prima degli appelli.</span>
                </div>
              </div>
            )}

            {/* TAB 3: PROF VS IO / CATCHUP ENGINE (Real CatchUpIndicator.tsx Replica) */}
            {activeTab === 'catchup' && (
              <div className="real-body-catchup fade-in">
                <div className="catchup-intro-bar">
                  <h4>Confronto Avanzamento Programma (Professore vs Tuo Studio)</h4>
                  <p>Il motore analizza le lezioni universitarie svolte dal docente e traccia lo stato effettivo di appunti ed esercizi completati da te.</p>
                </div>

                <div className="catchup-cards-grid">
                  {/* Course 1: In Sync */}
                  <div className="catchup-course-card in-sync">
                    <div className="catchup-card-top">
                      <div className="course-title-block">
                        <span className="course-badge-dot" style={{ background: '#4285f4' }} />
                        <h5>Analisi Matematica I</h5>
                      </div>
                      <span className="sync-chip in-sync">In pari col prof! ✨</span>
                    </div>

                    <div className="prof-vs-student-grid">
                      <div className="prof-box">
                        <span className="box-role">👨‍🏫 Prof</span>
                        <div className="box-lesson-topic">#18 · Teorema di De L'Hôpital</div>
                        <span className="box-sub">Ultima spiegata ieri</span>
                      </div>
                      <div className="student-box">
                        <span className="box-role">🎯 Tu</span>
                        <div className="box-lesson-topic">#18 · Teorema di De L'Hôpital</div>
                        <span className="box-sub text-success">Appunti e teoria svolti</span>
                      </div>
                    </div>

                    <div className="track-badges-row">
                      <span className="track-chip text-success"><BookOpen size={13} /> Teoria: 18/18 (100%)</span>
                      <span className="track-chip text-success"><Wrench size={13} /> Esercizi: 12/12</span>
                    </div>
                  </div>

                  {/* Course 2: 2 Lessons Behind */}
                  <div className="catchup-course-card behind">
                    <div className="catchup-card-top">
                      <div className="course-title-block">
                        <span className="course-badge-dot" style={{ background: '#34a853' }} />
                        <h5>Basi di Dati</h5>
                      </div>
                      <span className="sync-chip behind">2 lezioni indietro</span>
                    </div>

                    <div className="prof-vs-student-grid">
                      <div className="prof-box">
                        <span className="box-role">👨‍🏫 Prof</span>
                        <div className="box-lesson-topic">#14 · Trigger e Procedure PL/SQL</div>
                        <span className="box-sub">Lezione di questa mattina</span>
                      </div>
                      <div className="student-box">
                        <span className="box-role">🎯 Tu</span>
                        <div className="box-lesson-topic">#12 · Progettazione Concettuale ER</div>
                        <span className="box-sub text-danger">Da recuperare: #13, #14</span>
                      </div>
                    </div>

                    <div className="track-badges-row">
                      <span className="track-chip text-danger"><BookOpen size={13} /> Teoria: 12/14 (-2 lezioni)</span>
                      <span className="track-chip text-warning"><Wrench size={13} /> Esercizi: 8/10</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: REAL ANKI DASHBOARD (AnkiDashboard.tsx Replica) */}
            {activeTab === 'anki' && (
              <div className="real-body-anki fade-in">
                <div className="anki-dashboard-header">
                  <div className="anki-brand-line">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/3/3d/Anki-icon.svg" alt="Anki" style={{ width: 22, height: 22 }} />
                    <h4>Sincronizzazione Anki Desktop Connect</h4>
                    <span className="anki-status-pill connected">● Connesso</span>
                  </div>
                  <span className="anki-last-sync">Ultima sincronizzazione automatica: 12 minuti fa</span>
                </div>

                <div className="anki-metrics-row">
                  <div className="anki-kpi-card">
                    <span className="kpi-title">Da Fare Oggi (Totale)</span>
                    <strong className="kpi-number">48 <small>carte</small></strong>
                    <div className="kpi-sub-breakdown">
                      <span className="sub-new">8 Nuove</span> • <span className="sub-due">40 Ripassi</span>
                    </div>
                  </div>

                  <div className="anki-kpi-card">
                    <span className="kpi-title">Tempo Previsto</span>
                    <strong className="kpi-number text-primary">18 <small>minuti</small></strong>
                    <span className="kpi-sub-breakdown">Velocità: 22.5s / carta</span>
                  </div>

                  <div className="anki-kpi-card">
                    <span className="kpi-title">Studiate Oggi</span>
                    <strong className="kpi-number text-success">35 <small>completate</small></strong>
                    <span className="kpi-sub-breakdown">14 minuti di studio</span>
                  </div>
                </div>

                {/* Simulated Chart from Anki Dashboard */}
                <div className="anki-chart-mock">
                  <div className="chart-header-line">
                    <span className="chart-title"><BarChart2 size={16} /> Andamento Ripetizioni Ultimi 7 Giorni</span>
                    <span className="chart-legend-badge">Carte studiate per giorno</span>
                  </div>
                  <div className="anki-bars-visual">
                    <div className="bar-col"><div className="bar-fill" style={{ height: '40%' }}><span>32</span></div><small>Mer</small></div>
                    <div className="bar-col"><div className="bar-fill" style={{ height: '65%' }}><span>54</span></div><small>Gio</small></div>
                    <div className="bar-col"><div className="bar-fill" style={{ height: '50%' }}><span>40</span></div><small>Ven</small></div>
                    <div className="bar-col"><div className="bar-fill" style={{ height: '20%' }}><span>15</span></div><small>Sab</small></div>
                    <div className="bar-col"><div className="bar-fill" style={{ height: '30%' }}><span>22</span></div><small>Dom</small></div>
                    <div className="bar-col"><div className="bar-fill" style={{ height: '80%' }}><span>68</span></div><small>Ieri</small></div>
                    <div className="bar-col active-today"><div className="bar-fill" style={{ height: '45%' }}><span>35</span></div><small>Oggi</small></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Core Pillars */}
        <section className="landing-features">
          <GlassPanel className="feature-card">
            <div className="feature-icon"><Target size={26} /></div>
            <h3>Priorità Automatiche</h3>
            <p>L'app analizza scadenze, difficoltà dei corsi e crediti (CFU) per dirti ogni giorno esattamente su cosa concentrarti prima.</p>
          </GlassPanel>

          <GlassPanel className="feature-card">
            <div className="feature-icon"><CalendarIcon size={26} /></div>
            <h3>Calendario & Orario Ateneo</h3>
            <p>Importa il calendario .ICS della tua università: l'app calcola spostamenti, pause pranzo e inserisce lo studio negli slot liberi.</p>
          </GlassPanel>

          <GlassPanel className="feature-card">
            <div className="feature-icon"><TrendingUp size={26} /></div>
            <h3>Stato di Recupero Prof</h3>
            <p>Visualizza in ogni istante a quale lezione è arrivato il docente e quante ne hai svolte tu, azzerando i ritardi prima degli esami.</p>
          </GlassPanel>
        </section>

        {/* Security & Privacy Banner */}
        <section className="landing-security-note">
          <div className="security-note-content">
            <ShieldCheck size={20} className="text-success" />
            <span>Sincronizzazione cloud sicura Google Firebase con crittografia end-to-end. Nessun dato venduto o tracciato.</span>
          </div>
        </section>

        {/* Simple Footer */}
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
