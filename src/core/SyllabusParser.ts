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

  // Tutti i fogli (un calendario può essere diviso per mese o per modulo)
  const parts: string[] = [];
  for (const name of sheetNames) {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { FS: ' | ' });
    if (csv.trim()) parts.push(sheetNames.length > 1 ? `### Foglio: ${name}\n${csv}` : csv);
  }
  return parts.join('\n');
}

/**
 * Extracts text from a plain text / markdown file.
 */
export async function extractTextFromPlain(fileData: ArrayBuffer): Promise<string> {
  return new TextDecoder('utf-8').decode(fileData);
}

/**
 * Normalizes date strings like "15/09/2026", "15/9", "Tue 15/09/2026" into YYYY-MM-DD
 */
export function normalizeDate(rawDate: string, defaultYear = new Date().getFullYear()): string {
  if (!rawDate) return '';
  const clean = rawDate.replace(/[a-zA-Z]/g, '').trim();

  // ISO pattern YYYY-MM-DD (va controllato per primo: altrimenti 2026-09-15 verrebbe letto come 26-09)
  const isoMatch = clean.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

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

  return rawDate;
}
