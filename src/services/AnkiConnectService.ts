
export interface AnkiConnectAction {
    action: string;
    version: number;
    params?: any;
}

export interface AnkiConnectResponse<T> {
    result: T;
    error: string | null;
}

export class AnkiConnectService {
    private baseUrl = 'http://127.0.0.1:8765';

    private async invoke<T>(action: string, params: any = {}): Promise<T> {
        const payload: AnkiConnectAction = {
            action,
            version: 6,
            params,
        };

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }

            const data: AnkiConnectResponse<T> = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            return data.result;
        } catch (error) {
            console.error(`AnkiConnect invoke error for action '${action}':`, error);
            throw error;
        }
    }

    async deckNames(): Promise<string[]> {
        return this.invoke<string[]>('deckNames');
    }

    async findCards(deckName: string): Promise<number[]> {
        return this.invoke<number[]>('findCards', { query: `deck:"${deckName}"` });
    }

    async findDueCards(deckName: string): Promise<number[]> {
        return this.invoke<number[]>('findCards', { query: `deck:"${deckName}" is:due` });
    }

    async cardsInfo(cardIds: number[]): Promise<any[]> {
        return this.invoke<any[]>('cardsInfo', { cards: cardIds });
    }

    async answerCard(cardId: number, ease: number): Promise<boolean> {
        // 'answerCards' action takes a list of answers
        const answers = [{ cardId, ease }];
        // It returns a list of booleans? Documentation says "Returns true if successful".
        // Let's assume it returns true/false or list of results.
        // Actually, AnkiConnect answerCards returns a list of booleans for each card.
        const result = await this.invoke<boolean[]>('answerCards', { answers });
        return result && result.length > 0 && result[0];
    }
}
