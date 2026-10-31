import { describe, it, expect, vi, beforeEach } from 'vitest';
import { callAI } from './aiClient';
import { auth } from './firebase';

vi.mock('./firebase', () => ({
  auth: {
    currentUser: null,
  },
}));

describe('aiClient callAI error handling and diagnostics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('throws authentication error when user is not logged in', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = null;
    await expect(callAI('test prompt')).rejects.toThrow('Devi essere autenticato per usare le funzioni AI.');
  });

  it('returns parsed text, model, and tokens on success', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        text: '{"result": "ok"}',
        model: 'gemini-3.5-flash',
        tokens: 150,
      })),
    } as unknown as Response);

    const res = await callAI('test prompt');
    expect(res.text).toBe('{"result": "ok"}');
    expect(res.model).toBe('gemini-3.5-flash');
    expect(res.tokens).toBe(150);
  });

  it('throws specific error message returned in json error field', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue(JSON.stringify({
        error: 'Prompt non valido o non riconosciuto.',
      })),
    } as unknown as Response);

    await expect(callAI('test prompt')).rejects.toThrow('Prompt non valido o non riconosciuto.');
  });

  it('diagnoses Vercel FUNCTION_INVOCATION_TIMEOUT and HTML 504 errors', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 504,
      text: vi.fn().mockResolvedValue('<html><body>504 FUNCTION_INVOCATION_TIMEOUT</body></html>'),
    } as unknown as Response);

    await expect(callAI('long syllabus')).rejects.toThrow(/Il server ha impiegato troppo tempo per rispondere/);
  });

  it('diagnoses payload too large (413)', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      text: vi.fn().mockResolvedValue('Payload Too Large'),
    } as unknown as Response);

    await expect(callAI('huge syllabus')).rejects.toThrow(/Il documento inviato è troppo lungo/);
  });

  it('diagnoses server overload (502 / 503)', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue('Service Unavailable'),
    } as unknown as Response);

    await expect(callAI('test')).rejects.toThrow(/sovraccarichi o non raggiungibili/);
  });

  it('diagnoses session expired (401)', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue('Unauthorized'),
    } as unknown as Response);

    await expect(callAI('test')).rejects.toThrow(/Sessione scaduta o non valida/);
  });

  it('diagnoses rate limiting (429)', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: vi.fn().mockResolvedValue('Too Many Requests'),
    } as unknown as Response);

    await expect(callAI('test')).rejects.toThrow(/Limite di richieste raggiunto/);
  });

  it('extracts concise non-HTML error message for unexpected error statuses', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue('Custom gateway malfunction'),
    } as unknown as Response);

    await expect(callAI('test')).rejects.toThrow('Errore AI (500): Custom gateway malfunction');
  });

  it('handles network connection error', async () => {
    // @ts-expect-error mock auth
    auth.currentUser = {
      getIdToken: vi.fn().mockResolvedValue('fake-token'),
    };

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    await expect(callAI('test')).rejects.toThrow(/Impossibile contattare il servizio AI/);
  });
});
