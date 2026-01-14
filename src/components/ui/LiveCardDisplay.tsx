import { cleanAnkiText } from '../../utils/textUtils';

interface LiveCardDisplayProps {
    card: {
        fields: {
            Front: { value: string };
            Back: { value: string };
        };
    } | null;
    isListening: boolean;
}

/**
 * A read-only display for the current card being discussed with the AI.
 * Shows the Front of the card clearly.
 */
export function LiveCardDisplay({ card, isListening }: LiveCardDisplayProps) {
    if (!card) return null;

    const frontText = cleanAnkiText(card.fields.Front.value);

    return (
        <div className="w-full max-w-md bg-gray-800 rounded-2xl border border-gray-700 shadow-2xl p-6 mb-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Card</span>
                {isListening && (
                    <span className="flex items-center gap-2 text-xs text-green-400 font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        AI Listening
                    </span>
                )}
            </div>

            <div className="text-xl md:text-2xl text-white font-medium leading-relaxed text-center py-4">
                {frontText}
            </div>
        </div>
    );
}
