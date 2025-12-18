import { useState } from 'react';
import { AnkiDeckSelector } from './components/AnkiDeckSelector';
import { AnkiStudySession } from './components/AnkiStudySession';
import { DebugPanel } from './components/ui/DebugPanel';
import { StatusBadge } from './components/ui/StatusBadge';
import { ConnectionCard } from './components/ui/ConnectionCard';
import { useAudioDevices } from './hooks/useAudioDevices';
import { useRealtimeSession } from './hooks/useRealtimeSession';

/**
 * Main Application Component
 * 
 * Educational Note:
 * This component acts as the "Controller" or "Orchestrator".
 * It doesn't contain heavy logic itself (that's in the hooks).
 * Instead, it wires together the State (Hooks) and the View (Components).
 */
function App() {
  // 1. Hardware State
  const { hasMicrophone } = useAudioDevices();

  // 2. Realtime AI State (The "Brain")
  const {
    isConnected,
    isConnecting,
    error,
    debugInfo,
    setDebugInfo,
    evaluation,
    isStudyMode,
    connect,
    disconnect,
    startStudySession
  } = useRealtimeSession();

  // 3. Local UI State for Manual Study Mode (Testing without AI)
  const [manualStudyDeck, setManualStudyDeck] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">

      {/* 
        A. Manual Study Mode 
        If a user selects "Start Manual Study" from the deck selector, 
        we show the study session immediately.
      */}
      {manualStudyDeck ? (
        <AnkiStudySession
          deckName={manualStudyDeck}
          onExit={() => setManualStudyDeck(null)}
        />
      ) : (
        /* 
          B. Dashboard View
          Shows the Anki Deck Selector and the AI Voice Agent controls.
        */
        <>
          {/* Deck Selection & Manual Trigger */}
          <AnkiDeckSelector onStartStudy={setManualStudyDeck} />

          {/* Evaluation Badge (Visual Feedback for AI Studio) */}
          <StatusBadge status={evaluation} />

          {/* Main AI Interaction Card */}
          <ConnectionCard
            isConnected={isConnected}
            isConnecting={isConnecting}
            isStudyMode={isStudyMode}
            onConnect={connect}
            onDisconnect={disconnect}
            onStartStudy={startStudySession}
            hasMicrophone={hasMicrophone}
            error={error}
          />

          {/* Debug Console (Floating) */}
          <DebugPanel
            logs={debugInfo}
            onClear={() => setDebugInfo('')}
          />
        </>
      )}
    </div>
  );
}

export default App;
