import type {
  AssessmentType,
  CalendarEvent,
  Course,
  DocumentKind,
  ParsedAssessment,
  ParsedLessonNote,
  ParsedTopic,
  SyllabusExtractionResult,
} from './types';
import { callAI } from './aiClient';
import { normalizeDate } from './SyllabusParser';
import { normalizeLessonType } from './SyllabusMatcher';
import { localDateKey } from './lessonLink';

const MAX_DOC_CHARS = 120_000;
const MAX_DOC_LINES = 2500;

/** Riduce il testo grezzo (spazi, righe vuote) per contenere i token inviati all'AI. */
function compressDocumentText(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.replace(/[ \t]+/g, ' ').trim())
    .filter(l => l.length > 0 && !l.startsWith('--- PAGE BREAK'));
  return lines.slice(0, MAX_DOC_LINES).join('\n').slice(0, MAX_DOC_CHARS);
}

function short(text: string | undefined, max: number): string {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * Resoconto attuale della materia, dato all'AI insieme a ogni nuovo documento: serve a non
 * ri-estrarre ciò che già si sa e a mantenere la visione d'insieme del corso.
 */
export function buildCourseContext(course: Course, events: CalendarEvent[]): string {
  const info = course.info ?? {};
  const out: string[] = [`Corso: ${course.name}`];

  out.push(`Panoramica: ${short(info.overview, 600) || '(nessuna)'}`);
  out.push(`Composizione della valutazione: ${short(info.gradingSummary, 300) || '(sconosciuta)'}`);
  out.push(`Pianificazione dello studio: ${short(info.studyPlan, 400) || '(nessuna)'}`);

  const assessments = info.assessments ?? [];
  out.push(`Prove e scadenze già registrate (${assessments.length}):`);
  for (const a of assessments.slice(0, 40)) {
    out.push(
      `- [${a.type}] ${a.title}${a.date ? ` — ${a.date}${a.time ? ` ${a.time}` : ''}` : ' — data non definita'}` +
        `${a.weightPercent != null ? ` — peso ${a.weightPercent}%` : ''}${a.done ? ' — svolta' : ''}`
    );
  }
  if (assessments.length === 0) out.push('- (nessuna)');

  const topics = info.topics ?? [];
  out.push(`Indice degli argomenti già registrato (${topics.length} voci):`);
  out.push(topics.length ? topics.slice(0, 80).map(t => (t.part ? `${t.part} › ${t.title}` : t.title)).join('; ') : '- (vuoto)');

  const plan = [...(info.lessonPlan ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  out.push(`Calendario lezioni già registrato (${plan.length} lezioni${plan.length ? `, dal ${plan[0].date} al ${plan[plan.length - 1].date}` : ''}):`);
  for (const l of plan.slice(0, 60)) {
    out.push(`- ${l.date}${l.startTime ? ` ${l.startTime}` : ''}: ${l.topic}${l.cancelled ? ' (nessuna lezione)' : ''}`);
  }
  if (plan.length > 60) out.push(`- … e altre ${plan.length - 60} lezioni`);

  const courseEvents = events.filter(e => e.courseId === course.id);
  const lessons = courseEvents.filter(e => e.type === 'lesson').sort((a, b) => a.startTime.localeCompare(b.startTime));
  if (lessons.length) {
    out.push(
      `Nel calendario generale ci sono ${lessons.length} lezioni di questo corso (dal ${localDateKey(lessons[0].startTime)} ` +
        `al ${localDateKey(lessons[lessons.length - 1].startTime)}), di cui ${lessons.filter(l => l.topic).length} con argomento già assegnato.`
    );
  }
  const verifiche = courseEvents.filter(e => e.type === 'exam' || e.type === 'quiz' || e.type === 'project_deadline');
  for (const e of verifiche.slice(0, 20)) out.push(`Evento in calendario: [${e.type}] ${e.title} — ${localDateKey(e.startTime)}`);

  const docs = info.documents ?? [];
  if (docs.length) out.push(`Documenti già analizzati: ${docs.slice(-10).map(d => `${d.name} (${d.kind})`).join(', ')}`);

  return out.join('\n');
}

export function buildAnalysisPrompt(
  documentText: string,
  fileName: string,
  course: Course,
  courseContext: string,
  defaultYear: number
): string {
  const today = new Date().toISOString().substring(0, 10);
  return `
Sei l'assistente di uno studente universitario. Ti viene dato un documento relativo al corso "${course.name}" (file: "${fileName}").
Oggi è ${today}. Anno di riferimento per le date senza anno: ${defaultYear} (un anno accademico va da settembre a giugno: le date di gennaio-giugno cadono nell'anno solare successivo a quello di settembre-dicembre).

═══ RESOCONTO ATTUALE DELLA MATERIA (già in possesso dell'app) ═══
${courseContext}
═══════════════════════════════════════════════════════════════

COMPITO: capisci da solo che tipo di documento è ed estrai con accuratezza le informazioni presenti.
Esegui un MERGE BILANCIATO tra le informazioni che possiedi già nel resoconto e quelle del nuovo documento:
- Non dare più importanza a nessuna delle due fonti: integrane le informazioni in modo complementare.
- Se il nuovo documento contiene dettagli aggiuntivi, date più precise, capitoli o spiegazioni non presenti nel resoconto, includili.
- Se il documento conferma ciò che è già noto senza aggiungere nulla di nuovo, ometti la voce o restituiscine i dati consolidati.
- Se il documento tratta nuovi argomenti, lezioni o scadenze non ancora presenti, estraili per intero.
Il documento può contenere una o più di queste informazioni:
 a) calendario/programma delle lezioni con date → "lessons"
 b) indice, programma o elenco degli argomenti del corso → "topics"
 c) modalità di valutazione (quiz, laboratori, esame scritto/orale, progetti, pesi) → "assessments" e "gradingSummary"
 d) date di prove e SCADENZE (consegne, iscrizioni, progetti, homework, deadline) → "assessments" (type "deadline" per le scadenze di consegna)
 e) consigli o pianificazione dello studio → "studyPlan"
 f) descrizione generale del corso → "overview"

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questa struttura (campi non pertinenti: array vuoti / omessi):
{
  "documentKind": "lesson_calendar" | "syllabus" | "exam_info" | "study_plan" | "deadlines" | "other",
  "documentSummary": "una frase su cosa contiene il documento",
  "overview": "riassunto generale del corso (solo se il documento lo descrive)",
  "gradingSummary": "composizione della valutazione in poche parole, es. '2 quiz + laboratorio + esame scritto'",
  "studyPlan": "pianificazione dello studio suggerita dal documento",
  "lessons": [
    {
      "rawDate": "data come scritta", "parsedDate": "YYYY-MM-DD", "startTime": "HH:mm", "endTime": "HH:mm",
      "room": "aula", "lecturer": "docente", "topic": "argomento della lezione",
      "lessonType": "theory" | "exercise" | "theory_exercise" | "lab",
      "coursePart": "macro-argomento", "sectionsOrChapters": "capitoli/sezioni del libro",
      "readingsOrLinks": ["url o riferimenti"], "isCancelled": false
    }
  ],
  "topics": [ { "title": "argomento", "part": "modulo/macro-argomento", "details": "dettagli brevi" } ],
  "assessments": [
    {
      "type": "quiz" | "lab" | "exam" | "oral" | "project" | "deadline" | "other",
      "title": "es. 'Quiz 1', 'Esame scritto', 'Consegna progetto'",
      "weightPercent": 30, "date": "YYYY-MM-DD", "time": "HH:mm", "notes": "dettagli utili"
    }
  ]
}

Regole per le lezioni: una riga per lezione/esercitazione; "lessonType" = "exercise" per "EXE", "Esercitazione", "Exercises"; "lab" per i laboratori; "isCancelled": true per "NO CLASS", "Vacanza", "Sospensione". Escludi righe di riepilogo totali.
Regole per le prove: se il documento dice "2 quiz" senza date, crea comunque due voci ("Quiz 1", "Quiz 2") senza data. Il campo "date" solo se la data è scritta nel documento.
Le date vanno sempre in formato ISO "YYYY-MM-DD", gli orari in formato 24h.

DOCUMENTO:
"""
${compressDocumentText(documentText)}
"""
`;
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function isoDate(v: unknown, year: number): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const n = normalizeDate(s, year);
  return /^\d{4}-\d{2}-\d{2}$/.test(n) ? n : undefined;
}

function hhmm(v: unknown): string | undefined {
  const s = str(v);
  const m = s?.match(/(\d{1,2})[:.](\d{2})/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
}

const ASSESSMENT_TYPES: AssessmentType[] = ['quiz', 'lab', 'exam', 'oral', 'project', 'deadline', 'other'];
const DOCUMENT_KINDS: DocumentKind[] = ['lesson_calendar', 'syllabus', 'exam_info', 'study_plan', 'deadlines', 'other'];

function parseJsonLoose(text: string): Record<string, unknown> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first < 0 || last <= first) throw new Error("Impossibile decodificare la risposta dell'AI.");
    try {
      parsed = JSON.parse(cleaned.slice(first, last + 1));
    } catch {
      throw new Error("Risposta dell'AI incompleta (documento troppo lungo?). Prova con un file più breve.");
    }
  }
  if (Array.isArray(parsed)) return { lessons: parsed };
  return (parsed && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
}

/** Normalizza la risposta grezza dell'AI nel formato interno (difensivo: l'AI può omettere o sbagliare campi). */
export function normalizeExtraction(raw: Record<string, unknown>, year: number): Omit<SyllabusExtractionResult, 'tokensUsed' | 'modelUsed' | 'courseName'> {
  const lessonsRaw = (Array.isArray(raw.lessons) ? raw.lessons : Array.isArray(raw.lectures) ? raw.lectures : []) as Array<Record<string, unknown>>;
  const lessons: ParsedLessonNote[] = lessonsRaw
    .filter(l => l && typeof l === 'object')
    .map((l, i) => {
      const rawDate = str(l.rawDate) ?? str(l.parsedDate) ?? '';
      return {
        id: `syllabus-lesson-${i + 1}`,
        rawDate,
        parsedDate: isoDate(l.parsedDate, year) ?? isoDate(rawDate, year),
        startTime: hhmm(l.startTime),
        endTime: hhmm(l.endTime),
        room: str(l.room),
        lecturer: str(l.lecturer),
        topic: str(l.topic) ?? '',
        lessonType: normalizeLessonType(l.lessonType),
        coursePart: str(l.coursePart),
        sectionsOrChapters: str(l.sectionsOrChapters),
        readingsOrLinks: Array.isArray(l.readingsOrLinks) ? l.readingsOrLinks.filter((x): x is string => typeof x === 'string' && !!x.trim()) : [],
        isCancelled: Boolean(l.isCancelled),
      };
    })
    .filter(l => l.parsedDate && (l.topic || l.isCancelled));

  const assessmentsRaw = (Array.isArray(raw.assessments) ? raw.assessments : Array.isArray(raw.deadlines) ? raw.deadlines : []) as Array<Record<string, unknown>>;
  const assessments: ParsedAssessment[] = assessmentsRaw
    .filter(a => a && typeof a === 'object' && str(a.title))
    .map(a => {
      const weight = typeof a.weightPercent === 'number' ? a.weightPercent : Number(a.weightPercent);
      return {
        type: ASSESSMENT_TYPES.includes(a.type as AssessmentType) ? (a.type as AssessmentType) : 'other',
        title: str(a.title)!,
        weightPercent: Number.isFinite(weight) && weight > 0 ? Math.min(100, weight) : undefined,
        date: isoDate(a.date, year),
        time: hhmm(a.time),
        notes: str(a.notes),
      };
    });

  const topicsRaw = (Array.isArray(raw.topics) ? raw.topics : []) as Array<Record<string, unknown> | string>;
  const topics: ParsedTopic[] = topicsRaw
    .map(t => (typeof t === 'string' ? { title: t } : t))
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object' && !!str((t as Record<string, unknown>).title))
    .map(t => ({ title: str(t.title)!, part: str(t.part), details: str(t.details) }));

  const kind = DOCUMENT_KINDS.includes(raw.documentKind as DocumentKind)
    ? (raw.documentKind as DocumentKind)
    : lessons.length ? 'lesson_calendar' : topics.length ? 'syllabus' : assessments.length ? 'exam_info' : 'other';

  return {
    documentKind: kind,
    documentSummary: str(raw.documentSummary),
    overview: str(raw.overview),
    gradingSummary: str(raw.gradingSummary),
    studyPlan: str(raw.studyPlan),
    lessons,
    assessments,
    topics,
    totalExtracted: lessons.length + assessments.length + topics.length,
  };
}

/**
 * Analizza un documento del corso con l'AI (tramite proxy server-side) tenendo conto del
 * resoconto attuale della materia. L'AI decide da sola quali informazioni estrarre.
 */
export async function analyzeCourseDocument(
  rawContent: string,
  fileName: string,
  course: Course,
  events: CalendarEvent[],
  defaultYear: number = new Date().getFullYear()
): Promise<SyllabusExtractionResult> {
  if (!compressDocumentText(rawContent).trim()) {
    throw new Error('Il documento è vuoto o non contiene testo leggibile.');
  }

  const prompt = buildAnalysisPrompt(rawContent, fileName, course, buildCourseContext(course, events), defaultYear);
  const response = await callAI(prompt);
  const normalized = normalizeExtraction(parseJsonLoose(response.text), defaultYear);

  return {
    ...normalized,
    courseName: course.name,
    tokensUsed: response.tokens,
    modelUsed: response.model,
  };
}

