import React, { useState } from 'react';
import { CalendarIcon, BookOpen, Activity, Clock, Plus, Settings, Home as HomeIcon, LogOut, Upload } from 'lucide-react';
import { Calendar } from '../components/features/calendar/Calendar';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { EventFormModal } from '../components/features/events/EventFormModal';

export function Home() {
  const navigate = useNavigate();
  const user = useAppStore(state => state.user);
  
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
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
        <div className="px-2 mb-6">
          <Button 
            variant="primary" 
            icon={<Plus size={20} />} 
            className="w-full py-3 shadow-md rounded-2xl bg-white text-[var(--accent-primary)] border border-[var(--border-color)] hover:bg-[var(--accent-secondary)]"
            onClick={() => setIsEventModalOpen(true)}
          >
            Crea Evento
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
            <GlassPanel className="p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-secondary mb-4 uppercase tracking-wider">
                <Activity size={18} />
                Statistiche Efficienza
              </div>
              <div className="flex items-end gap-2">
                <span className="text-[40px] leading-none font-normal text-[var(--accent-primary)]">86%</span>
                <span className="text-[var(--accent-success)] text-sm font-medium mb-1 bg-[#e6f4ea] px-2 py-0.5 rounded">+2% questa sett.</span>
              </div>
              <p className="text-muted text-sm mt-4 border-t border-[var(--border-color)] pt-3">Ottimo lavoro! Stai rispettando le stime temporali calcolate dall'algoritmo.</p>
            </GlassPanel>

            <GlassPanel className="flex-1 p-0 overflow-hidden">
              <div className="flex items-center gap-2 text-sm font-medium text-secondary p-5 pb-2 uppercase tracking-wider border-b border-[var(--border-color)]">
                <BookOpen size={18} />
                Prossime Attività
              </div>
              
              <ul className="flex flex-col">
                <li className="p-4 border-b border-[var(--border-color)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-[var(--text-primary)]">Esercizi Analisi I</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#fce8e6] text-[var(--accent-danger)]">URGENTE</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                    <Clock size={14} />
                    Scadenza: Esame tra 10 giorni
                  </div>
                </li>
                
                <li className="p-4 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-[var(--text-primary)]">Sistemazione Appunti Fisica II</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-[#fef7e0] text-[var(--accent-warning)]">MEDIA</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                    <Clock size={14} />
                    Tempo stimato: 1h 30m
                  </div>
                </li>
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
    </div>
  );
}
