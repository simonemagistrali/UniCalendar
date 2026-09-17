import React from 'react';
import { CalendarIcon, BookOpen, Activity, Clock, Plus, Settings, Home as HomeIcon, LogOut } from 'lucide-react';
import { Calendar } from '../components/features/calendar/Calendar';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="layout-wrapper animate-in fade-in duration-300">
      
      {/* Sidebar Google Style */}
      <aside className="sidebar">
        <div className="flex items-center gap-3 mb-10 px-4">
          <div className="p-2 bg-[var(--accent-primary)] rounded-xl text-white">
            <CalendarIcon size={24} />
          </div>
          <span className="font-bold text-xl text-[var(--text-primary)]">UniCalendar</span>
        </div>

        {/* Floating Action Button (Google Style) */}
        <div className="px-2 mb-6">
          <Button variant="primary" icon={<Plus size={20} />} className="w-full py-3 shadow-md rounded-2xl bg-white text-[var(--accent-primary)] border border-[var(--border-color)] hover:bg-[var(--accent-secondary)]">
            Crea Evento
          </Button>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <button className="flex items-center gap-3 px-4 py-3 rounded-full bg-[var(--accent-secondary)] text-[var(--accent-primary)] text-sm font-medium transition-colors">
            <HomeIcon size={20} />
            Dashboard
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors" onClick={() => navigate('/settings')}>
            <Settings size={20} />
            Impostazioni
          </button>
        </nav>

        <div className="mt-auto">
          <button className="flex items-center gap-3 px-4 py-3 rounded-full text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] text-sm font-medium w-full transition-colors" onClick={() => navigate('/login')}>
            <LogOut size={20} />
            Esci
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-medium text-[var(--text-primary)]">Il tuo piano di studi</h1>
            <p className="text-secondary text-sm mt-1">Tutto sotto controllo, senza stress.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left Column: Calendar */}
          <div className="xl:col-span-2">
            <Calendar />
          </div>

          {/* Right Column: Analytics & Tasks */}
          <div className="flex flex-col gap-6">
            <GlassPanel>
              <div className="flex items-center gap-2 text-sm font-medium text-secondary mb-4">
                <Activity size={18} />
                STATISTICHE EFFICIENZA
              </div>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-medium text-[var(--accent-primary)]">86%</span>
                <span className="text-[var(--accent-success)] text-sm font-medium mb-1 bg-[#e6f4ea] px-2 py-0.5 rounded-full">+2% questa sett.</span>
              </div>
              <p className="text-muted text-sm mt-3">Ottimo lavoro! Stai rispettando le stime.</p>
            </GlassPanel>

            <GlassPanel className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-secondary mb-4">
                <BookOpen size={18} />
                PROSSIME ATTIVITÀ
              </div>
              
              <ul className="flex flex-col gap-3">
                <li className="p-4 rounded-xl border border-[var(--border-color)] bg-white flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-[var(--text-primary)]">Esercizi Analisi I</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fce8e6] text-[var(--accent-danger)]">URGENTE</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={14} />
                    Scadenza: Esame tra 10 giorni
                  </div>
                </li>
                
                <li className="p-4 rounded-xl border border-[var(--border-color)] bg-white flex flex-col gap-2 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm text-[var(--text-primary)]">Sistemazione Appunti Fisica II</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#fef7e0] text-[var(--accent-warning)]">MEDIA</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={14} />
                    Tempo stimato: 1h 30m
                  </div>
                </li>
              </ul>
            </GlassPanel>
          </div>
        </div>
      </main>
    </div>
  );
}
