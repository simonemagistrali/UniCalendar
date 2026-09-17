import React from 'react';
import { CalendarIcon } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const navigate = useNavigate();

  const handleLogin = () => {
    // Simulazione di login
    navigate('/home');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)]">
      <GlassPanel className="w-full max-w-md flex flex-col items-center text-center p-10 shadow-lg border-none">
        <div className="p-4 rounded-full mb-6" style={{ backgroundColor: 'var(--accent-secondary)' }}>
          <CalendarIcon size={48} className="text-[var(--accent-primary)]" />
        </div>
        <h1 className="text-3xl font-bold mb-3 text-[var(--text-primary)] tracking-tight">UniCalendar</h1>
        <p className="text-[var(--text-secondary)] mb-10 text-sm leading-relaxed">
          Il tuo assistente allo studio personale. <br />
          Organizza le tue giornate, calcola le priorità e non rimanere mai più indietro.
        </p>
        
        <Button variant="primary" className="w-full py-3 text-base shadow-md hover:shadow-lg" onClick={handleLogin}>
          Accedi con Google
        </Button>
      </GlassPanel>
    </div>
  );
}
