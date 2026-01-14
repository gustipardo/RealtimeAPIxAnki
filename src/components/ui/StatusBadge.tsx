import { CheckCircle, XCircle } from 'lucide-react';

interface StatusBadgeProps {
    status: 'correct' | 'incorrect' | null;
}

/**
 * Visual feedback overlay for the study session.
 * 
 * Educational Note:
 * This component is "dumb" - it strictly receives a status and determines
 * what to render. Separation of Logic (deciding 'correct') from UI (showing green badge).
 */
export function StatusBadge({ status }: StatusBadgeProps) {
    if (!status) return null;

    const isCorrect = status === 'correct';

    return (
        <div className={`
            fixed top-10 left-1/2 transform -translate-x-1/2 
            px-8 py-4 rounded-full shadow-2xl 
            flex items-center space-x-3 z-50 animate-bounce
            ${isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
        `}>
            {isCorrect ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
            <span className="text-2xl font-bold uppercase">{status}</span>
        </div>
    );
}
