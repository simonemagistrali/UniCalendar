import { auth } from './firebase';

export interface AIResponse {
  text: string;
  model?: string;
  tokens?: number;
}

/**
 * Invia un prompt all'AI tramite il proxy server-side (/api/ai/gemini).
 * Nessuna chiave API è presente nel browser: il server la aggiunge e verifica il login.
 */
export async function callAI(prompt: string): Promise<AIResponse> {
  const user = auth.currentUser;
  if (!user) throw new Error('Devi essere autenticato per usare le funzioni AI.');
  const token = await user.getIdToken();

  let response: Response;
  try {
    response = await fetch('/api/ai/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prompt, temperature: 0.1 }),
    });
  } catch {
    throw new Error('Impossibile contattare il servizio AI. Controlla la connessione.');
  }

  let data: { text?: string; model?: string; tokens?: number; error?: string } = {};
  try {
    data = await response.json();
  } catch {
    // risposta non JSON (es. funzione non raggiungibile)
  }

  if (!response.ok || !data.text) {
    throw new Error(data.error || `Servizio AI non disponibile (errore ${response.status}).`);
  }
  return { text: data.text, model: data.model, tokens: data.tokens };
}

