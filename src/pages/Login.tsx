import React from 'react';
import { CalendarIcon } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const navigate = useNavigate();

  const handleLogin = () => {
    // Simulazione di login, andrà collegato a Firebase Auth
    navigate('/home');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-md flex flex-col items-center text-center p-8">
        <div className="bg-[var(--bg-tertiary)] p-4 rounded-full mb-6">
          <CalendarIcon size={48} className="text-[var(--accent-primary)]" />
        </div>
        <h1 className="text-3xl font-bold mb-2 text-gradient">UniCalendar</h1>
        <p className="text-secondary mb-8">
          Il tuo assistente allo studio personale. <br />
          Organizza, calcola le priorità e non rimanere mai indietro.
        </p>
        
        <Button className="w-full py-3 text-lg" onClick={handleLogin}>
          Accedi con Google
        </Button>
      </GlassPanel>
    </div>
  );
}
