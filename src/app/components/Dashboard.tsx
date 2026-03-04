'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Sparkles,
    Loader2,
    RefreshCw,
    Users,
    School,
    Clock,
    MessageSquare,
    TrendingUp,
    Calendar,
    BarChart3
} from 'lucide-react';

// Type for observation data from Supabase
interface Observation {
    id: string;
    created_at: string;
    teacher_name: string;
    school_name: string;
    observer_name: string;
    subject: string;
    grade_level: string;
    objective_visible: boolean;
    objective_concept: string;
    student_whisper_check: string;
    total_duration_seconds: number;
    time_teacher_talking: number;
    time_student_talking: number;
    time_silence: number;
    count_q_closed: number;
    count_q_open: number;
    count_q_probe: number;
    count_resp_short: number;
    count_resp_extended: number;
    count_resp_peer: number;
    count_code_switching: number;
    formative_methods_count: Record<string, number>;
    verbatim_quotes: string;
}

// Statistics type
interface Stats {
    totalObservations: number;
    uniqueTeachers: number;
    uniqueSchools: number;
    uniqueObservers: number;
    avgTeacherTalkPct: number;
    avgStudentTalkPct: number;
    totalQuestions: number;
    objectiveClearRate: number;
}

export function Dashboard() {
    const [observations, setObservations] = useState<Observation[]>([]);
    const [loading, setLoading] = useState(true);
    const [analyzing, setAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<string>('');
    const [stats, setStats] = useState<Stats | null>(null);

    // Fetch all observations from Supabase
    const fetchObservations = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('observations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching data:', error);
        } else {
            const obsData = (data || []) as Observation[];
            setObservations(obsData);
            calculateStats(obsData);
        }
        setLoading(false);
    }, []);

    // Calculate statistics from observations
    const calculateStats = (obsData: Observation[]) => {
        if (obsData.length === 0) return;

        const uniqueTeachers = new Set(obsData.map(o => o.teacher_name)).size;
        const uniqueSchools = new Set(obsData.map(o => o.school_name)).size;
        const uniqueObservers = new Set(obsData.map(o => o.observer_name)).size;

        const totalDuration = obsData.reduce((sum, o) => sum + (o.total_duration_seconds || 0), 0);
        const totalTeacherTalk = obsData.reduce((sum, o) => sum + (o.time_teacher_talking || 0), 0);
        const totalStudentTalk = obsData.reduce((sum, o) => sum + (o.time_student_talking || 0), 0);

        const avgTeacherTalkPct = totalDuration > 0
            ? Math.round((totalTeacherTalk / totalDuration) * 100)
            : 0;
        const avgStudentTalkPct = totalDuration > 0
            ? Math.round((totalStudentTalk / totalDuration) * 100)
            : 0;

        const totalQuestions = obsData.reduce((sum, o) =>
            sum + (o.count_q_closed || 0) + (o.count_q_open || 0) + (o.count_q_probe || 0), 0
        );

        const objectiveClearCount = obsData.filter(o => o.objective_visible).length;
        const objectiveClearRate = Math.round((objectiveClearCount / obsData.length) * 100);

        setStats({
            totalObservations: obsData.length,
            uniqueTeachers,
            uniqueSchools,
            uniqueObservers,
            avgTeacherTalkPct,
            avgStudentTalkPct,
            totalQuestions,
            objectiveClearRate,
        });
    };

    // Load observations on mount
    useEffect(() => {
        fetchObservations();
    }, [fetchObservations]);

    // Handle AI analysis with streaming
    const handleAnalyze = useCallback(async () => {
        if (observations.length === 0) return;

        setAnalyzing(true);
        setAnalysis('');

        try {
            const response = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ observations }),
            });

            if (!response.ok) throw new Error('Analysis failed');

            // Handle streaming response
            const reader = response.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // Handle SSE format (data: lines)
                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.choices?.[0]?.delta?.content) {
                                fullText += parsed.choices[0].delta.content;
                                setAnalysis(fullText);
                            }
                        } catch {
                            // If not JSON, treat as plain text
                            fullText += data;
                            setAnalysis(fullText);
                        }
                    } else if (line.trim()) {
                        fullText += line;
                        setAnalysis(fullText);
                    }
                }
            }
        } catch (error) {
            console.error('Analysis error:', error);
            setAnalysis('Error generating analysis. Please try again.');
        } finally {
            setAnalyzing(false);
        }
    }, [observations]);

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        return `${mins}m`;
    };

    // Format date helper
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-cyan-600" size={40} />
                <p className="text-slate-500 mt-4">Loading observations...</p>
            </div>
        );
    }

    if (observations.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <BarChart3 className="text-slate-400" size={32} />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No Observations Yet</h3>
                <p className="text-slate-500 max-w-md mx-auto">
                    Start making observations to see data and insights here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Observation Dashboard</h1>
                    <p className="text-slate-500 text-sm mt-1">
                        {stats?.totalObservations} observations across {stats?.uniqueSchools} schools
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchObservations}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <RefreshCw size={16} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button
                        onClick={handleAnalyze}
                        disabled={analyzing}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-700 hover:to-blue-700 transition-all disabled:opacity-50"
                    >
                        {analyzing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        <span>AI Analysis</span>
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass card bg-gradient-to-br from-blue-50/80 to-cyan-50/80">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Users className="text-blue-600" size={20} />
                            </div>
                            <span className="text-sm text-slate-600">Teachers</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats.uniqueTeachers}</p>
                        <p className="text-xs text-slate-500 mt-1">Unique observed</p>
                    </div>

                    <div className="glass card bg-gradient-to-br from-emerald-50/80 to-teal-50/80">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <School className="text-emerald-600" size={20} />
                            </div>
                            <span className="text-sm text-slate-600">Schools</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats.uniqueSchools}</p>
                        <p className="text-xs text-slate-500 mt-1">Participating</p>
                    </div>

                    <div className="glass card bg-gradient-to-br from-amber-50/80 to-yellow-50/80">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Clock className="text-amber-600" size={20} />
                            </div>
                            <span className="text-sm text-slate-600">Talk Ratio</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats.avgTeacherTalkPct}%</p>
                        <p className="text-xs text-slate-500 mt-1">Teacher / {stats.avgStudentTalkPct}% Student</p>
                    </div>

                    <div className="glass card bg-gradient-to-br from-violet-50/80 to-purple-50/80">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-violet-100 rounded-lg flex items-center justify-center">
                                <TrendingUp className="text-violet-600" size={20} />
                            </div>
                            <span className="text-sm text-slate-600">Objectives</span>
                        </div>
                        <p className="text-3xl font-bold text-slate-800">{stats.objectiveClearRate}%</p>
                        <p className="text-xs text-slate-500 mt-1">Clear / visible</p>
                    </div>
                </div>
            )}

            {/* AI Analysis Section */}
            {(analyzing || analysis) && (
                <div className="glass card bg-gradient-to-br from-indigo-50/80 to-blue-50/80 border-indigo-200">
                    <h2 className="font-semibold flex items-center gap-2 mb-4 text-indigo-900">
                        <Sparkles className="text-indigo-600" size={20} />
                        AI Thematic Analysis
                        {analyzing && <span className="text-sm font-normal text-indigo-500">(generating...)</span>}
                    </h2>
                    <div className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">
                        {analysis || 'Analyzing patterns across all observations...'}
                    </div>
                </div>
            )}

            {/* Recent Observations Table */}
            <div className="glass card overflow-hidden">
                <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Calendar size={18} className="text-cyan-600" />
                    Recent Observations
                </h2>
                <div className="overflow-x-auto -mx-6 px-6">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200">
                                <th className="text-left py-3 px-4 font-medium text-slate-600">Date</th>
                                <th className="text-left py-3 px-4 font-medium text-slate-600">Teacher</th>
                                <th className="text-left py-3 px-4 font-medium text-slate-600">School</th>
                                <th className="text-left py-3 px-4 font-medium text-slate-600">Subject</th>
                                <th className="text-left py-3 px-4 font-medium text-slate-600">Observer</th>
                                <th className="text-center py-3 px-4 font-medium text-slate-600">Duration</th>
                                <th className="text-center py-3 px-4 font-medium text-slate-600">Questions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {observations.slice(0, 10).map((obs) => (
                                <tr key={obs.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    <td className="py-3 px-4 text-slate-600">{formatDate(obs.created_at)}</td>
                                    <td className="py-3 px-4 font-medium text-slate-800">{obs.teacher_name}</td>
                                    <td className="py-3 px-4 text-slate-600">{obs.school_name}</td>
                                    <td className="py-3 px-4">
                                        <span className="px-2 py-1 bg-slate-100 rounded text-xs">
                                            {obs.subject}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-slate-600">{obs.observer_name}</td>
                                    <td className="py-3 px-4 text-center text-slate-600">
                                        {formatTime(obs.total_duration_seconds)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className="px-2 py-1 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                                            {(obs.count_q_closed || 0) + (obs.count_q_open || 0) + (obs.count_q_probe || 0)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {observations.length > 10 && (
                    <p className="text-center text-slate-500 text-sm mt-4">
                        Showing 10 of {observations.length} observations
                    </p>
                )}
            </div>
        </div>
    );
}
