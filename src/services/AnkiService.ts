import { type Card, MOCK_DECK } from '../data/mock_deck';

export class AnkiService {
    private deck: Card[];
    private currentIndex: number;

    constructor() {
        // Clone the deck to avoid mutating the original constant during the session
        this.deck = JSON.parse(JSON.stringify(MOCK_DECK));
        this.currentIndex = 0;
    }

    startSession(): void {
        this.currentIndex = 0;
        console.log('Anki Session Started. Deck size:', this.deck.length);
    }

    getNextCard(): { card: Card | null; progress: string } {
        if (this.currentIndex >= this.deck.length) {
            return { card: null, progress: 'Completed' };
        }

        const card = this.deck[this.currentIndex];
        this.currentIndex++;

        return {
            card,
            progress: `${this.currentIndex} of ${this.deck.length}`
        };
    }

    getDeckStats(): { totalCards: number; name: string; remainingCards: number } {
        return {
            totalCards: this.deck.length,
            name: 'AWS Security', // Hardcoded for this prototype as per plan
            remainingCards: this.deck.length - this.currentIndex
        };
    }

    reset(): void {
        this.currentIndex = 0;
    }
}
