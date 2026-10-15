# UniCalendar — Stima del risparmio di tempo e carico mentale

> [!IMPORTANT]
> **Onestà metodologica.** Non esistono dati empirici su UniCalendar: ciò che segue è un **modello parametrico con incertezza esplicita** (Monte Carlo, 100.000 simulazioni), costruito su (a) cosa il codice fa davvero e (b) letteratura peer-reviewed. I parametri di *tempo* sono assunzioni ragionevoli (triangolari min/moda/max), **non misure**. Il §6 spiega come trasformarli in misure vere in ~4 settimane.

## 1. Cosa fa l'app (dal codice) e quale lavoro umano sostituisce

| Modulo | Lavoro umano eliminato |
|---|---|
| `ICSParser`, `googleCalendar` | Inserimento manuale orario/esami |
| `TaskManager` | Creare a mano i task "ripassa lezione X", progetti, rilevare spostamenti |
| `PriorityEngine` | Decidere *cosa* fare prima (difficoltà, ritardo, esame, rinvii, recupero lezioni) |
| `SchedulerEngine` | Decidere *quando* (slot liberi, pausa pranzo, blocchi 15–120 min, buffer) |
| `TravelManager`, `MealManager` | Pianificare viaggi/pasti come vincoli |
| `FutureProjectionEngine` | Anticipare il carico futuro (task "fantasma") |
| `CatchUpEngine` | Calcolare a mano "quanto sono in pari" |

## 2. Fondamenti scientifici (e loro limiti)

| Meccanismo | Fonte primaria | Dato chiave | Come entra nel modello |
|---|---|---|---|
| Planning fallacy | Buehler, Griffin & Ross (1994) | Tesi: previsto 33,9 gg, reale 55,5 gg → **×1,64** | Giustifica buffer/ricalibrazione; qui solo come metrica di qualità |
| Unpacking | Kruger & Evans (2004) | Scomporre riduce l'ottimismo | Task auto-generati per lezione = scomposizione gratuita |
| Outside view | Kahneman & Tversky; Flyvbjerg | Usare la classe di riferimento storica | `PerformanceRecord` → buffer e priorità adattivi |
| Stime di durata | Halkjelsvik & Jørgensen (2012) | Sottostima dominante in centinaia di studi | Idem |
| Open loops / piano | Masicampo & Baumeister (2011) | Un **piano concreto** elimina l'interferenza cognitiva dei goal non completati | Meccanismo principale del carico mentale |
| Capacità WM | Cowan (2001) | ~4 chunk | Con 10–25 task pendenti si supera la capacità: serve esternalizzare |
| Cognitive Load Theory | Sweller (1988) | Il carico *extraneous* (organizzativo) è eliminabile | Tutto il lavoro di pianificazione è extraneous |
| Attention residue | Leroy (2009) | Il task lasciato aperto degrada il successivo | Scheduler completa un task prima del successivo (`taskIdx++` solo a fine) |
| Interruzioni | Mark et al. (2008) | ~23 min per tornare al task originale | **Non** convertito in minuti risparmiati (vedi §5) |

**Cautele:** la teoria dell'*ego depletion / decision fatigue* (Baumeister) ha avuto **repliche fallite** (Hagger et al., 2016): la uso solo come conteggio di decisioni, non come costo energetico. Il "23 min" di Mark è un lag di ripresa *osservato in ufficio*, non un costo per ogni switch né applicabile direttamente a studenti. Le fonti web consultate sono sintesi secondarie; i riferimenti sopra sono quelli primari da verificare prima di citarli.

## 3. Modello del tempo (minuti/settimana, studente-tipo: ~5 corsi, ~15 task/sett.)

| Componente | Baseline manuale | Con l'app | Parametri (min–moda–max) |
|---|---|---|---|
| Creazione task | n_task × 0,5′ | −90% | n 8–15–25; 0,3–0,5–1,0′ |
| Pianificazione (settimanale + replan giornaliero) | 10–25–45′ + (3–5–6 gg × 2–4–8′) | review 2–5–10′ | |
| Decisioni "e adesso?" | 2–3–5/gg × 5–6–7 gg × 0,5–1–2′ | −75% | |
| Recupero lezioni perse / replan | 1–2–4 ev × 3–5–10′ | −50…85% | |
| Viaggi | 1–3–6 × 0,5–1–2′ | −95% | |
| Auto-interruzioni evitate (controlli calendario) | 5–15–30/sett. × 0,25–0,5–1,5′ | | confidenza **bassa** |
| **Costo app** (log tempi, manutenzione) | — | +1–3–8′ | sottratto |
| Setup una tantum/semestre | 20–24–30 eventi × 0,5–1–1,5′ | import 2–4–10′ | |

### Risultati (Monte Carlo, 100k run) — studente che già pianifica attivamente

| Componente | Media | P5 | P95 |
|---|---|---|---|
| Pianificazione | 42,7 | 27,1 | 59,5 |
| Decisioni | 17,5 | 9,3 | 28,5 |
| Auto-interruzioni | 12,5 | 4,7 | 24,4 |
| Recupero/replan | 9,6 | 4,6 | 16,6 |
| Creazione task | 8,6 | 4,7 | 14,0 |
| Viaggi | 3,7 | 1,6 | 6,6 |
| Costo app | −4,0 | −1,8 | −6,7 |
| **NETTO** | **≈ 91 min/sett.** | **69** | **115** |

- **Annuo** (30 sett. attive, + setup): **≈ 46 h/anno** (IC 90%: **34–59 h**). Setup una tantum ≈ 39 min/anno.
- P(risparmio netto > 0) = 100% **sotto le assunzioni**.
- Sensibilità (corr. con il totale): **pianificazione 0,71**, auto-interruzioni 0,44, decisioni 0,42. → L'incertezza dominante è *quanto tempo spende davvero oggi lo studente a pianificare*: va misurata per prima.

> [!WARNING]
> **Studente che oggi NON pianifica:** risparmio di tempo ≈ **0** (media −0,7 min/sett., P(>0)=41%). Il beneficio per lui non è tempo ma **qualità/regolarità** e carico mentale. Dire "risparmia 90 min" a tutti sarebbe falso.

## 4. Carico mentale — cosa si può dire e misurare

Il carico non si converte in minuti in modo difendibile. Si misura con **indicatori ripetibili**:

| Indicatore | Baseline (stima strutturale) | Con l'app | Strumento |
|---|---|---|---|
| Decisioni/settimana (cosa+quando+quanto, ×15 task + replan) | ≈ 45–60 | ≈ 10–15 (accetta/modifica) | Conteggio azioni nell'app |
| Open loops (task pendenti senza slot) | 10–25 (≫ 4±1 di Cowan) | ≈ 0 se schedulati | `tasks − sessions` |
| Sforzo mentale percepito | — | atteso ↓ medio (d≈0,5, **ipotesi di design, non dato**) | Paas 9-pt, raw NASA-TLX |
| Aderenza al piano | — | — | % sessioni completate |
| Errore di stima (MAPE) | ~×1,64 sottostima (Buehler) | da misurare | `estimated` vs `actual` |

**Limite del codice (verificato):** il buffer in `SchedulerEngine.getDynamicBuffer` è **additivo** (10′ + max 30′ dopo ≥2 record) e **non corregge `estimatedDuration`**; la ricalibrazione moltiplicativa esiste solo in `FutureProjectionEngine`. Quindi la correzione della planning fallacy è **parziale**: l'app non porta da ×1,64 a ×1,0 da sola. Candidato di miglioramento misurabile: applicare un fattore storico (outside view) a `estimatedDuration`.

## 5. Cosa NON ho conteggiato (per non gonfiare)

- Nessun guadagno di apprendimento/voti (non è dimostrato).
- Nessuna conversione dei "23 min" di Mark: l'app non blocca notifiche; riduce solo i controlli volontari (voce a bassa confidenza, ~12 min/sett., eliminabile → totale ≈ 78 min/sett. senza).
- Nessuna sovrapposizione conteggiata due volte tra replan e recupero.
- Rischio opposto: **fiducia eccessiva** nel piano automatico e costo di correggere errori dello scheduler.

## 6. Protocollo di misurazione (rendere la stima una misura)

**Disegno:** crossover intra-soggetto, 2 settimane senza app (baseline) + 2 con app (ordine randomizzato/bilanciato).

1. **Tempo di pianificazione:** auto-log con timer (o screen-time) delle attività "pianifico/riordino/decido"; in app, strumentare `time_in_app_planning`, n. modifiche manuali, n. replan.
2. **Carico:** raw NASA-TLX (Hart & Staveland, 1988) a fine di ogni settimana + Paas 9-pt giornaliera (10 s).
3. **Esito:** % sessioni completate, MAPE stima, n. scadenze mancate.
4. **Numerosità (power analysis, paired t, α=.05, potenza .80):**
   - Effetto tempo atteso 30 min/sett., SD≈40 → d≈0,75 → **n ≈ 16**.
   - Effetto carico medio d=0,5 → **n ≈ 34**; d=0,3 → **n ≈ 89**.
5. **Analisi:** differenza pre/post con IC 95% bootstrap; riportare separatamente "planner" vs "non-planner" (§3).
6. **Criterio di falsificazione:** se IC95% del tempo netto include 0 per i planner, il modello è smentito.

Script riproducibile: [montecarlo.py](montecarlo.py) (esegui `python montecarlo.py`; seed 42; modifica le triangolari con i tuoi dati reali).

## 7. Sintesi

| Scenario | Risparmio |
|---|---|
| Studente che pianifica già a mano | **~1,3–1,5 h/sett. (IC90% 69–115 min)** ≈ **46 h/anno** |
| Come sopra senza voce a bassa confidenza | ~78 min/sett. ≈ 39 h/anno |
| Studente che non pianifica | ~0 min; beneficio solo in carico/regolarità |
| Carico mentale | −70–80% decisioni (strutturale); riduzione di sforzo percepito **da misurare** |
