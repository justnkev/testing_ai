'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

export type AgentContextType = {
    type: 'job' | 'customer' | 'invoice' | 'dashboard' | 'unknown';
    id?: string;
    data?: any;
};

interface AgentState {
    context: AgentContextType;
    setContext: (context: AgentContextType) => void;
}

const AgentContext = createContext<AgentState | undefined>(undefined);

export function AgentProvider({ children }: { children: ReactNode }) {
    const [context, setContext] = useState<AgentContextType>({ type: 'unknown' });

    return (
        <AgentContext.Provider value={{ context, setContext }}>
            {children}
        </AgentContext.Provider>
    );
}

export function useAgentContext() {
    const context = useContext(AgentContext);
    if (!context) {
        throw new Error('useAgentContext must be used within an AgentProvider');
    }
    return context;
}

// Helper hook for pages to set context
export function useSetAgentContext(context: AgentContextType) {
    const { setContext } = useAgentContext();

    useEffect(() => {
        // Only update if context actually changed (deep comparison would be better but this is a simple start)
        // We use a simple JSON stringify check to avoid infinite loops if objects are recreated
        setContext(context);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(context)]);
}
