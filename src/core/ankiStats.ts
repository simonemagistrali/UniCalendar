/**
 * ankiStats — Calcoli sullo storico Anki salvato (funziona anche con Anki chiuso).
 */
import type { AnkiDaySnapshot, UserPreferences } from './types';

const MAX_HISTORY_DAYS = 400;

export type AnkiSpeedSource = 'today' | 'history' | 'collection' | 'manual';

export interface AnkiSpeed {
    seconds: number;
    source: AnkiSpeedSource;
}

/** Ordina per data crescente (es. 2026-09-01, 2026-09-02...) */
export function sortHistory(history: AnkiDaySnapshot[]): AnkiDaySnapshot[] {
    return [...history].sort((a, b) => a.date.localeCompare(b.date));
}

/** Ultimo snapshot "reale" (non ricostruito), cioè l'ultima lettura completa da Anki */
export function getLatestSnapshot(history: AnkiDaySnapshot[]): AnkiDaySnapshot | null {
    const real = sortHistory(history).filter(h => !h.backfilled);
    return real.length > 0 ? real[real.length - 1] : null;
}

/**
 * Velocità effettiva (secondi per carta):
 * media pesata sulle risposte degli ultimi 14 giorni misurati → statistiche collezione → impostazione manuale.
 */
export function getEffectiveSpeed(history: AnkiDaySnapshot[], prefs: UserPreferences): AnkiSpeed {
    const measured = sortHistory(history)
        .filter(h => !h.backfilled && h.avgSecondsPerCard && h.avgSecondsPerCard > 0 && h.studied > 0)
        .slice(-14);

    const totalCards = measured.reduce((s, h) => s + h.studied, 0);
    if (totalCards >= 10) {
        const weighted = measured.reduce((s, h) => s + h.avgSecondsPerCard! * h.studied, 0) / totalCards;
        const onlyToday = measured.length === 1;
        return { seconds: Math.round(weighted * 10) / 10, source: onlyToday ? 'today' : 'history' };
    }

    const latest = getLatestSnapshot(history);
    if (latest?.collectionAvgSeconds && latest.collectionAvgSeconds > 0) {
        return { seconds: Math.round(latest.collectionAvgSeconds * 10) / 10, source: 'collection' };
    }
    return { seconds: prefs.ankiAverageTimeSeconds || 15, source: 'manual' };
}

/**
 * Calcola i minuti necessari stimati per lo studio di oggi,
 * includendo come numero di carte da fare SIA quelle nuove SIA quelle da ripassare.
 */
export function estimateMinutes(
    snapshot: Partial<Pick<AnkiDaySnapshot, 'remaining' | 'reviewDue' | 'learnDue' | 'newToday' | 'newTotal'>> | null,
    speedSeconds: number
): number {
    if (!snapshot) return 0;
    const reviewCards = (snapshot.reviewDue || 0) + (snapshot.learnDue || 0);
    const newCards = snapshot.newToday !== undefined
        ? snapshot.newToday
        : (snapshot.newTotal !== undefined ? Math.min(snapshot.newTotal, 20) : 0);
    
    // Il totale da fare include sia le carte da ripassare che le carte nuove
    const totalCards = (snapshot.remaining !== undefined && snapshot.remaining > 0)
        ? Math.max(snapshot.remaining, reviewCards + newCards)
        : (reviewCards + newCards);

    if (totalCards <= 0 || speedSeconds <= 0) return 0;
    return Math.ceil((totalCards * speedSeconds) / 60);
}

/**
 * Unisce una nuova lettura da Anki con lo storico salvato.
 * - Sostituisce lo snapshot del giorno corrente
 * - Ricostruisce i giorni passati mancanti dallo storico revisioni di Anki
 * - Mantiene al massimo MAX_HISTORY_DAYS giorni
 */
export function mergeAnkiHistory(
    history: AnkiDaySnapshot[],
    today: AnkiDaySnapshot,
    reviewsByDay: Record<string, number>,
): AnkiDaySnapshot[] {
    const map = new Map<string, AnkiDaySnapshot>();
    for (const h of history) map.set(h.date, h);

    for (const [date, studied] of Object.entries(reviewsByDay)) {
        if (date === today.date) continue;
        const existing = map.get(date);
        if (!existing) {
            map.set(date, { date, updatedAt: today.updatedAt, studied, backfilled: true });
        } else if (studied > existing.studied) {
            // Lo storico di Anki è la fonte più precisa per il numero di risposte
            map.set(date, { ...existing, studied });
        }
    }

    map.set(today.date, { ...map.get(today.date), ...today, backfilled: false });

    return sortHistory([...map.values()]).slice(-MAX_HISTORY_DAYS);
}

/** Unisce due storici (es. locale + cloud) prendendo per ogni giorno la versione più completa/recente */
export function unionAnkiHistory(a: AnkiDaySnapshot[] = [], b: AnkiDaySnapshot[] = []): AnkiDaySnapshot[] {
    const map = new Map<string, AnkiDaySnapshot>();
    for (const h of [...a, ...b]) {
        const existing = map.get(h.date);
        if (!existing) { map.set(h.date, h); continue; }
        // Preferisci gli snapshot reali a quelli ricostruiti, poi il più recente
        if (existing.backfilled && !h.backfilled) map.set(h.date, h);
        else if (!!existing.backfilled === !!h.backfilled && h.updatedAt > existing.updatedAt) map.set(h.date, h);
    }
    return sortHistory([...map.values()]).slice(-MAX_HISTORY_DAYS);
}

/** Confronta due snapshot ignorando il timestamp (per evitare salvataggi inutili) */
export function isSameSnapshot(a: AnkiDaySnapshot | undefined, b: AnkiDaySnapshot): boolean {
    if (!a) return false;
    const strip = ({ updatedAt: _u, ...rest }: AnkiDaySnapshot) => JSON.stringify(rest, Object.keys(rest).sort());
    return strip(a) === strip(b);
}

/**
 * Calcola statistiche aggregate e dati per i grafici dell'andamento dello studio nel tempo.
 */
export interface AnkiTrendStats {
    totalStudied: number;
    activeDaysCount: number;
    dailyAverage: number;
    avgSpeedSeconds: number | null;
    speedDeltaPercent: number | null; // e.g. -15% significa 15% più veloce
    chartDays: {
        date: string;
        label: string;
        studied: number;
        remaining?: number;
        avgSecondsPerCard?: number;
    }[];
}

export function getAnkiTrendStats(history: AnkiDaySnapshot[], daysWindow: number = 30): AnkiTrendStats {
    const sorted = sortHistory(history);
    if (sorted.length === 0) {
        return {
            totalStudied: 0,
            activeDaysCount: 0,
            dailyAverage: 0,
            avgSpeedSeconds: null,
            speedDeltaPercent: null,
            chartDays: [],
        };
    }

    // Costruisci le date per la finestra temporale richiesta (fino a oggi)
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - (daysWindow - 1));
    const startKey = startDate.toISOString().split('T')[0];

    // Mappa date storiche esistenti
    const historyMap = new Map<string, AnkiDaySnapshot>();
    for (const h of sorted) {
        historyMap.set(h.date, h);
    }

    const chartDays: AnkiTrendStats['chartDays'] = [];
    let totalStudied = 0;
    let activeDaysCount = 0;
    const measuredSpeeds: { date: string; speed: number; studied: number }[] = [];

    const cur = new Date(startDate);
    while (cur <= now) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;
        const label = `${d}/${m}`;

        const entry = historyMap.get(key);
        const studied = entry?.studied || 0;
        const remaining = entry?.remaining;
        const avgSecondsPerCard = entry?.avgSecondsPerCard;

        if (studied > 0) {
            totalStudied += studied;
            activeDaysCount++;
        }
        if (avgSecondsPerCard && avgSecondsPerCard > 0 && studied > 0) {
            measuredSpeeds.push({ date: key, speed: avgSecondsPerCard, studied });
        }

        chartDays.push({
            date: key,
            label,
            studied,
            remaining,
            avgSecondsPerCard: avgSecondsPerCard && avgSecondsPerCard > 0 ? avgSecondsPerCard : undefined,
        });

        cur.setDate(cur.getDate() + 1);
    }

    const dailyAverage = activeDaysCount > 0 ? Math.round(totalStudied / activeDaysCount) : 0;

    let avgSpeedSeconds: number | null = null;
    let speedDeltaPercent: number | null = null;

    if (measuredSpeeds.length > 0) {
        const sumWeighted = measuredSpeeds.reduce((acc, curr) => acc + curr.speed * curr.studied, 0);
        const sumCards = measuredSpeeds.reduce((acc, curr) => acc + curr.studied, 0);
        avgSpeedSeconds = sumCards > 0 ? Math.round((sumWeighted / sumCards) * 10) / 10 : null;

        // Se abbiamo almeno 4 misurazioni, calcola il trend tra la prima metà e la seconda
        if (measuredSpeeds.length >= 4) {
            const mid = Math.floor(measuredSpeeds.length / 2);
            const firstHalf = measuredSpeeds.slice(0, mid);
            const secondHalf = measuredSpeeds.slice(mid);

            const avg1 = firstHalf.reduce((a, b) => a + b.speed, 0) / firstHalf.length;
            const avg2 = secondHalf.reduce((a, b) => a + b.speed, 0) / secondHalf.length;

            if (avg1 > 0) {
                // Se avg2 < avg1, delta negativo = tempo diminuito = più veloce!
                speedDeltaPercent = Math.round(((avg2 - avg1) / avg1) * 100);
            }
        }
    }

    return {
        totalStudied,
        activeDaysCount,
        dailyAverage,
        avgSpeedSeconds,
        speedDeltaPercent,
        chartDays,
    };
}
