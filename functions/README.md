# Firebase Cloud Functions — UniCalendar Automated Emails

Questo modulo gestisce l'invio programmato dei riepiloghi settimanali di studio via email direttamente dal backend Firebase Blaze.

## Funzionalità
- **`sendWeeklySummaries`**: Esegue un controllo orario e invia l'email riepilogativa (ore totali, attività svolte, delta settimana precedente, materia più studiata) nel giorno e ora scelti dall'utente (es. Domenica sera o Lunedì mattina).
- **`sendWeeklySummaryTest`**: Funzione HTTPS Callable per inviare un'email di prova istantanea dal pannello impostazioni.
- Decrittazione trasparente dei dati crittografati con AES dell'utente.

## Prerequisiti
1. **Piano Firebase Blaze** (pay-as-you-go, include una quota gratuita mensile molto generosa: 2 milioni di invocazioni Cloud Functions e 40.000 ore di calcolo al mese).
2. Estensione **"Trigger Email from Firestore"** (consigliata) OPPURE variabili SMTP.

## Come distribuire le funzioni
Dalla cartella principale del progetto:
```bash
firebase deploy --only functions
```

## Opzione 1: Con estensione Firebase "Trigger Email from Firestore" (Scelta consigliata)
1. Nella console Firebase, vai su **Extensions** -> **Trigger Email from Firestore**.
2. Installa l'estensione indicando la collection `mail`.
3. Configura le credenziali del fornitore email (SendGrid, Mailgun, Brevo o account Gmail app password).
4. Le funzioni scriveranno automaticamente i messaggi formattati nella collection `mail`.

## Opzione 2: Con variabili d'ambiente SMTP dirette
Se preferisci non usare l'estensione, puoi impostare i parametri segreti in Firebase Functions:
```bash
firebase functions:secrets:set SMTP_HOST="smtp.gmail.com"
firebase functions:secrets:set SMTP_PORT="587"
firebase functions:secrets:set SMTP_USER="tuo-indirizzo@gmail.com"
firebase functions:secrets:set SMTP_PASS="password-per-le-app"
```
