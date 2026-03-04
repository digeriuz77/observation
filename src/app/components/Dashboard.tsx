'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, RefreshCw, Users, School, Clock, MessageSquare, Calendar, BarChart3, Lightbulb, HelpCircle, TrendingUp } from 'lucide-react';

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
    avg_wait_time_seconds: number;
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

// Aggregated statistics
interface Stats {
    totalObservations: number;
    uniqueTeachers: number;
    uniqueSchools: number;
    uniqueObservers: number;
    totalMinutesObserved: number;
    avgTeacherTalkPct: number;
    avgStudentTalkPct: number;
    avgSilencePct: number;
    avgWaitTimeSeconds: number;
    objectiveVisibleCount: number;
    objectiveVisibleRate: number;
    totalQuestions: number;
    studentUnderstanding: { None: number; Task: number; Concept: number };
    questionBreakdown: { closed: number; open: number; probe: number };
    responseBreakdown: { short: number; extended: number; peer: number };
    totalCodeSwitching: number;
}

// School/Observer summary
interface SchoolSummary {
    school_name: string;
    totalObservations: number;
    uniqueTeachers: number;
    avgTeacherTalkPct: number;
    avgStudentTalkPct: number;
}

export function Dashboard() {
    const [observations, setObservations] = useState<Observation[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<Stats | null>(null);
    const [schoolSummaries, setSchoolSummaries] = useState<SchoolSummary[]>([]);

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
            calculateSchoolSummaries(obsData);
        }
        setLoading(false);
    }, []);

    // Calculate statistics from observations
    const calculateStats = useCallback((obsData: Observation[]) => {
        if (obsData.length === 0) return;

        const uniqueTeachers = new Set(obsData.map(o => o.teacher_name)).size;
        const uniqueSchools = new Set(obsData.map(o => o.school_name)).size;
        const uniqueObservers = new Set(obsData.map(o => o.observer_name)).size;

        const totalDurationSeconds = obsData.reduce((sum, o) => sum + (o.total_duration_seconds || 0), 0);
        const totalTeacherTalk = obsData.reduce((sum, o) => sum + (o.time_teacher_talking || 0), 0);
        const totalStudentTalk = obsData.reduce((sum, o) => sum + (o.time_student_talking || 0), 0);
        const totalSilence = obsData.reduce((sum, o) => sum + (o.time_silence || 0), 0);

        const avgTeacherTalkPct = totalDurationSeconds > 0
            ? Math.round((totalTeacherTalk / totalDurationSeconds) * 100)
            : 0;
        const avgStudentTalkPct = totalDurationSeconds > 0
            ? Math.round((totalStudentTalk / totalDurationSeconds) * 100)
            : 0;
        const avgSilencePct = totalDurationSeconds > 0
            ? Math.round((totalSilence / totalDurationSeconds) * 100)
            : 0;

        const objectiveVisibleCount = obsData.filter(o => o.objective_visible).length;
        const objectiveVisibleRate = Math.round((objectiveVisibleCount / obsData.length) * 100);

        const totalQuestions = obsData.reduce((sum, o) =>
            sum + (o.count_q_closed || 0) + (o.count_q_open || 0) + (o.count_q_probe || 0), 0
        );

        const questionBreakdown = {
            closed: obsData.reduce((sum, o) => sum + (o.count_q_closed || 0), 0),
            open: obsData.reduce((sum, o) => sum + (o.count_q_open || 0), 0),
            probe: obsData.reduce((sum, o) => sum + (o.count_q_probe || 0), 0),
        };

        const responseBreakdown = {
            short: obsData.reduce((sum, o) => sum + (o.count_resp_short || 0), 0),
            extended: obsData.reduce((sum, o) => sum + (o.count_resp_extended || 0), 0),
            peer: obsData.reduce((sum, o) => sum + (o.count_resp_peer || 0), 0),
        };

        const studentUnderstanding = {
            None: obsData.filter(o => o.student_whisper_check === 'None').length,
            Task: obsData.filter(o => o.student_whisper_check === 'Task').length,
            Concept: obsData.filter(o => o.student_whisper_check === 'Concept').length,
        };

        const waitTimes = obsData.map(o => o.avg_wait_time_seconds || 0).filter(w => w > 0);
        const avgWaitTimeSeconds = waitTimes.length > 0
            ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
            : 0;

        const totalCodeSwitching = obsData.reduce((sum, o) => sum + (o.count_code_switching || 0), 0);

        setStats({
            totalObservations: obsData.length,
            uniqueTeachers,
            uniqueSchools,
            uniqueObservers,
            totalMinutesObserved: Math.round(totalDurationSeconds / 60),
            avgTeacherTalkPct,
            avgStudentTalkPct,
            avgSilencePct,
            avgWaitTimeSeconds: Math.round(avgWaitTimeSeconds * 10) / 10,
            objectiveVisibleCount,
            objectiveVisibleRate,
            totalQuestions,
            studentUnderstanding,
            questionBreakdown,
            responseBreakdown,
            totalCodeSwitching,
        });
    }, []);

    // Calculate school summaries
    const calculateSchoolSummaries = useCallback((obsData: Observation[]) => {
        const schoolMap = new Map<string, Observation[]>();
        obsData.forEach(obs => {
            if (!schoolMap.has(obs.school_name)) {
                schoolMap.set(obs.school_name, []);
            }
            schoolMap.get(obs.school_name)!.push(obs);
        });

        const summaries: SchoolSummary[] = [];
        schoolMap.forEach((schoolObs, schoolName) => {
            const totalDuration = schoolObs.reduce((sum, o) => sum + (o.total_duration_seconds || 0), 0);
            const totalTeacherTalk = schoolObs.reduce((sum, o) => sum + (o.time_teacher_talking || 0), 0);
            const totalStudentTalk = schoolObs.reduce((sum, o) => sum + (o.time_student_talking || 0), 0);

            summaries.push({
                school_name: schoolName,
                totalObservations: schoolObs.length,
                uniqueTeachers: new Set(schoolObs.map(o => o.teacher_name)).size,
                avgTeacherTalkPct: totalDuration > 0 ? Math.round((totalTeacherTalk / totalDuration) * 100) : 0,
                avgStudentTalkPct: totalDuration > 0 ? Math.round((totalStudentTalk / totalDuration) * 100) : 0,
            });
        });

        setSchoolSummaries(summaries.sort((a, b) => b.totalObservations - a.totalObservations));
    }, []);

    // Load observations on mount
    useEffect(() => {
        fetchObservations();
    }, [fetchObservations]);

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    };

    // Format date helper
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    // Calculate formative methods totals
    const formativeMethodsTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        observations.forEach(obs => {
            const counts = obs.formative_methods_count || {};
            Object.entries(counts).forEach(([method, count]) => {
                totals[method] = (totals[method] || 0) + count;
            });
        });
        return totals;
    }, [observations]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent-primary)' }} />
                <p className="text-secondary mt-4">Loading observations...</p>
            </div>
        );
    }

    if (observations.length === 0) {
        return (
            <div className="text-center py-20">
                <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                    <BarChart3 className="text-muted" size={32} />
                </div>
                <h3 className="text-lg font-semibold mb-2">No Observations Yet</h3>
                <p className="text-secondary max-w-md mx-auto">
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
                    <h1 className="text-xl font-bold">Observation Dashboard</h1>
                    <p className="text-secondary text-sm mt-1">
                        {stats?.totalObservations} observations across {stats?.uniqueSchools} schools
                    </p>
                </div>
                <button
                    onClick={fetchObservations}
                    className="btn btn-secondary"
                >
                    <RefreshCw size={16} />
                    <span className="hidden sm-block">Refresh</span>
                </button>
            </div>

            {/* Primary Statistics Cards */}
            {stats && (
                <div className="grid grid-2 sm:grid-4 gap-3">
                    <div className="card">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                                <Users size={16} className="text-accent" />
                            </div>
                            <span className="text-xs text-secondary">Teachers</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.uniqueTeachers}</p>
                        <p className="text-xs text-muted">Unique observed</p>
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                                <School size={16} className="text-accent" />
                            </div>
                            <span className="text-xs text-secondary">Schools</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.uniqueSchools}</p>
                        <p className="text-xs text-muted">Participating</p>
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                                <Clock size={16} className="text-accent" />
                            </div>
                            <span className="text-xs text-secondary">Total Time</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.totalMinutesObserved}m</p>
                        <p className="text-xs text-muted">Observed</p>
                    </div>

                    <div className="card">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-8 h-8 rounded flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                                <Calendar size={16} className="text-accent" />
                            </div>
                            <span className="text-xs text-secondary">Objectives</span>
                        </div>
                        <p className="text-2xl font-bold">{stats.objectiveVisibleRate}%</p>
                        <p className="text-xs text-muted">Visible / clear</p>
                    </div>
                </div>
            )}

            {/* Talk Time Distribution */}
            {stats && (
                <div className="card">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <MessageSquare size={18} className="text-accent" />
                        Talk Time Distribution
                    </h3>
                    <div className="flex items-center gap-1 h-8 rounded overflow-hidden mb-3">
                        <div
                            className="h-full flex items-center justify-center text-xs font-semibold text-white"
                            style={{ width: `${stats.avgTeacherTalkPct}%`, background: 'var(--accent-primary)' }}
                        >
                            {stats.avgTeacherTalkPct > 8 && `Teacher ${stats.avgTeacherTalkPct}%`}
                        </div>
                        <div
                            className="h-full flex items-center justify-center text-xs font-semibold"
                            style={{ width: `${stats.avgStudentTalkPct}%`, background: 'var(--success)' }}
                        >
                            {stats.avgStudentTalkPct > 8 && `Student ${stats.avgStudentTalkPct}%`}
                        </div>
                        <div
                            className="h-full flex items-center justify-center text-xs font-semibold text-secondary"
                            style={{ width: `${stats.avgSilencePct}%`, background: 'var(--bg-subtle)' }}
                        >
                            {stats.avgSilencePct > 8 && `Silence ${stats.avgSilencePct}%`}
                        </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted">
                        <span>Teacher: {stats.avgTeacherTalkPct}%</span>
                        <span>Student: {stats.avgStudentTalkPct}%</span>
                        <span>Silence: {stats.avgSilencePct}%</span>
                    </div>
                </div>
            )}

            {/* Student Understanding Breakdown */}
            {stats && (
                <div className="card">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <Lightbulb size={18} className="text-accent" />
                        Student Understanding Check
                    </h3>
                    <div className="grid grid-3 gap-3">
                        <div className="text-center p-3 rounded" style={{ background: 'var(--bg-subtle)' }}>
                            <p className="text-2xl font-bold">{stats.studentUnderstanding.None}</p>
                            <p className="text-xs text-muted">Couldn't Explain</p>
                        </div>
                        <div className="text-center p-3 rounded" style={{ background: 'var(--warning-bg)' }}>
                            <p className="text-2xl font-bold" style={{ color: 'var(--warning)' }}>{stats.studentUnderstanding.Task}</p>
                            <p className="text-xs text-secondary">Explained Task</p>
                        </div>
                        <div className="text-center p-3 rounded" style={{ background: 'var(--success-bg)' }}>
                            <p className="text-2xl font-bold" style={{ color: 'var(--success)' }}>{stats.studentUnderstanding.Concept}</p>
                            <p className="text-xs text-secondary">Explained Concept</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Questions & Responses */}
            {stats && (
                <div className="grid grid-2 gap-3">
                    {/* Question Types */}
                    <div className="card">
                        <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <HelpCircle size={16} className="text-accent" />
                            Question Types ({stats.totalQuestions})
                        </h4>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-secondary">Closed (What/Who)</span>
                                <span className="font-semibold">{stats.questionBreakdown.closed}</span>
                            </div>
                            <div className="w-full h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                                <div
                                    className="h-full rounded"
                                    style={{
                                        width: stats.totalQuestions > 0 ? `${(stats.questionBreakdown.closed / stats.totalQuestions) * 100}%` : '0%',
                                        background: 'var(--accent-primary)'
                                    }}
                                />
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-sm text-secondary">Open (Why/How)</span>
                                <span className="font-semibold">{stats.questionBreakdown.open}</span>
                            </div>
                            <div className="w-full h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                                <div
                                    className="h-full rounded"
                                    style={{
                                        width: stats.totalQuestions > 0 ? `${(stats.questionBreakdown.open / stats.totalQuestions) * 100}%` : '0%',
                                        background: 'var(--success)'
                                    }}
                                />
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-sm text-secondary">Probe</span>
                                <span className="font-semibold">{stats.questionBreakdown.probe}</span>
                            </div>
                            <div className="w-full h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                                <div
                                    className="h-full rounded"
                                    style={{
                                        width: stats.totalQuestions > 0 ? `${(stats.questionBreakdown.probe / stats.totalQuestions) * 100}%` : '0%',
                                        background: 'var(--warning)'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Response Types */}
                    <div className="card">
                        <h4 className="font-semibold mb-3 flex items-center gap-2 text-sm">
                            <MessageSquare size={16} className="text-accent" />
                            Student Responses
                        </h4>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-secondary">Short (1-2 words)</span>
                                <span className="font-semibold">{stats.responseBreakdown.short}</span>
                            </div>
                            <div className="w-full h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                                <div
                                    className="h-full rounded"
                                    style={{
                                        width: `${(stats.responseBreakdown.short / (stats.responseBreakdown.short + stats.responseBreakdown.extended + stats.responseBreakdown.peer || 1)) * 100}%`,
                                        background: 'var(--text-muted)'
                                    }}
                                />
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-sm text-secondary">Academic (Full sentence)</span>
                                <span className="font-semibold">{stats.responseBreakdown.extended}</span>
                            </div>
                            <div className="w-full h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                                <div
                                    className="h-full rounded"
                                    style={{
                                        width: `${(stats.responseBreakdown.extended / (stats.responseBreakdown.short + stats.responseBreakdown.extended + stats.responseBreakdown.peer || 1)) * 100}%`,
                                        background: 'var(--accent-primary)'
                                    }}
                                />
                            </div>

                            <div className="flex justify-between items-center pt-1">
                                <span className="text-sm text-secondary">Peer-to-Peer</span>
                                <span className="font-semibold">{stats.responseBreakdown.peer}</span>
                            </div>
                            <div className="w-full h-2 rounded overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                                <div
                                    className="h-full rounded"
                                    style={{
                                        width: `${(stats.responseBreakdown.peer / (stats.responseBreakdown.short + stats.responseBreakdown.extended + stats.responseBreakdown.peer || 1)) * 100}%`,
                                        background: 'var(--success)'
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Additional Metrics */}
            {stats && (
                <div className="card">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp size={18} className="text-accent" />
                        Additional Metrics
                    </h3>
                    <div className="grid grid-2 sm:grid-4 gap-3">
                        <div className="text-center p-3 rounded" style={{ background: 'var(--bg-subtle)' }}>
                            <p className="text-xl font-bold">{stats.avgWaitTimeSeconds}s</p>
                            <p className="text-xs text-muted">Avg Wait Time</p>
                        </div>
                        <div className="text-center p-3 rounded" style={{ background: 'var(--bg-subtle)' }}>
                            <p className="text-xl font-bold">{stats.totalCodeSwitching}</p>
                            <p className="text-xs text-muted">Code-Switches</p>
                        </div>
                        <div className="text-center p-3 rounded" style={{ background: 'var(--bg-subtle)' }}>
                            <p className="text-xl font-bold">{stats.uniqueObservers}</p>
                            <p className="text-xs text-muted">Observers</p>
                        </div>
                        <div className="text-center p-3 rounded" style={{ background: 'var(--bg-subtle)' }}>
                            <p className="text-xl font-bold">{stats.totalQuestions}</p>
                            <p className="text-xs text-muted">Total Questions</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Formative Methods Usage */}
            {Object.keys(formativeMethodsTotals).length > 0 && (
                <div className="card">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <HelpCircle size={18} className="text-accent" />
                        Formative Methods Used
                    </h3>
                    <div className="grid grid-2 sm:grid-3 gap-2">
                        {Object.entries(formativeMethodsTotals)
                            .sort(([, a], [, b]) => b - a)
                            .map(([method, count]) => (
                                <div
                                    key={method}
                                    className="flex justify-between items-center p-2 rounded text-sm"
                                    style={{ background: 'var(--bg-subtle)' }}
                                >
                                    <span className="text-secondary">{method}</span>
                                    <span className="font-semibold">{count}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {/* School Breakdown */}
            {schoolSummaries.length > 1 && (
                <div className="card">
                    <h3 className="font-semibold mb-4 flex items-center gap-2">
                        <School size={18} className="text-accent" />
                        By School
                    </h3>
                    <div className="space-y-3">
                        {schoolSummaries.map((school) => (
                            <div key={school.school_name} className="flex items-center justify-between p-3 rounded" style={{ background: 'var(--bg-subtle)' }}>
                                <div className="flex-1">
                                    <p className="font-medium text-sm">{school.school_name}</p>
                                    <p className="text-xs text-muted">
                                        {school.totalObservations} obs • {school.uniqueTeachers} teachers
                                    </p>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-secondary">T: {school.avgTeacherTalkPct}%</span>
                                    <span className="text-accent">S: {school.avgStudentTalkPct}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Observations Table */}
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="p-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                    <h3 className="font-semibold flex items-center gap-2">
                        <Calendar size={18} className="text-accent" />
                        Recent Observations
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide text-left">Date</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide text-left">Teacher</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide text-left hidden sm:table-cell">School</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide text-left hidden sm:table-cell">Subject</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide text-center hidden sm:table-cell">Duration</th>
                                <th className="px-4 py-3 font-semibold text-secondary text-xs uppercase tracking-wide text-center">Questions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {observations.slice(0, 10).map((obs) => (
                                <tr
                                    key={obs.id}
                                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                >
                                    <td className="px-4 py-3 text-secondary">{formatDate(obs.created_at)}</td>
                                    <td className="px-4 py-3 font-medium">{obs.teacher_name}</td>
                                    <td className="px-4 py-3 text-secondary hidden sm:table-cell">{obs.school_name}</td>
                                    <td className="px-4 py-3 hidden sm:table-cell">
                                        <span className="badge badge-neutral">{obs.subject}</span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-secondary hidden sm:table-cell">
                                        {formatTime(obs.total_duration_seconds)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className="badge badge-accent">
                                            {(obs.count_q_closed || 0) + (obs.count_q_open || 0) + (obs.count_q_probe || 0)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {observations.length > 10 && (
                    <p className="text-center text-muted text-sm py-3">
                        Showing 10 of {observations.length} observations
                    </p>
                )}
            </div>
        </div>
    );
}
