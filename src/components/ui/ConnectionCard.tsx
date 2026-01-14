import { Mic, MicOff, Loader2, Volume2, BookOpen } from 'lucide-react';

interface ConnectionCardProps {
    isConnected: boolean;
    isConnecting: boolean;
    isStudyMode: boolean;
    onConnect: () => void;
    onDisconnect: () => void;
    onStartStudy: () => void;
    hasMicrophone: boolean;
    error: string | null;
}

/**
 * The main UI Card for the application.
 * Shows the connection status, microphone visualizer, and action buttons.
 */
export function ConnectionCard({
    isConnected,
    isConnecting,
    isStudyMode,
    onConnect,
    onDisconnect,
    onStartStudy,
    hasMicrophone,
    error
}: ConnectionCardProps) {
    return (
        <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
            <div className="p-8 flex flex-col items-center space-y-8">
                {/* Visualizer / Icon */}
                <div className="relative">
                    <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${isConnected ? 'bg-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-gray-700'}`}>
                        {isConnected ? (
                            <Volume2 className="w-16 h-16 text-green-400 animate-pulse" />
                        ) : (
                            <MicOff className="w-16 h-16 text-gray-500" />
                        )}
                    </div>
                </div>

                {/* Status Text */}
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {isStudyMode ? "Anki Study Mode" : "Realtime Voice Agent"}
                    </h1>
                    <p className="text-gray-400">
                        {isConnected
                            ? isStudyMode ? "Listen to the question..." : "Listening... Speak naturally."
                            : "Click below to start."}
                    </p>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 text-center">
                        {error}
                    </div>
                )}

                {/* Mic Warning */}
                {!hasMicrophone && (
                    <div className="w-full bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-400 text-center">
                        No microphone detected.
                    </div>
                )}

                {/* Buttons */}
                <div className="w-full space-y-3">
                    {!isConnected ? (
                        <button
                            onClick={onConnect}
                            disabled={isConnecting}
                            className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-2 bg-white text-gray-900 hover:bg-gray-100 shadow-lg ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    <span>Connecting...</span>
                                </>
                            ) : (
                                <>
                                    <Mic className="w-5 h-5" />
                                    <span>Start Conversation</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <>
                            {!isStudyMode && (
                                <button
                                    onClick={onStartStudy}
                                    className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                                >
                                    <BookOpen className="w-5 h-5" />
                                    <span>Start Study Session</span>
                                </button>
                            )}

                            <button
                                onClick={onDisconnect}
                                className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                            >
                                <MicOff className="w-5 h-5" />
                                <span className={isStudyMode ? "text-red-400" : ""}>End Session</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="bg-gray-900/50 p-4 text-center text-xs text-gray-500 border-t border-gray-700">
                Powered by OpenAI Realtime API
            </div>
        </div>
    );
}
