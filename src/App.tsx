import { useState, useRef, useEffect } from 'react';
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { Mic, MicOff, Loader2, Volume2, BookOpen, CheckCircle, XCircle } from 'lucide-react';
import { AnkiService } from './services/AnkiService';
import { AnkiDeckSelector } from './components/AnkiDeckSelector';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<RealtimeSession | null>(null);
  const ankiServiceRef = useRef<AnkiService>(new AnkiService());
  const [hasMicrophone, setHasMicrophone] = useState<boolean>(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  // Evaluation Badge State
  const [evaluation, setEvaluation] = useState<'correct' | 'incorrect' | null>(null);
  const toolCallNames = useRef<Record<string, string>>({}); // Map call_id -> function_name

  useEffect(() => {
    const getDevices = async () => {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices();
        const hasMic = devs.some(d => d.kind === 'audioinput');
        setHasMicrophone(hasMic);
        setDebugInfo(prev => prev + `\nDevices found: ${devs.length}\n${JSON.stringify(devs.map(d => ({ kind: d.kind, label: d.label })), null, 2)}`);
      } catch (e: any) {
        setDebugInfo(prev => prev + `\nError listing devices: ${e.message}`);
      }
    };
    getDevices();
  }, []);

  // Clear badge after 3 seconds
  useEffect(() => {
    if (evaluation) {
      const timer = setTimeout(() => setEvaluation(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [evaluation]);

  const connect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      setDebugInfo(prev => prev + '\n\nStarting connection...');

      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('API Key not found. Please set VITE_OPENAI_API_KEY in .env');
      }

      const agent = new RealtimeAgent({
        name: "Voice Assistant",
        instructions: "You are a helpful, witty, and friendly voice assistant. You answer concisely and with personality.",
      });

      setDebugInfo(prev => prev + '\nRequesting microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setDebugInfo(prev => prev + '\nMicrophone access granted.');

      // Pre-flight check
      try {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });
        if (!response.ok) throw new Error(`API Key Validation Failed: ${response.status}`);
        setDebugInfo(prev => prev + '\nAPI key verified.');
      } catch (e: any) {
        setDebugInfo(prev => prev + `\nValidation warning: ${e.message}`);
      }

      const transport = new OpenAIRealtimeWebRTC({
        useInsecureApiKey: true,
        mediaStream: stream,
        baseUrl: 'https://api.openai.com/v1/realtime?model=gpt-realtime-mini'
      });
      const session = new RealtimeSession(agent, { transport });
      sessionRef.current = session;

      setDebugInfo(prev => prev + '\nConnecting session (SDK)...');
      await session.connect({
        apiKey: apiKey,
        model: 'gpt-realtime-mini',
      });
      setDebugInfo(prev => prev + '\nSession connected!');

      // Listen to events for Tool Calling
      // @ts-ignore
      session.on('transport_event', async (event: any) => {
        if (event.type === 'response.audio.delta' || event.type === 'response.audio_transcript.delta') return;

        // Capture Function Name from output_item.added
        if (event.type === 'response.output_item.added') {
          const item = event.item;
          if (item && item.type === 'function_call') {
            toolCallNames.current[item.call_id] = item.name;
            setDebugInfo(prev => prev + `\n[Tool Queued] ${item.name} (ID: ${item.call_id})`);
          }
        }

        // Handle Function Calling
        if (event.type === 'response.function_call_arguments.done') {
          const { call_id, arguments: _args } = event;
          const name = toolCallNames.current[call_id];

          setDebugInfo(prev => prev + `\n[Tool Executing] ${name} (ID: ${call_id})`);

          if (name === 'get_next_card') {
            const result = ankiServiceRef.current.getNextCard();
            setDebugInfo(prev => prev + `\n[Tool Result] ${JSON.stringify(result)}`);

            session.transport.sendEvent({
              type: 'conversation.item.create',
              item: {
                type: 'function_call_output',
                call_id: call_id,
                output: JSON.stringify(result),
              }
            });

            session.transport.sendEvent({
              type: 'response.create',
            });
          } else if (name === 'notify_evaluation') {
            try {
              const args = JSON.parse(_args);
              const verdict = args.verdict; // 'correct' | 'incorrect'
              setEvaluation(verdict);
              setDebugInfo(prev => prev + `\n[Badge] Evaluation: ${verdict}`);

              session.transport.sendEvent({
                type: 'conversation.item.create',
                item: {
                  type: 'function_call_output',
                  call_id: call_id,
                  output: JSON.stringify({ success: true }),
                }
              });
              session.transport.sendEvent({
                type: 'response.create',
              });

            } catch (e: any) {
              setDebugInfo(prev => prev + `\n[Badge Error] ${e.message}`);
            }
          }
        }
      });

      session.on('audio_start', () => {
        setDebugInfo(prev => prev + '\n[Event] Audio Started');
      });
      session.on('audio_stopped', () => {
        setDebugInfo(prev => prev + '\n[Event] Audio Stopped');
      });

      session.on('error', (error: any) => {
        setDebugInfo(prev => prev + `\n[Event] Error: ${JSON.stringify(error)}`);
      });

      setIsConnected(true);

      // Default greeting
      session.transport.sendEvent({
        type: 'response.create',
        response: {
          instructions: 'Say hello to the user and ask how you can help them today.',
        }
      });

    } catch (err: any) {
      console.error('Failed to connect:', err);
      setError(err.message || 'Failed to connect');
      setDebugInfo(prev => prev + `\nError: ${err.message}\nStack: ${err.stack}`);
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const startStudySession = () => {
    if (!sessionRef.current) return;

    setIsStudyMode(true);
    ankiServiceRef.current.startSession();

    // Get stats for greeting
    const stats = ankiServiceRef.current.getDeckStats();
    const now = new Date();
    const timeOfDay = now.getHours() < 12 ? 'morning' : 'afternoon';
    const greeting = `Good ${timeOfDay}! Today we're working on ${stats.name} and you have ${stats.remainingCards} flashcards left. Let's begin!`;

    setDebugInfo(prev => prev + `\n[Anki] Starting Session. Greeting: "${greeting}"`);

    const systemPrompt = `
      ROLE: You are a strict but helpful Anki Study Tutor.
      LANGUAGE: English ONLY. Never switch languages.
      
      CRITICAL DATA RULE: You have NO internal knowledge of the subject matter. You CANNOT invent questions. You must ALWAYS call the tool get_next_card BEFORE asking a question.

      Procedure for every turn:
      1. Call get_next_card.
      2. Wait for the tool output (JSON containing 'front' and 'back').
      3. Read the front text from the JSON.
      4. Rephrase THAT SPECIFIC TEXT into a conversational question. Do not add external facts.
      5. Listen to user answer.
      6. Compare user answer vs the back text from the JSON.
      7. DECIDE: Correct or Incorrect.
      8. Call the tool "notify_evaluation" with the verdict ("correct" or "incorrect").
      9. Speak your feedback to the user ("Correct" or "Incorrect" + explanation).
      
      If you do not have the card data loaded from the tool yet, DO NOT ASK A QUESTION. Call the tool first.

      TASK:
      1. Start the session precisely with the greeting provided in the context: "${greeting}"
      2. IMMEDIATELY call "get_next_card".
      3. Use the card data to ask the question.
    `;

    // 1. Update Session with Instructions and Tools
    sessionRef.current.transport.sendEvent({
      type: 'session.update',
      session: {
        instructions: systemPrompt,
        tools: [
          {
            type: 'function',
            name: 'get_next_card',
            description: 'Get the next flashcard from the deck. Returns null if deck is empty.',
            parameters: {
              type: 'object',
              properties: {},
            },
          },
          {
            type: 'function',
            name: 'notify_evaluation',
            description: 'Notify the UI about the evaluation result of the user answer.',
            parameters: {
              type: 'object',
              properties: {
                verdict: {
                  type: 'string',
                  enum: ['correct', 'incorrect'],
                  description: 'The evaluation verdict.',
                },
              },
              required: ['verdict'],
            },
          }
        ],
        tool_choice: 'auto',
      }
    });

    // 2. Trigger the interaction
    sessionRef.current.transport.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `System Alert: The session has started. Greeting: "${greeting}". Now fetch the first card immediately.`
          }
        ]
      }
    });
    sessionRef.current.transport.sendEvent({
      type: 'response.create',
    });
  };

  const disconnect = () => {
    if (sessionRef.current) {
      try {
        // @ts-ignore
        sessionRef.current.disconnect?.();
      } catch (e) {
        console.warn('Disconnect failed', e);
      }
      sessionRef.current = null;
      setIsConnected(false);
      setIsStudyMode(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      {/* Anki Connect Dashboard for Manual Verification */}
      <AnkiDeckSelector />

      {/* Badge Overlay */}
      {evaluation && (
        <div className={`fixed top-10 left-1/2 transform -translate-x-1/2 px-8 py-4 rounded-full shadow-2xl flex items-center space-x-3 z-50 animate-bounce ${evaluation === 'correct' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
          {evaluation === 'correct' ? <CheckCircle className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          <span className="text-2xl font-bold uppercase">{evaluation}</span>
        </div>
      )}

      <div className="max-w-md w-full bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
        <div className="p-8 flex flex-col items-center space-y-8">
          <div className="relative">
            <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${isConnected ? 'bg-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-gray-700'}`}>
              {isConnected ? (
                <Volume2 className="w-16 h-16 text-green-400 animate-pulse" />
              ) : (
                <MicOff className="w-16 h-16 text-gray-500" />
              )}
            </div>
            {isConnected && (
              <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" />
            )}
          </div>

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

          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400 text-center">
              {error}
            </div>
          )}

          {!hasMicrophone && (
            <div className="w-full bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 text-sm text-yellow-400 text-center">
              No microphone detected. Please check your browser's site settings and allow microphone access.
              <br />
              (Click the lock icon in the address bar)
            </div>
          )}

          <div className="w-full space-y-3">
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={isConnecting}
                className={`
                    w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200
                    flex items-center justify-center space-x-2
                    bg-white text-gray-900 hover:bg-gray-100 shadow-lg hover:shadow-xl hover:scale-[1.02]
                    ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
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
                    onClick={startStudySession}
                    className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                  >
                    <BookOpen className="w-5 h-5" />
                    <span>Start Study Session</span>
                  </button>
                )}

                <button
                  onClick={disconnect}
                  className="w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center space-x-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20"
                >
                  <MicOff className="w-5 h-5" />
                  <span>End Conversation</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="bg-gray-900/50 p-4 text-center text-xs text-gray-500 border-t border-gray-700">
          Powered by OpenAI Realtime API
        </div>
      </div>

      {/* Fixed Debug Panel */}
      <div className="fixed bottom-4 right-4 w-96 max-h-[500px] overflow-auto bg-black/80 backdrop-blur-sm rounded-lg border border-gray-700 shadow-2xl z-40">
        <div className="sticky top-0 bg-gray-900/90 p-2 border-b border-gray-700 flex justify-between items-center backdrop-blur-sm">
          <h3 className="font-bold text-gray-300 text-xs uppercase tracking-wider">Debug Console</h3>
          <button onClick={() => setDebugInfo('')} className="text-xs text-gray-500 hover:text-white">Clear</button>
        </div>
        <pre className="p-4 text-[10px] font-mono text-green-400 whitespace-pre-wrap leading-relaxed">
          {debugInfo || "Ready..."}
        </pre>
      </div>
    </div>
  );
}

export default App;
