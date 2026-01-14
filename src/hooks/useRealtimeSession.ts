import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { AnkiService } from '../services/AnkiService';
import { AnkiConnectService } from '../services/AnkiConnectService';

/**
 * Hook to manage the OpenAI Realtime WebRTC Session.
 * Refactored for Atomic Turn & Semantic Check architecture.
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
    const streamRef = useRef<MediaStream | null>(null); // For cleanup

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
            appendDebug('Requesting microphone...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
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
                // Ensure modalities are set correctly
                session.transport.sendEvent({
                    type: 'session.update',
                    session: {
                        modalities: ["text", "audio"],
                        instructions: 'Say hello to the user.'
                    }
                });
                session.transport.sendEvent({ type: 'response.create' });
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
            // Strict cleanup
            try {
                // @ts-ignore
                sessionRef.current.disconnect?.();
            } catch (e) { console.warn("Error calling disconnect on session", e); }
            sessionRef.current = null;
        }

        // Stop Microphone Stream
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            appendDebug('Microphone stream stopped.');
        }

        setIsConnected(false);
        setIsStudyMode(false);
        activeDeckNameRef.current = null;
        setCurrentCard(null);
        appendDebug('Disconnected.');
    }, []);

    // Helper to fetch next card based on mode
    const fetchNextCardInternal = async () => {
        if (activeDeckNameRef.current) {
            // Real Mode
            console.log("Fetching next real card, queue size:", realQueueRef.current.length);
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
            console.log(`Answering Real Card ${currentCardRef.current.cardId}: ${verdict}`);
            const ease = verdict === 'correct' ? 3 : 1;
            await realServiceRef.current.answerCard(currentCardRef.current.cardId, ease);
        } else {
            // Mock Answer (No-op or log)
            console.log(`Mock Answer: ${verdict}`);
        }
    };

    const startStudySession = useCallback(async (deckName?: string) => {
        // Auto-connect if not connected (Skip greeting if so)
        if (!sessionRef.current) {
            appendDebug('Auto-connecting for study session...');
            const success = await connect(true);
            if (!success) {
                appendDebug('Failed to auto-connect. Aborting study session.');
                return;
            }
        }

        appendDebug(`startStudySession called with deckName: "${deckName}"`);

        setIsStudyMode(true);
        // If deckName is provided, use it. If not, check if we already have one active (re-entry).
        // Only fallback to null (Mock) if explicitly intended or no state exists.
        if (deckName) {
            activeDeckNameRef.current = deckName;
        } else if (!activeDeckNameRef.current) {
            // No deck provided and no active deck? Warn or Default to Mock?
            // For now, let's log this case.
            appendDebug("No deckName provided. Falling back to Mock Mode (or previous deck if any).");
        }

        currentCardRef.current = null;
        setCurrentCard(null);

        // Initial Card Load
        const firstCard = await fetchNextCardInternal();
        const firstCardContent = firstCard ? {
            front: firstCard.fields.Front.value,
            back: firstCard.fields.Back.value
        } : null;

        let greeting = "";
        let instructions = "";

        // Check against ref, as deckName arg might be undefined on re-entry
        const currentDeck = activeDeckNameRef.current;

        if (currentDeck) {
            // REAL ANKI MODE
            try {
                // Initialize queue logic handled in fetchNextCardInternal or setup here if needed?
                // Logic already exists in realServiceRef usage, but we need to populate queue first!
                // FIX: Initialize queue like before
                const dueCards = await realServiceRef.current.findDueCards(currentDeck);
                realQueueRef.current = dueCards;
                const count = dueCards.length;

                // Re-fetch first card now that queue is populated
                // Because fetchNextCardInternal relies on realQueueRef
                const actualFirstCard = await fetchNextCardInternal();
                const actualFirstContent = actualFirstCard ? {
                    front: actualFirstCard.fields.Front.value,
                    back: actualFirstCard.fields.Back.value
                } : null;

                const now = new Date();
                const timeOfDay = now.getHours() < 12 ? 'morning' : 'afternoon';
                greeting = `Good ${timeOfDay}! We are studying ${currentDeck} from Anki. ${count} cards due.`;

                // --- ATOMIC TURN SYSTEM PROMPT ---
                instructions = `
                    ROLE: You are an expert Anki Tutor. Language: English ONLY.

                    CORE BEHAVIOR:
                    1. START: Greet with "${greeting}".
                       - IMMEDIATELY ask the question for the FIRST CARD provided in the initial user message.
                       - REPHRASE the card front into a natural question. NEVER read it verbatim.
                    
                    2. LISTENING & EVALUATING:
                       - Listen to user answer.
                       - SEMANTIC CHECK: If the user lists items in a different order, IT IS CORRECT. If they use synonyms, IT IS CORRECT. Be lenient on phrasing, strict on facts.
                       - DO NOT say "Evaluation answer" or "I am calling the tool". Just call it silently.

                    3. TRANSITION (ATOMIC TURN):
                       - Call \`evaluate_and_move_next(user_response_quality, feedback_text)\`.
                       - This tool SUBMITS the grade and FETCHES the next card atomically.
                       - The tool returns: { answered_card_back, next_card: { front, back } }.
                       - \`answered_card_back\` = the correct answer for the card you JUST evaluated.
                       - \`next_card\` = the NEXT card to ask.

                    4. AFTER TOOL RESPONSE - CRITICAL SEQUENCE:
                       a) FIRST: If incorrect, say "Incorrect! The correct answer is [answered_card_back]." - use the EXACT value from the tool response.
                       b) SECOND: Pause briefly (take a breath).
                       c) THIRD: Ask the NEXT question by rephrasing next_card.front.
                       - If correct, say "Correct!", pause briefly, then ask the next question.
                       - NEVER skip revealing the answer on incorrect. NEVER rush to the next question.

                    5. NO HINTS - STRICT RULE:
                       - "I DON'T KNOW" / "SKIP" / "PASS" / "HINT" / "HELP" / "CAN YOU GIVE ME A HINT?" -> ALL treated as INCORRECT.
                       - NEVER give hints. NEVER give clues. NEVER give partial answers.
                       - If user asks for a hint: immediately call the tool with incorrect, reveal the answer, move on.
                       - One attempt per card. No second chances.

                    FLOW:
                `;

                // Prepare initial prompt content
                var initialContent = `Session Started.
                    First Card Front: "${actualFirstContent?.front || 'None'}"
                    First Card Back: "${actualFirstContent?.back || 'None'}"
                `;

            } catch (e: any) {
                appendDebug(`Error init real session: ${e.message}`);
                return;
            }
        } else {
            // MOCK MODE (Simplified)
            mockServiceRef.current.startSession();
            const stats = mockServiceRef.current.getDeckStats();
            greeting = `Hello! Demo study for ${stats.name}.`;
            instructions = `ROLE: Demo Tutor. Use evaluate_and_move_next.`;
            var initialContent = "Start Demo.";
        }

        appendDebug(`Starting Study Session: ${greeting}`);

        // Update System Prompt & Tools
        sessionRef.current.transport.sendEvent({
            type: 'session.update',
            session: {
                modalities: ["text", "audio"],
                instructions: instructions,
                input_audio_transcription: { model: 'whisper-1' },
                tools: [
                    {
                        type: "function",
                        name: "evaluate_and_move_next",
                        description: "Evaluates the user's answer, updates the database, and retrieves the next card content.",
                        parameters: {
                            type: "object",
                            properties: {
                                user_response_quality: {
                                    type: "string",
                                    enum: ["correct", "incorrect"],
                                    description: "The verdict based on semantic meaning. 'A and B' equals 'B and A'."
                                },
                                feedback_text: {
                                    type: "string",
                                    description: "Short explanation of why it is correct or incorrect."
                                }
                            },
                            required: ["user_response_quality", "feedback_text"]
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
                content: [{ type: 'input_text', text: initialContent }]
            }
        });
        sessionRef.current.transport.sendEvent({ type: 'response.create' });
    }, []);

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

            if (name === 'evaluate_and_move_next') {
                try {
                    const args = JSON.parse(argsStr);
                    const verdict = args.user_response_quality;
                    const feedback = args.feedback_text;

                    appendDebug(`[Evaluation] ${verdict} - ${feedback}`);
                    setEvaluation(verdict);

                    // 0. Capture current card's back BEFORE transitioning (for "correct answer" feedback)
                    const answeredCardBack = currentCardRef.current?.fields?.Back?.value || null;

                    // 1. Submit Answer
                    await answerCardInternal(verdict);

                    // 2. Fetch Next Card
                    const nextCard = await fetchNextCardInternal();
                    const nextCardOutput = nextCard ? {
                        front: nextCard.fields.Front.value,
                        back: nextCard.fields.Back.value
                    } : { front: "END OF SESSION", back: "END OF SESSION" };

                    appendDebug(`[Tool Result] Next Card: ${nextCard ? 'Loaded' : 'End'}`);

                    // 3. Return Result to AI
                    session.transport.sendEvent({
                        type: 'conversation.item.create',
                        item: {
                            type: 'function_call_output',
                            call_id,
                            output: JSON.stringify({
                                status: "success",
                                answered_card_back: answeredCardBack,
                                next_card: nextCardOutput
                            })
                        }
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
        setDebugInfo,
        evaluation,
        isStudyMode,
        currentCard,
        connect,
        disconnect,
        startStudySession
    };
}
