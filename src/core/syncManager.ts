import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { loadState, saveState } from "./persistence";
import { encryptData, decryptData, isEncryptedFormat } from "./crypto";
import type { Task, Course, CalendarEvent, UserPreferences, StudySession, PerformanceRecord } from "./types";

export interface UserSyncData {
  tasks?: Task[];
  events?: CalendarEvent[];
  courses?: Course[];
  preferences?: UserPreferences;
  studySessions?: StudySession[];
  performanceHistory?: PerformanceRecord[];
}

/**
 * Limiti di sicurezza per prevenire attacchi di billing/sabotaggio
 */
const MAX_ARRAY_LENGTH = 5000;
const FORBIDDEN_FIELDS = ['isAdmin', 'role', 'admin', 'permissions'];
const SYNC_DEBOUNCE_MS = 3000;

/**
 * Valida i dati prima di scrivere su Firestore.
 * Rimuove campi proibiti e tronca array troppo grandi.
 */
function validateSyncData(data: UserSyncData): UserSyncData | null {
  try {
    // Blocca campi proibiti al livello root
    for (const field of FORBIDDEN_FIELDS) {
      if (field in (data as any)) {
        console.warn(`[Security] Blocked forbidden field: ${field}`);
        delete (data as any)[field];
      }
    }

    // Controlla che gli array non superino il limite massimo
    const arrayFields: (keyof UserSyncData)[] = ['tasks', 'events', 'courses', 'studySessions', 'performanceHistory'];
    for (const key of arrayFields) {
      const arr = data[key];
      if (Array.isArray(arr) && arr.length > MAX_ARRAY_LENGTH) {
        console.warn(`[Security] Array "${key}" exceeds max length (${arr.length}/${MAX_ARRAY_LENGTH}), truncating.`);
        (data as any)[key] = arr.slice(0, MAX_ARRAY_LENGTH);
      }
    }

    return data;
  } catch (error) {
    console.error('[Security] Data validation failed:', error);
    return null;
  }
}

/**
 * Salva i dati correnti dello stato su Firestore.
 * Viene chiamato in modo debounced per non inondare il database di richieste.
 */
export async function syncToCloud(userId: string, data: UserSyncData) {
  try {
    const validated = validateSyncData(data);
    if (!validated) {
      console.error("[Sync] Data validation failed, skipping cloud sync.");
      return;
    }

    const userDocRef = doc(db, "users", userId);
    
    // Firestore non accetta campi con valore "undefined". 
    // Usiamo stringify/parse per rimuovere ricorsivamente tutte le chiavi undefined
    const sanitizedData = JSON.parse(JSON.stringify(validated));
    
    // Obfuscate the data before saving
    const encryptedPayload: any = {};
    for (const [key, value] of Object.entries(sanitizedData)) {
      const encryptedValue = encryptData(value);
      
      // Controllo di Sicurezza Continuo (Fail-Safe)
      // Se il valore era definito, deve risultare in una stringa criptata.
      if (value !== undefined && value !== null && !isEncryptedFormat(encryptedValue)) {
        console.error(`[Security] 🚨 CRITICO: Il campo '${key}' non è stato criptato correttamente! Interrompo il salvataggio per evitare fughe di dati.`);
        return; // Blocchiamo tutto per evitare di scrivere dati in chiaro!
      }
      
      encryptedPayload[key] = encryptedValue;
    }
    
    await setDoc(userDocRef, {
      ...encryptedPayload,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log("[Sync] Data saved to cloud successfully.");
  } catch (error) {
    console.error("[Sync] Error saving to cloud:", error);
  }
}

/**
 * Carica i dati dell'utente dal cloud.
 */
export async function loadFromCloud(userId: string): Promise<UserSyncData | null> {
  try {
    const userDocRef = doc(db, "users", userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      console.log("[Sync] Data loaded from cloud successfully.");
      const rawData = docSnap.data();
      const decryptedData: any = {};
      let needsMigration = false;
      
      for (const [key, value] of Object.entries(rawData)) {
        if (key !== 'updatedAt') {
          // Se troviamo un campo che non è criptato, l'utente ha vecchi dati
          if (!isEncryptedFormat(value)) {
            needsMigration = true;
          }
          decryptedData[key] = decryptData(value as any);
        }
      }
      
      const finalData = decryptedData as UserSyncData;
      
      // Auto-Migrazione dei vecchi dati
      if (needsMigration) {
        console.log("[Security] 🔄 Trovati dati in chiaro (vecchia versione). Avvio migrazione criptata in background...");
        setTimeout(() => {
          syncToCloud(userId, finalData).catch(console.error);
        }, 1500);
      }
      
      return finalData;
    }
  } catch (error) {
    console.error("[Sync] Error loading from cloud:", error);
  }
  return null;
}

// Debounce timer per evitare troppe chiamate al db
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let syncCallCount = 0;
const MAX_SYNCS_PER_MINUTE = 20;

// Reset sync counter ogni minuto
setInterval(() => { syncCallCount = 0; }, 60000);

/**
 * Helper per salvare sia in locale che tentare il salvataggio in cloud se loggato.
 */
export function persistState(data: UserSyncData, userId: string | null) {
  // Salva sempre in locale per offline
  saveState(data);
  
  // Se utente loggato, salva nel cloud asincronamente con debounce
  if (userId) {
    // Rate limiting: max 20 sync al minuto
    if (syncCallCount >= MAX_SYNCS_PER_MINUTE) {
      console.warn("[Sync] Rate limit reached, skipping cloud sync.");
      return;
    }

    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncCallCount++;
      syncToCloud(userId, data).catch(console.error);
    }, SYNC_DEBOUNCE_MS);
  }
}

let unsubscribeSnapshot: (() => void) | null = null;

/**
 * Ascolta i cambiamenti in tempo reale dal cloud (per supportare modifiche da altri dispositivi)
 */
export function subscribeToCloud(userId: string, onDataUpdate: (data: UserSyncData) => void) {
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
  }
  
  const userDocRef = doc(db, "users", userId);
  
  unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
    if (docSnap.exists()) {
      // Ignora i cambiamenti generati localmente per evitare loop di aggiornamento UI inutili,
      // a meno che non vogliamo essere super sicuri. 'hasPendingWrites' è true per scritture locali non ancora confermate.
      if (!docSnap.metadata.hasPendingWrites) {
        console.log("[Sync] Dati aggiornati dal cloud (Real-time).");
        const rawData = docSnap.data();
        const decryptedData: any = {};
        for (const [key, value] of Object.entries(rawData)) {
          if (key !== 'updatedAt') {
            decryptedData[key] = decryptData(value as any);
          }
        }
        onDataUpdate(decryptedData as UserSyncData);
      }
    }
  }, (error) => {
    console.error("[Sync] Error in real-time subscription:", error);
  });
  
  return unsubscribeSnapshot;
}
