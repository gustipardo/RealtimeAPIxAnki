import React from 'react';

interface DebugPanelProps {
    logs: string;
    onClear: () => void;
}

/**
 * A floating debug console to show Realtime API events.
 * 
 * Educational Note:
 * When working with WebSocket or WebRTC streams, things happen asynchronously.
 * Having a visible log of events (Tool calls, Connection status, Errors) 
 * is crucial for debugging without having to constantly check the browser console.
 */
export function DebugPanel({ logs, onClear }: DebugPanelProps) {
    return (
        <div className="fixed bottom-4 right-4 w-96 max-h-[500px] overflow-auto bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700 shadow-2xl z-40">
            <div className="sticky top-0 bg-gray-900/90 p-2 border-b border-gray-700 flex justify-between items-center backdrop-blur-sm">
                <h3 className="font-bold text-gray-300 text-xs uppercase tracking-wider">Debug Console</h3>
                <button
                    onClick={onClear}
                    className="text-xs text-gray-500 hover:text-white transition-colors"
                >
                    Clear
                </button>
            </div>
            <pre className="p-4 text-[10px] font-mono text-green-400 whitespace-pre-wrap leading-relaxed">
                {logs || "Ready..."}
            </pre>
        </div>
    );
}
