import { useState, useRef, useEffect, useCallback } from 'react';
import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { AnkiService } from '../services/AnkiService';

/**
 * Hook to manage the OpenAI Realtime WebRTC Session.
 * 
 * Educational Note:
 * This hook encapsulates the entire lifecycle of the AI connection:
 * 1. Setup: Initializes the Client and Agent.
 * 2. Connection: Handles WebRTC handshake via Ephemeral Tokens (or API Key directly here).
 * 3. Tool Handling: Listens for 'response.function_call_arguments.done' events and executes code.
 * 4. Cleanup: Ensures we disconnect when the component unmounts.
 */
export function useRealtimeSession() {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [debugInfo, setDebugInfo] = useState<string>('');
    const [evaluation, setEvaluation] = useState<'correct' | 'incorrect' | null>(null);
    const [isStudyMode, setIsStudyMode] = useState(false);

    // Refs for non-reactive state
    const sessionRef = useRef<RealtimeSession | null>(null);
    const ankiServiceRef = useRef<AnkiService>(new AnkiService());
    const toolCallNames = useRef<Record<string, string>>({});

    const appendDebug = (msg: string) => setDebugInfo(prev => prev + '\n' + msg);

    // Clear evaluation badge after delay
    useEffect(() => {
        if (evaluation) {
            const timer = setTimeout(() => setEvaluation(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [evaluation]);

    const connect = useCallback(async () => {
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
                useInsecureApiKey: true, // Only for local dev! Use backend relay for prod.
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

            // 4. Default Greeting
            session.transport.sendEvent({
                type: 'response.create',
                response: { instructions: 'Say hello to the user.' }
            });

            // 5. Event Listeners
            // @ts-ignore
            session.on('transport_event', handleTransportEvent);
            session.on('error', (err: any) => appendDebug(`[Error] ${JSON.stringify(err)}`));

        } catch (err: any) {
            console.error(err);
            setError(err.message);
            appendDebug(`Error: ${err.message}`);
            setIsConnected(false);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(() => {
        if (sessionRef.current) {
            // @ts-ignore
            sessionRef.current.disconnect?.();
            sessionRef.current = null;
        }
        setIsConnected(false);
        setIsStudyMode(false);
        appendDebug('Disconnected.');
    }, []);

    const startStudySession = useCallback(() => {
        if (!sessionRef.current) return;
        setIsStudyMode(true);

        // Initialize Anki Service
        ankiServiceRef.current.startSession();
        const stats = ankiServiceRef.current.getDeckStats();

        const now = new Date();
        const timeOfDay = now.getHours() < 12 ? 'morning' : 'afternoon';
        const greeting = `Good ${timeOfDay}! We are studying ${stats.name}. ${stats.remainingCards} cards remaining.`;

        appendDebug(`Starting Study Session: ${greeting}`);

        // Update System Prompt & Tools
        const systemPrompt = `
            ROLE: You are an Anki Tutor.
            LANGUAGE: English ONLY.
            TASK:
            1. Call get_next_card.
            2. Ask the question based on the card.
            3. Listen to answer.
            4. Call notify_evaluation(correct/incorrect).
            5. Provide feedback.
            START GREETING: "${greeting}"
        `;

        sessionRef.current.transport.sendEvent({
            type: 'session.update',
            session: {
                instructions: systemPrompt,
                tools: [
                    {
                        type: 'function',
                        name: 'get_next_card',
                        description: 'Get next card data (front/back).',
                        parameters: { type: 'object', properties: {} }
                    },
                    {
                        type: 'function',
                        name: 'notify_evaluation',
                        description: 'Notify UI of result.',
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

    const handleTransportEvent = async (event: any) => {
        const session = sessionRef.current;
        if (!session) return;

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
                const result = ankiServiceRef.current.getNextCard();
                appendDebug(`[Tool Result] ${JSON.stringify(result)}`);

                session.transport.sendEvent({
                    type: 'conversation.item.create',
                    item: { type: 'function_call_output', call_id, output: JSON.stringify(result) }
                });
                session.transport.sendEvent({ type: 'response.create' });
            }
            else if (name === 'notify_evaluation') {
                try {
                    const args = JSON.parse(argsStr);
                    setEvaluation(args.verdict);
                    appendDebug(`[Evaluation] ${args.verdict}`);

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
        connect,
        disconnect,
        startStudySession
    };
}
