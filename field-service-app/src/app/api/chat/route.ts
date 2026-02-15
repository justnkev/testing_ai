import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToModelMessages, stepCountIs, type UIMessage } from 'ai';
import { tools } from '@/lib/ai/tools';

export const maxDuration = 30;

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { messages, context } = body as { messages: UIMessage[]; context?: any };

        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
        console.log('[Agent] API Key present:', !!apiKey, 'Key prefix:', apiKey?.substring(0, 10));
        console.log('[Agent] Received messages:', messages.length, 'Context:', context?.type);

        if (!apiKey) {
            return new Response(
                JSON.stringify({ error: 'GOOGLE_GENERATIVE_AI_API_KEY is not set' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const google = createGoogleGenerativeAI({ apiKey });

        const contextPrompt = context?.type && context.type !== 'unknown'
            ? `\n\nCURRENT CONTEXT: User is viewing a ${context.type}${context.id ? ` with ID ${context.id}` : ''}.${context.data ? ` Details: ${JSON.stringify(context.data)}` : ''}`
            : '';

        const system = `You are a helpful field service assistant embedded in the Field Service Pro app.
You can help the user manage jobs, customers, and invoices.
Always check the CURRENT CONTEXT to see what the user is looking at.
If the user says "this job", refer to the ID in the context.
Keep responses concise and actionable.

Current time: ${new Date().toISOString()}
${contextPrompt}`;

        const modelMessages = await convertToModelMessages(messages);
        console.log('[Agent] Converted', modelMessages.length, 'messages. Calling Gemini...');

        const result = streamText({
            model: google('gemini-2.5-flash'),
            system,
            messages: modelMessages,
            tools,
            stopWhen: stepCountIs(5),
            onError: (event) => {
                console.error('[Agent] Stream error event:', JSON.stringify(event.error, null, 2));
            },
        });

        console.log('[Agent] Stream created, returning response');
        return result.toUIMessageStreamResponse();
    } catch (error: any) {
        console.error('[Agent] Caught error:', error?.message || error);
        console.error('[Agent] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
        return new Response(
            JSON.stringify({ error: error?.message || 'Internal server error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
