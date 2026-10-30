/**
 * Smoke test end-to-end: avvia il server in memoria, lo interroga con un client MCP vero
 * e verifica che ogni tool risponda e che nessun tool sia di scrittura.
 *
 * Esegui: npm test
 */
process.env.UNICALENDAR_DEMO = '1';

import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import CryptoJS from 'crypto-js';
import { createServer } from '../src/server.ts';
import { decryptField } from '../src/data.ts';

const [clientT, serverT] = InMemoryTransport.createLinkedPair();
const server = createServer();
await server.connect(serverT);
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(clientT);

type Result = { isError?: boolean; content: { type: string; text: string }[] };
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as Result;
  return { isError: !!r.isError, json: r.isError ? r.content[0].text : JSON.parse(r.content[0].text) };
};

let passed = 0;
const ok = (label: string) => { passed++; console.log(`  ✓ ${label}`); };

// 1. Tutti i tool dichiarati e tutti in sola lettura
const { tools } = await client.listTools();
const names = tools.map(t => t.name).sort();
assert.deepEqual(names, [
  'find_free_slots', 'get_catchup_status', 'get_overview', 'get_upcoming_assessments',
  'get_week_summary', 'list_courses', 'list_events', 'list_tasks',
]);
for (const t of tools) assert.equal(t.annotations?.readOnlyHint, true, `${t.name} non è readOnly`);
ok(`${tools.length} tool, tutti readOnlyHint`);

// 2. Overview
const ov = (await call('get_overview')).json;
assert.equal(ov.courses.length, 3);
assert.equal(ov.openTasks, 4);
assert.ok(ov.topPriorityTasks[0].priority >= ov.topPriorityTasks[1].priority);
ok('get_overview');

// 3. Task: filtri
assert.equal((await call('list_tasks')).json.total, 4);
assert.equal((await call('list_tasks', { status: 'done' })).json.total, 2);
assert.equal((await call('list_tasks', { course: 'fisica' })).json.total, 2);
assert.equal((await call('list_tasks', { status: 'all', limit: 2 })).json.returned, 2);
assert.equal((await call('list_tasks', { dueWithinDays: 7 })).json.total, 1);
const bad = await call('list_tasks', { course: 'Chimica' });
assert.ok(bad.isError && String(bad.json).includes('Analisi Matematica'));
ok('list_tasks (stato, materia, scadenza, limite, errore materia)');

// 4. Eventi
assert.ok((await call('list_events')).json.total >= 3);
assert.equal((await call('list_events', { type: 'exam', from: '2000-01-01', to: '2999-12-31' })).json.total, 1);
assert.equal((await call('list_events', { from: 'ieri' })).isError, true);
ok('list_events');

// 5. Esami
const ass = (await call('get_upcoming_assessments', { days: 30 })).json;
assert.equal(ass.length, 2);
assert.equal(ass[0].type, 'quiz');
assert.equal(ass[1].prepTasksOpen, 1);
ok('get_upcoming_assessments');

// 6. Recupero (usa il vero CatchUpEngine dell'app)
const cu = (await call('get_catchup_status')).json;
assert.equal(cu.courses.length, 3);
assert.ok(cu.globalPercent >= 0 && cu.globalPercent <= 100);
assert.equal((await call('get_catchup_status', { course: 'basi' })).json.courses.length, 1);
ok('get_catchup_status (CatchUpEngine reale)');

// 7. Riepilogo settimanale (WeeklySummaryEngine reale)
const ws = (await call('get_week_summary')).json;
assert.equal(typeof ws.tasksCompleted, 'number');
assert.equal(typeof (await call('get_week_summary', { weekOffset: -1 })).json.minutesStudied, 'number');
ok('get_week_summary (WeeklySummaryEngine reale)');

// 8. Slot liberi
const fs = (await call('find_free_slots', { minMinutes: 60 })).json;
assert.ok(fs.slots.length > 0);
for (const s of fs.slots) assert.ok(s.minutes >= 60);
const sunday = fs.slots.filter((s: { date: string }) => new Date(s.date + 'T12:00:00').getDay() === 0);
assert.equal(sunday.length, 0, 'la domenica è disabilitata nelle preferenze');
ok('find_free_slots');

// 9. Decifratura compatibile con src/core/crypto.ts
const key = 'k'.repeat(64);
const enc = CryptoJS.AES.encrypt(JSON.stringify([{ id: 'x' }]), key).toString();
assert.deepEqual(decryptField(enc, key), [{ id: 'x' }]);
assert.equal(decryptField(enc, 'chiave-sbagliata'), null);
assert.equal(decryptField('in chiaro', key), 'in chiaro');
ok('decryptField compatibile con il formato AES dell\'app');

await client.close();
console.log(`\n${passed} gruppi di test superati.`);

