import { useState, useEffect, useRef } from 'react';
import { CalendarIcon, Plus, Upload, Settings, Home as HomeIcon, LogOut, GraduationCap, Menu, X, Undo2, TrendingUp, MoreHorizontal, CheckSquare, BarChart3, Brain } from "lucide-react";

import { Calendar } from '../components/features/calendar/Calendar';

import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { EventFormModal } from '../components/features/events/EventFormModal';
import { ImportCalendarModal } from '../components/features/events/ImportCalendarModal';
import { TaskPanel } from '../components/features/tasks/TaskPanel';
import { CourseManager } from '../components/features/courses/CourseManager';
import { CatchUpMini } from '../components/features/dashboard/CatchUpIndicator';
import { StatisticsDashboard } from '../components/features/dashboard/StatisticsDashboard';
import { AnkiDashboard } from '../pages/AnkiDashboard';
import { authService } from '../core/mockBackend';

export function Home() {
  const navigate = useNavigate();
  const user = useAppStore(s => s.user);
  const undo = useAppStore(s => s.undo);
  const pastStates = useAppStore(s => s.pastStates);

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'tasks' | 'statistics' | 'anki'>('calendar');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const prevStatesLength = useRef(pastStates.length);

  useEffect(() => {
    if (pastStates.length > prevStatesLength.current) {
      setShowSnackbar(true);
      const timer = setTimeout(() => {
        setShowSnackbar(false);
      }, 4000);
      prevStatesLength.current = pastStates.length;
      return () => clearTimeout(timer);
    } else {
      setShowSnackbar(false);
      prevStatesLength.current = pastStates.length;
    }
  }, [pastStates.length]);

  const handleLogout = async () => {
    await authService.logout();
    navigate('/login');
  };

  return (
    <div className="layout-wrapper">

      {/* Mobile Top Bar */}
      <div className="mobile-topbar" style={{ justifyContent: 'center' }}>
        <div className="mobile-logo">
          <img src="/icon.jpg" alt="UniCalendar Logo" style={{ width: 24, height: 24, borderRadius: 6 }} />
          <span style={{ fontSize: '18px', fontWeight: 700 }}>UniCalendar</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/icon.jpg" alt="UniCalendar Logo" style={{ width: 28, height: 28, borderRadius: 6 }} />
          </div>
          <span className="sidebar-logo-text">UniCalendar</span>
        </div>

        {/* Create Event Button */}
        <div className="sidebar-actions">
          <button className="sidebar-create-btn" onClick={() => { setIsEventModalOpen(true); setSidebarOpen(false); }}>
            <Plus size={20} />
            <span>Crea Evento</span>
          </button>
          <button className="sidebar-action-btn" onClick={() => { setIsImportModalOpen(true); setSidebarOpen(false); }}>
            <Upload size={16} />
            <span>Importa .ics</span>
          </button>
          <button className="sidebar-action-btn" onClick={() => { setIsCourseModalOpen(true); setSidebarOpen(false); }}>
            <GraduationCap size={16} />
            <span>Gestisci Corsi</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <button className={`sidebar-nav-item ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => { setActiveTab('calendar'); setSidebarOpen(false); }}>
            <CalendarIcon size={20} /> Calendario
          </button>
          <button className={`sidebar-nav-item ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => { setActiveTab('tasks'); setSidebarOpen(false); }}>
            <HomeIcon size={20} /> Attività
          </button>
          <button className={`sidebar-nav-item ${activeTab === 'statistics' ? 'active' : ''}`} onClick={() => { setActiveTab('statistics'); setSidebarOpen(false); }}>
            <TrendingUp size={20} /> Statistiche
          </button>
          <button className={`sidebar-nav-item hide-on-mobile ${activeTab === 'anki' ? 'active' : ''}`} onClick={() => { setActiveTab('anki'); setSidebarOpen(false); }}>
            <img src="https://upload.wikimedia.org/wikipedia/commons/3/3d/Anki-icon.svg" alt="Anki" style={{ width: 20, height: 20, filter: 'grayscale(100%) brightness(200%)' }} /> Anki
          </button>
        </nav>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <button className="sidebar-nav-item" onClick={() => { navigate('/settings'); setSidebarOpen(false); }}>
            <Settings size={20} /> Impostazioni
          </button>
          {user && (
            <div className="sidebar-user">
              {user.photoURL && <img src={user.photoURL} alt="" className="sidebar-user-avatar" />}
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{user.name}</span>
                <span className="sidebar-user-email">{user.email}</span>
              </div>
            </div>
          )}
          <button className="sidebar-nav-item sidebar-logout" onClick={handleLogout}>
            <LogOut size={20} /> Esci
          </button>
        </div>
      </aside>

      {/* Overlay for mobile sidebar */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content */}
      <main className="main-content">
        <header className="main-header" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 className="main-title" style={{ margin: 0 }}>
            {activeTab === 'calendar' ? 'Calendario' : activeTab === 'tasks' ? 'Attività' : activeTab === 'statistics' ? 'Statistiche' : 'Studio Anki'}
          </h1>
        </header>

        <div className="main-body">
          {activeTab === 'calendar' && (
            <div className="calendar-layout">
              <div className="calendar-main">
                <Calendar />
              </div>
              <div className="calendar-sidebar">
                <CatchUpMini />
                <TaskPanel dailyGoalOnly={true} />
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="tasks-page">
              <TaskPanel />
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="statistics-page">
              <StatisticsDashboard />
            </div>
          )}

          {activeTab === 'anki' && (
            <div className="anki-page-wrapper">
              <AnkiDashboard />
            </div>
          )}
        </div>
      </main>

      {/* ═══ Mobile Bottom Navigation Bar ═══ */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-item ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          <span className="mobile-nav-icon"><CalendarIcon size={22} /></span>
          <span>Calendario</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <span className="mobile-nav-icon"><CheckSquare size={22} /></span>
          <span>Attività</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          <span className="mobile-nav-icon"><BarChart3 size={22} /></span>
          <span>Statistiche</span>
        </button>
        <button
          className={`mobile-nav-item hide-on-mobile ${activeTab === 'anki' ? 'active' : ''}`}
          onClick={() => setActiveTab('anki')}
        >
          <span className="mobile-nav-icon"><Brain size={22} /></span>
          <span>Anki</span>
        </button>
        <button
          className="mobile-nav-item"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="mobile-nav-icon"><MoreHorizontal size={22} /></span>
          <span>Altro</span>
        </button>
      </nav>

      {/* ═══ Mobile FAB (Floating Action Button) ═══ */}
      {activeTab !== 'statistics' && (
        <button
          className="mobile-fab"
          onClick={() => setIsEventModalOpen(true)}
          aria-label="Crea Evento"
        >
          <Plus size={28} />
        </button>
      )}

      {/* ═══ Modern Snackbar (Undo) ═══ */}
      {showSnackbar && pastStates.length > 0 && (
        <div className="modern-snackbar">
          <span className="snackbar-message">Modifica applicata</span>
          <button className="snackbar-action" onClick={() => { undo(); setShowSnackbar(false); }}>
            Annulla
          </button>
        </div>
      )}

      {/* Modals */}
      <EventFormModal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} />
      <ImportCalendarModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      <CourseManager isOpen={isCourseModalOpen} onClose={() => setIsCourseModalOpen(false)} />
    </div>
  );
}
