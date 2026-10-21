import type { ParsedLessonNote, SyllabusExtractionResult } from './types';

/**
 * Extracts raw textual content from a PDF file preserving layout order.
 */
export async function extractTextFromPDF(fileData: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.111/pdf.worker.min.js';
  }
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(fileData) });
  const pdfDoc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    
    // Group text items by roughly identical Y-coordinate to keep rows intact
    const items = content.items as Array<{ str: string; transform: number[] }>;
    if (!items || items.length === 0) continue;

    // Sort items top-to-bottom, left-to-right
    const sorted = [...items].sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 6) return yDiff; // Different line
      return a.transform[4] - b.transform[4]; // Same line, left to right
    });

    let currentY = sorted[0]?.transform[5] ?? 0;
    let line = '';
    const lines: string[] = [];

    for (const it of sorted) {
      if (!it.str) continue;
      const y = it.transform[5];
      if (Math.abs(y - currentY) > 6) {
        if (line.trim()) lines.push(line.trim());
        line = it.str;
        currentY = y;
      } else {
        line += (line ? ' \t ' : '') + it.str.trim();
      }
    }
    if (line.trim()) lines.push(line.trim());

    pageTexts.push(lines.join('\n'));
  }

  return pageTexts.join('\n--- PAGE BREAK ---\n');
}

/**
 * Extracts raw tabular content from an Excel file (.xlsx, .xls) or CSV.
 */
export async function extractTextFromExcel(fileData: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(fileData, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  if (!sheetNames || sheetNames.length === 0) {
    throw new Error('Nessun foglio trovato nel file Excel.');
  }

  // Use the first sheet
  const sheet = workbook.Sheets[sheetNames[0]];
  // Convert to CSV with pipe delimiter for clear separation
  const csv = XLSX.utils.sheet_to_csv(sheet, { FS: ' | ' });
  return csv;
}

/**
 * Compresses raw text by trimming headers, multiple spaces and blank lines
 * to drastically minimize the token count sent to Gemini.
 */
function compressTableText(text: string): string {
  const lines = text.split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('---'));

  // Cap at ~150 lines to prevent runaway payloads if document is huge
  return lines.slice(0, 160).join('\n');
}

/**
 * Normalizes date strings like "15/09/2026", "15/9", "Tue 15/09/2026" into YYYY-MM-DD
 */
export function normalizeDate(rawDate: string, defaultYear = new Date().getFullYear()): string {
  if (!rawDate) return '';
  const clean = rawDate.replace(/[a-zA-Z]/g, '').trim();
  
  // Pattern DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = clean.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Pattern DD/MM (assume defaultYear)
  const dmMatch = clean.match(/(\d{1,2})[/\-.](\d{1,2})/);
  if (dmMatch) {
    const [, d, m] = dmMatch;
    return `${defaultYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // ISO pattern YYYY-MM-DD
  const isoMatch = clean.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return rawDate;
}

/**
 * Calls Google Gemini Flash API with structured output schema to extract
 * all lectures, dates, topics, textbook references, and exercise markers.
 */
/**
 * Lista ordinata di modelli Google Gemini della famiglia Flash / Flash-Lite.
 * Tutti questi modelli hanno costo token INFERIORE o UGUALE a Gemini Flash
 * (escludendo categoricamente i modelli Pro, molto più onerosi).
 * Vengono testati sequenzialmente in caso di sovraccarico (503), rate limit (429) o indisponibilità temporanea.
 */
export const GEMINI_FLASH_CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',        // Costo token inferiore a Flash, velocità massima e alta disponibilità
  'gemini-flash-lite-latest',     // Alias Flash-Lite
  'gemini-3.5-flash',             // Flash standard, alta accuratezza e velocità
  'gemini-flash-latest',          // Alias Flash standard
  'gemini-3.8-flash',             // Famiglia Flash
  'gemini-3.7-flash',             // Famiglia Flash
  'gemini-3.6-flash',             // Famiglia Flash
  'gemini-3.1-flash-lite',        // Famiglia Flash-Lite
  'gemini-3.1-flash-lite-preview',// Flash-Lite preview
  'gemini-3-flash-preview',       // Flash preview
];

/**
 * Calls Google Gemini API with fallback across all models with cost <= Flash.
 * Returns extracted syllabus lectures, notes, chapters, topics.
 */
export async function analyzeSyllabusWithGemini(
  rawContent: string,
  apiKey: string,
  courseContextName?: string,
  defaultYear: number = new Date().getFullYear(),
  onModelAttempt?: (info: { model: string; attempt: number; total: number }) => void
): Promise<SyllabusExtractionResult> {
  if (!apiKey) {
    throw new Error('API Key di Gemini mancante. Configurala nelle impostazioni.');
  }

  const compressed = compressTableText(rawContent);
  if (!compressed.trim()) {
    throw new Error('Il documento è vuoto o non contiene testo leggibile.');
  }

  const prompt = `
Sei un assistente per studenti universitari. Analizza la seguente tabella/calendario delle lezioni per il corso ${courseContextName ? `"${courseContextName}"` : 'universitario'}.
Estrai con la massima precisione l'elenco di tutte le lezioni/esercitazioni/date.

Anno accademico di riferimento di default: ${defaultYear}.

Regole:
1. Per ogni riga individua:
   - "rawDate": la data come scritta nel file (es. "15/09/2026" o "Tuesday 15/9").
   - "parsedDate": la data normalizzata in formato ISO "YYYY-MM-DD". Se l'anno non è indicato nella riga ma appare nell'intestazione o è deducibile, usa quello, altrimenti usa ${defaultYear}.
   - "startTime": orario di inizio (es. "14:15", "08:15", "14:30") in formato 24h.
   - "endTime": orario di fine (se presente, es. "16:15", "10:15").
   - "room": aula (es. "6.0.1", "9.12").
   - "lecturer": nome del docente o esercitatore se specificato (es. "Francesco", "Brambilla", "Tocchetti").
   - "topic": argomento o titolo della lezione (es. "Relational and non relational DBs", "Agent architectures").
   - "lessonType": "exercise" se la riga contiene "EXE", "Esercitazione", "Exercises", "Lab", altrimenti "theory".
   - "coursePart": parte del corso o macro-argomento se presente (es. "Intro, RDBMS, DWH", "Computing").
   - "sectionsOrChapters": capitoli o sezioni del libro di testo indicati (es. "Chapter 1, Sections 1-2").
   - "readingsOrLinks": array di eventuali link URL, paper o slide citati per quel giorno.
   - "isCancelled": true se c'è scritto "NO CLASS", "Vacanza", "Sospensione", altrimenti false.
2. Escludi righe di riepilogo totali (es. "TOTAL 30 22").
3. Rispondi ESCLUSIVAMENTE con un oggetto JSON valido.

Tabella grezza da analizzare:
"""
${compressed}
"""
`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    }
  };

  const modelErrors: Array<{ model: string; status: number; message: string }> = [];

  for (let i = 0; i < GEMINI_FLASH_CANDIDATE_MODELS.length; i++) {
    const currentModel = GEMINI_FLASH_CANDIDATE_MODELS[i];
    onModelAttempt?.({ model: currentModel, attempt: i + 1, total: GEMINI_FLASH_CANDIDATE_MODELS.length });

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!rawJson) {
          throw new Error('Nessun testo generato dal modello.');
        }

        let lessons: ParsedLessonNote[] = [];
        try {
          const parsed = JSON.parse(rawJson);
          if (Array.isArray(parsed)) {
            lessons = parsed;
          } else if (Array.isArray(parsed.lessons)) {
            lessons = parsed.lessons;
          } else if (Array.isArray(parsed.lectures)) {
            lessons = parsed.lectures;
          }
        } catch {
          throw new Error('Impossibile decodificare il JSON restituito da Gemini.');
        }

        // Post-process to ensure IDs and normalized dates
        const processed = lessons.map((l, index) => ({
          ...l,
          id: `syllabus-lesson-${index + 1}`,
          parsedDate: l.parsedDate || normalizeDate(l.rawDate, defaultYear),
          lessonType: l.lessonType === 'exercise' ? ('exercise' as const) : ('theory' as const),
          readingsOrLinks: Array.isArray(l.readingsOrLinks) ? l.readingsOrLinks : [],
          isCancelled: Boolean(l.isCancelled),
        }));

        const tokensUsed = data.usageMetadata?.totalTokenCount;

        return {
          courseName: courseContextName,
          lessons: processed,
          totalExtracted: processed.length,
          tokensUsed,
          modelUsed: currentModel,
        };
      }

      // If response not ok, inspect status & error
      const errText = await response.text();
      let parsedMsg = errText;
      try {
        const j = JSON.parse(errText);
        parsedMsg = j.error?.message || errText;
      } catch {
        // ignore
      }

      modelErrors.push({ model: currentModel, status: response.status, message: parsedMsg });
      console.warn(`[Gemini Fallback] Modello ${currentModel} ha risposto con ${response.status}: ${parsedMsg}. Tentativo con il modello successivo...`);

      // If the API key is universally invalid (not a model issue), interrupt immediately
      if (response.status === 400 && (parsedMsg.includes('API key not valid') || parsedMsg.includes('API_KEY_INVALID'))) {
        throw new Error(`Chiave API non valida: ${parsedMsg}`);
      }

    } catch (err: any) {
      if (err.message && err.message.startsWith('Chiave API non valida')) {
        throw err;
      }
      modelErrors.push({ model: currentModel, status: 0, message: err?.message || String(err) });
      console.warn(`[Gemini Fallback] Errore su ${currentModel}:`, err);
    }
  }

  // All fallback models failed
  const errorDetails = modelErrors
    .map(e => `• ${e.model} (${e.status || 'errore'}): ${e.message}`)
    .slice(0, 4)
    .join('\n');

  throw new Error(
    `Tutti i modelli Gemini a costo equivalente o inferiore (${GEMINI_FLASH_CANDIDATE_MODELS.length} modelli testati) sono attualmente non disponibili o sovraccarichi.\n\nDettagli errori:\n${errorDetails}\n\nRiprova tra qualche istante.`
  );
}
