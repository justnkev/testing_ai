'use client';

import { memo } from 'react';
import { Technician } from '@/lib/validations/calendar';
import { Button } from '@/components/ui/button';
import { Check, Users, X } from 'lucide-react';

interface TechnicianFilterProps {
    technicians: Technician[];
    selectedTechnicians: Set<string>;
    onToggle: (techId: string) => void;
    onClearAll: () => void;
}

export const TechnicianFilter = memo(function TechnicianFilter({
    technicians,
    selectedTechnicians,
    onToggle,
    onClearAll,
}: TechnicianFilterProps) {
    const hasFilter = selectedTechnicians.size > 0;

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 h-full overflow-auto">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-white">
                    <Users className="w-5 h-5" />
                    <h3 className="font-semibold">Technicians</h3>
                </div>
                {hasFilter && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClearAll}
                        className="text-slate-400 hover:text-white h-7 px-2"
                    >
                        <X className="w-4 h-4 mr-1" />
                        Clear
                    </Button>
                )}
            </div>

            {technicians.length === 0 ? (
                <p className="text-slate-400 text-sm">No technicians found</p>
            ) : (
                <div className="space-y-2">
                    {technicians.map((tech) => {
                        const isSelected = selectedTechnicians.has(tech.id);
                        const displayName = tech.display_name || tech.email || 'Unknown';

                        return (
                            <button
                                key={tech.id}
                                onClick={() => onToggle(tech.id)}
                                className={`
                  w-full flex items-center gap-3 p-2 rounded-lg transition-colors
                  ${isSelected
                                        ? 'bg-slate-700 ring-2 ring-blue-500'
                                        : 'hover:bg-slate-700/50'
                                    }
                `}
                            >
                                {/* Color indicator */}
                                <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: tech.avatar_color || '#3B82F6' }}
                                />

                                {/* Name */}
                                <span className="text-sm text-white truncate flex-1 text-left">
                                    {displayName}
                                </span>

                                {/* Check indicator */}
                                {isSelected && (
                                    <Check className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-700">
                <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-3">Status Colors</h4>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-xs text-slate-300">Scheduled</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-xs text-slate-300">In Progress</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-500" />
                        <span className="text-xs text-slate-300">Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-xs text-slate-300">Cancelled</span>
                    </div>
                </div>
            </div>

            {/* Priority indicators */}
            <div className="mt-4 pt-4 border-t border-slate-700">
                <h4 className="text-xs text-slate-400 uppercase tracking-wide mb-3">Priority</h4>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full ring-2 ring-orange-500 bg-slate-600" />
                        <span className="text-xs text-slate-300">High Priority</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full ring-2 ring-red-500 bg-slate-600" />
                        <span className="text-xs text-slate-300">Urgent</span>
                    </div>
                </div>
            </div>
        </div>
    );
});
