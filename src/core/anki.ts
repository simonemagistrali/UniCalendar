const ANKI_URL = 'http://127.0.0.1:8765';

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
    } catch (e) {
        // Silently fail if Anki is not open, as this is expected behavior for many users
        throw new Error('Anki not reachable');
    }
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
            // rated:1 means cards that were answered today (1 day ago)
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
        } catch (e) {
            console.error("Failed to parse Anki stats", e);
            return null;
        }
    }
};
