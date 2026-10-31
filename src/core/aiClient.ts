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

  let rawText = '';
  let data: { text?: string; model?: string; tokens?: number; error?: string } = {};

  try {
    rawText = await response.text();
    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        // La risposta non è JSON valido (ad es. pagina HTML di Vercel/Cloudflare o testo grezzo)
      }
    }
  } catch {
    // Errore nella lettura del corpo della risposta
  }

  if (!response.ok || !data.text) {
    if (data.error) {
      throw new Error(data.error);
    }

    if (response.status === 504 || rawText.includes('FUNCTION_INVOCATION_TIMEOUT') || rawText.includes('Gateway Timeout')) {
      throw new Error(
        'Il server ha impiegato troppo tempo per rispondere (timeout). ' +
        'Il documento potrebbe essere troppo corposo o il servizio sovraccarico. Prova con una sezione più breve.'
      );
    }

    if (response.status === 413 || rawText.includes('FUNCTION_PAYLOAD_TOO_LARGE') || rawText.includes('Payload Too Large')) {
      throw new Error('Il documento inviato è troppo lungo per essere analizzato in una singola richiesta.');
    }

    if (response.status === 401) {
      throw new Error('Sessione scaduta o non valida. Effettua nuovamente il login per usare le funzioni AI.');
    }

    if (response.status === 429) {
      throw new Error('Limite di richieste raggiunto. Attendi qualche istante prima di riprovare.');
    }

    if (response.status === 502 || response.status === 503) {
      throw new Error('I server AI sono attualmente sovraccarichi o non raggiungibili. Riprova tra poco.');
    }

    // Se c'è testo ma non era JSON ed è breve (meno di 200 caratteri), includilo se non sembra HTML
    const cleanText = rawText.replace(/<[^>]+>/g, '').trim();
    if (cleanText && cleanText.length < 200) {
      throw new Error(`Errore AI (${response.status}): ${cleanText}`);
    }

    throw new Error(`Servizio AI non disponibile (errore ${response.status}).`);
  }
  return { text: data.text, model: data.model, tokens: data.tokens };
}

