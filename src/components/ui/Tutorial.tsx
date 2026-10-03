import { useState, useEffect } from 'react';
import { CalendarIcon, Brain, CheckSquare, X, ArrowRight, ArrowLeft } from 'lucide-react';

export function Tutorial() {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('uniCalendar_tutorialCompleted');
    if (!hasSeenTutorial) {
      setIsVisible(true);
    }
  }, []);

  if (!isVisible) return null;

  const handleClose = () => {
    localStorage.setItem('uniCalendar_tutorialCompleted', 'true');
    setIsVisible(false);
  };

  const steps = [
    {
      title: 'Benvenuto in UniCalendar! 🎉',
      description: 'Il tuo compagno ideale per organizzare al meglio lo studio universitario e massimizzare la produttività. Scopriamo in pochi passi come ottenere il massimo!',
      icon: <img src="/icon.png" alt="Logo" style={{ width: 80, height: 80, objectFit: 'contain' }} />,
    },
    {
      title: 'Pianifica le Tue Giornate 📅',
      description: 'Gestisci lezioni, esami e sessioni di studio. Crea eventi o collegati a Google Calendar: basta scaricare il file .ics da Google e caricarlo tramite "Importa .ics" nel menu!',
      icon: <CalendarIcon size={64} className="tutorial-icon-accent" />,
    },
    {
      title: 'Attività & Produttività ✅',
      description: 'Usa la sezione Attività per creare le tue to-do list giornaliere. Suddividi i task complessi e tieni d\'occhio la barra di progresso per rimanere sempre motivato.',
      icon: <CheckSquare size={64} className="tutorial-icon-accent" />,
    },
    {
      title: 'Ripasso Intelligente con Anki 🧠',
      description: 'Ottimizza lo studio sfruttando la ripetizione dilazionata! Se usi Anki, esplora la sezione dedicata per generare automaticamente il tuo piano di ripasso ideale.',
      icon: <Brain size={64} className="tutorial-icon-accent" />,
    }
  ];

  return (
    <div className="modal-overlay tutorial-overlay">
      <div className="tutorial-backdrop" onClick={handleClose}></div>
      <div className="tutorial-container">
        <button className="tutorial-close-btn" onClick={handleClose}>
          <X size={20} />
        </button>
        <div className="tutorial-content-wrapper">
          <div className="tutorial-icon-wrapper">
            {steps[step].icon}
          </div>
          <h2 className="tutorial-title">{steps[step].title}</h2>
          <p className="tutorial-description">{steps[step].description}</p>
        </div>
        
        <div className="tutorial-footer">
          <div className="tutorial-indicators">
            {steps.map((_, i) => (
              <div key={i} className={`tutorial-dot ${i === step ? 'active' : ''}`} />
            ))}
          </div>
          <div className="tutorial-actions">
            {step > 0 ? (
              <button className="btn btn-ghost tutorial-btn-prev" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft size={16} /> Indietro
              </button>
            ) : (
              <div style={{ width: 90 }}></div> // Placeholder for layout
            )}
            {step < steps.length - 1 ? (
              <button className="btn btn-primary tutorial-btn-next" onClick={() => setStep(s => s + 1)}>
                Avanti <ArrowRight size={16} />
              </button>
            ) : (
              <button className="btn btn-primary tutorial-btn-finish" onClick={handleClose}>
                Inizia 🎉
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
