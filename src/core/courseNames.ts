/**
 * courseNames — Estrazione avanzata del nome del corso ESCLUSIVAMENTE dagli eventi del calendario
 * e riparazione automatica/unificazione dei corsi nel database.
 */
import type { CalendarEvent, Course, Task, PerformanceRecord } from './types';

/** Parole o etichette che da sole NON possono mai costituire il nome di un corso */
export const BOGUS_COURSE_NAMES = new Set([
  'didattica', 'didattiche',
  'lezione', 'lezioni', 'lez',
  'esercitazione', 'esercitazioni', 'eserc', 'esercizi',
  'laboratorio', 'lab',
  'teoria',
  'corso', 'insegnamento', 'modulo', 'mod',
  'aula', 'room', 'sede', 'edificio', 'plesso', 'piano',
  'prof', 'professore', 'professoressa', 'docente', 'dottore', 'dott', 'dott.ssa', 'ing',
  'canale', 'gruppo', 'sezione', 'sez',
  'online', 'remoto', 'presenza', 'telematico',
  'esame', 'appello', 'parziale', 'recupero', 'prova',
  'generico', 'studio', 'attivita', 'scadenza',
  'recuperare', 'ripassare', 'studiare', 'rivedere',
]);

/** Prefisso che identifica compiti/task erroneamente finiti tra i corsi */
export const TASK_ACTION_PREFIX = /^(?:recuperare|ripassare|studiare|studio|esercizi|esercitazione|seguire|completare|leggere|fare|preparare|appunti|rivedere)\b/i;

/** Prefissi comuni nei calendari universitari (es. Polimi: "Didattica - ") che indicano la tipologia dell'evento */
const LESSON_PREFIX = /^\s*(?:attività\s+didattica|didattica|lezione|lezioni|lez\.?|lecture|lesson|esercitazione|esercitazioni|eserc\.?|laboratorio|lab\.?|teoria|corso|insegnamento|modulo|mod\.?)\b\.?\s*(?:n\.?\s*\d+|#?\d+|\d+)?\s*(?:[:\-–—|/]\s*)?(?:(?:di|del|della|dello|dei|degli|delle|of|on|in)\s+|d['’]\s*)?(?:[:\-–—|/]\s*)?/i;

/** Prefissi esame o appello */
const EXAM_PREFIX = /^\s*(?:esame|appello|prova|parziale|recupero|preappello)\b\.?\s*(?:[:\-–—|/]\s*)?(?:(?:di|del|della|dello|dei|degli|delle|of|on|in)\s+|d['’]\s*)?(?:[:\-–—|/]\s*)?/i;

/** Settore Scientifico Disciplinare italiano: es. ING-INF/05, MAT/05, FIS/01, SECS-P/07, IUS/01, CHIM/03, BIO/10 */
const SSD_CODE = /^\s*(?:[A-Z]{3,4}(?:-[A-Z]{2,4})?\s*\/\s*\d{2})\s*[-–—|:]\s*/i;

/** Prefissi di codici numerici o alfanumerici: es. 084723 - , B012345 - , COD. 12345 - */
const NUMERIC_CODE = /^\s*(?:cod\.?\s*)?(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{4,12}\s*[-–—|:]\s*/i;

/** Prefissi tra parentesi o quadre all'inizio del titolo: es. [INF-01], (084723) */
const LEADING_BRACKETS = /^\s*(?:\[[^\]]+\]|\([^)]+\))\s*[-–—|:]?\s*/;

/** Nomi di docenti all'inizio del titolo: es. "Prof. Mario Rossi - ", "Docente: Rossi - " */
const LEADING_INSTRUCTOR = /^\s*(?:prof\.?|prof\.ssa|docente|dott\.?|dott\.ssa|ing\.?)\s+[A-Za-zÀ-ÿ'\s.]*?[-–—|:]\s*/i;

/** Prefissi di anno/semestre all'inizio: es. 1° Semestre - , A.A. 2024/2025 - */
const LEADING_ACADEMIC_YEAR = /^\s*(?:(?:1|2|i|ii)[°^]?\s*(?:semestre|sem\.?|anno|periodo)|a\.?a\.?\s*\d{2,4}[/-]\d{2,4})\s*[-–—|:]\s*/i;

/** Segmenti che indicano chiaramente metadati/informazioni accessorie (aula, docente, canale, modalità, ecc.) */
const ACCESSORY_SEGMENT = /^(?:aula|room|edificio|sede|plesso|piano|prof\.?|prof\.ssa|docente|dott\.?|dott\.ssa|ing\.?|canale|gruppo|sez\.?|sezione|student\s+group|group|telematico|online|in presenza|presenza|remoto|zoom|teams|meet|cfu|crediti|semestre|anno|lezione|lez\.?|lecture|lesson|esercitazione|eserc\.?|exe\b|exer\b|exercises?|laboratorio|lab\.?|teoria|n\.?\s*\d+|#\d+)\b/i;

/** Code accessorie da ripulire in fondo al nome */
const TRAILING_NOISE = [
  /[\s,]+(?:aula|room|edificio|sede|plesso|prof\.?|prof\.ssa|docente|dott\.?|ing\.?)\b.*$/i,
  /[\s,]+(?:canale|gruppo|sez\.?|sezione|student\s+group|group)\b.*$/i,
  /[\s,]+(?:lezione|lez\.?|lecture|lesson)\b.*$/i,
  /[\s,]+(?:esercitazione|esercitazioni|teoria|laboratorio|lab\.?|exe|exer|exercises?)\b.*$/i,
  /[\s,]+(?:cfu|crediti)\s*\d+\s*$/i,
  /[\s,]+(?:n\.?\s*|#)\d+\s*$/i,
  /[\s:,.\-–—|/]+$/,
];

/**
 * Elimina parole consecutive duplicate: es. "STATISTICS STATISTICS STATISTICS" -> "STATISTICS"
 */
export function collapseDuplicateWords(str: string): string {
  if (!str) return '';
  const words = str.trim().split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === 0 || words[i].toLowerCase() !== words[i - 1].toLowerCase()) {
      out.push(words[i]);
    }
  }
  return out.join(' ');
}

function stripPrefixes(text: string): string {
  let prev = '';
  let cur = text.trim();
  while (cur !== prev) {
    prev = cur;
    cur = cur
      .replace(SSD_CODE, '')
      .replace(NUMERIC_CODE, '')
      .replace(LEADING_BRACKETS, '')
      .replace(LEADING_INSTRUCTOR, '')
      .replace(LESSON_PREFIX, '')
      .replace(EXAM_PREFIX, '')
      .replace(LEADING_ACADEMIC_YEAR, '')
      .trim();
  }
  return cur;
}

/** Formatta i titoli tutti in MAIUSCOLO in Title Case, preservando numeri romani (I, II, III...) e acronimi (AI, DB, SO...) */
export function formatCourseTitleCase(str: string): string {
  if (!str) return '';
  const letters = str.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length > 2 && letters === letters.toUpperCase()) {
    const ROMAN_OR_ACRONYM = /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|AI|DB|SO|OS|IT|TLC|CFU|LAB)$/i;
    const LOWERCASE_WORDS = /^(?:di|del|della|dello|dei|degli|delle|e|ed|in|su|per|con|da|a|the|of|and|for)$/i;

    return str
      .toLowerCase()
      .split(' ')
      .map((word, idx) => {
        if (!word) return '';
        if (ROMAN_OR_ACRONYM.test(word)) return word.toUpperCase();
        if (idx > 0 && LOWERCASE_WORDS.test(word)) return word.toLowerCase();
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  }
  return str;
}

/**
 * Pulisce ed estrae il nome del corso da un titolo di evento del calendario.
 */
export function cleanCourseName(title: string): string {
  if (!title) return '';

  let cur = collapseDuplicateWords(title.trim());

  // 1. Rimuovi prefissi iniziali (didattica, tipo lezione, SSD, codici numerici, docente iniziale)
  cur = stripPrefixes(cur);

  // 1.5 Rimuovi suffissi accessori di esercitazione, laboratori e gruppi studenti anche se non preceduti da trattino
  cur = cur.replace(/\s+(?:EXE|EXER|EXERCISES?|ESERCITAZIONE|ESERCITAZIONI|LAB|LABORATORIO|STUDENT\s+GROUP|GROUP)\b.*$/i, '').trim();

  // 2. Rimuovi informazioni accessorie tra parentesi tonde o quadre
  cur = cur.replace(/\s*\((?:prof\.?|prof\.ssa|docente|aula|room|edificio|canale|gruppo|sez\.?|sezione|sede|ore|cfu|crediti|teoria|esercitazione|lab\.?|laboratorio|online|remoto|presenza|[a-z]-[a-z]|\d+)[^)]*\)/gi, '');
  cur = cur.replace(/\s*\[(?:prof\.?|prof\.ssa|docente|aula|room|edificio|canale|gruppo|sez\.?|sezione|sede|ore|cfu|crediti|teoria|esercitazione|lab\.?|laboratorio|online|remoto|presenza|[a-z]-[a-z]|\d+)[^\]]*\]/gi, '');
  cur = cur.replace(/\s*\([^)]*\)\s*$/g, '');

  // 3. Normalizza trattini interni tra parole prima di dividere (es. ANALISI-MATEMATICA -> ANALISI - MATEMATICA)
  cur = cur.replace(/([A-Za-zÀ-ÿ0-9])\s*[-–—]\s*([A-Za-zÀ-ÿ0-9])/g, '$1 - $2');

  // 4. Dividi sui delimitatori principali
  const segments = cur.split(/\s*[-–—|/]\s+|\s*;\s*|\s*:\s*|\s*@\s*/).map(s => s.trim()).filter(Boolean);
  const keptSegments: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = stripPrefixes(segments[i]);
    if (!seg) continue;

    // Se incontriamo un segmento accessorio, interrompi
    if (ACCESSORY_SEGMENT.test(seg)) break;

    const cleaned = seg.replace(/[\s,]+(?:aula|room|edificio|sede|prof\.?|prof\.ssa|docente|dott\.?|ing\.?|canale|gruppo|student\s+group|group|exe|exer|exercises?)\b.*$/i, '').trim();
    if (cleaned) keptSegments.push(cleaned);
    if (cleaned !== seg) break;
  }

  let result = keptSegments.length > 0 ? keptSegments.join(' ') : cur;

  // 5. Ripulisci code residue e parole duplicate
  let prev = '';
  while (result !== prev) {
    prev = result;
    for (const re of TRAILING_NOISE) result = result.replace(re, '').trim();
  }

  result = collapseDuplicateWords(result);
  return formatCourseTitleCase(result.trim());
}

/** Estrae il nome completo del corso dal titolo di un evento (alias di cleanCourseName) */
export function extractCourseName(title: string): string {
  return cleanCourseName(title);
}

/** Nome corso dal titolo, con fallback al titolo originale se l'estrazione fallisce */
export function courseNameFromTitle(title: string): string {
  return extractCourseName(title) || title.trim();
}

/** Normalizza per confronti case-insensitive e senza accenti */
export function normalizeCourseName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Trova il corso corrispondente al titolo di un evento (gestisce match esatto, prefisso ed estensione) */
export function findCourseForTitle(title: string, courses: Course[]): Course | undefined {
  const extracted = courseNameFromTitle(title);
  const target = normalizeCourseName(extracted);
  if (!target) return undefined;

  // 1. Corrispondenza esatta col nome normalizzato del corso
  let found = courses.find(c => normalizeCourseName(c.name) === target);
  if (found) return found;

  // 1b. Corrispondenza esatta con eventuale nome originale del corso
  found = courses.find(c => c.originalName && normalizeCourseName(c.originalName) === target);
  if (found) return found;

  // 2. Corrispondenza col nome normalizzato estratto del corso
  found = courses.find(c => normalizeCourseName(courseNameFromTitle(c.name)) === target);
  if (found) return found;

  // 2b. Corrispondenza col nome normalizzato estratto dell'originalName
  found = courses.find(c => c.originalName && normalizeCourseName(courseNameFromTitle(c.originalName)) === target);
  if (found) return found;

  // 3. Match prefisso: se il corso salvato ha un nome breve (es. "Analisi") e il titolo è "Analisi Matematica 1"
  const prefixMatches = courses.filter(c => {
    const cn = normalizeCourseName(c.name);
    const on = c.originalName ? normalizeCourseName(c.originalName) : '';
    return (cn && (target === cn || target.startsWith(cn + ' '))) ||
           (on && (target === on || target.startsWith(on + ' ')));
  });
  if (prefixMatches.length === 1) return prefixMatches[0];

  // 4. Match inverso: se il corso è "Analisi Matematica 1" e il titolo dell'evento è "Analisi"
  const reverseMatches = courses.filter(c => {
    const cn = normalizeCourseName(c.name);
    const on = c.originalName ? normalizeCourseName(c.originalName) : '';
    return (cn && cn.startsWith(target + ' ')) ||
           (on && on.startsWith(target + ' '));
  });
  if (reverseMatches.length === 1) return reverseMatches[0];

  return undefined;
}

/** Converte numeri romani in cifre arabe e normalizza per comparazioni di equivalenza */
export function canonicalizeCourseName(name: string): string {
  let n = normalizeCourseName(name);
  n = n
    .replace(/\bx\b/g, '10')
    .replace(/\bix\b/g, '9')
    .replace(/\bviii\b/g, '8')
    .replace(/\bvii\b/g, '7')
    .replace(/\bvi\b/g, '6')
    .replace(/\biv\b/g, '4')
    .replace(/\bv\b/g, '5')
    .replace(/\biii\b/g, '3')
    .replace(/\bii\b/g, '2')
    .replace(/\bi\b/g, '1');
  return n;
}

/** Estrae eventuale numero di modulo o semestre (es. 1, 2) */
function extractCourseNumber(name: string): string | null {
  const m = canonicalizeCourseName(name).match(/\b([1-9]|10)\b/);
  return m ? m[1] : null;
}

/** Estrae le parole significative escludendo congiunzioni e numeri */
function getCourseWords(name: string): string[] {
  const STOPWORDS = new Set(['di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'ed', 'e', 'per', 'in', 'con', 'su', 'da', 'a', 'and', 'for', 'of']);
  return canonicalizeCourseName(name)
    .split(/\s+/)
    .filter(w => !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

/**
 * Determina se due nomi di corsi si riferiscono allo stesso insegnamento
 * (es. "Systems" e "Systems and Methods for Big and Unstructured Data", "Bayesian Statistics" e "Bayesian Statistics Statistics...").
 */
export function areSameCourse(nameA: string, nameB: string): boolean {
  const cA = canonicalizeCourseName(nameA);
  const cB = canonicalizeCourseName(nameB);
  if (cA === cB) return true;

  const numA = extractCourseNumber(nameA);
  const numB = extractCourseNumber(nameB);
  // Se hanno numeri espliciti diversi (es. Software Engineering 1 vs 2), sono corsi diversi!
  if (numA && numB && numA !== numB) return false;

  const wordsA = getCourseWords(nameA);
  const wordsB = getCourseWords(nameB);
  if (wordsA.length === 0 || wordsB.length === 0) return false;

  const stem = (w: string) => w.replace(/s$/, '');

  // Se uno ha solo una parola radice e l'altro inizia con quella (es. "system" e "systems and methods...")
  if (wordsA.length === 1 && stem(wordsB[0]) === stem(wordsA[0])) return true;
  if (wordsB.length === 1 && stem(wordsA[0]) === stem(wordsB[0])) return true;

  // Se le parole del più corto sono prefisso del più lungo
  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longer = wordsA.length <= wordsB.length ? wordsB : wordsA;
  const isPrefix = shorter.every((w, i) => stem(longer[i]) === stem(w));
  if (isPrefix) return true;

  // Se condividono il numero e la prima parola principale
  if (numA && numB && numA === numB && stem(shorter[0]) === stem(longer[0])) return true;

  return false;
}

/** Punteggio di affidabilità di un candidato nome corso (estratto ESCLUSIVAMENTE dagli eventi) */
function scoreCandidate(name: string, origCourseName: string, eventCount: number): number {
  const norm = normalizeCourseName(name);
  if (!norm || BOGUS_COURSE_NAMES.has(norm) || /^\d+$/.test(norm) || TASK_ACTION_PREFIX.test(name)) return -100000;

  const words = norm.split(/\s+/).filter(Boolean).length;
  let score = words > 1 ? 1000 + words * 50 : 10;

  const origNorm = normalizeCourseName(origCourseName);
  if (origNorm) {
    if (norm === origNorm) score += 100;
    else if (norm.includes(origNorm) || origNorm.includes(norm)) score += 200;
  }

  // Bonus se contiene specificazioni numeriche o romane
  if (/\b(?:[1-9]|I|II|III|IV|V|VI|VII|VIII|IX|X)\b/i.test(name)) {
    score += 50;
  }

  score += eventCount * 10;
  return score;
}

/** Punteggio di qualità del corso per determinare il nome canonico da preservare nel cluster */
function scoreCourseQuality(c: Course, eventCount: number): number {
  if (c.isCustomName) return 1000000; // Priorità massima ai corsi con nome personalizzato o confermato a mano
  const norm = normalizeCourseName(c.name);
  const words = norm.split(/\s+/).filter(Boolean).length;
  let score = words > 1 ? 1000 + words * 50 : 10;
  if (/\b(?:[1-9]|I|II|III|IV|V|VI|VII|VIII|IX|X)\b/i.test(c.name)) score += 100;
  score += eventCount * 20;
  score += c.name.length;
  return score;
}

interface RepairInput {
  courses: Course[];
  events: CalendarEvent[];
  tasks: Task[];
  performanceHistory: PerformanceRecord[];
}

interface RepairResult extends RepairInput {
  changed: boolean;
  repairedCount: number;
}

/**
 * Ripara i corsi:
 * 1. Estrae i nomi dei corsi ESCLUSIVAMENTE dagli eventi del calendario (mai dai task).
 * 2. Rimuove corsi fittizi generati da titoli di task o parole non valide.
 * 3. Rimuove prefissi universitari come "Didattica - " o "Didattica".
 * 4. Risolve bug di ripetizione (es. "STATISTICS STATISTICS...").
 * 5. Deduplica e unifica tutti i corsi doppioni in modo trasparente.
 * 6. Preserva rigorosamente come predefiniti i corsi i cui nomi sono stati modificati a mano dall'utente.
 */
export function repairCourseNames(input: RepairInput): RepairResult {
  let changed = false;
  let repairedCount = 0;
  let courses: Course[] = input.courses.map(c => ({ ...c }));
  let events: CalendarEvent[] = input.events.map(e => ({ ...e }));
  let tasks: Task[] = input.tasks.map(t => ({ ...t }));
  let performanceHistory: PerformanceRecord[] = input.performanceHistory.map(p => ({ ...p }));
  const eventCourseOverride = new Map<string, string>(); // eventId -> new courseId

  // 1. Elimina preventivamente corsi che sono palesemente titoli di task
  const validCourses: Course[] = [];
  const prunedTaskCourseIds = new Set<string>();

  for (const course of courses) {
    const isTaskName = TASK_ACTION_PREFIX.test(course.name.trim());
    if (isTaskName && !course.isCustomName) {
      prunedTaskCourseIds.add(course.id);
      changed = true;
      repairedCount++;
      console.log(`[repairCourseNames] Rimosso corso non valido (nome da task): "${course.name}"`);
    } else {
      validCourses.push(course);
    }
  }
  courses = validCourses;

  // 2. Ripara il nome di ciascun corso basandosi ESCLUSIVAMENTE sugli eventi del calendario
  for (const course of courses) {
    // Se il nome è stato modificato a mano (isCustomName), è predefinito: NON toccare course.name all'apertura!
    if (course.isCustomName) {
      const linkedEvents = events.filter(e => e.courseId === course.id);
      for (const e of linkedEvents) {
        eventCourseOverride.set(e.id, course.id);
      }
      for (const e of events) {
        if (!e.courseId && (e.type === 'lesson' || e.type === 'generic' || !e.type)) {
          const match = findCourseForTitle(e.title, [course]);
          if (match) {
            eventCourseOverride.set(e.id, course.id);
            changed = true;
          }
        }
      }
      continue;
    }

    const cleanedInitial = cleanCourseName(course.name);
    if (cleanedInitial && cleanedInitial !== course.name) {
      course.name = cleanedInitial;
      changed = true;
    }

    const courseNorm = normalizeCourseName(course.name);
    const wordCount = course.name.trim().split(/\s+/).length;
    const isBogusName = BOGUS_COURSE_NAMES.has(courseNorm) || /^\d+$/.test(courseNorm);

    interface CandidateEntry {
      name: string;
      events: CalendarEvent[];
    }
    const candidateMap = new Map<string, CandidateEntry>();

    const recordCandidate = (rawCand: string, ev?: CalendarEvent) => {
      const clean = cleanCourseName(rawCand);
      const key = normalizeCourseName(clean);
      if (!key || BOGUS_COURSE_NAMES.has(key) || /^\d+$/.test(key) || TASK_ACTION_PREFIX.test(clean)) return;
      if (!candidateMap.has(key)) {
        candidateMap.set(key, { name: clean, events: [] });
      }
      const entry = candidateMap.get(key)!;
      if (ev && !entry.events.some(e => e.id === ev.id)) {
        entry.events.push(ev);
      }
    };

    // Candidato dal nome del corso ripulito
    recordCandidate(course.name);

    // Candidati dagli eventi del calendario già collegati al corso
    const linkedEvents = events.filter(e => e.courseId === course.id);
    for (const e of linkedEvents) {
      recordCandidate(e.title, e);
    }

    // Se il nome è a una sola parola o bogus, cerca tra gli eventi del calendario che menzionano il corso
    if (wordCount === 1 || isBogusName || linkedEvents.length === 0) {
      for (const e of events) {
        if (e.type === 'exam' || e.type === 'quiz' || e.type === 'sport' || e.type === 'travel' || e.type === 'meal') continue;
        const eCand = cleanCourseName(e.title);
        const eNorm = normalizeCourseName(eCand);
        if (!eNorm) continue;

        const matchesWord = courseNorm && (
          eNorm === courseNorm ||
          eNorm.startsWith(courseNorm + ' ') ||
          new RegExp(`\\b${courseNorm}\\b`).test(eNorm)
        );

        if (matchesWord && (!e.courseId || e.courseId === course.id || isBogusName)) {
          recordCandidate(eCand, e);
        }
      }
    }

    if (candidateMap.size === 0) {
      const cleaned = cleanCourseName(course.name);
      if (cleaned && cleaned !== course.name) {
        course.name = cleaned;
        changed = true;
        repairedCount++;
      }
      continue;
    }

    // Calcola il miglior candidato usando ESCLUSIVAMENTE gli eventi
    const scoredCandidates = [...candidateMap.values()].map(entry => ({
      ...entry,
      score: scoreCandidate(entry.name, course.name, entry.events.length),
    })).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.name.length - a.name.length;
    });

    const best = scoredCandidates[0];

    if (best && best.score > 0 && best.name !== course.name) {
      const oldName = course.name;
      course.name = best.name;
      changed = true;
      repairedCount++;
      console.log(`[repairCourseNames] Corso "${oldName}" riparato in "${best.name}"`);
    }

    if (best) {
      for (const e of best.events) {
        if (e.courseId !== course.id) {
          eventCourseOverride.set(e.id, course.id);
          changed = true;
        }
      }
    }
  }

  // 3. Raggruppa e deduplica semanticamente tutti i corsi (rimuove doppioni e varianti)
  const clusters: Course[][] = [];
  const courseEventCounts = new Map<string, number>();

  for (const c of courses) {
    const eCount = events.filter(e => (eventCourseOverride.get(e.id) || e.courseId) === c.id).length;
    courseEventCounts.set(c.id, eCount);
  }

  for (const course of courses) {
    const norm = normalizeCourseName(course.name);
    // Elimina etichette riservate o vuote solo se non è un corso personalizzato a mano
    if (!course.isCustomName && (BOGUS_COURSE_NAMES.has(norm) || /^\d+$/.test(norm) || TASK_ACTION_PREFIX.test(course.name))) {
      changed = true;
      continue;
    }

    let matchedCluster: Course[] | null = null;
    for (const cluster of clusters) {
      // Due corsi entrambi impostati/creati a mano dall'utente non devono essere unificati forzatamente
      const hasCustom = cluster.some(c => c.isCustomName);
      if (course.isCustomName && hasCustom) {
        continue;
      }

      if (cluster.some(existing => (
        areSameCourse(existing.name, course.name) ||
        (existing.originalName && areSameCourse(existing.originalName, course.name)) ||
        (course.originalName && areSameCourse(existing.name, course.originalName))
      ))) {
        matchedCluster = cluster;
        break;
      }
    }
    if (matchedCluster) {
      matchedCluster.push(course);
    } else {
      clusters.push([course]);
    }
  }

  const uniqueCourses: Course[] = [];
  const courseIdRemap = new Map<string, string>(); // oldCourseId -> keptCourseId

  for (const cluster of clusters) {
    cluster.sort((a, b) => {
      // Un corso personalizzato o confermato a mano ha priorità assoluta come canonico
      if (a.isCustomName && !b.isCustomName) return -1;
      if (!a.isCustomName && b.isCustomName) return 1;
      const sa = scoreCourseQuality(a, courseEventCounts.get(a.id) || 0);
      const sb = scoreCourseQuality(b, courseEventCounts.get(b.id) || 0);
      return sb - sa;
    });

    const canonical = cluster[0];
    // Se unifichiamo un duplicato verso un corso custom, assicuriamoci che conservi l'originalName se assente
    if (cluster.length > 1 && canonical.isCustomName && !canonical.originalName) {
      const nonCustom = cluster.find(c => !c.isCustomName && c.name);
      if (nonCustom) {
        canonical.originalName = nonCustom.name;
      }
    }
    uniqueCourses.push(canonical);

    if (cluster.length > 1) {
      changed = true;
      for (let i = 1; i < cluster.length; i++) {
        courseIdRemap.set(cluster[i].id, canonical.id);
        repairedCount++;
        console.log(`[repairCourseNames] Unificato corso duplicato "${cluster[i].name}" in "${canonical.name}"`);
      }
    }
  }

  // 4. Applica remap e override sugli eventi
  events = events.map(e => {
    let newCourseId = eventCourseOverride.get(e.id) || e.courseId;
    if (newCourseId && courseIdRemap.has(newCourseId)) {
      newCourseId = courseIdRemap.get(newCourseId);
    }

    if (!newCourseId && e.type !== 'exam' && e.type !== 'quiz' && e.type !== 'sport' && e.type !== 'travel' && e.type !== 'meal') {
      const match = findCourseForTitle(e.title, uniqueCourses);
      if (match) {
        newCourseId = match.id;
      }
    }

    let updatedTitle = collapseDuplicateWords(e.title);
    if (newCourseId) {
      const targetCourse = uniqueCourses.find(c => c.id === newCourseId);
      if (targetCourse) {
        const cleanTitleStr = cleanCourseName(updatedTitle);
        const matchesOriginal = Boolean(targetCourse.originalName && (
          normalizeCourseName(updatedTitle) === normalizeCourseName(targetCourse.originalName) ||
          normalizeCourseName(cleanTitleStr) === normalizeCourseName(targetCourse.originalName)
        ));
        if (
          updatedTitle.trim().split(/\s+/).length <= 2 ||
          SSD_CODE.test(updatedTitle) ||
          NUMERIC_CODE.test(updatedTitle) ||
          normalizeCourseName(updatedTitle) === normalizeCourseName(targetCourse.name) ||
          matchesOriginal
        ) {
          updatedTitle = targetCourse.name;
        } else if (cleanTitleStr && cleanTitleStr !== updatedTitle && cleanTitleStr.split(/\s+/).length >= 2) {
          updatedTitle = cleanTitleStr;
        }
      }
    }

    const titleChanged = updatedTitle !== e.title;
    const courseChanged = newCourseId !== e.courseId;

    if (titleChanged || courseChanged) {
      changed = true;
      return {
        ...e,
        title: updatedTitle,
        courseId: newCourseId,
        type: (e.type === 'generic' || !e.type) ? ('lesson' as const) : e.type,
      };
    }
    return e;
  });

  // 5. Aggiorna i task: ripara i titoli con parole duplicate e allinea courseId
  const taskCourseOverride = new Map<string, string>();
  tasks = tasks.map(t => {
    let newCourseId = t.courseId;
    if (t.relatedEventId && eventCourseOverride.has(t.relatedEventId)) {
      newCourseId = eventCourseOverride.get(t.relatedEventId)!;
    }
    if (newCourseId && courseIdRemap.has(newCourseId)) {
      newCourseId = courseIdRemap.get(newCourseId)!;
    }
    // Se il task era assegnato a un corso-task rimosso, azzera o riallinea all'evento
    if (newCourseId && prunedTaskCourseIds.has(newCourseId)) {
      const relatedEv = events.find(e => e.id === t.relatedEventId);
      newCourseId = relatedEv?.courseId || undefined;
      changed = true;
    }

    // Pulisci parole duplicate nel titolo del task (es. "STATISTICS STATISTICS...")
    const cleanTitle = collapseDuplicateWords(t.title);
    const titleChanged = cleanTitle !== t.title;
    const courseChanged = newCourseId !== t.courseId;

    if (titleChanged || courseChanged) {
      if (newCourseId) taskCourseOverride.set(t.id, newCourseId);
      changed = true;
      return { ...t, title: cleanTitle, courseId: newCourseId };
    }
    return t;
  });

  // 6. Aggiorna la cronologia delle performance
  if (taskCourseOverride.size > 0 || courseIdRemap.size > 0 || prunedTaskCourseIds.size > 0) {
    performanceHistory = performanceHistory.map(p => {
      let newCourseId = p.courseId;
      if (taskCourseOverride.has(p.taskId)) {
        newCourseId = taskCourseOverride.get(p.taskId)!;
      }
      if (newCourseId && courseIdRemap.has(newCourseId)) {
        newCourseId = courseIdRemap.get(newCourseId)!;
      }
      if (newCourseId && prunedTaskCourseIds.has(newCourseId)) {
        newCourseId = undefined as any;
      }
      if (newCourseId !== p.courseId) {
        changed = true;
        return { ...p, courseId: newCourseId };
      }
      return p;
    });
  }

  return {
    courses: uniqueCourses,
    events,
    tasks,
    performanceHistory,
    changed,
    repairedCount,
  };
}
