import type { AnkiDaySnapshot, CalendarEvent, Course, Task } from './types';

/**
 * WeeklySummaryEngine — funzioni pure (nessun accesso a store/DOM), così lo stesso modulo
 * può essere riusato lato server (Cloud Function) per l'email settimanale.
 */

export interface CourseWeekStat {
  courseId: string;
  courseName: string;
  minutes: number;
  tasks: number;
}

export interface WeeklySummary {
  weekStart: string; // ISO (lunedì 00:00 locale)
  weekEnd: string;   // ISO (lunedì successivo)
  tasksCompleted: number;
  minutesStudied: number;
  prevTasksCompleted: number;
  prevMinutesStudied: number;
  deltaMinutes: number;
  deltaTasks: number;
  byCourse: CourseWeekStat[];
  topCourse?: CourseWeekStat;
  topics: string[];
  streakDays: number;
  bestDay?: { date: string; minutes: number };
  estimateAccuracy?: number; // actual/estimated medio (1 = stime perfette)
  openBacklog: number;       // task aperti più vecchi di 14 giorni
  attended: number;
  recovered: number;
  ankiCards: number;
  upcoming: { title: string; date: string; kind: 'exam' | 'quiz' | 'project_deadline' }[];
  atRisk: { courseName: string; daysToExam: number; minutesThisWeek: number }[];
  tip?: string;
}

const DAY = 86400000;

/** Lunedì 00:00 (locale) della settimana che contiene `d`. */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // lun=0 ... dom=6
  x.setDate(x.getDate() - dow);
  return x;
}

function minutesOf(t: Task): number {
  return t.actualDuration ?? t.estimatedDuration ?? 0;
}

function doneIn(tasks: Task[], from: number, to: number): Task[] {
  return tasks.filter(t => {
    if (t.status !== 'done' || !t.completedAt || t.isPhantom) return false;
    const c = new Date(t.completedAt).getTime();
    return c >= from && c < to;
  });
}

function topicOf(t: Task, events: Map<string, CalendarEvent>): string | undefined {
  const m = t.description?.match(/Argomento:\s*([^\n\r]+)/i);
  if (m && m[1].trim()) return m[1].trim();
  const ev = t.relatedEventId ? events.get(t.relatedEventId) : undefined;
  if (ev?.topic) return ev.topic;
  return undefined;
}

export class WeeklySummaryEngine {
  /**
   * @param weekOffset 0 = settimana corrente (lun→adesso), -1 = settimana scorsa completa, ...
   */
  static compute(
    tasks: Task[],
    courses: Course[],
    events: CalendarEvent[],
    ankiHistory: AnkiDaySnapshot[] = [],
    now: Date = new Date(),
    weekOffset: number = 0
  ): WeeklySummary {
    const thisStart = startOfWeekMonday(new Date(now.getTime() + weekOffset * 7 * DAY));
    const start = thisStart.getTime();
    const end = start + 7 * DAY;
    const prevStart = start - 7 * DAY;

    const eventsById = new Map(events.map(e => [e.id, e]));
    const courseById = new Map(courses.map(c => [c.id, c]));

    const done = doneIn(tasks, start, end);
    const prevDone = doneIn(tasks, prevStart, start);

    const minutes = done.reduce((s, t) => s + minutesOf(t), 0);
    const prevMinutes = prevDone.reduce((s, t) => s + minutesOf(t), 0);

    // Per materia
    const stat = new Map<string, CourseWeekStat>();
    for (const t of done) {
      if (!t.courseId) continue;
      const c = courseById.get(t.courseId);
      const cur = stat.get(t.courseId) || { courseId: t.courseId, courseName: c?.name || 'Materia', minutes: 0, tasks: 0 };
      cur.minutes += minutesOf(t);
      cur.tasks += 1;
      stat.set(t.courseId, cur);
    }
    const byCourse = [...stat.values()].sort((a, b) => b.minutes - a.minutes);

    // Temi studiati (unici)
    const topics: string[] = [];
    for (const t of done) {
      const tp = topicOf(t, eventsById);
      if (tp && !topics.includes(tp)) topics.push(tp);
      if (topics.length >= 12) break;
    }

    // Giorno migliore
    const perDay = new Map<string, number>();
    for (const t of done) {
      const key = new Date(t.completedAt as string).toLocaleDateString('sv-SE');
      perDay.set(key, (perDay.get(key) || 0) + minutesOf(t));
    }
    let bestDay: WeeklySummary['bestDay'];
    for (const [date, m] of perDay) if (!bestDay || m > bestDay.minutes) bestDay = { date, minutes: m };

    // Streak: giorni consecutivi (fino a ieri/oggi) con almeno un task completato
    const allDoneDays = new Set(
      tasks.filter(t => t.status === 'done' && t.completedAt && !t.isPhantom)
        .map(t => new Date(t.completedAt as string).toLocaleDateString('sv-SE'))
    );
    let streak = 0;
    const cursor = new Date(Math.min(now.getTime(), end - 1));
    cursor.setHours(0, 0, 0, 0);
    if (!allDoneDays.has(cursor.toLocaleDateString('sv-SE'))) cursor.setDate(cursor.getDate() - 1); // oggi può essere ancora vuoto
    while (allDoneDays.has(cursor.toLocaleDateString('sv-SE'))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Accuratezza stime
    const withActual = done.filter(t => t.actualDuration && t.estimatedDuration);
    const estimateAccuracy = withActual.length >= 3
      ? withActual.reduce((s, t) => s + (t.actualDuration as number) / t.estimatedDuration, 0) / withActual.length
      : undefined;

    // Arretrato
    const openBacklog = tasks.filter(t =>
      t.status !== 'done' && !t.isPhantom && now.getTime() - new Date(t.createdAt).getTime() > 14 * DAY
    ).length;

    // Presenza a lezione
    const follow = done.filter(t => t.title.toLowerCase().startsWith('seguire/recuperare'));
    const attended = follow.filter(t => t.completionMode === 'attended').length;
    const recovered = follow.filter(t => t.completionMode === 'recovered').length;

    // Anki
    const startKey = new Date(start).toLocaleDateString('sv-SE');
    const endKey = new Date(end).toLocaleDateString('sv-SE');
    const ankiCards = ankiHistory
      .filter(d => d.date >= startKey && d.date < endKey)
      .reduce((s, d) => s + (d.studied || 0), 0);

    // Prossima settimana: verifiche e scadenze
    const nextFrom = Math.max(end, now.getTime());
    const upcoming = events
      .filter(e => (e.type === 'exam' || e.type === 'quiz' || e.type === 'project_deadline')
        && new Date(e.startTime).getTime() >= nextFrom
        && new Date(e.startTime).getTime() < nextFrom + 7 * DAY)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map(e => ({ title: e.title, date: e.startTime, kind: e.type as 'exam' | 'quiz' | 'project_deadline' }));

    // Materie a rischio: esame entro 14 giorni e poche ore questa settimana
    const atRisk: WeeklySummary['atRisk'] = [];
    for (const e of events) {
      if (e.type !== 'exam' || !e.courseId) continue;
      const days = (new Date(e.startTime).getTime() - now.getTime()) / DAY;
      if (days < 0 || days > 14) continue;
      const m = stat.get(e.courseId)?.minutes || 0;
      if (m < 120) {
        atRisk.push({ courseName: courseById.get(e.courseId)?.name || e.title, daysToExam: Math.ceil(days), minutesThisWeek: m });
      }
    }

    // Un suggerimento semplice
    let tip: string | undefined;
    if (atRisk.length > 0) {
      tip = `Dedica più tempo a ${atRisk[0].courseName}: l'esame è tra ${atRisk[0].daysToExam} giorni e questa settimana hai studiato solo ${atRisk[0].minutesThisWeek} min.`;
    } else if (estimateAccuracy && estimateAccuracy > 1.3) {
      tip = `Le tue attività richiedono in media il ${Math.round((estimateAccuracy - 1) * 100)}% in più del previsto: prova ad aumentare i tempi stimati.`;
    } else if (openBacklog >= 5) {
      tip = `Hai ${openBacklog} attività aperte da oltre 2 settimane: prova la modalità "più vecchi prima" per smaltirle.`;
    } else if (minutes < prevMinutes * 0.6 && prevMinutes > 0) {
      tip = 'Settimana più leggera della precedente: se è voluto va bene, altrimenti pianifica un blocco fisso.';
    }

    return {
      weekStart: new Date(start).toISOString(),
      weekEnd: new Date(end).toISOString(),
      tasksCompleted: done.length,
      minutesStudied: minutes,
      prevTasksCompleted: prevDone.length,
      prevMinutesStudied: prevMinutes,
      deltaMinutes: minutes - prevMinutes,
      deltaTasks: done.length - prevDone.length,
      byCourse,
      topCourse: byCourse[0],
      topics,
      streakDays: streak,
      bestDay,
      estimateAccuracy,
      openBacklog,
      attended,
      recovered,
      ankiCards,
      upcoming,
      atRisk,
      tip,
    };
  }

  static formatDuration(min: number): string {
    const h = Math.floor(Math.abs(min) / 60);
    const m = Math.round(Math.abs(min) % 60);
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }

  /** Testo semplice (per condivisione o corpo email). */
  static toPlainText(s: WeeklySummary): string {
    const f = this.formatDuration;
    const sign = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±');
    const lines: string[] = [];
    lines.push(`UniCalendar — riepilogo settimanale (${new Date(s.weekStart).toLocaleDateString('it-IT')})`);
    lines.push('');
    lines.push(`Attività completate: ${s.tasksCompleted} (${sign(s.deltaTasks)}${Math.abs(s.deltaTasks)} rispetto alla settimana prima)`);
    lines.push(`Tempo di studio: ${f(s.minutesStudied)} (${sign(s.deltaMinutes)}${f(s.deltaMinutes)})`);
    if (s.topCourse) lines.push(`Materia più studiata: ${s.topCourse.courseName} (${f(s.topCourse.minutes)})`);
    if (s.streakDays > 0) lines.push(`Serie attuale: ${s.streakDays} giorni consecutivi`);
    if (s.bestDay) lines.push(`Giorno migliore: ${new Date(s.bestDay.date).toLocaleDateString('it-IT', { weekday: 'long' })} (${f(s.bestDay.minutes)})`);
    if (s.topics.length) lines.push(`Temi studiati: ${s.topics.join('; ')}`);
    if (s.attended + s.recovered > 0) lines.push(`Lezioni: ${s.attended} seguite in aula, ${s.recovered} recuperate`);
    if (s.ankiCards > 0) lines.push(`Anki: ${s.ankiCards} carte`);
    if (s.estimateAccuracy) lines.push(`Accuratezza stime: ${Math.round(s.estimateAccuracy * 100)}% (100% = perfette)`);
    if (s.openBacklog > 0) lines.push(`Arretrato (aperti da oltre 14 giorni): ${s.openBacklog}`);
    if (s.upcoming.length) {
      lines.push('');
      lines.push('In arrivo la prossima settimana:');
      for (const u of s.upcoming) lines.push(`• ${u.title} — ${new Date(u.date).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}`);
    }
    if (s.atRisk.length) {
      lines.push('');
      lines.push('Materie da non trascurare:');
      for (const r of s.atRisk) lines.push(`• ${r.courseName}: esame tra ${r.daysToExam} giorni, ${f(r.minutesThisWeek)} questa settimana`);
    }
    if (s.tip) { lines.push(''); lines.push(`Suggerimento: ${s.tip}`); }
    return lines.join('\n');
  }
}
