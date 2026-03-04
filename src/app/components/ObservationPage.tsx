'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Play,
    Square,
    MessageCircle,
    Clock,
    Undo2,
    WifiOff,
    CheckCircle,
    AlertCircle,
    ChevronLeft
} from 'lucide-react';

// Types for observation data
interface ObservationData {
    teacher_name: string;
    subject: string;
    grade_level: string;
    observed_at: string;

    // Domain 1 & 2: Quick Checks
    objective_visible: boolean;
    student_whisper_check: string;

    // Timers (Stored in total seconds)
    total_duration_seconds: number;
    time_teacher_talking: number;
    time_student_talking: number;
    time_silence: number;
    avg_wait_time_seconds: number;

    // Teacher Question Tallies
    count_q_closed: number;
    count_q_open: number;
    count_q_probe: number;

    // Student Response Tallies
    count_resp_short: number;
    count_resp_extended: number;
    count_resp_peer: number;

    // Environment & Language
    count_code_switching: number;

    // Qualitative Data
    formative_methods: string[];
    verbatim_quotes: string;

    // M&E Grouping
    department: string;
    school_name: string;
}

// History entry for undo
interface HistoryEntry {
    type: string;
    value: number;
    previousValue: number;
}

// Predefined options - Primary only (Years 1-6)
const subjects = ['Mathematics', 'Science', 'English', 'Malay', 'Chinese', 'Art', 'Music', 'PE', 'Integrated'];
const gradeLevels = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'];
const formativeTags = ['Hands Up', 'Cold Call', 'Turn & Talk', 'Whiteboards', 'Think-Pair-Share', 'Choral Response'];
const departments = ['Science', 'Mathematics', 'English', 'Malay', 'Chinese', 'ICT', 'Art', 'Music', 'PE', 'Integrated'];
const schools = ["St. Augustine's", "St. Bartholomew", 'SK Nanga Ajau', 'SK Nanga Spak'];

export function ObservationPage({ observerName, onBack }: { observerName: string; onBack: () => void }) {
    // Context state
    const [teacherName, setTeacherName] = useState('');
    const [subject, setSubject] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');

    // M&E Grouping
    const [department, setDepartment] = useState('');
    const [schoolName, setSchoolName] = useState('');

    // Domain 1 & 2: Quick Checks
    const [objectiveVisible, setObjectiveVisible] = useState(false);
    const [studentWhisperCheck, setStudentWhisperCheck] = useState<'None' | 'Task' | 'Concept' | ''>('');

    // Observation active state
    const [isObserving, setIsObserving] = useState(false);
    const [masterTimer, setMasterTimer] = useState(0);
    const [masterInterval, setMasterInterval] = useState<NodeJS.Timeout | null>(null);

    // Talk time tracker state
    const [activeTalkState, setActiveTalkState] = useState<'teacher' | 'silence' | 'student' | null>(null);
    const [timeTeacherTalking, setTimeTeacherTalking] = useState(0);
    const [timeStudentTalking, setTimeStudentTalking] = useState(0);
    const [timeSilence, setTimeSilence] = useState(0);

    // Talk time interval refs
    const talkTimeInterval = useRef<NodeJS.Timeout | null>(null);

    // Teacher questions
    const [qClosed, setQClosed] = useState(0);
    const [qOpen, setQOpen] = useState(0);
    const [qProbe, setQProbe] = useState(0);

    // Student responses
    const [respShort, setRespShort] = useState(0);
    const [respExtended, setRespExtended] = useState(0);
    const [respPeer, setRespPeer] = useState(0);

    // Environment
    const [codeSwitching, setCodeSwitching] = useState(0);
    const [waitTimes, setWaitTimes] = useState<number[]>([]);
    const [isHoldingWaitTime, setIsHoldingWaitTime] = useState(false);
    const waitTimeStartRef = useRef<number | null>(null);

    // Qualitative evidence
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [verbatimQuotes, setVerbatimQuotes] = useState('');

    // Undo history
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [offlineMode, setOfflineMode] = useState(false);

    // Check network status
    useEffect(() => {
        const handleOnline = () => setOfflineMode(false);
        const handleOffline = () => setOfflineMode(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        if (!navigator.onLine) setOfflineMode(true);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    // Master timer - runs for 15 minutes max
    useEffect(() => {
        if (isObserving && masterTimer < 900) {
            const interval = setInterval(() => {
                setMasterTimer(prev => prev + 1);
            }, 1000);
            setMasterInterval(interval);
            return () => clearInterval(interval);
        } else if (masterTimer >= 900) {
            handleStopObservation();
        }
    }, [isObserving]);

    // Talk time tracker - updates every second
    useEffect(() => {
        if (isObserving && activeTalkState) {
            talkTimeInterval.current = setInterval(() => {
                if (activeTalkState === 'teacher') {
                    setTimeTeacherTalking(prev => prev + 1);
                } else if (activeTalkState === 'student') {
                    setTimeStudentTalking(prev => prev + 1);
                } else if (activeTalkState === 'silence') {
                    setTimeSilence(prev => prev + 1);
                }
            }, 1000);
            return () => {
                if (talkTimeInterval.current) clearInterval(talkTimeInterval.current);
            };
        }
    }, [isObserving, activeTalkState]);

    // Calculate average wait time
    const avgWaitTime = waitTimes.length > 0
        ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
        : 0;

    // Format time helper
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Add to history for undo
    const addToHistory = (type: string, value: number, previousValue: number) => {
        setHistory(prev => [...prev.slice(-9), { type, value, previousValue }]); // Keep last 10
    };

    // Undo last action
    const handleUndo = () => {
        if (history.length === 0) return;

        const last = history[history.length - 1];
        setHistory(prev => prev.slice(0, -1));

        switch (last.type) {
            case 'qClosed': setQClosed(last.previousValue); break;
            case 'qOpen': setQOpen(last.previousValue); break;
            case 'qProbe': setQProbe(last.previousValue); break;
            case 'respShort': setRespShort(last.previousValue); break;
            case 'respExtended': setRespExtended(last.previousValue); break;
            case 'respPeer': setRespPeer(last.previousValue); break;
            case 'codeSwitching': setCodeSwitching(last.previousValue); break;
        }
    };

    // Increment handlers with undo support
    const incrementQClosed = () => {
        addToHistory('qClosed', qClosed + 1, qClosed);
        setQClosed(prev => prev + 1);
    };
    const incrementQOpen = () => {
        addToHistory('qOpen', qOpen + 1, qOpen);
        setQOpen(prev => prev + 1);
    };
    const incrementQProbe = () => {
        addToHistory('qProbe', qProbe + 1, qProbe);
        setQProbe(prev => prev + 1);
    };
    const incrementRespShort = () => {
        addToHistory('respShort', respShort + 1, respShort);
        setRespShort(prev => prev + 1);
    };
    const incrementRespExtended = () => {
        addToHistory('respExtended', respExtended + 1, respExtended);
        setRespExtended(prev => prev + 1);
    };
    const incrementRespPeer = () => {
        addToHistory('respPeer', respPeer + 1, respPeer);
        setRespPeer(prev => prev + 1);
    };
    const incrementCodeSwitching = () => {
        addToHistory('codeSwitching', codeSwitching + 1, codeSwitching);
        setCodeSwitching(prev => prev + 1);
    };

    // Start observation
    const handleStartObservation = () => {
        if (!teacherName || !subject || !gradeLevel) {
            alert('Please fill in Teacher Name, Subject, and Grade Level');
            return;
        }
        setIsObserving(true);
        setMasterTimer(0);
        setHistory([]);
    };

    // Stop observation
    const handleStopObservation = () => {
        setIsObserving(false);
        setActiveTalkState(null);
        if (masterInterval) clearInterval(masterInterval);
        if (talkTimeInterval.current) clearInterval(talkTimeInterval.current);
    };

    // Wait time hold handlers
    const handleWaitTimeStart = () => {
        waitTimeStartRef.current = Date.now();
        setIsHoldingWaitTime(true);
    };

    const handleWaitTimeEnd = () => {
        if (waitTimeStartRef.current) {
            const elapsed = (Date.now() - waitTimeStartRef.current) / 1000;
            setWaitTimes(prev => [...prev, elapsed]);
            waitTimeStartRef.current = null;
        }
        setIsHoldingWaitTime(false);
    };

    // Toggle formative tag
    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    // Save to localStorage for offline
    const saveToLocalStorage = (data: ObservationData) => {
        const pending = JSON.parse(localStorage.getItem('pending_observations') || '[]');
        pending.push({ ...data, savedAt: new Date().toISOString() });
        localStorage.setItem('pending_observations', JSON.stringify(pending));
    };

    // Attempt to sync pending observations
    const syncPendingObservations = async () => {
        const pending = JSON.parse(localStorage.getItem('pending_observations') || '[]');
        if (pending.length === 0) return;

        const remaining: any[] = [];
        for (const obs of pending) {
            try {
                const { error } = await supabase.from('observations').insert(obs);
                if (error) throw error;
            } catch {
                remaining.push(obs);
            }
        }
        localStorage.setItem('pending_observations', JSON.stringify(remaining));
    };

    // Try to sync on mount if online
    useEffect(() => {
        if (navigator.onLine) {
            syncPendingObservations();
        }
    }, []);

    // Submit observation
    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        const observationData: ObservationData = {
            teacher_name: teacherName,
            subject,
            grade_level: gradeLevel,
            observed_at: new Date().toISOString(),

            // Domain 1 & 2
            objective_visible: objectiveVisible,
            student_whisper_check: studentWhisperCheck,

            // Timers
            total_duration_seconds: masterTimer,
            time_teacher_talking: timeTeacherTalking,
            time_student_talking: timeStudentTalking,
            time_silence: timeSilence,
            avg_wait_time_seconds: Math.round(avgWaitTime * 100) / 100,

            // Teacher Questions
            count_q_closed: qClosed,
            count_q_open: qOpen,
            count_q_probe: qProbe,

            // Student Responses
            count_resp_short: respShort,
            count_resp_extended: respExtended,
            count_resp_peer: respPeer,

            // Environment
            count_code_switching: codeSwitching,

            // Qualitative
            formative_methods: selectedTags,
            verbatim_quotes: verbatimQuotes,

            // M&E Grouping
            department,
            school_name: schoolName,
        };

        // Check if online
        if (!navigator.onLine) {
            saveToLocalStorage(observationData);
            setOfflineMode(true);
            setSubmitSuccess(true);
            setIsSubmitting(false);
            return;
        }

        try {
            const { error } = await supabase
                .from('observations')
                .insert(observationData);

            if (error) throw error;

            // Try to sync any pending
            await syncPendingObservations();

            setSubmitSuccess(true);
        } catch (err: any) {
            console.error('Error submitting:', err);
            // Try to save locally on error
            saveToLocalStorage(observationData);
            setSubmitError('Saved offline. Will sync when connected.');
            setSubmitSuccess(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reset form
    const handleReset = () => {
        setTeacherName('');
        setSubject('');
        setGradeLevel('');
        setDepartment('');
        setSchoolName('');
        setObjectiveVisible(false);
        setStudentWhisperCheck('');
        setIsObserving(false);
        setMasterTimer(0);
        setActiveTalkState(null);
        setTimeTeacherTalking(0);
        setTimeStudentTalking(0);
        setTimeSilence(0);
        setQClosed(0);
        setQOpen(0);
        setQProbe(0);
        setRespShort(0);
        setRespExtended(0);
        setRespPeer(0);
        setCodeSwitching(0);
        setWaitTimes([]);
        setSelectedTags([]);
        setVerbatimQuotes('');
        setHistory([]);
        setSubmitSuccess(false);
        setSubmitError(null);
        setOfflineMode(false);
        if (masterInterval) clearInterval(masterInterval);
        if (talkTimeInterval.current) clearInterval(talkTimeInterval.current);
    };

    // Success screen
    if (submitSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
                <div className="glass card max-w-md w-full text-center animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        {offlineMode ? <WifiOff className="w-10 h-10 text-orange-500" /> : <CheckCircle className="w-10 h-10 text-green-600" />}
                    </div>
                    <h2 className="text-2xl font-bold text-teal-900 mb-2">
                        {offlineMode ? 'Saved Offline!' : 'Observation Saved!'}
                    </h2>
                    <p className="text-slate-600 mb-8">
                        {masterTimer > 0 ? `Recorded ${formatTime(masterTimer)} of observation data` : 'Observation data has been saved'}
                        {offlineMode && ' - Will sync when connected'}
                    </p>
                    <button onClick={handleReset} className="btn-primary w-full">
                        New Observation
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-28">
            {/* Header - Context Section */}
            <header className="glass sticky top-0 z-20 px-4 py-4">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <button onClick={onBack} className="flex items-center gap-1 text-slate-600 hover:text-teal-700">
                            <ChevronLeft className="w-5 h-5" />
                            <span>Exit</span>
                        </button>
                        <div className="flex items-center gap-2">
                            {offlineMode && (
                                <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
                                    <WifiOff className="w-3 h-3" />
                                    Offline
                                </span>
                            )}
                            <div className="text-sm font-medium text-slate-500">
                                <span className="text-teal-700">{observerName}</span>
                            </div>
                        </div>
                    </div>

                    {!isObserving ? (
                        <div className="space-y-4">
                            {/* Domain 1: Learning Objective Check */}
                            <div className="bg-blue-50 rounded-xl p-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-slate-700">Objective Visible on Board?</span>
                                    <button
                                        onClick={() => setObjectiveVisible(!objectiveVisible)}
                                        className={`w-16 h-8 rounded-full transition-all ${objectiveVisible ? 'bg-teal-600' : 'bg-slate-300'
                                            }`}
                                    >
                                        <div className={`w-6 h-6 bg-white rounded-full shadow transform transition-transform ${objectiveVisible ? 'translate-x-9' : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                            </div>

                            {/* Domain 2: Student Understanding Check */}
                            <div className="bg-green-50 rounded-xl p-4">
                                <div className="text-sm font-medium text-slate-700 mb-3">
                                    Ask student: "What are you learning?"
                                </div>
                                <div className="flex gap-2">
                                    {(['None', 'Task', 'Concept'] as const).map((option) => (
                                        <button
                                            key={option}
                                            onClick={() => setStudentWhisperCheck(option)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${studentWhisperCheck === option
                                                ? option === 'None' ? 'bg-red-500 text-white'
                                                    : option === 'Task' ? 'bg-yellow-500 text-white'
                                                        : 'bg-green-500 text-white'
                                                : 'bg-white text-slate-600 hover:bg-slate-100'
                                                }`}
                                        >
                                            {option === 'None' ? "Couldn't Explain"
                                                : option === 'Task' ? 'Explained Task'
                                                    : 'Explained Concept'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Teacher Name</label>
                                    <input
                                        type="text"
                                        value={teacherName}
                                        onChange={(e) => setTeacherName(e.target.value)}
                                        placeholder="Enter name"
                                        className="input-field text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Subject</label>
                                    <select
                                        value={subject}
                                        onChange={(e) => setSubject(e.target.value)}
                                        className="input-field text-sm"
                                    >
                                        <option value="">Select</option>
                                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Grade Level</label>
                                    <select
                                        value={gradeLevel}
                                        onChange={(e) => setGradeLevel(e.target.value)}
                                        className="input-field text-sm"
                                    >
                                        <option value="">Select</option>
                                        {gradeLevels.map(g => <option key={g} value={g}>{g}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Department & School for M&E */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Department</label>
                                    <select
                                        value={department}
                                        onChange={(e) => setDepartment(e.target.value)}
                                        className="input-field text-sm"
                                    >
                                        <option value="">Select</option>
                                        {departments.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">School</label>
                                    <select
                                        value={schoolName}
                                        onChange={(e) => setSchoolName(e.target.value)}
                                        className="input-field text-sm"
                                    >
                                        <option value="">Select</option>
                                        {schools.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="text-sm flex flex-wrap items-center gap-1">
                                <span className="font-semibold text-cyan-900">{teacherName}</span>
                                <span className="text-slate-400 hidden sm:inline">•</span>
                                <span className="text-slate-600">{subject}</span>
                                <span className="text-slate-400 hidden sm:inline">•</span>
                                <span className="text-slate-600">{gradeLevel}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Undo Button */}
                                {history.length > 0 && (
                                    <button
                                        onClick={handleUndo}
                                        className="flex items-center gap-1 px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-full text-sm text-slate-700"
                                    >
                                        <Undo2 className="w-4 h-4" />
                                        <span className="hidden sm:inline">Undo</span>
                                    </button>
                                )}
                                <div className="text-xl sm:text-2xl font-mono font-bold text-cyan-700 timer-display">
                                    {formatTime(masterTimer)}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24">
                {/* Start/Stop Button */}
                {!isObserving ? (
                    <button
                        onClick={handleStartObservation}
                        className="w-full py-6 bg-teal-700 hover:bg-teal-800 text-white text-xl font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                        <Play className="w-6 h-6" />
                        Start 15-Min Observation
                    </button>
                ) : (
                    <button
                        onClick={handleStopObservation}
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white text-lg font-bold rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-all active:scale-95"
                    >
                        <Square className="w-5 h-5" />
                        End Observation
                    </button>
                )}

                {/* Section 1: Talk-Time Tracker */}
                <section className="glass card">
                    <h3 className="section-header">
                        <Clock className="w-5 h-5 text-cyan-600" />
                        Talk-Time Tracker
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <button
                            onClick={() => setActiveTalkState('teacher')}
                            disabled={!isObserving}
                            className={`py-6 rounded-xl text-center transition-all active:scale-95 ${activeTalkState === 'teacher'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                                } ${!isObserving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="text-3xl mb-1">🗣️</div>
                            <div className="font-bold">Teacher Talk</div>
                            <div className="text-sm opacity-80">{formatTime(timeTeacherTalking)}</div>
                        </button>
                        <button
                            onClick={() => setActiveTalkState('silence')}
                            disabled={!isObserving}
                            className={`py-6 rounded-xl text-center transition-all active:scale-95 ${activeTalkState === 'silence'
                                ? 'bg-orange-500 text-white shadow-lg'
                                : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
                                } ${!isObserving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="text-3xl mb-1">⏳</div>
                            <div className="font-bold">Silence/Work</div>
                            <div className="text-sm opacity-80">{formatTime(timeSilence)}</div>
                        </button>
                        <button
                            onClick={() => setActiveTalkState('student')}
                            disabled={!isObserving}
                            className={`py-6 rounded-xl text-center transition-all active:scale-95 ${activeTalkState === 'student'
                                ? 'bg-green-600 text-white shadow-lg'
                                : 'bg-green-50 text-green-800 hover:bg-green-100'
                                } ${!isObserving ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <div className="text-3xl mb-1">💬</div>
                            <div className="font-bold">Student Talk</div>
                            <div className="text-sm opacity-80">{formatTime(timeStudentTalking)}</div>
                        </button>
                    </div>
                </section>

                {/* Section 2: Action Board */}
                {isObserving && (
                    <>
                        {/* Group A: Teacher Questions */}
                        <section className="glass card">
                            <h3 className="section-header">
                                <span className="w-3 h-3 bg-blue-600 rounded-full"></span>
                                Teacher Questions
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    onClick={incrementQClosed}
                                    className="py-5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-center transition-all active:scale-95"
                                >
                                    <div className="font-bold text-sm mb-1">+1 Closed/Recall</div>
                                    <div className="text-xs opacity-70">(What/Who)</div>
                                    <div className="text-2xl font-bold text-blue-600 mt-2">{qClosed}</div>
                                </button>
                                <button
                                    onClick={incrementQOpen}
                                    className="py-5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-center transition-all active:scale-95"
                                >
                                    <div className="font-bold text-sm mb-1">+1 Open/Explain</div>
                                    <div className="text-xs opacity-70">(Why/How)</div>
                                    <div className="text-2xl font-bold text-blue-600 mt-2">{qOpen}</div>
                                </button>
                                <button
                                    onClick={incrementQProbe}
                                    className="py-5 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-center transition-all active:scale-95"
                                >
                                    <div className="font-bold text-sm mb-1">+1 Probe</div>
                                    <div className="text-xs opacity-70">("How do you know?")</div>
                                    <div className="text-2xl font-bold text-blue-600 mt-2">{qProbe}</div>
                                </button>
                            </div>
                        </section>

                        {/* Group B: Student Responses */}
                        <section className="glass card">
                            <h3 className="section-header">
                                <span className="w-3 h-3 bg-green-600 rounded-full"></span>
                                Student Responses
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <button
                                    onClick={incrementRespShort}
                                    className="py-5 bg-green-50 hover:bg-green-100 text-green-800 rounded-xl text-center transition-all active:scale-95"
                                >
                                    <div className="font-bold text-sm mb-1">+1 Short Answer</div>
                                    <div className="text-xs opacity-70">(1-2 words)</div>
                                    <div className="text-2xl font-bold text-green-600 mt-2">{respShort}</div>
                                </button>
                                <button
                                    onClick={incrementRespExtended}
                                    className="py-5 bg-green-50 hover:bg-green-100 text-green-800 rounded-xl text-center transition-all active:scale-95"
                                >
                                    <div className="font-bold text-sm mb-1">+1 Academic Sentence</div>
                                    <div className="text-xs opacity-70">(Extended answer)</div>
                                    <div className="text-2xl font-bold text-green-600 mt-2">{respExtended}</div>
                                </button>
                                <button
                                    onClick={incrementRespPeer}
                                    className="py-5 bg-green-50 hover:bg-green-100 text-green-800 rounded-xl text-center transition-all active:scale-95"
                                >
                                    <div className="font-bold text-sm mb-1">+1 Peer-to-Peer</div>
                                    <div className="text-xs opacity-70">(Student → Student)</div>
                                    <div className="text-2xl font-bold text-green-600 mt-2">{respPeer}</div>
                                </button>
                            </div>
                        </section>

                        {/* Group C: Wait Time & Environment */}
                        <section className="glass card">
                            <h3 className="section-header">
                                <span className="w-3 h-3 bg-orange-500 rounded-full"></span>
                                Wait Time & Environment
                            </h3>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={incrementCodeSwitching}
                                        className="py-4 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-xl text-center transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <div className="text-left">
                                            <div className="font-bold">+1 Code-Switch</div>
                                            <div className="text-xs opacity-70">EN↔MS</div>
                                        </div>
                                        <div className="text-2xl font-bold text-orange-600">{codeSwitching}</div>
                                    </button>
                                    <div className="py-4 bg-slate-100 rounded-xl text-center">
                                        <div className="text-sm text-slate-600 mb-1">Avg Wait Time</div>
                                        <div className="text-2xl font-bold text-slate-800">{avgWaitTime.toFixed(1)}s</div>
                                        <div className="text-xs text-slate-500">{waitTimes.length} samples</div>
                                    </div>
                                </div>

                                {/* Wait Time Hold Button */}
                                <button
                                    onMouseDown={handleWaitTimeStart}
                                    onMouseUp={handleWaitTimeEnd}
                                    onMouseLeave={() => isHoldingWaitTime && handleWaitTimeEnd()}
                                    onTouchStart={handleWaitTimeStart}
                                    onTouchEnd={handleWaitTimeEnd}
                                    className={`w-full py-6 rounded-xl text-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-3 ${isHoldingWaitTime
                                        ? 'bg-orange-600 text-white shadow-lg animate-pulse'
                                        : 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                                        }`}
                                >
                                    <Clock className="w-6 h-6" />
                                    {isHoldingWaitTime ? 'Release when someone speaks...' : 'Hold for Wait Time'}
                                </button>
                            </div>
                        </section>
                    </>
                )}

                {/* Section 3: Qualitative Evidence */}
                {isObserving && (
                    <section className="glass card">
                        <h3 className="section-header">
                            <MessageCircle className="w-5 h-5 text-cyan-600" />
                            Qualitative Evidence
                        </h3>

                        {/* Formative Tags */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-600 mb-2">Formative Methods Observed</label>
                            <div className="flex flex-wrap gap-2">
                                {formativeTags.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => toggleTag(tag)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedTags.includes(tag)
                                            ? 'bg-teal-700 text-white shadow-md'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Verbatim Quotes */}
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">
                                Exact Quotes
                                <span className="font-normal text-slate-400 ml-2">(Use keyboard mic to dictate)</span>
                            </label>
                            <textarea
                                value={verbatimQuotes}
                                onChange={(e) => setVerbatimQuotes(e.target.value)}
                                placeholder="Type or dictate notable quotes here..."
                                className="input-field min-h-[100px] resize-none"
                            />
                        </div>
                    </section>
                )}

                {/* Submit Button */}
                {isObserving && masterTimer > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-sm border-t border-slate-200">
                        <div className="max-w-4xl mx-auto">
                            {submitError && (
                                <div className="mb-3 p-3 bg-orange-50 text-orange-700 rounded-lg flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    {submitError}
                                </div>
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="w-full py-4 bg-teal-700 hover:bg-teal-800 disabled:bg-slate-400 text-white text-lg font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all"
                            >
                                {isSubmitting ? (
                                    <>Submitting...</>
                                ) : (
                                    <>
                                        End & Submit to Database
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
