/**
 * Proxy server-side verso Google Gemini.
 *
 * La chiave API vive SOLO nelle variabili d'ambiente del server (GEMINI_API_KEY):
 * non viene mai inclusa nel bundle del browser né salvata nei dati dell'utente.
 * Chi usa l'app deve essere autenticato (token Firebase) per poter usare l'AI.
 *
 * Usato sia dalla funzione Vercel (api/ai/gemini.ts) sia dal server di sviluppo di Vite.
 */

/** Modelli Flash / Flash-Lite provati in ordine in caso di sovraccarico o indisponibilità. */
export const GEMINI_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
];

const MAX_PROMPT_CHARS = 250_000;
const MAX_REQUESTS_PER_HOUR = 40;

export interface ProxyEnv {
  GEMINI_API_KEY?: string;
  /** Chiave web (pubblica) di Firebase, serve solo per verificare l'identità dell'utente */
  FIREBASE_API_KEY?: string;
}

export interface ProxyResult {
  status: number;
  body: Record<string, unknown>;
}

// Limite best-effort per utente (in memoria dell'istanza serverless).
const usage = new Map<string, number[]>();

function rateLimited(uid: string): boolean {
  const now = Date.now();
  const recent = (usage.get(uid) ?? []).filter(t => now - t < 3_600_000);
  if (recent.length >= MAX_REQUESTS_PER_HOUR) {
    usage.set(uid, recent);
    return true;
  }
  recent.push(now);
  usage.set(uid, recent);
  return false;
}

/** Verifica il token Firebase tramite l'endpoint pubblico di Identity Toolkit. */
async function verifyFirebaseUser(idToken: string, webApiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { users?: Array<{ localId?: string }> };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

export async function handleGeminiRequest(
  authorization: string | undefined,
  body: unknown,
  env: ProxyEnv
): Promise<ProxyResult> {
  if (!env.GEMINI_API_KEY) {
    return { status: 503, body: { error: 'Servizio AI non configurato sul server (GEMINI_API_KEY mancante).' } };
  }
  if (!env.FIREBASE_API_KEY) {
    return { status: 503, body: { error: 'Servizio AI non configurato sul server (FIREBASE_API_KEY mancante).' } };
  }

  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { status: 401, body: { error: 'Accesso richiesto: effettua il login.' } };

  const uid = await verifyFirebaseUser(token, env.FIREBASE_API_KEY);
  if (!uid) return { status: 401, body: { error: 'Sessione non valida: effettua di nuovo il login.' } };

  if (rateLimited(uid)) {
    return { status: 429, body: { error: 'Hai raggiunto il limite orario di richieste AI. Riprova più tardi.' } };
  }

  const b = (body && typeof body === 'object' ? body : {}) as { prompt?: unknown; temperature?: unknown };
  const prompt = typeof b.prompt === 'string' ? b.prompt : '';
  if (!prompt.trim()) return { status: 400, body: { error: 'Richiesta vuota.' } };
  if (prompt.length > MAX_PROMPT_CHARS) return { status: 413, body: { error: 'Documento troppo grande per l\'analisi.' } };
  const temperature = typeof b.temperature === 'number' ? Math.min(1, Math.max(0, b.temperature)) : 0.1;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature,
      maxOutputTokens: 32768,
    },
  };

  const errors: string[] = [];
  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          usageMetadata?: { totalTokenCount?: number };
        };
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '';
        if (!text) {
          errors.push(`${model}: risposta vuota`);
          continue;
        }
        return { status: 200, body: { text, model, tokens: data.usageMetadata?.totalTokenCount } };
      }

      const errText = await response.text();
      let msg = errText;
      try { msg = (JSON.parse(errText) as { error?: { message?: string } }).error?.message || errText; } catch { /* testo grezzo */ }
      // Chiave non valida: inutile provare gli altri modelli. Non rivelare dettagli al client.
      if (response.status === 400 && /API key not valid|API_KEY_INVALID/i.test(msg)) {
        console.error('[AI proxy] GEMINI_API_KEY non valida');
        return { status: 503, body: { error: 'Servizio AI temporaneamente non disponibile (configurazione server).' } };
      }
      errors.push(`${model} (${response.status})`);
    } catch (e) {
      errors.push(`${model}: ${(e as Error)?.message ?? 'errore di rete'}`);
    }
  }

  console.error('[AI proxy] Tutti i modelli hanno fallito:', errors.join(' | '));
  return {
    status: 502,
    body: { error: `Tutti i modelli AI sono sovraccarichi o non disponibili (${errors.length} tentativi). Riprova tra qualche istante.` },
  };
}

