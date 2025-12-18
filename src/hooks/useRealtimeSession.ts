import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { AnkiService } from '../services/AnkiService';
import { AnkiConnectService } from '../services/AnkiConnectService';

/**
 * Hook to manage the OpenAI Realtime WebRTC Session.
 * Supports both Mock Mode (Demo) and Real Anki Mode (Conversational Study).
 */
export function useRealtimeSession() {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [evaluation, setEvaluation] = useState<'correct' | 'incorrect' | null>(null);
    const [isStudyMode, setIsStudyMode] = useState(false);

    // Exposed state for UI
    const [currentCard, setCurrentCard] = useState<any | null>(null);

    // Refs for non-reactive state
    const sessionRef = useRef<RealtimeSession | null>(null);
    const toolCallNames = useRef<Record<string, string>>({});

    // Service Refs
    const mockServiceRef = useRef<AnkiService>(new AnkiService());
    const realServiceRef = useRef<AnkiConnectService>(new AnkiConnectService());

    // Session State
    const activeDeckNameRef = useRef<string | null>(null); // If null -> Mock Mode
    const realQueueRef = useRef<number[]>([]);
    const currentCardRef = useRef<any | null>(null); // For tool access

    const appendDebug = (msg: string) => setDebugInfo(prev => prev + '\n' + msg);

    // Clear evaluation badge after delay
    useEffect(() => {
        if (evaluation) {
            const timer = setTimeout(() => setEvaluation(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [evaluation]);

    const connect = useCallback(async (skipGreeting = false): Promise<boolean> => {
        try {
            setIsConnecting(true);
            setError(null);
            appendDebug('Starting connection...');

            const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
            if (!apiKey) throw new Error('VITE_OPENAI_API_KEY not found');

            // 1. Microphone Access
            appendDebug('Requesting microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            appendDebug('Microphone access granted.');

            // 2. Realtime Agent Setup
            const agent = new RealtimeAgent({
                name: "Anki Tutor",
                instructions: "You are a helpful Anki Studio Tutor.",
            });

            const transport = new OpenAIRealtimeWebRTC({
                useInsecureApiKey: true,
                mediaStream: stream,
                baseUrl: 'https://api.openai.com/v1/realtime?model=gpt-realtime-mini'
            });

            const session = new RealtimeSession(agent, { transport });
            sessionRef.current = session;

            // 3. Connect
            appendDebug('Connecting session...');
            await session.connect({
                apiKey: apiKey,
                model: 'gpt-realtime-mini',
            });
            appendDebug('Session connected!');
            setIsConnected(true);

            // 4. Default Greeting (if not skipped)
            if (!skipGreeting) {
                session.transport.sendEvent({
                    type: 'response.create',
                    response: { instructions: 'Say hello to the user.' }
                });
            }

            // 5. Event Listeners
            // @ts-ignore
            session.on('transport_event', handleTransportEvent);
            session.on('error', (err: any) => appendDebug(`[Error] ${JSON.stringify(err)}`));

            return true;

        } catch (err: any) {
            console.error(err);
            setError(err.message);
            appendDebug(`Error: ${err.message}`);
            setIsConnected(false);
        } finally {
            setIsConnecting(false);
        }
        return false;
    }, []);

    const disconnect = useCallback(() => {
        if (sessionRef.current) {
            // @ts-ignore
            sessionRef.current.disconnect?.();
            sessionRef.current = null;
        }
        setIsConnected(false);
        setIsStudyMode(false);
        activeDeckNameRef.current = null;
        setCurrentCard(null);
        appendDebug('Disconnected.');
    }, []);

    const startStudySession = useCallback(async (deckName?: string) => {
        // Auto-connect if not connected
        // Auto-connect if not connected (Skip greeting if so)
        if (!sessionRef.current) {
            appendDebug('Auto-connecting for study session...');
            const success = await connect(true);
            if (!success) {
                appendDebug('Failed to auto-connect. Aborting study session.');
                return;
            }
        }

        setIsStudyMode(true);
        activeDeckNameRef.current = deckName || null;
        currentCardRef.current = null;
        setCurrentCard(null);

        let greeting = "";
        let instructions = "";

        if (deckName) {
            // REAL ANKI MODE
            try {
                // Initialize queue
                const dueCards = await realServiceRef.current.findDueCards(deckName);
                realQueueRef.current = dueCards;
                const count = dueCards.length;

                const now = new Date();
                const timeOfDay = now.getHours() < 12 ? 'morning' : 'afternoon';
                greeting = `Good ${timeOfDay}! We are studying ${deckName} from your Anki collection. You have ${count} cards due.`;
                instructions = `
                    ROLE: You are an Anki Tutor.
                    LANGUAGE: English ONLY.
                    MODE: REAL ANKI.
                    TASK:
                    1. Call get_next_card.
                    2. If null returned, say "Session Complete".
                    3. Ask question based on Front.
                    4. Evaluate answer matching Back.
                    5. Call notify_evaluation(correct/incorrect).
                    6. Say "Correct/Incorrect" and brief explanation.
                    7. IMMEDIATELY call get_next_card. REPEAT LOOP.
                `;
            } catch (e: any) {
                appendDebug(`Error init real session: ${e.message}`);
                return;
            }
        } else {
            // MOCK MODE
            mockServiceRef.current.startSession();
            const stats = mockServiceRef.current.getDeckStats();
            greeting = `Hello! Starting demo study for ${stats.name}.`;
            instructions = `
                ROLE: You are an Anki Tutor (Demo Mode).
                TASK: One-off questions.
            `;
        }

        appendDebug(`Starting Study Session: ${greeting}`);

        // Update System Prompt & Tools
        sessionRef.current.transport.sendEvent({
            type: 'session.update',
            session: {
                instructions: instructions,
                tools: [
                    {
                        type: 'function',
                        name: 'get_next_card',
                        description: 'Get next card data (front/back). Returns null if deck empty.',
                        parameters: { type: 'object', properties: {} }
                    },
                    {
                        type: 'function',
                        name: 'notify_evaluation',
                        description: 'Notify UI and Anki of result.',
                        parameters: {
                            type: 'object',
                            properties: { verdict: { type: 'string', enum: ['correct', 'incorrect'] } },
                            required: ['verdict']
                        }
                    }
                ],
                tool_choice: 'auto'
            }
        });

        // Trigger Start
        sessionRef.current.transport.sendEvent({
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [{ type: 'input_text', text: `Start session. Greeting: ${greeting}. Fetch first card.` }]
            }
        });
        sessionRef.current.transport.sendEvent({ type: 'response.create' });
    }, []);

    // Helper to fetch next card based on mode
    const fetchNextCardInternal = async () => {
        if (activeDeckNameRef.current) {
            // Real Mode
            if (realQueueRef.current.length === 0) return null;

            const nextId = realQueueRef.current[0];
            const info = await realServiceRef.current.cardsInfo([nextId]);
            if (info && info.length > 0) {
                // Remove from queue locally (optimistic)
                realQueueRef.current = realQueueRef.current.slice(1);

                const card = info[0];
                currentCardRef.current = card;
                setCurrentCard(card); // Update UI
                return card;
            }
            return null;
        } else {
            // Mock Mode
            const { card } = mockServiceRef.current.getNextCard();
            if (card) {
                // Shim to match real Anki structure
                const shimmed = {
                    cardId: card.id,
                    fields: {
                        Front: { value: card.front },
                        Back: { value: card.back }
                    }
                };
                currentCardRef.current = shimmed;
                setCurrentCard(shimmed);
                return shimmed;
            }
            return null;
        }
    };

    // Helper to answer card
    const answerCardInternal = async (verdict: 'correct' | 'incorrect') => {
        if (activeDeckNameRef.current && currentCardRef.current) {
            // Real Answer
            const ease = verdict === 'correct' ? 3 : 1;
            await realServiceRef.current.answerCard(currentCardRef.current.cardId, ease);
        } else {
            // Mock Answer (No-op or log)
            console.log(`Mock Answer: ${verdict}`);
        }
    };

    const handleTransportEvent = async (event: any) => {
        const session = sessionRef.current;
        if (!session) return;

        // --- ENHANCED DEBUG LOGGING ---
        if (event.type === 'response.audio_transcript.done') {
            appendDebug(`[AI]: ${event.transcript}`);
        }
        if (event.type === 'conversation.item.input_audio_transcription.completed') {
            appendDebug(`[User]: ${event.transcript}`);
        }

        // Ignoring audio deltas for log clarity
        if (event.type === 'response.audio.delta' || event.type === 'response.audio_transcript.delta') return;

        // Tool Queueing
        if (event.type === 'response.output_item.added') {
            const item = event.item;
            if (item?.type === 'function_call') {
                toolCallNames.current[item.call_id] = item.name;
                appendDebug(`[Tool Queued] ${item.name}`);
            }
        }

        // Tool Execution
        if (event.type === 'response.function_call_arguments.done') {
            const { call_id, arguments: argsStr } = event;
            const name = toolCallNames.current[call_id];
            appendDebug(`[Tool Executing] ${name}`);

            if (name === 'get_next_card') {
                const result = await fetchNextCardInternal();
                appendDebug(`[Tool Result] ${result ? 'Card Loaded' : 'End of Deck'}`);

                session.transport.sendEvent({
                    type: 'conversation.item.create',
                    item: { type: 'function_call_output', call_id, output: JSON.stringify(result) }
                });
                session.transport.sendEvent({ type: 'response.create' });
            }
            else if (name === 'notify_evaluation') {
                try {
                    const args = JSON.parse(argsStr);
                    const verdict = args.verdict;
                    setEvaluation(verdict);
                    appendDebug(`[Evaluation] ${verdict}`);

                    // Perform Logic (Write to Anki)
                    await answerCardInternal(verdict);

                    session.transport.sendEvent({
                        type: 'conversation.item.create',
                        item: { type: 'function_call_output', call_id, output: JSON.stringify({ success: true }) }
                    });
                    session.transport.sendEvent({ type: 'response.create' });
                } catch (e) {
                    appendDebug(`Tool Error: ${e}`);
                }
            }
        }
    };

    return {
        isConnected,
        isConnecting,
        error,
        debugInfo,
        setDebugInfo, // Exposed to allow clearing
        evaluation,
        isStudyMode,
        currentCard, // New: Exposed for Live Display
        connect,
        disconnect,
        startStudySession
    };
}
