'use client';

import { useCallback } from 'react';
import { updateChecklistItem } from '@/lib/actions/job-execution';
import { toast } from 'sonner';
import { CheckSquare, Square, AlertCircle } from 'lucide-react';

interface ChecklistItemData {
    id: string;
    title: string;
    description: string | null;
    is_required: boolean;
    is_completed: boolean;
}

interface TaskChecklistProps {
    items: ChecklistItemData[];
    onItemChange: () => void;
    disabled?: boolean;
}

export function TaskChecklist({ items, onItemChange, disabled }: TaskChecklistProps) {
    const handleToggle = useCallback(
        async (itemId: string, currentValue: boolean) => {
            const result = await updateChecklistItem(itemId, !currentValue);
            if (result.success) {
                onItemChange();
            } else {
                toast.error(result.error);
            }
        },
        [onItemChange]
    );

    if (items.length === 0) {
        return null;
    }

    const completedCount = items.filter((i) => i.is_completed).length;
    const requiredIncomplete = items.filter((i) => i.is_required && !i.is_completed);

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                <h3 className="text-white font-medium">Task Checklist</h3>
                <span className="text-sm text-slate-400">
                    {completedCount} / {items.length} complete
                </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-slate-700">
                {items.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => handleToggle(item.id, item.is_completed)}
                        disabled={disabled}
                        className={`w-full flex items-start gap-3 p-4 text-left transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700/50'
                            }`}
                    >
                        {item.is_completed ? (
                            <CheckSquare className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
                        ) : (
                            <Square className="w-6 h-6 text-slate-500 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span
                                    className={`font-medium ${item.is_completed ? 'text-slate-400 line-through' : 'text-white'
                                        }`}
                                >
                                    {item.title}
                                </span>
                                {item.is_required && !item.is_completed && (
                                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                                        Required
                                    </span>
                                )}
                            </div>
                            {item.description && (
                                <p className="text-sm text-slate-400 mt-1">{item.description}</p>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            {/* Warning for incomplete required items */}
            {requiredIncomplete.length > 0 && (
                <div className="p-3 bg-amber-500/10 border-t border-amber-500/30 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs text-amber-300">
                        {requiredIncomplete.length} required item{requiredIncomplete.length > 1 ? 's' : ''}{' '}
                        incomplete
                    </span>
                </div>
            )}
        </div>
    );
}
