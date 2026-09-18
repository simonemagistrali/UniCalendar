# 🎓 UniCalendar

Benvenuto in **UniCalendar**, l'applicazione definitiva per la gestione e la pianificazione della vita universitaria! 🚀

UniCalendar è un'app web moderna e intuitiva progettata specificamente per gli studenti universitari che vogliono ottimizzare la gestione del proprio tempo, bilanciando in modo efficace lezioni, studio individuale e impegni personali.

## ✨ Perché usare UniCalendar? (Utilità)

La vita universitaria può essere caotica. Tra orari delle lezioni che cambiano, sessioni di studio da programmare, recuperi di lezioni perse e tempi di spostamento tra una sede e l'altra, avere tutto sotto controllo è una sfida. 
UniCalendar risolve questo problema offrendo una piattaforma centralizzata in cui il tuo calendario accademico prende vita e si adatta in modo intelligente alle tue esigenze.

Le funzionalità principali includono:

- **📅 Gestione Avanzata del Calendario:** Visualizza e gestisci le tue lezioni ed eventi con un'interfaccia elegante. Salva la tua vista (zoom/scorrimento) preferita per un accesso rapido.
- **🔄 Sincronizzazione con Google Calendar:** Collega il tuo account Google per avere tutti i tuoi impegni (personali e universitari) sincronizzati in un unico posto bidirezionalmente.
- **🚶‍♂️ Ottimizzazione dei Tempi di Spostamento:** Calcola automaticamente e tiene conto dei tempi di viaggio tra diverse sedi o aule, assicurandoti di non arrivare mai in ritardo e pianificando pause realistiche.
- **📚 Pianificazione Intelligente dello Studio:** Gestisci i task e assegnali direttamente agli slot vuoti del calendario. L'app ti aiuta a trovare il tempo migliore per studiare.
- **🔁 Gestione Recupero Lezioni:** Se salti una lezione o un professore sposta un corso, puoi gestire facilmente la riprogrammazione come "task" specifico da recuperare.
- **🏖️ Focus Fine Settimana:** Una vista dedicata per gestire e visualizzare in modo chiaro i task e gli impegni del weekend, separandoli dal flusso feriale.

## 🛠️ Tecnologie Utilizzate

- **Frontend:** React 19, TypeScript, Vite
- **Stato & Dati:** Zustand, Firebase
- **UI & Stile:** CSS personalizzato con un design "Glassmorphism" e icone Lucide-React
- **Date & Orari:** Date-fns

## 🚀 Come iniziare (Installazione e Uso)

### Prerequisiti
Assicurati di avere [Node.js](https://nodejs.org/) (versione 18+) installato sul tuo computer.

### 1. Clonare il repository
```bash
git clone https://github.com/simonemagistrali/UniCalendar.git
cd UniCalendar
```

### 2. Installare le dipendenze
```bash
npm install
```

### 3. Configurare l'ambiente (Variabili d'ambiente)
Crea un file `.env` nella directory principale del progetto. Dovrai aggiungere le tue chiavi API di Firebase e (opzionalmente) di Google Calendar.
```env
VITE_FIREBASE_API_KEY=tua_chiave_api
VITE_FIREBASE_AUTH_DOMAIN=tuo_dominio_auth
VITE_FIREBASE_PROJECT_ID=tuo_project_id
# Aggiungi altre variabili necessarie per Firebase o Google Calendar
```

### 4. Avviare l'applicazione in locale
```bash
npm run dev
```
L'applicazione sarà disponibile all'indirizzo `http://localhost:5173`.

## 📖 Come usarla

1. **Dashboard Principale:** Una volta effettuato l'accesso, ti troverai di fronte alla tua settimana. Puoi subito iniziare ad aggiungere corsi e lezioni.
2. **Aggiunta Corsi:** Vai nella sezione dedicata ai corsi per configurare le tue materie (nome, crediti, professore).
3. **Pianificazione Task:** Nel pannello laterale, aggiungi le attività da svolgere (es. "Studiare Capitolo 3") e trascinale o assegnale a specifici orari liberi nel calendario.
4. **Sincronizzazione:** Vai in "Impostazioni" per collegare il tuo Google Calendar. Gli eventi verranno importati automaticamente e mostrati accanto alle lezioni.
5. **Tempi di viaggio:** Quando crei eventi in luoghi diversi, l'app ti suggerirà di inserire dei tempi cuscinetto per lo spostamento.

## 🤝 Contribuire
I contributi sono benvenuti! Se hai idee per nuove funzionalità o hai trovato un bug, sentiti libero di aprire una *Issue* o inviare una *Pull Request*.

## 📄 Licenza
Questo progetto è distribuito sotto licenza MIT.
