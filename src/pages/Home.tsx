import React, { useState } from 'react';
import { CalendarIcon, BookOpen, Activity, Clock, Plus } from 'lucide-react';
import { Calendar } from '../components/features/calendar/Calendar';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 gap-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
            <CalendarIcon />
            UniCalendar
          </h1>
          <p className="text-secondary text-sm mt-1">Bentornato! Ecco il tuo piano di studi.</p>
        </div>
        <div className="flex gap-4">
          <Button variant="secondary" onClick={() => navigate('/settings')}>
            Impostazioni
          </Button>
          <Button icon={<Plus size={18} />} onClick={() => setIsModalOpen(true)}>
            Aggiungi Evento
          </Button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left Column: Calendar */}
        <section className="lg:col-span-2 flex flex-col">
          <Calendar />
        </section>

        {/* Right Column: Dashboard & Tasks */}
        <section className="flex flex-col gap-6">
          <GlassPanel className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gradient">
              <Activity size={24} />
              Efficienza Studio
            </div>
            <p className="text-muted text-sm">Il tuo andamento rispetto ai tempi stimati.</p>
            <div className="flex justify-center items-center h-32 border border-dashed border-[var(--glass-border)] rounded-xl">
              <span className="text-muted">Grafico in arrivo...</span>
            </div>
          </GlassPanel>

          <GlassPanel className="flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2 text-lg font-semibold text-gradient">
              <BookOpen size={24} />
              Prossime Task
            </div>
            <p className="text-muted text-sm">Le tue attività di studio ordinate per importanza.</p>
            <ul className="flex flex-col gap-3">
              <li className="p-4 bg-white/5 rounded-xl border-l-4 border-[var(--accent-danger)]">
                <div className="font-semibold text-sm">Analisi Matematica I - Esercizi</div>
                <div className="text-muted text-xs flex items-center gap-1 mt-2">
                  <Clock size={12} />
                  Alta Priorità - Esame in 10 giorni
                </div>
              </li>
              <li className="p-4 bg-white/5 rounded-xl border-l-4 border-[var(--accent-warning)]">
                <div className="font-semibold text-sm">Fisica II - Sistemazione Appunti</div>
                <div className="text-muted text-xs flex items-center gap-1 mt-2">
                  <Clock size={12} />
                  Media Priorità
                </div>
              </li>
            </ul>
          </GlassPanel>
        </section>
      </main>

      {/* Example Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Nuovo Evento">
        <p className="text-sm text-secondary mb-6">
          Qui potrai inserire una nuova lezione, un esame o uno spostamento. 
          Il form è in fase di sviluppo.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Annulla</Button>
          <Button variant="primary" onClick={() => setIsModalOpen(false)}>Salva (Demo)</Button>
        </div>
      </Modal>
    </div>
  );
}
