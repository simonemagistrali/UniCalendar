import { doc, getDoc, setDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { loadState, saveState } from "./persistence";
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
 * Salva i dati correnti dello stato su Firestore.
 * Viene chiamato in modo debounced per non inondare il database di richieste.
 */
export async function syncToCloud(userId: string, data: UserSyncData) {
  try {
    const userDocRef = doc(db, "users", userId);
    
    // Firestore non accetta campi con valore "undefined". 
    // Usiamo stringify/parse per rimuovere ricorsivamente tutte le chiavi undefined
    const sanitizedData = JSON.parse(JSON.stringify(data));
    
    await setDoc(userDocRef, {
      ...sanitizedData,
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
      return docSnap.data() as UserSyncData;
    }
  } catch (error) {
    console.error("[Sync] Error loading from cloud:", error);
  }
  return null;
}

// Debounce timer per evitare troppe chiamate al db
let syncTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Helper per salvare sia in locale che tentare il salvataggio in cloud se loggato.
 */
export function persistState(data: UserSyncData, userId: string | null) {
  // Salva sempre in locale per offline
  saveState(data);
  
  // Se utente loggato, salva nel cloud asincronamente con debounce di 2 secondi
  if (userId) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      syncToCloud(userId, data).catch(console.error);
    }, 2000);
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
        const data = docSnap.data() as UserSyncData;
        onDataUpdate(data);
      }
    }
  }, (error) => {
    console.error("[Sync] Error in real-time subscription:", error);
  });
  
  return unsubscribeSnapshot;
}
