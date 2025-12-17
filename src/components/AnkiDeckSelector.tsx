
import { useState } from 'react';
import { AnkiConnectService } from '../services/AnkiConnectService';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

const ankiService = new AnkiConnectService();

export interface AnkiDeckSelectorProps {
    onStartStudy?: (deckName: string) => void;
}

export function AnkiDeckSelector({ onStartStudy }: AnkiDeckSelectorProps) {
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [decks, setDecks] = useState<string[]>([]);
    const [selectedDeck, setSelectedDeck] = useState<string | null>(null);

    const [allCardIds, setAllCardIds] = useState<number[]>([]);
    const [cards, setCards] = useState<any[]>([]);
    const [showDueOnly, setShowDueOnly] = useState(false);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    const handleConnect = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const deckNames = await ankiService.deckNames();
            setDecks(deckNames);
            setIsConnected(true);
        } catch (err: any) {
            setError(err.message || 'Failed to connect to Anki directly.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeckChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const deckName = e.target.value;
        setSelectedDeck(deckName);
        setCurrentPage(1); // Reset to first page
        fetchCardIds(deckName, showDueOnly);
    };

    const handleDueToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
        const isChecked = e.target.checked;
        setShowDueOnly(isChecked);
        setCurrentPage(1); // Reset to first page
        if (selectedDeck) {
            fetchCardIds(selectedDeck, isChecked);
        }
    };

    const fetchCardIds = async (deckName: string, dueOnly: boolean) => {
        if (!deckName) return;
        setIsLoading(true);
        setError(null);
        setCards([]); // Clear current view
        try {
            const ids = dueOnly
                ? await ankiService.findDueCards(deckName)
                : await ankiService.findCards(deckName);

            setAllCardIds(ids);
            fetchCardsForPage(ids, 1);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch cards.');
            setAllCardIds([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCardsForPage = async (ids: number[], page: number) => {
        setIsLoading(true);
        const startIndex = (page - 1) * PAGE_SIZE;
        const endIndex = startIndex + PAGE_SIZE;
        const pageIds = ids.slice(startIndex, endIndex);

        if (pageIds.length > 0) {
            try {
                const cardsData = await ankiService.cardsInfo(pageIds);
                setCards(cardsData);
            } catch (err: any) {
                setError(err.message || 'Failed to fetch card details.');
            }
        } else {
            setCards([]);
        }
        setIsLoading(false);
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        fetchCardsForPage(allCardIds, newPage);
    };

    const totalPages = Math.ceil(allCardIds.length / PAGE_SIZE);

    return (
        <div className="w-full max-w-2xl bg-gray-800 rounded-xl p-6 border border-gray-700 shadow-xl mb-8">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Anki Connect Dashboard
                    {isConnected && <CheckCircle className="w-5 h-5 text-green-500" />}
                </h2>
                {!isConnected && (
                    <button
                        onClick={handleConnect}
                        disabled={isLoading}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Connect to Local Anki
                    </button>
                )}
            </div>

            {error && (
                <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg mb-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="font-semibold">Connection Error</p>
                        <p className="text-sm opacity-90">{error}</p>
                        <p className="text-xs mt-2 text-red-300">
                            Tip: Ensure Anki is running, AnkiConnect is installed, and 'webCorsOriginList' includes 'http://localhost:5173' in AnkiConnect config.
                        </p>
                    </div>
                </div>
            )}

            {isConnected && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Select Deck</label>
                            <select
                                onChange={handleDeckChange}
                                value={selectedDeck || ''}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            >
                                <option value="">-- Choose a Deck --</option>
                                {decks.map(deck => (
                                    <option key={deck} value={deck}>{deck}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end pb-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={showDueOnly}
                                        onChange={handleDueToggle}
                                    />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </div>
                                <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">Show Only Due Cards</span>
                            </label>
                        </div>
                    </div>

                    {selectedDeck && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold text-white">
                                    Card Preview
                                    <span className="text-sm font-normal text-gray-400 ml-2">
                                        ({allCardIds.length} {showDueOnly ? 'due' : ''} cards found)
                                    </span>
                                </h3>
                                <div className="flex items-center gap-3">
                                    {onStartStudy && (
                                        <button
                                            onClick={() => onStartStudy(selectedDeck)}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                            Start Manual Study
                                        </button>
                                    )}
                                    {isLoading && <Loader2 className="w-5 h-5 animate-spin text-blue-400" />}
                                </div>
                            </div>

                            {cards.length === 0 && !isLoading && (
                                <p className="text-gray-500 italic">No {showDueOnly ? 'due ' : ''}cards found in this deck.</p>
                            )}

                            <div className="grid gap-4">
                                {cards.map((card: any) => (
                                    <div key={card.cardId} className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50 hover:border-gray-600 transition-colors">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Front</span>
                                                <div className="text-gray-200" dangerouslySetInnerHTML={{ __html: card.fields.Front.value }} />
                                            </div>
                                            <div className="md:border-l md:border-gray-700 md:pl-4">
                                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Back</span>
                                                <div className="text-gray-200" dangerouslySetInnerHTML={{ __html: card.fields.Back.value }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {allCardIds.length > PAGE_SIZE && (
                                <div className="flex items-center justify-center space-x-4 mt-6">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Previous
                                    </button>
                                    <span className="text-gray-400 text-sm">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                    }
                </div >
            )}

        </div >
    );
}
