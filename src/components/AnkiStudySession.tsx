
import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, XCircle, ArrowRight, Eye } from 'lucide-react';
import { AnkiConnectService } from '../services/AnkiConnectService';
import { cleanAnkiText } from '../utils/textUtils';

const ankiService = new AnkiConnectService();

interface AnkiStudySessionProps {
    deckName: string;
    initialCards?: number[]; // Optional list of card IDs to start with
    onExit: () => void;
}

export function AnkiStudySession({ deckName, initialCards = [], onExit }: AnkiStudySessionProps) {
    const [queue, setQueue] = useState<number[]>(initialCards);
    const [currentCard, setCurrentCard] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [showBack, setShowBack] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionStats, setSessionStats] = useState({ correct: 0, incorrect: 0 });

    useEffect(() => {
        // If we have cards in queue but no current card, load the first one
        if (queue.length > 0 && !currentCard && !isLoading) {
            loadNextCard();
        } else if (queue.length === 0 && !currentCard && !isLoading) {
            // Need to fetch more cards if queue is empty? 
            // For now, let's assume we just finish the session or fetch more due cards.
            fetchMoreDueCards();
        }
    }, [queue, currentCard]);

    const fetchMoreDueCards = async () => {
        setIsLoading(true);
        try {
            const newIds = await ankiService.findDueCards(deckName);
            // Filter out IDs we might have just seen? 
            // Ideally AnkiConnect won't return them if we just answered them, but might take a moment.
            if (newIds.length > 0) {
                setQueue(prev => [...prev, ...newIds]);
            } else {
                // No more due cards
            }
        } catch (err: any) {
            setError("Failed to fetch more cards: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const loadNextCard = async () => {
        if (queue.length === 0) return;

        setIsLoading(true);
        const nextId = queue[0];
        try {
            const cardInfo = await ankiService.cardsInfo([nextId]);
            if (cardInfo && cardInfo.length > 0) {
                setCurrentCard(cardInfo[0]);
                setShowBack(false);
            }
        } catch (err: any) {
            setError("Failed to load card: " + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAnswer = async (ease: number) => {
        if (!currentCard) return;

        setIsLoading(true);
        try {
            const success = await ankiService.answerCard(currentCard.cardId, ease);
            if (success) {
                setSessionStats(prev => ({
                    ...prev,
                    correct: ease === 3 ? prev.correct + 1 : prev.correct,
                    incorrect: ease === 1 ? prev.incorrect + 1 : prev.incorrect
                }));
                // Remove current card from queue
                setQueue(prev => prev.slice(1));
                setCurrentCard(null); // Triggers useEffect to load next
            } else {
                setError("Failed to submit answer to Anki.");
                setIsLoading(false);
            }
        } catch (err: any) {
            setError("Error submitting answer: " + err.message);
            setIsLoading(false);
        }
    };

    if (error) {
        return (
            <div className="p-6 text-center text-red-400 bg-red-900/20 rounded-xl border border-red-500/30">
                <p>{error}</p>
                <button onClick={onExit} className="mt-4 px-4 py-2 bg-gray-700 rounded-lg text-white text-sm">Exit Session</button>
            </div>
        );
    }

    if (!currentCard && !isLoading && queue.length === 0) {
        return (
            <div className="p-8 text-center bg-gray-800 rounded-xl border border-gray-700 shadow-xl">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
                <p className="text-gray-400 mb-6">You have reviewed all due cards in this deck.</p>
                <div className="flex justify-center gap-8 mb-6">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{sessionStats.correct}</div>
                        <div className="text-xs text-gray-500 uppercase">Correct</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{sessionStats.incorrect}</div>
                        <div className="text-xs text-gray-500 uppercase">Incorrect</div>
                    </div>
                </div>
                <button onClick={onExit} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors">
                    Back to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto">
            {/* Header / Stats */}
            <div className="flex items-center justify-between mb-4 px-2">
                <div className="text-gray-400 text-sm">
                    Deck: <span className="text-white font-medium">{deckName}</span>
                </div>
                <div className="text-gray-400 text-sm">
                    Queue: <span className="text-white font-medium">{queue.length}</span>
                </div>
                <button onClick={onExit} className="text-gray-500 hover:text-white text-sm">
                    Exit
                </button>
            </div>

            {/* Card Area */}
            <div className="relative bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl overflow-hidden min-h-[400px] flex flex-col">
                {isLoading && (
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm z-10 flex items-center justify-center">
                        <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    </div>
                )}

                {currentCard && (
                    <div className="flex-1 p-8 flex flex-col justify-center items-center text-center">
                        {/* Front */}
                        <div className="mb-8 w-full">
                            <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-semibold">Question</h3>
                            <div className="text-2xl md:text-3xl text-white font-medium leading-relaxed">
                                {cleanAnkiText(currentCard.fields.Front.value)}
                            </div>
                        </div>

                        {/* Back */}
                        {showBack && (
                            <div className="w-full pt-8 border-t border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                <h3 className="text-xs uppercase tracking-widest text-gray-500 mb-4 font-semibold">Answer</h3>
                                <div className="text-xl md:text-2xl text-blue-200 leading-relaxed">
                                    {cleanAnkiText(currentCard.fields.Back.value)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="mt-8 flex justify-center gap-4 h-16">
                {!showBack ? (
                    <button
                        onClick={() => setShowBack(true)}
                        className="w-full max-w-xs flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-lg font-bold py-3 px-8 rounded-xl shadow-lg transition-transform active:scale-95"
                    >
                        <Eye className="w-5 h-5" />
                        Show Answer
                    </button>
                ) : (
                    <>
                        <button
                            onClick={() => handleAnswer(1)}
                            className="flex-1 max-w-[180px] flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border-2 border-red-500 font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
                        >
                            <XCircle className="w-6 h-6" />
                            Incorrect
                        </button>
                        <button
                            onClick={() => handleAnswer(3)}
                            className="flex-1 max-w-[180px] flex items-center justify-center gap-2 bg-green-500/10 hover:bg-green-500 text-green-500 hover:text-white border-2 border-green-500 font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
                        >
                            <CheckCircle className="w-6 h-6" />
                            Correct
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
