import React from 'react';
import { Calendar as CalendarIcon, BookOpen, Activity, Clock } from 'lucide-react';
import { Calendar } from './components/Calendar';

function App() {
  return (
    <div className="flex flex-col min-h-screen p-4 md:p-8 gap-6">
      <header className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gradient flex items-center gap-2">
            <CalendarIcon />
            UniCalendar
          </h1>
          <p className="text-secondary text-sm mt-1">Organizza il tuo tempo, non rimanere mai indietro.</p>
        </div>
        <button className="btn btn-primary">
          Login con Google
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left Column: Calendar (Takes up 2/3 space on large screens) */}
        <section className="lg:col-span-2 flex flex-col">
          <Calendar />
        </section>

        {/* Right Column: Dashboard & Tasks */}
        <section className="flex flex-col gap-6">
          <div className="glass-panel p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gradient">
              <Activity size={24} />
              Efficienza Studio
            </div>
            <p className="text-muted text-sm">Il tuo andamento rispetto ai tempi stimati.</p>
            <div className="flex justify-center items-center h-32" style={{ border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
              <span className="text-muted">Grafico in arrivo...</span>
            </div>
          </div>

          <div className="glass-panel p-6 flex flex-col gap-4 flex-1">
            <div className="flex items-center gap-2 text-lg font-semibold text-gradient">
              <BookOpen size={24} />
              Prossime Task
            </div>
            <p className="text-muted text-sm">Le tue attività di studio ordinate per importanza.</p>
            <ul className="flex flex-col gap-3">
              <li className="p-4" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '4px solid var(--accent-danger)' }}>
                <div className="font-semibold text-sm">Analisi Matematica I - Esercizi</div>
                <div className="text-muted text-xs flex items-center gap-1 mt-2">
                  <Clock size={12} />
                  Alta Priorità - Esame in 10 giorni
                </div>
              </li>
              <li className="p-4" style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', borderLeft: '4px solid var(--accent-warning)' }}>
                <div className="font-semibold text-sm">Fisica II - Sistemazione Appunti</div>
                <div className="text-muted text-xs flex items-center gap-1 mt-2">
                  <Clock size={12} />
                  Media Priorità
                </div>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
