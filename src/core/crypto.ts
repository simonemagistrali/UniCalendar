import CryptoJS from 'crypto-js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

// Cache in memory for the current session
let sessionKey: string | null = null;

/**
 * Inizializza o recupera la chiave crittografica dell'utente da Firebase
 */
export async function initializeUserCryptoKey(userId: string): Promise<string> {
  if (sessionKey) return sessionKey;

  const keyRef = doc(db, 'user_keys', userId);
  const keySnap = await getDoc(keyRef);

  if (keySnap.exists()) {
    sessionKey = keySnap.data().key;
  } else {
    // Genera una nuova chiave casuale sicura a 256 bit
    const newKey = CryptoJS.lib.WordArray.random(32).toString();
    await setDoc(keyRef, { key: newKey });
    sessionKey = newKey;
  }

  return sessionKey!;
}

export function clearCryptoKey() {
  sessionKey = null;
}

/**
 * Offusca un oggetto in una stringa Base64 crittografata
 */
export function encryptData(data: any): string {
  if (!sessionKey) {
    console.warn('[Crypto] Nessuna chiave di sessione trovata. Dati salvati in chiaro.');
    return data;
  }
  try {
    const jsonStr = JSON.stringify(data);
    return CryptoJS.AES.encrypt(jsonStr, sessionKey).toString();
  } catch (error) {
    console.error('[Crypto] Errore durante la crittografia', error);
    return data;
  }
}

/**
 * Decripta una stringa Base64 nell'oggetto originale
 */
export function decryptData(encryptedStr: string): any {
  if (!sessionKey || typeof encryptedStr !== 'string') {
    return encryptedStr;
  }
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedStr, sessionKey);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(decryptedStr);
  } catch (error) {
    console.error('[Crypto] Errore durante la decrittografia', error);
    return encryptedStr;
  }
}
