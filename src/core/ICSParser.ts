/**
 * ICS/CSV Parser — Parses real .ics and .csv calendar files into CalendarEvent[].
 * No external dependencies, pure string parsing.
 */
import type { CalendarEvent } from './types';
import { v4 as uuidv4 } from 'uuid';

/* ─── ICS Parsing ─── */

function parseICSDate(value: string): string {
  // Formats: 20261015T090000Z  or  20261015T090000
  if (!value) return new Date().toISOString();
  const clean = value.replace(/[^0-9T]/g, '');
  const y = clean.substring(0, 4);
  const m = clean.substring(4, 6);
  const d = clean.substring(6, 8);
  const h = clean.length >= 11 ? clean.substring(9, 11) : '00';
  const min = clean.length >= 13 ? clean.substring(11, 13) : '00';
  const s = clean.length >= 15 ? clean.substring(13, 15) : '00';
  const isUTC = value.endsWith('Z');
  const dateStr = `${y}-${m}-${d}T${h}:${min}:${s}${isUTC ? 'Z' : ''}`;
  return new Date(dateStr).toISOString();
}

function unfoldICS(raw: string): string {
  // ICS uses line folding: a CRLF followed by a space/tab means continuation
  return raw.replace(/\r?\n[ \t]/g, '');
}

export function parseICS(raw: string): CalendarEvent[] {
  const unfolded = unfoldICS(raw);
  const lines = unfolded.split(/\r?\n/);
  const events: CalendarEvent[] = [];
  let current: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed === 'BEGIN:VEVENT') {
      current = { id: uuidv4(), isDone: false,  };
      continue;
    }

    if (trimmed === 'END:VEVENT' && current) {
      // Determine type from title heuristics
      const title = (current.title || '').toLowerCase();
      if (!current.type) {
        if (title.includes('esame') || title.includes('exam')) current.type = 'exam';
        else if (title.includes('lezione') || title.includes('lecture') || title.includes('lesson')) current.type = 'lesson';
        else current.type = 'generic';
      }

      if (current.title && current.startTime && current.endTime) {
        events.push(current as CalendarEvent);
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    
    const key = trimmed.substring(0, colonIdx).split(';')[0]; // strip params like DTSTART;VALUE=DATE
    const val = trimmed.substring(colonIdx + 1);

    switch (key) {
      case 'SUMMARY':
        current.title = val;
        break;
      case 'DTSTART':
        current.startTime = parseICSDate(val);
        break;
      case 'DTEND':
        current.endTime = parseICSDate(val);
        break;
      case 'LOCATION':
        if (val) {
          current.location = { type: 'in_person', address: val };
        }
        break;
      case 'UID':
        current.sourceCalendarId = val; // For duplicate detection
        break;
    }
  }

  return events;
}

/* ─── CSV Parsing ─── */

export function parseCSV(raw: string): CalendarEvent[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const events: CalendarEvent[] = [];

  // Try to find column indices
  const titleIdx = headers.findIndex(h => h.includes('subject') || h.includes('titolo') || h.includes('summary') || h.includes('title'));
  const startDateIdx = headers.findIndex(h => h.includes('start date') || h.includes('data inizio'));
  const startTimeIdx = headers.findIndex(h => h.includes('start time') || h.includes('ora inizio'));
  const endDateIdx = headers.findIndex(h => h.includes('end date') || h.includes('data fine'));
  const endTimeIdx = headers.findIndex(h => h.includes('end time') || h.includes('ora fine'));
  const locationIdx = headers.findIndex(h => h.includes('location') || h.includes('luogo'));

  if (titleIdx === -1) return []; // Can't parse without a title

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    if (cols.length <= titleIdx) continue;

    const title = cols[titleIdx] || '';
    if (!title) continue;

    // Build dates
    const sDate = startDateIdx >= 0 ? cols[startDateIdx] : '';
    const sTime = startTimeIdx >= 0 ? cols[startTimeIdx] : '09:00';
    const eDate = endDateIdx >= 0 ? cols[endDateIdx] : sDate;
    const eTime = endTimeIdx >= 0 ? cols[endTimeIdx] : '10:00';

    let startTime: string;
    let endTime: string;

    try {
      startTime = new Date(`${sDate} ${sTime}`).toISOString();
      endTime = new Date(`${eDate} ${eTime}`).toISOString();
    } catch {
      continue; // Skip unparseable rows
    }

    const titleLower = title.toLowerCase();
    let type: CalendarEvent['type'] = 'generic';
    if (titleLower.includes('esame') || titleLower.includes('exam')) type = 'exam';
    else if (titleLower.includes('lezione') || titleLower.includes('lecture')) type = 'lesson';

    events.push({
      id: uuidv4(),
      title,
      type,
      startTime,
      endTime,
      location: locationIdx >= 0 && cols[locationIdx] ? { type: 'in_person', address: cols[locationIdx] } : undefined,
      isDone: false,
      });
  }

  return events;
}

/** Parse a single CSV line handling quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

/* ─── Fetch from URL ─── */

export async function fetchCalendarFromURL(url: string): Promise<CalendarEvent[]> {
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    if (text.includes('BEGIN:VCALENDAR') || text.includes('BEGIN:VEVENT')) {
      return parseICS(text);
    }
    // Try CSV
    return parseCSV(text);
  } catch (error) {
    console.error('Failed to fetch calendar from URL:', error);
    return [];
  }
}
