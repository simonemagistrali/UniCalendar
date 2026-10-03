import { useEffect } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function Tutorial() {
  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('uniCalendar_tutorialDriverCompleted');
    
    if (!hasSeenTutorial) {
      // Small timeout to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        const isMobile = window.innerWidth <= 900;

        const steps = isMobile ? [
          {
            popover: {
              title: 'Benvenuto in UniCalendar! 🎉',
              description: 'Facciamo un rapido tour per scoprire le funzionalità principali.',
              align: 'center'
            }
          },
          {
            element: '.calendar-main',
            popover: {
              title: 'Il tuo Calendario 📅',
              description: 'Qui puoi visualizzare tutti gli eventi, le lezioni e le sessioni di studio.',
              side: 'top',
              align: 'start'
            }
          },
          {
            element: '.mobile-fab',
            popover: {
              title: 'Aggiungi Eventi ➕',
              description: 'Tocca questo pulsante per creare un nuovo evento in qualsiasi momento.',
              side: 'top',
              align: 'end'
            }
          },
          {
            element: '.mobile-bottom-nav',
            popover: {
              title: 'Navigazione rapida 🚀',
              description: 'Usa la barra inferiore per passare velocemente tra Attività (To-Do), Statistiche e Anki.',
              side: 'top',
              align: 'center'
            }
          },
          {
            element: '.mobile-nav-item:last-child',
            popover: {
              title: 'Menu Avanzato ed Esportazioni ⚙️',
              description: 'Tocca "Altro" per aprire il menu laterale: lì troverai il pulsante "Importa .ics" per collegare Google Calendar!',
              side: 'top',
              align: 'end'
            }
          }
        ] : [
          {
            popover: {
              title: 'Benvenuto in UniCalendar! 🎉',
              description: 'Facciamo un rapido tour per scoprire dove si trovano le funzionalità principali.',
              align: 'center'
            }
          },
          {
            element: '.calendar-main',
            popover: {
              title: 'Il tuo Calendario 📅',
              description: 'Qui avrai la visione d\'insieme delle tue giornate: lezioni, esami e studio.',
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '.sidebar-create-btn',
            popover: {
              title: 'Crea Nuovi Eventi ➕',
              description: 'Clicca qui per aggiungere rapidamente un nuovo impegno al calendario.',
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '.sidebar-actions > button:nth-child(2)',
            popover: {
              title: 'Collega Google Calendar 🔄',
              description: 'Usa questo pulsante per caricare il tuo file .ics esportato da Google Calendar e avere tutto sincronizzato.',
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '.sidebar-nav',
            popover: {
              title: 'Strumenti di Studio 📚',
              description: 'Da qui puoi passare alle tue Attività (To-Do list), vedere le Statistiche o usare l\'integrazione con Anki.',
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '.calendar-sidebar',
            popover: {
              title: 'Obiettivi di Oggi 🎯',
              description: 'La barra laterale ti mostrerà sempre i task urgenti per tenerti concentrato!',
              side: 'left',
              align: 'start'
            }
          }
        ];

        const driverObj = driver({
          showProgress: true,
          steps: steps as any,
          nextBtnText: 'Avanti',
          prevBtnText: 'Indietro',
          doneBtnText: 'Fatto',
          allowClose: false,
          onDestroyed: () => {
            localStorage.setItem('uniCalendar_tutorialDriverCompleted', 'true');
          }
        });
        
        driverObj.drive();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, []);

  return null;
}
