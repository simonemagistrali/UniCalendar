/**
 * courseNames — Estrazione robusta del nome del corso dal titolo di un evento
 * e riparazione automatica dei corsi salvati con nomi troncati (es. solo la prima parola).
 */
import type { CalendarEvent, Course, Task, PerformanceRecord } from './types';
import { v4 as uuidv4 } from 'uuid';

/** Prefissi comuni nei calendari universitari che indicano la tipologia dell'evento */
const LESSON_PREFIX = /^\s*(?:lezione|lezioni|lez\.?|lecture|lesson|esercitazione|esercitazioni|eserc\.?|laboratorio|lab\.?|teoria|corso|insegnamento)\b\.?\s*(?:n\.?\s*\d+|#?\d+|\d+)?\s*(?:[:\-–—|]\s*)?(?:(?:di|del|della|dello|dei|degli|delle|of|on|in)\s+|d['’]\s*)?(?:[:\-–—|]\s*)?/i;

/** Prefissi di codici di corso: es. [INF-01], (084723), o 084723 - (deve contenere almeno una cifra!) */
const LEADING_CODE_OR_BRACKET = /^\s*(?:\[[^\]]+\]|\([^)]+\))\s*[-–—|:]?\s*/;
const LEADING_NUMERIC_CODE = /^\s*(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{4,12}\s*[-–—|:]\s*/;

/** Nomi di docenti all'inizio del titolo: es. "Prof. Mario Rossi - ", "Docente: Rossi - " */
const LEADING_INSTRUCTOR = /^\s*(?:prof\.?|prof\.ssa|docente|dott\.?|ing\.?)\s+[A-Za-zÀ-ÿ'\s]+[-–—|:]\s*/i;

/** Segmenti che indicano chiaramente metadati/informazioni accessorie (aula, docente, canale, modalità, ecc.) */
const ACCESSORY_SEGMENT = /^(?:aula|room|edificio|sede|plesso|piano|prof\.?|prof\.ssa|docente|dott\.?|ing\.?|canale|gruppo|sez\.?|sezione|telematico|online|in presenza|presenza|remoto|zoom|teams|meet|cfu|crediti|semestre|anno)\b/i;
const ACCESSORY_LESSON_SEGMENT = /^(?:lezione|lez\.?|lecture|lesson|esercitazione|eserc\.?|laboratorio|lab\.?|teoria)\s*(?:n\.?\s*\d+|#\d+|\d+)?$/i;
const ACCESSORY_TAG = /^(?:n\.?\s*|#)\d+$/i;

/** Code accessorie da ripulire in fondo al nome */
const TRAILING_NOISE = [
  /[\s,]+(?:aula|room|edificio|sede|plesso|prof\.?|prof\.ssa|docente|dott\.?|ing\.?)\b.*$/i,
  /[\s,]+(?:lezione|lez\.?|lecture|lesson)\s*(?:n\.?\s*)?#?\d*\s*$/i,
  /[\s,]+(?:esercitazione|esercitazioni|teoria|laboratorio|lab\.?)\s*$/i,
  /[\s,]+(?:n\.?\s*|#)\d+\s*$/i,
  /[\s:,.\-–—|/]+$/,
];

function stripPrefixes(text: string): string {
  let prev = '';
  let cur = text.trim();
  while (cur !== prev) {
    prev = cur;
    cur = cur
      .replace(LEADING_CODE_OR_BRACKET, '')
      .replace(LEADING_NUMERIC_CODE, '')
      .replace(LEADING_INSTRUCTOR, '')
      .replace(LESSON_PREFIX, '')
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
 * Estrae il nome completo del corso dal titolo di un evento.
 * Gestisce correttamente:
 * - Titoli universitari con trattini intermedi: "ANALISI - MATEMATICA 1 - AULA 3" → "Analisi Matematica 1"
 * - Prefissi di tipo lezione: "Lezione di Ingegneria del Software" → "Ingegneria del Software"
 * - Codici corso o docenti: "084723 - SISTEMI OPERATIVI" → "Sistemi Operativi"
 * - Informazioni accessorie tra parentesi: "Economia Aziendale (Canale A)" → "Economia Aziendale"
 */
export function extractCourseName(title: string): string {
  if (!title) return '';

  // 1. Rimuovi prefissi iniziali (codici numerici, prefisso lezione, docente iniziale)
  let name = stripPrefixes(title.replace(/\s+/g, ' '));

  // 2. Rimuovi parentesi con informazioni accessorie (docente, aula, canale, cfu...)
  name = name.replace(/\s*\((?:prof\.?|docente|aula|edificio|canale|gruppo|sede|ore|cfu)[^)]*\)/gi, '');
  name = name.replace(/\s*\[(?:prof\.?|docente|aula|edificio|canale|gruppo|sede|ore|cfu)[^\]]*\]/gi, '');

  // 3. Dividi sui separatori principali: " - ", " – ", " — ", " | ", " ; ", " / ", " @ "
  const rawSegments = name.split(/\s+[-–—|/]\s+|\s*;\s*|\s+@\s+/).map(s => s.trim()).filter(Boolean);

  const keptSegments: string[] = [];
  for (let i = 0; i < rawSegments.length; i++) {
    const seg = stripPrefixes(rawSegments[i]);
    if (!seg) continue;

    // Se il segmento è palesemente un'informazione accessoria, interrompi la raccolta
    if (ACCESSORY_SEGMENT.test(seg) || ACCESSORY_LESSON_SEGMENT.test(seg) || ACCESSORY_TAG.test(seg)) {
      break;
    }

    // Se contiene menzione di aula o docente all'interno del segmento, ripuliscila e fermati
    if (/\b(?:prof\.?|prof\.ssa|docente|aula|edificio|sede)\b/i.test(seg)) {
      const cleaned = seg.replace(/[\s,]+(?:aula|room|edificio|sede|prof\.?|prof\.ssa|docente)\b.*$/i, '').trim();
      if (cleaned) keptSegments.push(cleaned);
      break;
    }

    keptSegments.push(seg);
  }

  let result = keptSegments.length > 0 ? keptSegments.join(' ') : name;

  // 4. Ripulisci eventuale rumore di coda residuo
  let prev = '';
  while (result !== prev) {
    prev = result;
    for (const re of TRAILING_NOISE) result = result.replace(re, '').trim();
  }

  return formatCourseTitleCase(result.trim());
}

/** Nome corso dal titolo, con fallback al titolo intero se l'estrazione fallisce */
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

/** Trova il corso corrispondente al titolo di un evento (gestisce match esatto e prefisso/estensione) */
export function findCourseForTitle(title: string, courses: Course[]): Course | undefined {
  const extracted = courseNameFromTitle(title);
  const target = normalizeCourseName(extracted);
  if (!target) return undefined;

  // 1. Corrispondenza esatta col nome normalizzato del corso
  let found = courses.find(c => normalizeCourseName(c.name) === target);
  if (found) return found;

  // 2. Corrispondenza col nome normalizzato estratto del corso
  found = courses.find(c => normalizeCourseName(courseNameFromTitle(c.name)) === target);
  if (found) return found;

  // 3. Match prefisso: se il corso salvato ha un nome breve (es. "Analisi") e il titolo è "Analisi Matematica 1"
  const prefixMatches = courses.filter(c => {
    const cn = normalizeCourseName(c.name);
    return cn && (target === cn || target.startsWith(cn + ' '));
  });
  if (prefixMatches.length === 1) return prefixMatches[0];

  // 4. Match inverso: se il corso è "Analisi Matematica 1" e il titolo dell'evento è "Analisi"
  const reverseMatches = courses.filter(c => {
    const cn = normalizeCourseName(c.name);
    return cn && cn.startsWith(target + ' ');
  });
  if (reverseMatches.length === 1) return reverseMatches[0];

  return undefined;
}

const COURSE_COLORS = ['#1a73e8', '#d93025', '#188038', '#f29900', '#a142f4', '#e8710a', '#1967d2', '#c5221f'];

interface RepairInput {
  courses: Course[];
  events: CalendarEvent[];
  tasks: Task[];
  performanceHistory: PerformanceRecord[];
}

interface RepairResult extends RepairInput {
  changed: boolean;
}

/**
 * Ripara i corsi salvati con nomi troncati (es. solo la prima parola salvata in precedenza).
 * - Identifica corsi con nomi a parola singola o prefissi e cerca negli eventi del calendario
 *   il nome reale e completo (es. "Analisi" → "Analisi Matematica 1").
 * - Se più corsi diversi erano stati salvati sotto lo stesso prefisso, li separa correttamente.
 * - Collega le lezioni orfane o con type generico al corso corrispondente.
 * - Aggiorna coerentemente corsi, eventi, task e cronologia performance.
 * - Idempotente: una seconda esecuzione non produce ulteriori modifiche.
 */
export function repairCourseNames(input: RepairInput): RepairResult {
  let changed = false;
  const courses = input.courses.map(c => ({ ...c }));
  let events = input.events.map(e => ({ ...e }));
  const eventCourseOverride = new Map<string, string>(); // eventId → nuovo courseId

  for (const course of [...courses]) {
    const courseNorm = normalizeCourseName(course.name);

    // Eventi collegati a questo corso (sia lesson che generic o altro, escluso exam)
    const linked = events.filter(e => (e.courseId === course.id || eventCourseOverride.get(e.id) === course.id) && e.type !== 'exam');

    // Se il corso ha solo una parola o nessun evento collegato, cerca tra gli eventi orfani che iniziano col nome del corso
    const wordCount = course.name.trim().split(/\s+/).length;
    if (linked.length === 0 || wordCount === 1) {
      const candidatesFromUnlinked = events.filter(e => {
        if (e.type === 'exam' || e.type === 'sport' || e.type === 'travel' || e.type === 'meal') return false;
        if (e.courseId && e.courseId !== course.id) return false;
        const extracted = courseNameFromTitle(e.title);
        const norm = normalizeCourseName(extracted);
        return norm === courseNorm || norm.startsWith(courseNorm + ' ');
      });
      for (const e of candidatesFromUnlinked) {
        if (!linked.some(l => l.id === e.id)) linked.push(e);
      }
    }

    if (linked.length === 0) {
      const cleaned = extractCourseName(course.name);
      if (cleaned && cleaned !== course.name) {
        course.name = cleaned;
        changed = true;
      }
      continue;
    }

    // Raggruppa gli eventi per nome estratto completo
    const groups = new Map<string, { name: string; events: CalendarEvent[] }>();
    for (const e of linked) {
      const name = courseNameFromTitle(e.title);
      if (!name) continue;
      const key = normalizeCourseName(name);
      if (!groups.has(key)) groups.set(key, { name, events: [] });
      groups.get(key)!.events.push(e);
    }
    if (groups.size === 0) continue;

    // Ordina per frequenza (e a parità di frequenza per lunghezza del nome)
    const sorted = [...groups.entries()].sort((a, b) => {
      const freqDiff = b[1].events.length - a[1].events.length;
      if (freqDiff !== 0) return freqDiff;
      return b[1].name.length - a[1].name.length;
    });

    const [, bestGroup] = sorted[0];

    // Se il miglior nome estratto è più completo del vecchio nome salvato
    if (bestGroup.name && bestGroup.name !== course.name) {
      const bestNorm = normalizeCourseName(bestGroup.name);
      if (bestNorm === courseNorm || bestNorm.startsWith(courseNorm + ' ') || wordCount === 1) {
        course.name = bestGroup.name;
        changed = true;
      }
    }

    // Collega gli eventi al corso
    for (const e of bestGroup.events) {
      if (e.courseId !== course.id) {
        eventCourseOverride.set(e.id, course.id);
        changed = true;
      }
    }

    // Se c'erano più corsi distinti fusi insieme (es. Analisi 1 e Analisi 2)
    for (const [key, group] of sorted.slice(1)) {
      if (key === normalizeCourseName(course.name)) continue;
      let target = courses.find(c => c.id !== course.id && normalizeCourseName(c.name) === key);
      if (!target) {
        target = {
          ...course,
          id: uuidv4(),
          name: group.name,
          color: COURSE_COLORS[courses.length % COURSE_COLORS.length],
        };
        courses.push(target);
        changed = true;
      }
      for (const e of group.events) {
        eventCourseOverride.set(e.id, target.id);
        changed = true;
      }
    }
  }

  // Deduplica eventuali corsi che ora condividono lo stesso nome normalizzato
  const uniqueCourses: Course[] = [];
  const courseIdRemap = new Map<string, string>();
  for (const c of courses) {
    const norm = normalizeCourseName(c.name);
    const existing = uniqueCourses.find(u => normalizeCourseName(u.name) === norm);
    if (existing) {
      courseIdRemap.set(c.id, existing.id);
      changed = true;
    } else {
      uniqueCourses.push(c);
    }
  }

  // Applica remap e override sugli eventi
  events = events.map(e => {
    let newCourseId = eventCourseOverride.get(e.id) || e.courseId;
    if (newCourseId && courseIdRemap.has(newCourseId)) {
      newCourseId = courseIdRemap.get(newCourseId);
    }
    // Se non ha corso associato, prova ad associarlo
    if (!newCourseId && e.type !== 'exam' && e.type !== 'sport' && e.type !== 'travel' && e.type !== 'meal') {
      const match = findCourseForTitle(e.title, uniqueCourses);
      if (match) {
        newCourseId = match.id;
        changed = true;
      }
    }
    if (newCourseId !== e.courseId) {
      changed = true;
      return {
        ...e,
        courseId: newCourseId,
        type: (e.type === 'generic' || !e.type) ? ('lesson' as const) : e.type
      };
    }
    return e;
  });

  let tasks = input.tasks;
  let performanceHistory = input.performanceHistory;

  // Aggiorna i task il cui relatedEventId o courseId è stato modificato
  const taskCourseOverride = new Map<string, string>();
  tasks = tasks.map(t => {
    let newCourseId = t.courseId;
    if (t.relatedEventId && eventCourseOverride.has(t.relatedEventId)) {
      newCourseId = eventCourseOverride.get(t.relatedEventId)!;
    }
    if (newCourseId && courseIdRemap.has(newCourseId)) {
      newCourseId = courseIdRemap.get(newCourseId)!;
    }
    if (newCourseId !== t.courseId) {
      taskCourseOverride.set(t.id, newCourseId!);
      changed = true;
      return { ...t, courseId: newCourseId };
    }
    return t;
  });

  if (taskCourseOverride.size > 0 || courseIdRemap.size > 0) {
    performanceHistory = performanceHistory.map(p => {
      let newCourseId = p.courseId;
      if (taskCourseOverride.has(p.taskId)) {
        newCourseId = taskCourseOverride.get(p.taskId)!;
      }
      if (courseIdRemap.has(newCourseId)) {
        newCourseId = courseIdRemap.get(newCourseId)!;
      }
      if (newCourseId !== p.courseId) {
        changed = true;
        return { ...p, courseId: newCourseId };
      }
      return p;
    });
  }

  if (!changed) return { ...input, changed: false };
  return { courses: uniqueCourses, events, tasks, performanceHistory, changed: true };
}
