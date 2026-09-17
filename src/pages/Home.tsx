import React, { useState } from 'react';
import { CalendarIcon, BookOpen, Activity, Clock, Plus, Settings, Home as HomeIcon, LogOut, Upload } from 'lucide-react';
import { Calendar } from '../components/features/calendar/Calendar';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { EventFormModal } from '../components/features/events/EventFormModal';
import { ImportCalendarModal } from '../components/features/events/ImportCalendarModal';
import { EfficiencyDashboard } from '../components/features/dashboard/EfficiencyDashboard';

export function Home() {
  const navigate = useNavigate();
  const user = useAppStore(state => state.user);
  const tasks = useAppStore(state => state.tasks);
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  return (
    <div className="layout-wrapper animate-in fade-in duration-300">
      
      {/* Sidebar Authentic Google Style */}
      <aside className="sidebar">
        <div className="flex items-center gap-3 mb-10 px-4">
          <div className="p-2 bg-[var(--accent-primary)] rounded-xl text-white">
            <CalendarIcon size={24} />
          </div>
          <span className="font-bold text-xl text-[var(--text-primary)]">UniCalendar</span>
        </div>

        {/* Floating Action Button (Google Style) */}
        <div className="px-2 mb-4">
          <Button 
            variant="primary" 
            icon={<Plus size={20} />} 
            className="w-full py-3 shadow-md rounded-2xl bg-white text-[var(--accent-primary)] border border-[var(--border-color)] hover:bg-[var(--accent-secondary)]"
            onClick={() => setIsEventModalOpen(true)}
          >
            Crea Evento
          </Button>
        </div>
        
        <div className="px-2 mb-6">
          <Button 
            variant="ghost" 
            icon={<Upload size={20} />} 
            className="w-full py-2 shadow-sm rounded-xl text-[var(--text-secondary)] border border-[var(--border-color)] hover:bg-[var(--bg-hover)]"
            onClick={() => setIsImportModalOpen(true)}
          >
            Importa .ics
          </Button>
        </div>

        <nav className="flex flex-col gap-1 flex-1 px-3">
          <button className="flex items-center gap-4 px-4 py-2.5 rounded-r-full bg-[var(--accent-secondary)] text-[var(--accent-primary-hover)] text-sm font-medium transition-colors" style={{ width: 'calc(100% - 12px)' }}>
            <HomeIcon size={20} />
            Dashboard
          </button>
          <button className="flex items-center gap-4 px-4 py-2.5 rounded-r-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] text-sm font-medium transition-colors" style={{ width: 'calc(100% - 12px)' }} onClick={() => navigate('/settings')}>
            <Settings size={20} />
            Impostazioni
          </button>
        </nav>

        <div className="mt-auto px-3">
          <button className="flex items-center gap-4 px-4 py-2.5 rounded-r-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] text-sm font-medium transition-colors w-full" style={{ width: 'calc(100% - 12px)' }} onClick={() => navigate('/login')}>
            <LogOut size={20} />
            Esci
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="flex justify-between items-center mb-6 px-2">
          <h1 className="text-[28px] font-normal text-[var(--text-primary)]">Il tuo piano di studi</h1>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Calendar */}
          <div className="xl:col-span-2">
            <Calendar />
          </div>

          {/* Right Column: Analytics & Tasks */}
          <div className="flex flex-col gap-6">
            <EfficiencyDashboard />

            <GlassPanel className="flex-1">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-secondary)]">
                  <BookOpen size={18} />
                  PROSSIME ATTIVITÀ
                </div>
                <span className="text-xs bg-[var(--bg-secondary)] px-2 py-1 rounded-full border border-[var(--border-color)]">
                  Ordinate per Priorità
                </span>
              </div>
              
              <ul className="flex flex-col gap-3">
                {tasks.length === 0 ? (
                  <div className="text-center p-6 text-sm text-[var(--text-secondary)]">
                    Nessuna attività programmata.<br/>Importa il calendario o attendi la fine delle lezioni!
                  </div>
                ) : (
                  tasks.map(task => (
                    <li key={task.id} className="p-4 rounded-xl border border-[var(--border-color)] bg-white flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                      <div className="flex justify-between items-start">
                        <span className="font-medium text-sm text-[var(--text-primary)]">{task.title}</span>
                        {task.priorityScore > 50 ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fce8e6] text-[var(--accent-danger)]">URGENTE</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef7e0] text-[var(--accent-warning)]">MEDIA</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mt-1">
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          Stima: {task.estimatedDuration} min
                        </div>
                        {task.status === 'done' ? (
                          <span className="text-[var(--accent-success)] font-medium">Completata</span>
                        ) : (
                          <span className="text-[var(--accent-primary)] font-medium">Da fare</span>
                        )}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </GlassPanel>
          </div>
        </div>
      </main>

      {/* Modals */}
      <EventFormModal 
        isOpen={isEventModalOpen} 
        onClose={() => setIsEventModalOpen(false)} 
      />
      <ImportCalendarModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}
