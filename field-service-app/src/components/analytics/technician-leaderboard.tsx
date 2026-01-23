import type { TechnicianPerformance } from '@/lib/validations/analytics';
import { Trophy, User } from 'lucide-react';

interface TechnicianLeaderboardProps {
    data: TechnicianPerformance[];
}

export function TechnicianLeaderboard({ data }: TechnicianLeaderboardProps) {
    if (data.length === 0) {
        return null;
    }

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
        }).format(value);

    return (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-semibold text-white">Technician Leaderboard</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-700">
                            <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Rank</th>
                            <th className="text-left py-3 px-2 text-sm font-medium text-slate-400">Technician</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-slate-400">Completed</th>
                            <th className="text-right py-3 px-2 text-sm font-medium text-slate-400">Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.map((tech, index) => (
                            <tr
                                key={tech.technicianId}
                                className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                            >
                                <td className="py-3 px-2">
                                    <span
                                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${index === 0
                                                ? 'bg-yellow-500/20 text-yellow-400'
                                                : index === 1
                                                    ? 'bg-slate-400/20 text-slate-300'
                                                    : index === 2
                                                        ? 'bg-amber-700/20 text-amber-500'
                                                        : 'bg-slate-700 text-slate-400'
                                            }`}
                                    >
                                        {index + 1}
                                    </span>
                                </td>
                                <td className="py-3 px-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                                            <User className="w-4 h-4 text-slate-400" />
                                        </div>
                                        <span className="text-white font-medium">{tech.technicianName}</span>
                                    </div>
                                </td>
                                <td className="py-3 px-2 text-right">
                                    <span className="text-green-400">{tech.jobsCompleted}</span>
                                    {tech.jobsCancelled > 0 && (
                                        <span className="text-slate-500 ml-1">/ {tech.jobsCancelled} cancelled</span>
                                    )}
                                </td>
                                <td className="py-3 px-2 text-right">
                                    <span className="text-white font-semibold">{formatCurrency(tech.totalRevenue)}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
