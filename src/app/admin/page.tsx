'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Download,
    Eye,
    EyeOff,
    BarChart3,
    PieChart,
    TrendingUp,
    Users,
    Clock,
    BookOpen,
    RefreshCw
} from 'lucide-react';

interface OverallSummary {
    total_observations: number;
    total_minutes_observed: number;
    avg_teacher_talk_pct: number;
    avg_student_talk_pct: number;
    avg_silence_pct: number;
    total_closed_questions: number;
    total_open_questions: number;
    total_probe_questions: number;
    overall_avg_wait_time: number;
    pct_objective_visible: number;
    unique_teachers_observed: number;
    departments_represented: number;
}

interface DepartmentSummary {
    department: string;
    school_name: string;
    total_observations: number;
    avg_teacher_talk_pct: number;
    avg_student_talk_pct: number;
    avg_silence_pct: number;
    total_closed_questions: number;
    total_open_questions: number;
    total_probe_questions: number;
    schoolwide_avg_wait_time: number;
    pct_objective_visible: number;
}

interface RawObservation {
    id: string;
    teacher_name: string;
    subject: string;
    grade_level: string;
    department: string;
    school_name: string;
    observed_at: string;
    objective_visible: boolean;
    time_teacher_talking: number;
    time_student_talking: number;
    time_silence: number;
    count_q_closed: number;
    count_q_open: number;
    count_q_probe: number;
    avg_wait_time_seconds: number;
    formative_methods: string[];
    verbatim_quotes: string;
}

export default function AdminDashboard() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [showTeacherNames, setShowTeacherNames] = useState(true);
    const [loading, setLoading] = useState(false);
    const [overallSummary, setOverallSummary] = useState<OverallSummary | null>(null);
    const [departmentSummary, setDepartmentSummary] = useState<DepartmentSummary[]>([]);
    const [rawObservations, setRawObservations] = useState<RawObservation[]>([]);

    // Simple password check (in production, use proper auth)
    const handleLogin = () => {
        if (password === 'stem2026') {
            setIsAuthenticated(true);
        } else {
            alert('Incorrect password');
        }
    };

    // Fetch aggregated data
    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch overall summary
            const { data: overall, error: overallError } = await supabase
                .from('overall_summary')
                .select('*')
                .single();

            if (overallError) throw overallError;
            setOverallSummary(overall);

            // Fetch department summary
            const { data: dept, error: deptError } = await supabase
                .from('stakeholder_summary')
                .select('*')
                .order('department');

            if (deptError) throw deptError;
            setDepartmentSummary(dept || []);

            // Fetch raw observations for export
            const { data: raw, error: rawError } = await supabase
                .from('observations')
                .select('*')
                .order('observed_at', { ascending: false })
                .limit(100);

            if (rawError) throw rawError;
            setRawObservations(raw || []);
        } catch (err) {
            console.error('Error fetching data:', err);
        } finally {
            setLoading(false);
        }
    };

    // Export to CSV
    const exportToCSV = () => {
        const headers = [
            'Date', 'Teacher', 'Subject', 'Grade', 'Department', 'School',
            'Objective Visible', 'Teacher Talk %', 'Student Talk %', 'Silence %',
            'Closed Q', 'Open Q', 'Probe Q', 'Avg Wait Time',
            'Formative Methods', 'Verbatim Quotes'
        ];

        const rows = rawObservations.map(obs => {
            const total = obs.time_teacher_talking + obs.time_student_talking + obs.time_silence;
            const teacherPct = total > 0 ? Math.round(obs.time_teacher_talking / total * 100) : 0;
            const studentPct = total > 0 ? Math.round(obs.time_student_talking / total * 100) : 0;
            const silencePct = total > 0 ? Math.round(obs.time_silence / total * 100) : 0;

            return [
                new Date(obs.observed_at).toLocaleDateString(),
                showTeacherNames ? obs.teacher_name : '***',
                obs.subject,
                obs.grade_level,
                obs.department || 'N/A',
                obs.school_name || 'N/A',
                obs.objective_visible ? 'Yes' : 'No',
                teacherPct,
                studentPct,
                silencePct,
                obs.count_q_closed,
                obs.count_q_open,
                obs.count_q_probe,
                obs.avg_wait_time_seconds,
                (obs.formative_methods || []).join('; '),
                (obs.verbatim_quotes || '').replace(/"/g, '""')
            ].map(val => `"${val}"`).join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stem-observations-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-slate-100">
                <div className="glass card max-w-md w-full p-8">
                    <h1 className="text-2xl font-bold text-teal-900 mb-4 text-center">STEM Observation Admin</h1>
                    <p className="text-slate-600 mb-6 text-center">Enter password to access M&E Dashboard</p>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                        placeholder="Enter password"
                        className="input-field mb-4"
                    />
                    <button onClick={handleLogin} className="btn-primary w-full">
                        Access Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="glass sticky top-0 z-20 px-6 py-4">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-teal-700 rounded-lg flex items-center justify-center text-white font-bold text-xl">S</div>
                        <div>
                            <h1 className="font-bold text-xl text-teal-900">M&E Dashboard</h1>
                            <p className="text-xs text-slate-500">STEM Observation Analytics</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowTeacherNames(!showTeacherNames)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${showTeacherNames ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-600'
                                }`}
                        >
                            {showTeacherNames ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            {showTeacherNames ? 'Names Visible' : 'Names Hidden'}
                        </button>
                        <button
                            onClick={fetchData}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800"
                        >
                            <Download className="w-4 h-4" />
                            Export CSV
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6 space-y-6">
                {/* KPI Cards */}
                {overallSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass card p-4">
                            <div className="flex items-center gap-2 text-slate-600 mb-2">
                                <BarChart3 className="w-5 h-5" />
                                <span className="text-sm">Total Observations</span>
                            </div>
                            <div className="text-3xl font-bold text-teal-700">{overallSummary.total_observations}</div>
                            <div className="text-xs text-slate-500">{Math.round(overallSummary.total_minutes_observed)} mins observed</div>
                        </div>
                        <div className="glass card p-4">
                            <div className="flex items-center gap-2 text-slate-600 mb-2">
                                <TrendingUp className="w-5 h-5" />
                                <span className="text-sm">Teacher Talk</span>
                            </div>
                            <div className="text-3xl font-bold text-blue-600">{overallSummary.avg_teacher_talk_pct}%</div>
                            <div className="text-xs text-slate-500">vs {overallSummary.avg_student_talk_pct}% student</div>
                        </div>
                        <div className="glass card p-4">
                            <div className="flex items-center gap-2 text-slate-600 mb-2">
                                <BookOpen className="w-5 h-5" />
                                <span className="text-sm">Objectives Visible</span>
                            </div>
                            <div className="text-3xl font-bold text-green-600">{overallSummary.pct_objective_visible}%</div>
                            <div className="text-xs text-slate-500">of classrooms</div>
                        </div>
                        <div className="glass card p-4">
                            <div className="flex items-center gap-2 text-slate-600 mb-2">
                                <Clock className="w-5 h-5" />
                                <span className="text-sm">Avg Wait Time</span>
                            </div>
                            <div className="text-3xl font-bold text-orange-600">{overallSummary.overall_avg_wait_time}s</div>
                            <div className="text-xs text-slate-500">after questions</div>
                        </div>
                    </div>
                )}

                {/* Question Types Summary */}
                {overallSummary && (
                    <div className="glass card p-6">
                        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-teal-700" />
                            Question Types Breakdown
                        </h2>
                        <div className="grid grid-cols-3 gap-6">
                            <div className="text-center p-4 bg-blue-50 rounded-xl">
                                <div className="text-4xl font-bold text-blue-600">{overallSummary.total_closed_questions}</div>
                                <div className="text-sm text-blue-800 mt-1">Closed/Recall</div>
                                <div className="text-xs text-blue-500">(What/Who)</div>
                            </div>
                            <div className="text-center p-4 bg-teal-50 rounded-xl">
                                <div className="text-4xl font-bold text-teal-600">{overallSummary.total_open_questions}</div>
                                <div className="text-sm text-teal-800 mt-1">Open/Explain</div>
                                <div className="text-xs text-teal-500">(Why/How)</div>
                            </div>
                            <div className="text-center p-4 bg-purple-50 rounded-xl">
                                <div className="text-4xl font-bold text-purple-600">{overallSummary.total_probe_questions}</div>
                                <div className="text-sm text-purple-800 mt-1">Probe Questions</div>
                                <div className="text-xs text-purple-500">("How do you know?")</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Department Breakdown */}
                <div className="glass card p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Users className="w-5 h-5 text-teal-700" />
                        Department Summary
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="text-left text-sm text-slate-500 border-b border-slate-200">
                                    <th className="pb-3">Department</th>
                                    <th className="pb-3">School</th>
                                    <th className="pb-3 text-center">Obs</th>
                                    <th className="pb-3 text-center">Teacher Talk %</th>
                                    <th className="pb-3 text-center">Student Talk %</th>
                                    <th className="pb-3 text-center">Closed Q</th>
                                    <th className="pb-3 text-center">Open Q</th>
                                    <th className="pb-3 text-center">Obj. Visible %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {departmentSummary.map((dept, idx) => (
                                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                        <td className="py-3 font-medium text-slate-800">{dept.department}</td>
                                        <td className="py-3 text-slate-600">{dept.school_name || '-'}</td>
                                        <td className="py-3 text-center text-slate-600">{dept.total_observations}</td>
                                        <td className="py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${dept.avg_teacher_talk_pct > 60 ? 'bg-red-100 text-red-700' :
                                                    dept.avg_teacher_talk_pct > 40 ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-green-100 text-green-700'
                                                }`}>
                                                {dept.avg_teacher_talk_pct}%
                                            </span>
                                        </td>
                                        <td className="py-3 text-center text-slate-600">{dept.avg_student_talk_pct}%</td>
                                        <td className="py-3 text-center text-blue-600">{dept.total_closed_questions}</td>
                                        <td className="py-3 text-center text-teal-600">{dept.total_open_questions}</td>
                                        <td className="py-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${dept.pct_objective_visible >= 80 ? 'bg-green-100 text-green-700' :
                                                    dept.pct_objective_visible >= 50 ? 'bg-yellow-100 text-yellow-700' :
                                                        'bg-red-100 text-red-700'
                                                }`}>
                                                {dept.pct_objective_visible}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                                {departmentSummary.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="py-8 text-center text-slate-500">
                                            No department data yet. Observations will appear here once submitted.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Recent Observations */}
                <div className="glass card p-6">
                    <h2 className="text-lg font-bold text-slate-800 mb-4">Recent Observations</h2>
                    <div className="space-y-3">
                        {rawObservations.slice(0, 10).map((obs) => (
                            <div key={obs.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div>
                                    <div className="font-medium text-slate-800">
                                        {showTeacherNames ? obs.teacher_name : '***'}
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        {obs.subject} • {obs.grade_level} • {obs.department || 'No Dept'}
                                    </div>
                                </div>
                                <div className="text-right text-sm">
                                    <div className="text-slate-600">
                                        {new Date(obs.observed_at).toLocaleDateString()}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                        {obs.count_q_closed + obs.count_q_open + obs.count_q_probe} questions
                                    </div>
                                </div>
                            </div>
                        ))}
                        {rawObservations.length === 0 && (
                            <p className="text-center text-slate-500 py-8">
                                No observations yet. Start collecting data!
                            </p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
