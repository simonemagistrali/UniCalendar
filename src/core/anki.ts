import type { AnkiDaySnapshot } from './types';

const ANKI_URL = 'http://127.0.0.1:8765';

/** Ora di inizio del "giorno Anki" (impostazione predefinita di Anki: 4:00) */
const ANKI_ROLLOVER_HOUR = 4;

async function invoke(action: string, version: number = 6, params: any = {}) {
    try {
        const response = await fetch(ANKI_URL, {
            method: 'POST',
            body: JSON.stringify({ action, version, params }),
            headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.error) {
            throw new Error(result.error);
        }
        return result.result;
    } catch {
        // Silently fail if Anki is not open, as this is expected behavior for many users
        throw new Error('Anki not reachable');
    }
}

function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Inizio del giorno Anki corrente (tiene conto del rollover delle 4:00) */
export function getAnkiDayStart(now: Date = new Date()): Date {
    const start = new Date(now);
    start.setHours(ANKI_ROLLOVER_HOUR, 0, 0, 0);
    if (now.getTime() < start.getTime()) start.setDate(start.getDate() - 1);
    return start;
}

/** Chiave "YYYY-MM-DD" del giorno Anki corrente */
export function getAnkiDayKey(now: Date = new Date()): string {
    return toDateKey(getAnkiDayStart(now));
}

export interface AnkiQueueCounts {
    reviewDue: number;
    learnDue: number;
    newToday: number;
}

export interface AnkiTodayReviews {
    count: number;
    totalSeconds: number;
    avgSeconds: number | null;
}

export const ankiService = {
    async checkConnection(): Promise<boolean> {
        try {
            const version = await invoke('version');
            return !!version;
        } catch {
            return false;
        }
    },

    async getDueCardsCount(): Promise<number> {
        try {
            const cards = await invoke('findCards', 6, { query: 'is:due' });
            return cards.length;
        } catch {
            return 0;
        }
    },

    async getStudiedTodayCount(): Promise<number> {
        try {
            const cards = await invoke('findCards', 6, { query: 'rated:1' });
            return cards.length;
        } catch {
            return 0;
        }
    },

    async getNewCardsCount(): Promise<number> {
        try {
            const cards = await invoke('findCards', 6, { query: 'is:new' });
            return cards.length;
        } catch {
            return 0;
        }
    },

    async getLearnCardsCount(): Promise<number> {
        try {
            const cards = await invoke('findCards', 6, { query: 'is:learn' });
            return cards.length;
        } catch {
            return 0;
        }
    },

    async getReviewCardsCount(): Promise<number> {
        try {
            const cards = await invoke('findCards', 6, { query: 'is:review is:due' });
            return cards.length;
        } catch {
            return 0;
        }
    },

    /**
     * Code di oggi come le mostra Anki nella schermata dei mazzi
     * (nuove limitate dal limite giornaliero + apprendimento + ripasso).
     */
    async getTodayQueueCounts(): Promise<AnkiQueueCounts | null> {
        try {
            const names: string[] = await invoke('deckNames');
            const topLevel = names.filter(n => !n.includes('::'));
            if (topLevel.length === 0) return { reviewDue: 0, learnDue: 0, newToday: 0 };
            const stats = await invoke('getDeckStats', 6, { decks: topLevel });
            const counts: AnkiQueueCounts = { reviewDue: 0, learnDue: 0, newToday: 0 };
            for (const deck of Object.values(stats || {}) as any[]) {
                counts.reviewDue += Number(deck.review_count) || 0;
                counts.learnDue += Number(deck.learn_count) || 0;
                counts.newToday += Number(deck.new_count) || 0;
            }
            return counts;
        } catch {
            // Fallback se getDeckStats non è disponibile (es. finestra Anki non su panoramica mazzi)
            try {
                const [review, learn] = await Promise.all([
                    invoke('findCards', 6, { query: 'is:review is:due' }).catch(() => []),
                    invoke('findCards', 6, { query: 'is:learn' }).catch(() => []),
                ]);
                return { reviewDue: review.length, learnDue: learn.length, newToday: 0 };
            } catch {
                return null;
            }
        }
    },

    /** Risposte date oggi e tempo impiegato (dal registro revisioni di Anki) */
    async getTodayReviews(): Promise<AnkiTodayReviews> {
        const dayStartMs = getAnkiDayStart().getTime();
        try {
            const cards: number[] = await invoke('findCards', 6, { query: 'rated:1' });
            if (!cards || cards.length === 0) return { count: 0, totalSeconds: 0, avgSeconds: null };
            const reviews = await invoke('getReviewsOfCards', 6, { cards: cards.map(String) });
            let count = 0;
            let totalMs = 0;
            for (const list of Object.values(reviews || {}) as any[]) {
                for (const r of list || []) {
                    if (Number(r.id) >= dayStartMs) {
                        count++;
                        // Ignora pause anomale (> 5 min) che falserebbero la media
                        totalMs += Math.min(Number(r.time) || 0, 5 * 60 * 1000);
                    }
                }
            }
            const totalSeconds = totalMs / 1000;
            return {
                count,
                totalSeconds,
                avgSeconds: count > 0 && totalSeconds > 0 ? Math.round((totalSeconds / count) * 10) / 10 : null,
            };
        } catch {
            try {
                const count = await invoke('getNumCardsReviewedToday');
                return { count: Number(count) || 0, totalSeconds: 0, avgSeconds: null };
            } catch {
                return { count: 0, totalSeconds: 0, avgSeconds: null };
            }
        }
    },

    /** Storico risposte per giorno (tutta la collezione): { "YYYY-MM-DD": numero } */
    async getReviewsByDay(): Promise<Record<string, number>> {
        try {
            const rows: [string, number][] = await invoke('getNumCardsReviewedByDay');
            const out: Record<string, number> = {};
            for (const [date, n] of rows || []) out[date] = Number(n) || 0;
            return out;
        } catch {
            return {};
        }
    },

    async getAverageTimeSeconds(): Promise<number | null> {
        try {
            const html = await invoke('getCollectionStatsHTML', 6);
            if (typeof html !== 'string') return null;
            
            // Rimuovi caratteri di formattazione bidirezionali nascosti inseriti da Anki
            const cleanHtml = html.replace(/[\u2066-\u2069]/g, '');
            
            // Cerca "Average answer time:" o "Tempo medio di risposta:" seguito dal valore in secondi
            const regex = /(?:Average answer time|Tempo medio di risposta)[\s\S]{0,100}?<b[^>]*>\s*([0-9]+[.,][0-9]+)\s*s/i;
            const match = cleanHtml.match(regex);
            
            if (match && match[1]) {
                const parsed = parseFloat(match[1].replace(',', '.'));
                if (!isNaN(parsed) && parsed > 0) {
                    return parsed;
                }
            }
            return null;
        } catch {
            return null;
        }
    },

    /**
     * Legge tutto ciò che serve da Anki in un colpo solo.
     * Ritorna null se Anki non è raggiungibile.
     */
    async fetchFullSnapshot(): Promise<{
        today: Omit<AnkiDaySnapshot, 'estimatedMinutes'>;
        reviewsByDay: Record<string, number>;
        collectionAvgSeconds: number | null;
    } | null> {
        const connected = await this.checkConnection();
        if (!connected) return null;

        try {
            const [queue, newTotal, todayReviews, reviewsByDay, collectionAvgSeconds] = await Promise.all([
                this.getTodayQueueCounts().catch(() => null),
                this.getNewCardsCount().catch(() => 0),
                this.getTodayReviews().catch(() => ({ count: 0, totalSeconds: 0, avgSeconds: null })),
                this.getReviewsByDay().catch(() => ({} as Record<string, number>)),
                this.getAverageTimeSeconds().catch(() => null),
            ]);

            const q = queue || { reviewDue: 0, learnDue: 0, newToday: 0 };
            const todayKey = getAnkiDayKey();
            const studied = Math.max(todayReviews?.count || 0, reviewsByDay?.[todayKey] || 0);

            const effectiveNewToday = q.newToday > 0 ? q.newToday : ((newTotal || 0) > 0 ? Math.min(newTotal || 0, 20) : 0);
            const remaining = q.reviewDue + q.learnDue + effectiveNewToday;

            return {
                today: {
                    date: todayKey,
                    updatedAt: new Date().toISOString(),
                    reviewDue: q.reviewDue,
                    learnDue: q.learnDue,
                    newToday: q.newToday > 0 ? q.newToday : effectiveNewToday,
                    newTotal: newTotal || 0,
                    remaining,
                    studied,
                    studyMinutes: (todayReviews?.totalSeconds || 0) > 0 ? Math.round(todayReviews.totalSeconds / 6) / 10 : undefined,
                    avgSecondsPerCard: todayReviews?.avgSeconds ?? undefined,
                    collectionAvgSeconds: collectionAvgSeconds ?? undefined,
                },
                reviewsByDay: reviewsByDay || {},
                collectionAvgSeconds,
            };
        } catch (e) {
            console.error('Error fetching Anki snapshot:', e);
            return null;
        }
    },
};
