import { useState } from 'react';
import { CalendarIcon, BrainCircuit, Target, Sparkles, ArrowRight } from 'lucide-react';
import { GlassPanel } from '../components/ui/GlassPanel';
import { Button } from '../components/ui/Button';
import { useNavigate } from 'react-router-dom';
import { authService } from '../core/mockBackend';

export function Login() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await authService.loginWithGoogle();
      navigate('/home');
    } catch (err: any) {
      console.error('Login failed', err);
      // Firebase popup closed by user
      if (err?.code === 'auth/popup-closed-by-user') {
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
        <div className="landing-hero">
          <div className="landing-badge">
            <Sparkles size={16} />
            <span>Il tuo nuovo metodo di studio</span>
          </div>
          <h1 className="landing-title">
            Studia in modo <span>Intelligente</span>, non di più.
          </h1>
          <p className="landing-description">
            UniCalendar è l'app definitiva per gli studenti universitari. Organizza le tue giornate, calcola le priorità in automatico e sfrutta algoritmi di spaced repetition per preparare i tuoi esami senza stress.
          </p>
          <div className="landing-cta">
            <Button variant="primary" className="landing-btn-start" onClick={() => setShowLogin(true)}>
              Inizia Ora <ArrowRight size={18} />
            </Button>
          </div>
        </div>
        
        <div className="landing-features">
          <GlassPanel className="feature-card">
            <div className="feature-icon"><Target size={28} /></div>
            <h3>Priorità Automatiche</h3>
            <p>Non sai da dove iniziare? L'app calcola per te su cosa devi concentrarti oggi per non restare indietro.</p>
          </GlassPanel>
          <GlassPanel className="feature-card">
            <div className="feature-icon"><CalendarIcon size={28} /></div>
            <h3>Pianificazione Smart</h3>
            <p>Distribuisci il carico di studio in base ai giorni disponibili e alle pagine da fare. Tutto sotto controllo.</p>
          </GlassPanel>
          <GlassPanel className="feature-card">
            <div className="feature-icon"><BrainCircuit size={28} /></div>
            <h3>Metodo Spaced Repetition</h3>
            <p>Massimizza la memorizzazione a lungo termine con il sistema di ripetizione dilazionata integrato (stile Anki).</p>
          </GlassPanel>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <GlassPanel className="login-card fade-in">
        <div className="login-icon-wrapper">
          <CalendarIcon size={48} />
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
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/privacy'); }} style={{ color: 'var(--primary-color)', textDecoration: 'underline' }}>
            Privacy Policy
          </a>.
        </p>
      </GlassPanel>
    </div>
  );
}
