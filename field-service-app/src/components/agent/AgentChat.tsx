'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useAgentContext } from '@/lib/agent/context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, X, Send, Sparkles } from 'lucide-react';
import { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export function AgentChat() {
    const [isOpen, setIsOpen] = useState(false);
    const { context } = useAgentContext();
    const scrollRef = useRef<HTMLDivElement>(null);
    const [input, setInput] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Memoize transport so it's not recreated on every render
    const transport = useMemo(
        () => new DefaultChatTransport({ api: '/api/chat' }),
        []
    );

    const { messages, sendMessage, status } = useChat({
        transport,
        onError: (err) => {
            console.error('[AgentChat] Error:', err);
            setError('Something went wrong. Try sending your message again.');
        },
    });

    // Only treat submitted/streaming as loading — error and ready should re-enable input
    const isLoading = status === 'submitted' || status === 'streaming';

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;
        setError(null);
        // Pass context in each message so it's always current
        sendMessage({
            text: input,
            body: { context },
        });
        setInput('');
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="mb-4 w-[380px] h-[600px] bg-background border rounded-xl shadow-2xl flex flex-col overflow-hidden pointer-events-auto ring-1 ring-border/50"
                    >
                        {/* Header */}
                        <div className="p-4 border-b bg-muted/40 flex items-center justify-between backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <div className="bg-primary/10 p-2 rounded-lg">
                                    <Bot className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-sm">Companion Agent</h3>
                                    <div className="flex items-center gap-1.5">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                        </span>
                                        <span className="text-xs text-muted-foreground capitalize">
                                            {isLoading ? 'Thinking...' : context.type !== 'unknown' ? `Watching ${context.type}` : 'Active'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-muted"
                                onClick={() => setIsOpen(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Messages */}
                        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                            <div className="space-y-4">
                                {messages.length === 0 && (
                                    <div className="text-center py-12 px-4">
                                        <div className="bg-primary/5 h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <Sparkles className="h-6 w-6 text-primary" />
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            I&apos;m ready to help! I can see you&apos;re looking at {context.type === 'unknown' ? 'the dashboard' : `a ${context.type}`}.
                                        </p>
                                    </div>
                                )}

                                {messages.map((m) => {
                                    // Extract text parts, skip tool-related parts
                                    const textParts = m.parts?.filter((p) => p.type === 'text') || [];
                                    // Don't render empty messages (e.g. tool-call-only messages)
                                    if (textParts.length === 0) return null;

                                    return (
                                        <div
                                            key={m.id}
                                            className={cn(
                                                "flex w-full mb-4",
                                                m.role === 'user' ? "justify-end" : "justify-start"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm",
                                                    m.role === 'user'
                                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                                        : "bg-muted/80 text-foreground rounded-bl-none"
                                                )}
                                            >
                                                {textParts.map((part, i) => (
                                                    <span key={i}>{part.text}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}

                                {isLoading && (
                                    <div className="flex justify-start mb-4">
                                        <div className="bg-muted/80 rounded-2xl rounded-bl-none px-4 py-3 flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce"></span>
                                        </div>
                                    </div>
                                )}

                                {error && !isLoading && (
                                    <div className="flex justify-start mb-4">
                                        <div className="bg-destructive/10 text-destructive rounded-2xl rounded-bl-none px-4 py-2.5 text-sm">
                                            {error}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>

                        {/* Input */}
                        <div className="p-4 border-t bg-background/80 backdrop-blur-sm">
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <Input
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask me to draft an invoice..."
                                    disabled={isLoading}
                                    className="rounded-full bg-muted/50 border-transparent focus:border-primary focus:bg-background transition-all"
                                />
                                <Button
                                    type="submit"
                                    size="icon"
                                    disabled={isLoading || !input.trim()}
                                    className="rounded-full shrink-0 h-10 w-10"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Button
                onClick={() => setIsOpen(!isOpen)}
                size="lg"
                className={cn(
                    "h-14 w-14 rounded-full shadow-lg transition-all duration-300 pointer-events-auto hover:scale-105",
                    isOpen ? "bg-muted text-muted-foreground hover:bg-muted/80" : "bg-primary text-primary-foreground"
                )}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
            </Button>
        </div>
    );
}
