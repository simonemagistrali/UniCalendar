/**
 * Server MCP di UniCalendar (SOLA LETTURA) — trasporto stdio.
 *
 * Avvio:  npm start   (oppure npm run demo per i dati di esempio)
 * ATTENZIONE: stdout è riservato al protocollo MCP. Log solo su stderr.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getUserData } from './data.ts';
import * as tools from './tools.ts';

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const dateHelp = 'Formato YYYY-MM-DD (fuso orario locale).';

/** Esegue un tool: carica i dati, serializza in JSON compatto, gestisce gli errori. */
async function run<T>(fn: (data: Awaited<ReturnType<typeof getUserData>>) => T) {
  try {
    const result = fn(await getUserData());
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
  } catch (err) {
    return {
      isError: true,
      content: [{ type: 'text' as const, text: `Errore: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }
}

export function createServer(): McpServer {
  const server = new McpServer(
    { name: 'unicalendar', version: '0.1.0' },
    {
      instructions:
        'UniCalendar è il pianificatore di studio universitario dell\'utente. Questi strumenti leggono ' +
        'soltanto (non modificano nulla). Per una panoramica parti da get_overview. Le durate sono in minuti, ' +
        'le date nel fuso locale dell\'utente. Se una materia non viene trovata, usa list_courses.',
    },
  );

  server.registerTool(
    'get_overview',
    {
      title: 'Panoramica di oggi',
      description:
        'Istantanea dello stato dell\'utente: attività aperte e minuti residui, completate oggi, % di recupero lezioni, ' +
        'eventi rimasti oggi, 5 attività a priorità più alta, prossimi esami/quiz. Usalo come primo strumento.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => run(d => tools.getOverview(d)),
  );

  server.registerTool(
    'list_courses',
    {
      title: 'Elenco materie',
      description: 'Materie dell\'utente con difficoltà, attività aperte (numero e minuti) e prossimo esame/quiz.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => run(d => tools.listCourses(d)),
  );

  server.registerTool(
    'list_tasks',
    {
      title: 'Elenco attività',
      description:
        'Attività di studio. Di default solo quelle aperte, ordinate per priorità. Filtri: stato, materia (nome anche parziale), ' +
        'scadenza entro N giorni. Le completate sono ordinate dalla più recente.',
      inputSchema: {
        status: z.enum(['open', 'todo', 'in_progress', 'done', 'all']).optional()
          .describe('open = da fare + in corso (default); done = completate; all = tutte'),
        course: z.string().optional().describe('Nome (anche parziale) o id della materia'),
        dueWithinDays: z.number().int().min(0).max(365).optional().describe('Solo attività con scadenza entro N giorni'),
        limit: z.number().int().min(1).max(100).optional().describe('Massimo risultati (default 30)'),
      },
      annotations: READ_ONLY,
    },
    args => run(d => tools.listTasks(d, args)),
  );

  server.registerTool(
    'list_events',
    {
      title: 'Eventi del calendario',
      description:
        'Eventi (lezioni, esami, quiz, viaggi, sport, scadenze) in un intervallo. Default: i prossimi 7 giorni da oggi.',
      inputSchema: {
        from: z.string().optional().describe(`Inizio intervallo. ${dateHelp} Default: oggi`),
        to: z.string().optional().describe(`Fine intervallo, incluso. ${dateHelp} Default: from + 7 giorni`),
        type: z.enum(['generic', 'lesson', 'exam', 'quiz', 'travel', 'sport', 'project_deadline', 'meal']).optional(),
        course: z.string().optional().describe('Nome (anche parziale) o id della materia'),
        limit: z.number().int().min(1).max(200).optional().describe('Massimo risultati (default 50)'),
      },
      annotations: READ_ONLY,
    },
    args => run(d => tools.listEvents(d, args)),
  );

  server.registerTool(
    'get_upcoming_assessments',
    {
      title: 'Prossimi esami e scadenze',
      description:
        'Esami, quiz e scadenze di progetto nei prossimi N giorni, con giorni mancanti e carico di preparazione ancora aperto.',
      inputSchema: {
        days: z.number().int().min(1).max(365).optional().describe('Orizzonte in giorni (default 60)'),
      },
      annotations: READ_ONLY,
    },
    ({ days }) => run(d => tools.getUpcomingAssessments(d, days)),
  );

  server.registerTool(
    'get_catchup_status',
    {
      title: 'Stato recupero lezioni',
      description:
        'Quanto è "in pari" l\'utente: per materia lezioni passate, lezioni completamente recuperate, attività e minuti arretrati, ' +
        'data stimata di recupero. Opzionalmente solo per una materia.',
      inputSchema: {
        course: z.string().optional().describe('Nome (anche parziale) o id della materia'),
      },
      annotations: READ_ONLY,
    },
    ({ course }) => run(d => tools.getCatchUpStatus(d, course)),
  );

  server.registerTool(
    'get_week_summary',
    {
      title: 'Riepilogo settimanale',
      description:
        'Riepilogo di una settimana (lunedì–domenica): attività e minuti, confronto con la precedente, ore per materia, argomenti ' +
        'studiati, streak, arretrato, materie a rischio per esami vicini.',
      inputSchema: {
        weekOffset: z.number().int().min(-52).max(0).optional()
          .describe('0 = settimana corrente (default), -1 = scorsa, -2 = due settimane fa…'),
      },
      annotations: READ_ONLY,
    },
    ({ weekOffset }) => run(d => tools.getWeekSummary(d, weekOffset)),
  );

  server.registerTool(
    'find_free_slots',
    {
      title: 'Slot liberi per studiare',
      description:
        'Intervalli liberi dentro le fasce di studio impostate dall\'utente, al netto di lezioni, viaggi, esami e sessioni già pianificate. ' +
        'Considera solo il futuro. Max 31 giorni.',
      inputSchema: {
        from: z.string().optional().describe(`Primo giorno. ${dateHelp} Default: oggi`),
        to: z.string().optional().describe(`Ultimo giorno incluso. ${dateHelp} Default: from + 6 giorni`),
        minMinutes: z.number().int().min(5).max(480).optional().describe('Durata minima dello slot (default 30)'),
      },
      annotations: READ_ONLY,
    },
    args => run(d => tools.findFreeSlots(d, args)),
  );

  return server;
}

async function main() {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('[unicalendar-mcp] in ascolto su stdio (sola lettura)');
}

// Avvia solo se eseguito direttamente (i test importano createServer).
if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/server.ts')) {
  main().catch(err => {
    console.error('[unicalendar-mcp] errore fatale:', err);
    process.exit(1);
  });
}
