/**
 * Caricamento dei dati utente (SOLA LETTURA).
 *
 * Tre sorgenti, scelte tramite variabili d'ambiente:
 *  1. UNICALENDAR_DEMO=1            → dati di esempio (per provare il server)
 *  2. UNICALENDAR_DATA_FILE=<path>  → file JSON esportato dall'app (stato locale)
 *  3. UNICALENDAR_UID=<uid>         → lettura da Firestore con Firebase Admin
 *                                      (richiede GOOGLE_APPLICATION_CREDENTIALS)
 *
 * IMPORTANTE: in un server MCP stdio NIENTE deve andare su stdout (è il canale del
 * protocollo). Tutti i log usano console.error.
 */
import { readFile } from 'node:fs/promises';
import CryptoJS from 'crypto-js';
import type {
  AnkiDaySnapshot,
  CalendarEvent,
  Course,
  Semester,
  StudySession,
  Task,
  UserPreferences,
} from '../../src/core/types.ts';
import { buildDemoData } from './demo.ts';

export interface UserData {
  tasks: Task[];
  events: CalendarEvent[];
  courses: Course[];
  studySessions: StudySession[];
  ankiHistory: AnkiDaySnapshot[];
  semesters: Semester[];
  preferences: Partial<UserPreferences>;
  /** Descrizione della sorgente, utile per il debug */
  source: string;
}

const ENCRYPTED_PREFIX = 'U2FsdGVkX1';
const META_FIELDS = ['updatedAt', 'lastWriterId'];

/** Normalizza un oggetto grezzo (qualunque sorgente) nella forma UserData. */
export function normalizeUserData(raw: Record<string, unknown>, source: string): UserData {
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    tasks: arr<Task>(raw.tasks),
    events: arr<CalendarEvent>(raw.events),
    courses: arr<Course>(raw.courses),
    studySessions: arr<StudySession>(raw.studySessions),
    ankiHistory: arr<AnkiDaySnapshot>(raw.ankiHistory),
    semesters: arr<Semester>(raw.semesters),
    preferences: (raw.preferences && typeof raw.preferences === 'object'
      ? raw.preferences
      : {}) as Partial<UserPreferences>,
    source,
  };
}

/** Decifra un campo AES come fa src/core/crypto.ts (stesso formato CryptoJS). */
export function decryptField(value: unknown, key: string): unknown {
  if (typeof value !== 'string' || !value.startsWith(ENCRYPTED_PREFIX)) return value;
  try {
    const text = CryptoJS.AES.decrypt(value, key).toString(CryptoJS.enc.Utf8);
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function loadFromFile(path: string): Promise<UserData> {
  const text = await readFile(path, 'utf8');
  return normalizeUserData(JSON.parse(text), `file:${path}`);
}

async function loadFromFirestore(uid: string): Promise<UserData> {
  // Import dinamico: chi usa solo demo/file non deve avere le credenziali.
  const { initializeApp, applicationDefault, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');

  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
  const db = getFirestore();

  const [userSnap, keySnap] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('user_keys').doc(uid).get(),
  ]);
  if (!userSnap.exists) throw new Error(`Nessun documento users/${uid} su Firestore.`);
  const key = keySnap.exists ? (keySnap.data()?.key as string | undefined) : undefined;

  const decrypted: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(userSnap.data() ?? {})) {
    if (META_FIELDS.includes(field)) continue;
    decrypted[field] = key ? decryptField(value, key) : value;
  }
  return normalizeUserData(decrypted, `firestore:users/${uid}`);
}

/** Cache breve: più tool call consecutive non rileggono ogni volta Firestore. */
const CACHE_TTL_MS = 60_000;
let cache: { at: number; data: UserData } | null = null;

export async function getUserData(): Promise<UserData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  const env = process.env;
  let data: UserData;
  if (env.UNICALENDAR_DEMO === '1') {
    data = buildDemoData();
  } else if (env.UNICALENDAR_DATA_FILE) {
    data = await loadFromFile(env.UNICALENDAR_DATA_FILE);
  } else if (env.UNICALENDAR_UID) {
    data = await loadFromFirestore(env.UNICALENDAR_UID);
  } else {
    throw new Error(
      'Nessuna sorgente dati configurata. Imposta UNICALENDAR_DATA_FILE (file JSON), ' +
        'UNICALENDAR_UID (Firestore) oppure UNICALENDAR_DEMO=1 (dati di esempio). Vedi README.',
    );
  }
  cache = { at: Date.now(), data };
  return data;
}

/** Solo per i test. */
export function clearDataCache(): void {
  cache = null;
}
