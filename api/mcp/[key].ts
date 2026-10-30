/**
 * Endpoint MCP remoto (Streamable HTTP, stateless) per UniCalendar — SOLA LETTURA.
 *
 * URL:  https://<dominio>/api/mcp/<MCP_SECRET>
 *
 * Variabili d'ambiente (Vercel):
 *   MCP_SECRET                codice segreto lungo nel link (>= 24 caratteri)
 *   UNICALENDAR_UID           uid Firebase dell'utente di cui esporre i dati
 *   FIREBASE_SERVICE_ACCOUNT  JSON della chiave dell'account di servizio
 *
 * Chi conosce il link legge i dati: per invalidarlo basta cambiare MCP_SECRET.
 * Un link sbagliato risponde 404, senza rivelare che l'endpoint esiste.
 */
import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from '../../mcp-server/src/server.ts';

type Req = IncomingMessage & { body?: unknown };

function keyMatches(provided: string, secret: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: Req, res: ServerResponse): Promise<void> {
  const secret = process.env.MCP_SECRET ?? '';
  const last = new URL(req.url ?? '/', 'http://localhost').pathname.split('/').filter(Boolean).pop() ?? '';
  let provided = last;
  try { provided = decodeURIComponent(last); } catch { /* resta il valore grezzo */ }

  if (secret.length < 24 || !keyMatches(provided, secret)) {
    res.statusCode = 404;
    res.end();
    return;
  }

  // Server stateless: niente sessioni, accettiamo solo POST JSON-RPC.
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }));
    return;
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

