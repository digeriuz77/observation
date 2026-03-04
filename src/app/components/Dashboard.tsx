'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/classnames';

// Type for observation data
interface ObservationDisplay {
    id: string;
    created_at: string;
    teacher_name: string;
    school_name: string;
    observer_name?: string;
}

export function Dashboard() {
    const [observations, setObservations] = useState<ObservationDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);

    const fetchObservations = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('observations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching data:', error);
        else setObservations((data || []) as ObservationDisplay[]);
        setLoading(false);
    }, []);

    // Load observations on mount
    useEffect(() => {
        fetchObservations();
    }, [fetchObservations]);

    const handleSynthesize = useCallback(async () => {
        setAnalyzing(true);
        // In a real app, this would call a server action that uses the Gemini API
        // For this prototype, we'll simulate the AI synthesis
        setTimeout(() => {
            setAnalysis(`
### Identified Themes in STEM English Instruction

1. **Scaffolding vs. Direct Instruction**: Observations show a high frequency of "teacher telling" during complex STEM concepts. There is a clear gap in utilizing sentence frames for disciplinary language.
2. **Disciplinary Language Integration**: Domain 5 notes suggest that while Tier 2 vocabulary is displayed, students are rarely pushed to use it in mathematical explanations.
3. **Formative Feedback Loops**: Wait time (Domain 3) remains low across 3 schools, limiting student conceptual processing.

**Recommendations**: Focus upcoming coaching cycles on 'Think-Aloud' modeling and increasing wait time to 5+ seconds.
      `);
            setAnalyzing(false);
        }, 2000);
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
                <p className="text-secondary mt-4">Loading observations...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h1 className="text-xl font-bold">Observation Dashboard</h1>
                <div className="flex gap-2">
                    <button
                        onClick={fetchObservations}
                        className="btn btn-secondary"
                    >
                        <RefreshCw size={16} />
                        <span className="hidden sm-block">Refresh</span>
                    </button>
                    <button
                        onClick={handleSynthesize}
                        disabled={analyzing || observations.length === 0}
                        className="btn btn-primary"
                    >
                        {analyzing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        <span>AI Analysis</span>
                    </button>
                </div>
            </div>

            {/* AI Analysis Card */}
            {analysis && (
                <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                    <h2 className="font-semibold flex items-center gap-2 mb-4">
                        <Sparkles size={18} style={{ color: 'var(--accent-primary)' }} />
                        Thematic Analysis
                    </h2>
                    <div className="text-secondary text-sm whitespace-pre-wrap">
                        {analysis}
                    </div>
                </div>
            )}

            {/* Observations Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {observations.length === 0 ? (
                    <div className="p-12 text-center text-muted">
                        No observations recorded yet.
                    </div>
                ) : (
                    <table className="w-full text-left">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide">Date</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide">Teacher</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide">School</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide hidden sm:table-cell">Observer</th>
                            </tr>
                        </thead>
                        <tbody>
                            {observations.map((obs) => (
                                <tr
                                    key={obs.id}
                                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                >
                                    <td className="px-4 py-3 text-sm text-secondary">
                                        {new Date(obs.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 font-medium">{obs.teacher_name}</td>
                                    <td className="px-4 py-3 text-secondary">{obs.school_name}</td>
                                    <td className="px-4 py-3 text-secondary hidden sm:table-cell">{obs.observer_name || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
