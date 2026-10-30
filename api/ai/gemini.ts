/**
 * Endpoint serverless  POST /api/ai/gemini
 *
 * Variabili d'ambiente (Vercel, solo lato server — NON usare il prefisso VITE_):
 *   GEMINI_API_KEY    chiave Google Gemini
 *   FIREBASE_API_KEY  chiave web Firebase (la stessa di VITE_FIREBASE_API_KEY), per verificare il login
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGeminiRequest } from '../_lib/geminiProxy.ts';

type Req = IncomingMessage & { body?: unknown };

async function readBody(req: Req): Promise<unknown> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch { return {}; }
    }
    return req.body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return {}; }
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end(JSON.stringify({ error: 'Metodo non consentito.' }));
    return;
  }

  const result = await handleGeminiRequest(req.headers.authorization, await readBody(req), {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    FIREBASE_API_KEY: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
  });
  res.statusCode = result.status;
  res.end(JSON.stringify(result.body));
}

