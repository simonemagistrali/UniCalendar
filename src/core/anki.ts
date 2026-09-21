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
    }
};
