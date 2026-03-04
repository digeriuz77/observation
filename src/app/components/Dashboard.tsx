'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';

export function Dashboard() {
    const [observations, setObservations] = useState<any[]>([]);
    const [columns, setColumns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);

    useEffect(() => {
        fetchObservations();
    }, []);

    const fetchObservations = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('observations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching data:', error);
        else setObservations(data || []);
        setLoading(false);
    };

    const handleSynthesize = async () => {
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
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-teal-700 mb-4" size={48} />
                <p className="text-slate-500">Loading shared observations...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-teal-900">Observation Dashboard</h1>
                <div className="flex gap-3">
                    <button
                        onClick={fetchObservations}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all"
                    >
                        <RefreshCw size={18} />
                        <span>Refresh</span>
                    </button>
                    <button
                        onClick={handleSynthesize}
                        disabled={analyzing || observations.length === 0}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-800 text-white hover:bg-teal-700 transition-all disabled:opacity-50"
                    >
                        {analyzing ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                        <span>AI Synthesis</span>
                    </button>
                </div>
            </div>

            {analysis && (
                <div className="glass card border-l-4 border-l-teal-500 bg-teal-50/50 animate-in slide-in-from-top-4 duration-500">
                    <h2 className="text-xl font-bold text-teal-900 mb-4 flex items-center gap-2">
                        <Sparkles className="text-teal-600" size={20} />
                        Thematic AI Analysis
                    </h2>
                    <div className="prose prose-teal max-w-none text-slate-700 whitespace-pre-wrap">
                        {analysis}
                    </div>
                </div>
            )}

            <div className="glass overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-100/50 border-b border-slate-200">
                            <th className="px-6 py-4 font-semibold text-slate-700">Date</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Teacher</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">School</th>
                            <th className="px-6 py-4 font-semibold text-slate-700">Observer</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {observations.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                    No observations recorded yet.
                                </td>
                            </tr>
                        ) : (
                            observations.map((obs) => (
                                <tr key={obs.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {new Date(obs.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-900">{obs.teacher_name}</td>
                                    <td className="px-6 py-4 text-slate-600">{obs.school_name}</td>
                                    <td className="px-6 py-4 text-slate-600">{obs.observer_name}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
