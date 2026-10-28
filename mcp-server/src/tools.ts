/**
 * Logica dei tool, in sola lettura. Funzioni pure su UserData → oggetti JSON compatti.
 * Le risposte sono volutamente snelle: ogni token speso consuma la quota dell'utente.
 */
import { CatchUpEngine } from '../../src/core/CatchUpEngine.ts';
import { WeeklySummaryEngine } from '../../src/core/WeeklySummaryEngine.ts';
import type { CalendarEvent, Course, Task } from '../../src/core/types.ts';
import type { UserData } from './data.ts';

const MIN = 60_000;

/* ─── Utility ─── */

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-10-28 17:30" nel fuso locale (più leggibile per l'LLM di un ISO UTC). */
export function fmt(iso: string | Date | undefined): string | undefined {
  if (!iso) return undefined;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return undefined;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Rimuove i campi undefined/null/array vuoti per risparmiare token. */
export function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out as Partial<T>;
}

/** Parsa "YYYY-MM-DD" (locale, inizio giorno) o un ISO completo. */
export function parseDate(s: string | undefined, fallback: Date): Date {
  if (!s) return fallback;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Data non valida: "${s}". Usa il formato YYYY-MM-DD.`);
  return d;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Risolve un nome materia (parziale, case-insensitive) o un id in un Course. */
export function resolveCourse(data: UserData, query: string | undefined): Course | undefined {
  if (!query) return undefined;
  const q = query.trim().toLowerCase();
  return (
    data.courses.find(c => c.id === query) ??
    data.courses.find(c => c.name.toLowerCase() === q) ??
    data.courses.find(c => c.name.toLowerCase().includes(q))
  );
}

function requireCourse(data: UserData, query: string | undefined): Course | undefined {
  if (!query) return undefined;
  const c = resolveCourse(data, query);
  if (!c) {
    throw new Error(
      `Materia "${query}" non trovata. Materie disponibili: ${data.courses.map(x => x.name).join(', ') || '(nessuna)'}.`,
    );
  }
  return c;
}

function courseName(data: UserData, id?: string): string | undefined {
  return id ? data.courses.find(c => c.id === id)?.name : undefined;
}

/* ─── Tool: list_courses ─── */

export function listCourses(data: UserData) {
  return data.courses.map(c => {
    const open = data.tasks.filter(t => t.courseId === c.id && t.status !== 'done' && !t.isPhantom);
    const nextAssessment = data.events
      .filter(e => e.courseId === c.id && (e.type === 'exam' || e.type === 'quiz') && new Date(e.startTime).getTime() > Date.now())
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
    return compact({
      name: c.name,
      difficulty: c.difficulty,
      openTasks: open.length,
      openMinutes: open.reduce((s, t) => s + (t.estimatedDuration || 0), 0),
      nextAssessment: nextAssessment ? `${nextAssessment.type} ${fmt(nextAssessment.startTime)}` : undefined,
    });
  });
}

/* ─── Tool: list_tasks ─── */

export interface ListTasksArgs {
  status?: 'todo' | 'in_progress' | 'done' | 'open' | 'all';
  course?: string;
  dueWithinDays?: number;
  limit?: number;
}

function shapeTask(data: UserData, t: Task) {
  return compact({
    id: t.id,
    title: t.title,
    course: courseName(data, t.courseId),
    status: t.status,
    estMin: t.estimatedDuration,
    actualMin: t.actualDuration,
    deadline: fmt(t.deadline),
    priority: Math.round(t.priorityScore),
    lesson: t.lessonDate ? `${t.lessonDate}${t.lessonTimeSlot ? ' ' + t.lessonTimeSlot : ''}` : undefined,
    examPrep: t.assessmentPrep ? t.assessmentPhase ?? true : undefined,
    postponed: t.postponedCount || undefined,
    completedAt: fmt(t.completedAt),
    description: t.description ? t.description.slice(0, 200) : undefined,
  });
}

export function listTasks(data: UserData, args: ListTasksArgs = {}) {
  const status = args.status ?? 'open';
  const course = requireCourse(data, args.course);
  const limit = Math.min(Math.max(args.limit ?? 30, 1), 100);
  const horizon = args.dueWithinDays !== undefined ? Date.now() + args.dueWithinDays * 86_400_000 : undefined;

  let list = data.tasks.filter(t => !t.isPhantom);
  if (status === 'open') list = list.filter(t => t.status !== 'done');
  else if (status !== 'all') list = list.filter(t => t.status === status);
  if (course) list = list.filter(t => t.courseId === course.id);
  if (horizon !== undefined) list = list.filter(t => t.deadline && new Date(t.deadline).getTime() <= horizon);

  // Aperti: priorità decrescente. Completati: più recenti prima.
  list.sort((a, b) =>
    status === 'done'
      ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
      : b.priorityScore - a.priorityScore,
  );

  return {
    total: list.length,
    returned: Math.min(list.length, limit),
    tasks: list.slice(0, limit).map(t => shapeTask(data, t)),
  };
}

/* ─── Tool: list_events ─── */

export interface ListEventsArgs {
  from?: string;
  to?: string;
  type?: CalendarEvent['type'];
  course?: string;
  limit?: number;
}

export function listEvents(data: UserData, args: ListEventsArgs = {}) {
  const from = parseDate(args.from, startOfDay(new Date()));
  const to = args.to ? addDays(parseDate(args.to, from), args.to.length === 10 ? 1 : 0) : addDays(from, 7);
  const course = requireCourse(data, args.course);
  const limit = Math.min(Math.max(args.limit ?? 50, 1), 200);

  const list = data.events
    .filter(e => {
      const s = new Date(e.startTime).getTime();
      const en = new Date(e.endTime).getTime();
      return en > from.getTime() && s < to.getTime();
    })
    .filter(e => !args.type || e.type === args.type)
    .filter(e => !course || e.courseId === course.id)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    range: `${fmt(from)} → ${fmt(to)}`,
    total: list.length,
    events: list.slice(0, limit).map(e =>
      compact({
        title: e.title,
        type: e.type,
        start: fmt(e.startTime),
        end: fmt(e.endTime),
        course: courseName(data, e.courseId),
        place: e.location?.type === 'remote' ? 'online' : e.location?.address,
        topic: e.topic,
        lecturer: e.lecturer,
      }),
    ),
  };
}

/* ─── Tool: get_upcoming_assessments ─── */

export function getUpcomingAssessments(data: UserData, days = 60) {
  const now = Date.now();
  const end = now + days * 86_400_000;
  return data.events
    .filter(e => ['exam', 'quiz', 'project_deadline'].includes(e.type))
    .filter(e => {
      const s = new Date(e.startTime).getTime();
      return s >= now && s <= end;
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .map(e => {
      const prep = data.tasks.filter(
        t => t.assessmentPrep && t.courseId === e.courseId && !t.isPhantom,
      );
      const prepOpen = prep.filter(t => t.status !== 'done');
      return compact({
        title: e.title,
        type: e.type,
        start: fmt(e.startTime),
        daysLeft: Math.ceil((new Date(e.startTime).getTime() - now) / 86_400_000),
        course: courseName(data, e.courseId),
        prepTasksOpen: prepOpen.length,
        prepMinutesOpen: prepOpen.reduce((s, t) => s + (t.estimatedDuration || 0), 0),
      });
    });
}

/* ─── Tool: get_catchup_status ─── */

export function getCatchUpStatus(data: UserData, course?: string) {
  const summary = CatchUpEngine.calculate(data.events, data.courses, data.tasks, data.studySessions);
  const wanted = requireCourse(data, course);
  const rows = summary.courses
    .filter(c => !wanted || c.courseId === wanted.id)
    .map(c =>
      compact({
        course: c.courseName,
        pastLessons: c.totalLessonsPast,
        lessonsCaughtUp: c.lessonsFullyCaughtUp,
        catchUpPercent: c.catchUpPercentage,
        pendingTasks: c.pendingTasksCount,
        pendingMinutes: c.pendingMinutes,
        estimatedCatchUpDate: fmt(c.estimatedCatchUpDate ?? undefined)?.slice(0, 10),
        planningOk: c.isPlanningCaughtUp,
      }),
    );
  return compact({
    globalPercent: summary.globalPercentage,
    globalCatchUpDate: fmt(summary.globalCatchUpDate ?? undefined)?.slice(0, 10),
    planningOk: summary.globalPlanningCaughtUp,
    courses: rows,
  });
}

/* ─── Tool: get_week_summary ─── */

export function getWeekSummary(data: UserData, weekOffset = 0) {
  const s = WeeklySummaryEngine.compute(data.tasks, data.courses, data.events, data.ankiHistory, new Date(), weekOffset);
  return compact({
    week: `${fmt(s.weekStart)?.slice(0, 10)} → ${fmt(new Date(new Date(s.weekEnd).getTime() - 1))?.slice(0, 10)}`,
    tasksCompleted: s.tasksCompleted,
    minutesStudied: s.minutesStudied,
    studied: WeeklySummaryEngine.formatDuration(s.minutesStudied),
    vsPreviousWeek: { minutes: s.deltaMinutes, tasks: s.deltaTasks },
    byCourse: s.byCourse.map(c => ({ course: c.courseName, minutes: c.minutes, tasks: c.tasks })),
    topics: s.topics,
    streakDays: s.streakDays,
    bestDay: s.bestDay,
    estimateAccuracy: s.estimateAccuracy,
    openBacklog: s.openBacklog,
    attended: s.attended,
    recovered: s.recovered,
    ankiCards: s.ankiCards || undefined,
    upcoming: s.upcoming,
    atRisk: s.atRisk,
    tip: s.tip,
  });
}

/* ─── Tool: find_free_slots ─── */

export interface FindFreeSlotsArgs {
  from?: string;
  to?: string;
  minMinutes?: number;
}

interface Interval { start: number; end: number }

function hhmmToDate(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(day);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function subtract(windows: Interval[], busy: Interval[]): Interval[] {
  let result = windows;
  for (const b of busy) {
    const next: Interval[] = [];
    for (const w of result) {
      if (b.end <= w.start || b.start >= w.end) { next.push(w); continue; }
      if (b.start > w.start) next.push({ start: w.start, end: b.start });
      if (b.end < w.end) next.push({ start: b.end, end: w.end });
    }
    result = next;
  }
  return result;
}

/**
 * Slot liberi dentro le fasce di studio configurate dall'utente, al netto di eventi
 * (lezioni, viaggi, esami…) e sessioni di studio già pianificate. Solo il futuro.
 */
export function findFreeSlots(data: UserData, args: FindFreeSlotsArgs = {}) {
  const today = startOfDay(new Date());
  const from = parseDate(args.from, today);
  const toDay = args.to ? parseDate(args.to, addDays(from, 7)) : addDays(from, 6);
  const minMinutes = Math.max(args.minMinutes ?? 30, 5);
  const days = Math.min(Math.floor((startOfDay(toDay).getTime() - startOfDay(from).getTime()) / 86_400_000) + 1, 31);

  const busyAll: Interval[] = [
    ...data.events.map(e => ({ start: new Date(e.startTime).getTime(), end: new Date(e.endTime).getTime() })),
    ...data.studySessions.map(s => ({ start: new Date(s.startTime).getTime(), end: new Date(s.endTime).getTime() })),
  ];

  const hours = data.preferences.dailyStudyHours;
  const now = Date.now();
  const slots: { date: string; start: string; end: string; minutes: number }[] = [];

  for (let i = 0; i < Math.max(days, 1); i++) {
    const day = addDays(startOfDay(from), i);
    const dow = day.getDay();
    const cfg = hours?.[dow] ?? (hours ? undefined : { enabled: dow !== 0, start: '09:00', end: '19:00' });
    if (!cfg || !cfg.enabled) continue;

    let windows: Interval[] = [{ start: hhmmToDate(day, cfg.start).getTime(), end: hhmmToDate(day, cfg.end).getTime() }];
    if (cfg.lunchBreak?.enabled) {
      windows = subtract(windows, [{ start: hhmmToDate(day, cfg.lunchBreak.start).getTime(), end: hhmmToDate(day, cfg.lunchBreak.end).getTime() }]);
    }
    const dayBusy = busyAll.filter(b => b.end > windows[0]?.start && b.start < (windows[windows.length - 1]?.end ?? 0));
    windows = subtract(windows, dayBusy);

    for (const w of windows) {
      const start = Math.max(w.start, now);
      if (w.end - start >= minMinutes * MIN) {
        slots.push({
          date: fmt(new Date(start))!.slice(0, 10),
          start: fmt(new Date(start))!.slice(11),
          end: fmt(new Date(w.end))!.slice(11),
          minutes: Math.round((w.end - start) / MIN),
        });
      }
    }
  }

  return {
    note: 'Fasce di studio configurate dall\'utente, al netto di eventi e sessioni già pianificate.',
    totalFreeMinutes: slots.reduce((s, x) => s + x.minutes, 0),
    slots,
  };
}

/* ─── Tool: get_overview ─── */

export function getOverview(data: UserData) {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = addDays(todayStart, 1);

  const open = data.tasks.filter(t => t.status !== 'done' && !t.isPhantom);
  const doneToday = data.tasks.filter(
    t => t.status === 'done' && t.completedAt && new Date(t.completedAt) >= todayStart && new Date(t.completedAt) < todayEnd,
  );
  const todayEvents = data.events
    .filter(e => new Date(e.endTime) > now && new Date(e.startTime) < todayEnd)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const catchUp = CatchUpEngine.calculate(data.events, data.courses, data.tasks, data.studySessions);
  const top = [...open].sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 5);

  return compact({
    now: fmt(now),
    courses: data.courses.map(c => c.name),
    openTasks: open.length,
    openMinutes: open.reduce((s, t) => s + (t.estimatedDuration || 0), 0),
    doneToday: doneToday.length,
    dailyTaskGoal: data.preferences.dailyTaskGoal,
    catchUpPercent: catchUp.globalPercentage,
    todayRemainingEvents: todayEvents.map(e => ({ title: e.title, type: e.type, start: fmt(e.startTime)?.slice(11), end: fmt(e.endTime)?.slice(11) })),
    topPriorityTasks: top.map(t => shapeTask(data, t)),
    nextAssessments: getUpcomingAssessments(data, 30).slice(0, 3),
  });
}
