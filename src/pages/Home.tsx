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
      
      {/* Sidebar Professionale */}
      <aside className="sidebar">
        <div className="flex items-center gap-2 mb-10 px-2">
          <CalendarIcon size={20} className="text-white" />
          <span className="font-semibold text-lg tracking-tight">UniCalendar</span>
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          <button className="flex items-center gap-3 px-3 py-2 rounded-md bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm font-medium transition-colors">
            <HomeIcon size={16} />
            Dashboard
          </button>
          <button className="flex items-center gap-3 px-3 py-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] text-sm font-medium transition-colors" onClick={() => navigate('/settings')}>
            <Settings size={16} />
            Impostazioni
          </button>
        </nav>

        <div className="mt-auto">
          <button className="flex items-center gap-3 px-3 py-2 rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] text-sm font-medium w-full transition-colors" onClick={() => navigate('/login')}>
            <LogOut size={16} />
            Esci
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-secondary text-sm mt-1">Il tuo piano di studi ottimizzato.</p>
          </div>
          <Button variant="primary" icon={<Plus size={16} />}>
            Nuovo Evento
          </Button>
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
                <Activity size={16} />
                STATISTICHE
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-semibold">86%</span>
                <span className="text-success text-sm font-medium mb-1">+2% questa sett.</span>
              </div>
              <p className="text-muted text-xs mt-1">Efficienza di studio calcolata sulle ultime task.</p>
            </GlassPanel>

            <GlassPanel className="flex-1">
              <div className="flex items-center gap-2 text-sm font-medium text-secondary mb-4">
                <BookOpen size={16} />
                DA FARE (PRIORITÀ)
              </div>
              
              <ul className="flex flex-col gap-3">
                <li className="p-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">Esercizi Analisi I</span>
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-danger)] mt-1.5"></span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={12} />
                    Scadenza: Esame tra 10gg
                  </div>
                </li>
                
                <li className="p-3 rounded-md border border-[var(--border-color)] bg-[var(--bg-primary)] flex flex-col gap-2">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">Appunti Fisica II</span>
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-warning)] mt-1.5"></span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted">
                    <Clock size={12} />
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
