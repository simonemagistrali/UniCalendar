# UniCalendar MCP Server (sola lettura)

Collega UniCalendar al tuo assistente AI (Claude, Gemini, Cursor, VS Code, Antigravity…) tramite il
[Model Context Protocol](https://modelcontextprotocol.io). L'AI potrà **leggere** i tuoi task, eventi,
stato di recupero e riepiloghi, e rispondere a domande come *«cosa devo studiare oggi?»* o
*«trovami uno slot libero di 2 ore per Analisi questa settimana»*.

- **Nessuna modifica ai dati**: tutti i tool sono dichiarati `readOnlyHint` e non scrivono mai.
- **Nessun costo di API**: l'AI è quella che già usi; il server gira sul tuo PC.
- **Stessi calcoli dell'app**: riusa `CatchUpEngine` e `WeeklySummaryEngine` da `src/core`.

## Tool disponibili

| Tool | Cosa fa |
|---|---|
| `get_overview` | Panoramica: attività aperte, completate oggi, % recupero, eventi di oggi, top priorità, prossimi esami |
| `list_courses` | Materie con difficoltà, carico aperto, prossimo esame/quiz |
| `list_tasks` | Attività filtrabili per stato, materia, scadenza |
| `list_events` | Eventi in un intervallo (lezioni, esami, viaggi…) |
| `get_upcoming_assessments` | Esami/quiz/scadenze con giorni mancanti e preparazione residua |
| `get_catchup_status` | Quanto sei in pari con le lezioni, per materia |
| `get_week_summary` | Riepilogo settimanale (ore, materie, streak, materie a rischio) |
| `find_free_slots` | Slot liberi nelle tue fasce di studio, al netto di eventi e sessioni |

## 1. Installazione

Richiede [Node.js](https://nodejs.org) 20 o superiore.

```bash
cd mcp-server
npm install
npm test          # verifica che tutto funzioni (usa dati di esempio)
```

## 2. Scegli la sorgente dei dati

Imposta **una** di queste variabili d'ambiente (le inserirai nella configurazione del client, vedi sotto).

### A) Dati di esempio — per provare subito
`UNICALENDAR_DEMO=1`

### B) File esportato dall'app — consigliato per iniziare, nessuna credenziale
1. Apri UniCalendar nel browser, già loggato.
2. Apri la console degli strumenti sviluppatore (F12 → Console) e lancia:
   ```js
   copy(localStorage.getItem('unicalendar_state'))
   ```
3. Incolla il contenuto in un file, ad esempio `C:/Users/TU/unicalendar-data.json`.
4. `UNICALENDAR_DATA_FILE=C:/Users/TU/unicalendar-data.json`

> Il file è un'istantanea: per aggiornare i dati ripeti l'esportazione. Contiene i tuoi dati in chiaro
> (e le tue preferenze, inclusa un'eventuale chiave Gemini, che però il server **non espone mai**):
> non condividerlo e non metterlo su Git.

### C) Direttamente da Firestore — dati sempre aggiornati
Serve un account di servizio Firebase **del tuo progetto** (solo per uso personale).
1. Console Firebase → ⚙ Impostazioni progetto → *Account di servizio* → *Genera nuova chiave privata*.
   Salva il JSON fuori dal repository.
2. Console Firebase → Authentication → copia il tuo **UID** utente.
3. Imposta:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=C:/percorso/chiave-servizio.json
   UNICALENDAR_UID=<il tuo uid>
   ```

> ⚠ La chiave dell'account di servizio ha accesso amministrativo al progetto: trattala come una password.
> Il server legge `users/{uid}` e `user_keys/{uid}`, decifra i campi in locale e non scrive nulla.
> I dati vengono tenuti in cache 60 secondi.

## 3. Collega il tuo AI

In tutti gli esempi sostituisci `C:/PERCORSO/UniCalendar` con il percorso reale del progetto (usa `/` anche su Windows).
Il comando avvia il server con il `tsx` installato in `mcp-server/node_modules`.

Blocco comune ("mcpServers"):

```json
{
  "mcpServers": {
    "unicalendar": {
      "command": "node",
      "args": [
        "C:/PERCORSO/UniCalendar/mcp-server/node_modules/tsx/dist/cli.mjs",
        "C:/PERCORSO/UniCalendar/mcp-server/src/server.ts"
      ],
      "env": {
        "UNICALENDAR_DATA_FILE": "C:/Users/TU/unicalendar-data.json"
      }
    }
  }
}
```

### Claude Desktop
1. Impostazioni → *Sviluppatore* → *Modifica configurazione* (apre `claude_desktop_config.json`).
2. Incolla il blocco sopra (se `mcpServers` esiste già, aggiungi solo la voce `unicalendar`).
3. **Riavvia completamente Claude Desktop**. Compare l'icona degli strumenti nella chat.

### Claude Code
```bash
claude mcp add unicalendar -e UNICALENDAR_DATA_FILE=C:/Users/TU/unicalendar-data.json -- node C:/PERCORSO/UniCalendar/mcp-server/node_modules/tsx/dist/cli.mjs C:/PERCORSO/UniCalendar/mcp-server/src/server.ts
```

### Gemini CLI
Aggiungi il blocco comune a `~/.gemini/settings.json` (o `.gemini/settings.json` nel progetto), poi riavvia. Verifica con `/mcp`.

### Antigravity
Pannello agente → menu `…` → *MCP Servers* → *Manage MCP Servers* → *View raw config* e incolla il blocco comune.

### Cursor
Aggiungi il blocco comune a `~/.cursor/mcp.json` (globale) o `.cursor/mcp.json` (progetto).

### VS Code (GitHub Copilot)
Crea `.vscode/mcp.json` (nota: la chiave è `servers`, non `mcpServers`):
```json
{
  "servers": {
    "unicalendar": {
      "type": "stdio",
      "command": "node",
      "args": [
        "C:/PERCORSO/UniCalendar/mcp-server/node_modules/tsx/dist/cli.mjs",
        "C:/PERCORSO/UniCalendar/mcp-server/src/server.ts"
      ],
      "env": { "UNICALENDAR_DATA_FILE": "C:/Users/TU/unicalendar-data.json" }
    }
  }
}
```

### ChatGPT e client solo web (claude.ai, Gemini web)
**Non supportati in questa versione**: richiedono un server MCP *remoto* con autenticazione OAuth
(non ancora implementato). Questo server è locale (stdio).

> I menu e i nomi delle voci dei vari client cambiano spesso: se qualcosa non corrisponde, cerca nella loro
> documentazione "MCP servers" / "custom connectors".

## 4. Prova

Chiedi all'AI, ad esempio:
- «Dammi una panoramica di UniCalendar.»
- «Quali attività scadono nei prossimi 7 giorni?»
- «Quanto sono indietro con le lezioni di Fisica?»
- «Quando posso studiare per 90 minuti questa settimana?»
- «Com'è andata la mia settimana scorsa?»

## Risoluzione problemi

| Sintomo | Causa probabile |
|---|---|
| Il client dice "server disconnected" | Percorsi sbagliati nella config, oppure `npm install` non eseguito in `mcp-server/` |
| "Nessuna sorgente dati configurata" | Manca `UNICALENDAR_DATA_FILE`, `UNICALENDAR_UID` o `UNICALENDAR_DEMO` in `env` |
| Dati vecchi | Con il file: riesporta. Con Firestore: la cache dura 60 s |
| Campi vuoti dopo la decifratura (Firestore) | UID errato o chiave in `user_keys/{uid}` mancante |

Per provare il server a mano, in `mcp-server/`: `npx @modelcontextprotocol/inspector npm run demo`.

## Sicurezza

- Il server **non apre porte di rete** (solo stdin/stdout con il client che l'ha avviato).
- Sola lettura: nessuno strumento modifica o cancella dati.
- I dati letti passano al provider dell'AI che usi: valuta se sei a tuo agio, come per qualsiasi chat.
- Un'email o un documento che l'AI legge da *altri* connettori potrebbe contenere istruzioni ostili
  (prompt injection); per questo questa versione non offre strumenti di scrittura.

## Struttura

```
mcp-server/
  src/server.ts   registrazione dei tool + trasporto stdio
  src/tools.ts    logica dei tool (funzioni pure)
  src/data.ts     caricamento: demo / file / Firestore (+ decifratura AES)
  src/demo.ts     dati di esempio
  test/smoke.ts   test end-to-end con un client MCP in memoria
```
