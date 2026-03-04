'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { cn } from '@/utils/classnames';

// Types for observation data - matches database schema
interface ObservationData {
    teacher_name: string;
    subject: string;
    grade_level: string;
    observed_at: string;
    observer_name: string;  // Who made the observation

    // Domain 1 & 2: Quick Checks
    objective_visible: boolean;
    objective_concept: string;
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

    // Qualitative Data - JSONB in database
    formative_methods_count: Record<string, number>;
    verbatim_quotes: string;

    // M&E Grouping
    school_name: string;
}

// History entry for undo
interface HistoryEntry {
    type: string;
    value: number;
    previousValue: number;
}

// Constants moved outside component to avoid recreation on every render
const SUBJECTS = ['Mathematics', 'Science', 'English', 'Malay', 'Chinese', 'Art', 'Music', 'PE', 'Integrated'] as const;
const GRADE_LEVELS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'] as const;
const FORMATIVE_TAGS = ['Hands Up', 'Cold Call', 'Turn & Talk', 'Whiteboards', 'Think-Pair-Share', 'Choral Response'] as const;
const SCHOOLS = ["St. Augustine's", "St. Bartholomew", 'SK Nanga Ajau', 'SK Nanga Spak'] as const;

// Understanding options constants
const UNDERSTANDING_OPTIONS = [
    { value: 'None', label: "Couldn't Explain" },
    { value: 'Task', label: 'Explained Task' },
    { value: 'Concept', label: 'Explained Concept' }
] as const;

type UnderstandingValue = 'None' | 'Task' | 'Concept' | '';

interface ObservationPageProps {
    observerName: string;
    onBack: () => void;
}

export function ObservationPage({ observerName, onBack }: ObservationPageProps) {
    // Context state
    const [teacherName, setTeacherName] = useState('');
    const [subject, setSubject] = useState('');
    const [gradeLevel, setGradeLevel] = useState('');
    const [schoolName, setSchoolName] = useState('');

    // Domain 1: Learning Objective Check
    const [objectiveClear, setObjectiveClear] = useState(false);
    const [keyConcept, setKeyConcept] = useState('');

    // Domain 2: Student Understanding Check
    const [studentUnderstanding, setStudentUnderstanding] = useState<UnderstandingValue>('');

    // Observation active state
    const [isObserving, setIsObserving] = useState(false);
    const [masterTimer, setMasterTimer] = useState(0);
    const [masterInterval, setMasterInterval] = useState<NodeJS.Timeout | null>(null);

    // Talk time tracker state
    const [activeTalkState, setActiveTalkState] = useState<'teacher' | 'silence' | 'student' | null>(null);
    const [timeTeacherTalking, setTimeTeacherTalking] = useState(0);
    const [timeStudentTalking, setTimeStudentTalking] = useState(0);
    const [timeSilence, setTimeSilence] = useState(0);

    // Talk time interval ref
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

    // Formative method counters - changed from selectedTags to individual counts
    const [formativeCounts, setFormativeCounts] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        FORMATIVE_TAGS.forEach(tag => initial[tag] = 0);
        return initial;
    });

    // Qualitative evidence
    const [verbatimQuotes, setVerbatimQuotes] = useState('');

    // Undo history
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // Submission state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [offlineMode, setOfflineMode] = useState(false);

    // Draft save indicator
    const [lastSaved, setLastSaved] = useState<Date | null>(null);

    // LocalStorage key for this observer
    const draftKey = useMemo(() => `observation_draft_${observerName.replace(/\s+/g, '_')}`, [observerName]);

    // Start master timer immediately when component mounts
    useEffect(() => {
        const interval = setInterval(() => {
            setMasterTimer(prev => {
                if (prev >= 900) {
                    // Auto-stop at 15 minutes
                    return prev;
                }
                return prev + 1;
            });
        }, 1000);
        setMasterInterval(interval);

        return () => clearInterval(interval);
    }, []);

    // Memoized callbacks
    const handleStopObservation = useCallback(() => {
        setIsObserving(false);
        setActiveTalkState(null);
        if (talkTimeInterval.current) clearInterval(talkTimeInterval.current);
    }, []);

    const clearDraft = useCallback(() => {
        try {
            localStorage.removeItem(draftKey);
            setLastSaved(null);
        } catch (e) {
            console.error('Failed to clear draft:', e);
        }
    }, [draftKey]);

    // Toggle talk state - clicking the same button toggles it off
    const toggleTalkState = useCallback((state: 'teacher' | 'silence' | 'student') => {
        setActiveTalkState(prev => prev === state ? null : state);
    }, []);

    // Load draft from localStorage on mount
    useEffect(() => {
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const draft = JSON.parse(savedDraft);
                setTeacherName(draft.teacherName || '');
                setSubject(draft.subject || '');
                setGradeLevel(draft.gradeLevel || '');
                setSchoolName(draft.schoolName || '');
                setObjectiveClear(draft.objectiveClear || false);
                setKeyConcept(draft.keyConcept || '');
                setStudentUnderstanding(draft.studentUnderstanding || '');
                setTimeTeacherTalking(draft.timeTeacherTalking || 0);
                setTimeStudentTalking(draft.timeStudentTalking || 0);
                setTimeSilence(draft.timeSilence || 0);
                setQClosed(draft.qClosed || 0);
                setQOpen(draft.qOpen || 0);
                setQProbe(draft.qProbe || 0);
                setRespShort(draft.respShort || 0);
                setRespExtended(draft.respExtended || 0);
                setRespPeer(draft.respPeer || 0);
                setCodeSwitching(draft.codeSwitching || 0);
                setWaitTimes(draft.waitTimes || []);
                setFormativeCounts(draft.formativeCounts || {});
                setVerbatimQuotes(draft.verbatimQuotes || '');
                // Don't restore masterTimer - it starts fresh each time
                if (draft.lastSaved) {
                    setLastSaved(new Date(draft.lastSaved));
                }
            }
        } catch (e) {
            console.error('Failed to load draft:', e);
        }
    }, [draftKey]);

    // Auto-save draft to localStorage whenever data changes
    useEffect(() => {
        if (!isObserving && !teacherName && !subject) return; // Don't save empty drafts

        const draft = {
            teacherName,
            subject,
            gradeLevel,
            schoolName,
            objectiveClear,
            keyConcept,
            studentUnderstanding,
            timeTeacherTalking,
            timeStudentTalking,
            timeSilence,
            qClosed,
            qOpen,
            qProbe,
            respShort,
            respExtended,
            respPeer,
            codeSwitching,
            waitTimes,
            formativeCounts,
            verbatimQuotes,
            // Don't save masterTimer - it starts fresh each time
            lastSaved: new Date().toISOString()
        };

        try {
            localStorage.setItem(draftKey, JSON.stringify(draft));
            setLastSaved(new Date());
        } catch (e) {
            console.error('Failed to save draft:', e);
        }
    }, [
        teacherName, subject, gradeLevel, schoolName,
        objectiveClear,
        keyConcept,
        studentUnderstanding,
        timeTeacherTalking, timeStudentTalking, timeSilence,
        qClosed, qOpen, qProbe,
        respShort, respExtended, respPeer,
        codeSwitching, waitTimes,
        formativeCounts,
        verbatimQuotes,
        draftKey, isObserving
    ]);

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

    // Talk time tracker - updates every second when state is active
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
    const avgWaitTime = useMemo(() => {
        return waitTimes.length > 0
            ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length
            : 0;
    }, [waitTimes]);

    // Format time helper
    const formatTime = useCallback((seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }, []);

    // Add to history for undo
    const addToHistory = useCallback((type: string, value: number, previousValue: number) => {
        setHistory(prev => [...prev.slice(-9), { type, value, previousValue }]); // Keep last 10
    }, []);

    // Undo last action
    const handleUndo = useCallback(() => {
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
    }, [history]);

    // Increment handlers with undo support
    const incrementQClosed = useCallback(() => {
        addToHistory('qClosed', qClosed + 1, qClosed);
        setQClosed(prev => prev + 1);
    }, [qClosed, addToHistory]);

    const incrementQOpen = useCallback(() => {
        addToHistory('qOpen', qOpen + 1, qOpen);
        setQOpen(prev => prev + 1);
    }, [qOpen, addToHistory]);

    const incrementQProbe = useCallback(() => {
        addToHistory('qProbe', qProbe + 1, qProbe);
        setQProbe(prev => prev + 1);
    }, [qProbe, addToHistory]);

    const incrementRespShort = useCallback(() => {
        addToHistory('respShort', respShort + 1, respShort);
        setRespShort(prev => prev + 1);
    }, [respShort, addToHistory]);

    const incrementRespExtended = useCallback(() => {
        addToHistory('respExtended', respExtended + 1, respExtended);
        setRespExtended(prev => prev + 1);
    }, [respExtended, addToHistory]);

    const incrementRespPeer = useCallback(() => {
        addToHistory('respPeer', respPeer + 1, respPeer);
        setRespPeer(prev => prev + 1);
    }, [respPeer, addToHistory]);

    const incrementCodeSwitching = useCallback(() => {
        addToHistory('codeSwitching', codeSwitching + 1, codeSwitching);
        setCodeSwitching(prev => prev + 1);
    }, [codeSwitching, addToHistory]);

    // Formative method counter increment
    const incrementFormativeTag = useCallback((tag: string) => {
        setFormativeCounts(prev => ({
            ...prev,
            [tag]: (prev[tag] || 0) + 1
        }));
    }, []);

    // Start observation
    const handleStartObservation = useCallback(() => {
        if (!teacherName || !subject || !gradeLevel) {
            alert('Please fill in Teacher Name, Subject, and Grade Level');
            return;
        }
        setIsObserving(true);
        setHistory([]);
    }, [teacherName, subject, gradeLevel]);

    // Wait time hold handlers
    const handleWaitTimeStart = useCallback(() => {
        waitTimeStartRef.current = Date.now();
        setIsHoldingWaitTime(true);
    }, []);

    const handleWaitTimeEnd = useCallback(() => {
        if (waitTimeStartRef.current) {
            const elapsed = (Date.now() - waitTimeStartRef.current) / 1000;
            setWaitTimes(prev => [...prev, elapsed]);
            waitTimeStartRef.current = null;
        }
        setIsHoldingWaitTime(false);
    }, []);

    // Save to localStorage for offline
    const saveToLocalStorage = useCallback((data: ObservationData) => {
        const pending = JSON.parse(localStorage.getItem('pending_observations') || '[]');
        pending.push({ ...data, savedAt: new Date().toISOString() });
        localStorage.setItem('pending_observations', JSON.stringify(pending));
    }, []);

    // Attempt to sync pending observations
    const syncPendingObservations = useCallback(async () => {
        const pending = JSON.parse(localStorage.getItem('pending_observations') || '[]');
        if (pending.length === 0) return;

        const remaining: ObservationData[] = [];
        for (const obs of pending) {
            try {
                const { error } = await supabase.from('observations').insert(obs);
                if (error) throw error;
            } catch {
                remaining.push(obs);
            }
        }
        localStorage.setItem('pending_observations', JSON.stringify(remaining));
    }, []);

    // Try to sync on mount if online
    useEffect(() => {
        if (navigator.onLine) {
            syncPendingObservations();
        }
    }, [syncPendingObservations]);

    // Submit observation
    const handleSubmit = useCallback(async () => {
        setIsSubmitting(true);
        setSubmitError(null);

        const observationData: ObservationData = {
            teacher_name: teacherName,
            subject,
            grade_level: gradeLevel,
            observed_at: new Date().toISOString(),
            observer_name: observerName,  // Track who made this observation

            // Domain 1 & 2
            objective_visible: objectiveClear,
            objective_concept: keyConcept,
            student_whisper_check: studentUnderstanding,

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

            // Qualitative - Changed to counters
            formative_methods_count: formativeCounts,
            verbatim_quotes: verbatimQuotes,

            // M&E Grouping
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
        } catch (err: unknown) {
            console.error('Error submitting:', err);
            // Try to save locally on error
            saveToLocalStorage(observationData);
            setSubmitError('Saved offline. Will sync when connected.');
            setSubmitSuccess(true);
        } finally {
            setIsSubmitting(false);
        }
    }, [
        teacherName, subject, gradeLevel, schoolName,
        objectiveClear, keyConcept, studentUnderstanding,
        masterTimer, timeTeacherTalking, timeStudentTalking, timeSilence, avgWaitTime,
        qClosed, qOpen, qProbe,
        respShort, respExtended, respPeer,
        codeSwitching,
        formativeCounts, verbatimQuotes,
        saveToLocalStorage, syncPendingObservations
    ]);

    // Reset form
    const handleReset = useCallback(() => {
        setTeacherName('');
        setSubject('');
        setGradeLevel('');
        setSchoolName('');
        setObjectiveClear(false);
        setKeyConcept('');
        setStudentUnderstanding('');
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
        setFormativeCounts(() => {
            const initial: Record<string, number> = {};
            FORMATIVE_TAGS.forEach(tag => initial[tag] = 0);
            return initial;
        });
        setVerbatimQuotes('');
        setHistory([]);
        setSubmitSuccess(false);
        setSubmitError(null);
        setOfflineMode(false);
        if (masterInterval) clearInterval(masterInterval);
        if (talkTimeInterval.current) clearInterval(talkTimeInterval.current);
    }, [masterInterval]);

    // Success screen
    if (submitSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
                <div className="card max-w-sm w-full text-center animate-fade-in">
                    <div className="flex justify-center mb-6">
                        <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', offlineMode ? 'bg-amber-50' : 'bg-emerald-50')}>
                            {offlineMode ? <WifiOff className="w-8 h-8 text-amber-600" /> : <CheckCircle className="w-8 h-8 text-emerald-600" />}
                        </div>
                    </div>
                    <h2 className="text-xl font-bold mb-2">
                        {offlineMode ? 'Saved Offline' : 'Observation Saved'}
                    </h2>
                    <p className="text-secondary text-sm mb-6">
                        {masterTimer > 0 ? `Recorded ${formatTime(masterTimer)} of observation` : 'Observation data has been saved'}
                        {offlineMode && ' • Will sync when connected'}
                    </p>
                    <button onClick={handleReset} className="btn btn-primary btn-full">
                        New Observation
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24">
            {/* Header */}
            <header className="header">
                <div className="header-content">
                    <button onClick={onBack} className="btn btn-secondary btn-icon">
                        <ChevronLeft size={18} />
                    </button>

                    <div className="flex items-center gap-3">
                        {offlineMode && (
                            <span className="badge badge-warning">
                                <WifiOff size={12} className="mr-1" />
                                Offline
                            </span>
                        )}
                        <span className="text-sm font-medium text-accent">{observerName}</span>
                    </div>
                </div>
            </header>

            {/* Main content */}
            <main className="container">
                {!isObserving ? (
                    <div className="space-y-4">
                        {/* Start Button */}
                        <button
                            onClick={handleStartObservation}
                            className="btn btn-primary btn-full"
                            style={{ padding: '20px', fontSize: '16px', minHeight: '64px' }}
                        >
                            <Play size={24} />
                            Start 15-Min Observation
                        </button>

                        {/* Domain 1: Learning Objective Check */}
                        <div className="card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="font-semibold mb-1">Learning Objective Visible?</h3>
                                    <p className="text-sm text-muted">Is the learning objective clearly posted?</p>
                                </div>
                                <button
                                    onClick={() => setObjectiveClear(!objectiveClear)}
                                    className={cn('toggle', objectiveClear && 'active')}
                                >
                                    <div className="toggle-thumb" />
                                </button>
                            </div>
                            {objectiveClear && (
                                <input
                                    type="text"
                                    value={keyConcept}
                                    onChange={(e) => setKeyConcept(e.target.value)}
                                    placeholder="Key concept/topic..."
                                    className="input mt-4"
                                />
                            )}
                        </div>

                        {/* Class Information */}
                        <div className="card">
                            <h3 className="font-semibold mb-4">Class Information</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">Teacher Name</label>
                                    <input
                                        type="text"
                                        value={teacherName}
                                        onChange={(e) => setTeacherName(e.target.value)}
                                        placeholder="Enter teacher name"
                                        className="input"
                                    />
                                </div>
                                <div className="grid grid-2">
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-2">Subject</label>
                                        <select
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            className="input"
                                        >
                                            <option value="">Select subject</option>
                                            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-secondary mb-2">Grade Level</label>
                                        <select
                                            value={gradeLevel}
                                            onChange={(e) => setGradeLevel(e.target.value)}
                                            className="input"
                                        >
                                            <option value="">Select grade</option>
                                            {GRADE_LEVELS.map(g => <option key={g} value={g}>{g}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-secondary mb-2">School</label>
                                    <select
                                        value={schoolName}
                                        onChange={(e) => setSchoolName(e.target.value)}
                                        className="input"
                                    >
                                        <option value="">Select school</option>
                                        {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Active Observation Header */}
                        <div className="card">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-lg">{teacherName}</h2>
                                    <p className="text-secondary">{subject} • {gradeLevel}</p>
                                </div>
                                <div className="timer">{formatTime(masterTimer)}</div>
                            </div>
                        </div>

                        {/* End Observation Button */}
                        <button
                            onClick={handleStopObservation}
                            className="btn btn-full"
                            style={{ background: 'var(--error)', color: 'white', padding: '16px' }}
                        >
                            <Square size={20} />
                            End Observation
                        </button>

                        {/* Domain Checks - During Observation */}
                        <div className="card">
                            <h3 className="font-semibold mb-4">Quick Checks</h3>

                            {/* Domain 1: Learning Objective */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm">Learning Objective Visible?</span>
                                    {objectiveClear && (
                                        <span className="badge badge-success">Yes</span>
                                    )}
                                </div>
                                <button
                                    onClick={() => setObjectiveClear(!objectiveClear)}
                                    className={cn('toggle', objectiveClear && 'active')}
                                >
                                    <div className="toggle-thumb" />
                                </button>
                                {objectiveClear && (
                                    <input
                                        type="text"
                                        value={keyConcept}
                                        onChange={(e) => setKeyConcept(e.target.value)}
                                        placeholder="Key concept..."
                                        className="input mt-3"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Section 1: Talk-Time Tracker */}
                        <section className="card">
                            <h3 className="font-semibold flex items-center gap-2 mb-4">
                                <Clock size={18} className="text-accent" />
                                Talk-Time Tracker
                            </h3>
                            <div className="grid grid-3">
                                <button
                                    onClick={() => toggleTalkState('teacher')}
                                    className={cn('tally-btn', activeTalkState === 'teacher' && 'active')}
                                >
                                    <span className="text-2xl">🗣️</span>
                                    <span className="tally-label">Teacher</span>
                                    <span className="timer" style={{ fontSize: '18px' }}>{formatTime(timeTeacherTalking)}</span>
                                </button>
                                <button
                                    onClick={() => toggleTalkState('silence')}
                                    className={cn('tally-btn', activeTalkState === 'silence' && 'active')}
                                >
                                    <span className="text-2xl">⏳</span>
                                    <span className="tally-label">Silence/Work</span>
                                    <span className="timer" style={{ fontSize: '18px' }}>{formatTime(timeSilence)}</span>
                                </button>
                                <button
                                    onClick={() => toggleTalkState('student')}
                                    className={cn('tally-btn', activeTalkState === 'student' && 'active')}
                                >
                                    <span className="text-2xl">💬</span>
                                    <span className="tally-label">Student</span>
                                    <span className="timer" style={{ fontSize: '18px' }}>{formatTime(timeStudentTalking)}</span>
                                </button>
                            </div>
                        </section>

                        {/* Section 2: Teacher Questions */}
                        <section className="card">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold">Teacher Questions</h3>
                                {history.length > 0 && (
                                    <button onClick={handleUndo} className="btn btn-secondary text-xs">
                                        <Undo2 size={14} />
                                        Undo
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-3">
                                <button onClick={incrementQClosed} className="tally-btn">
                                    <span className="tally-count">{qClosed}</span>
                                    <span className="tally-label">Closed</span>
                                    <span className="tally-sublabel">What/Who</span>
                                </button>
                                <button onClick={incrementQOpen} className="tally-btn">
                                    <span className="tally-count">{qOpen}</span>
                                    <span className="tally-label">Open</span>
                                    <span className="tally-sublabel">Why/How</span>
                                </button>
                                <button onClick={incrementQProbe} className="tally-btn">
                                    <span className="tally-count">{qProbe}</span>
                                    <span className="tally-label">Probe</span>
                                    <span className="tally-sublabel">"How do you know?"</span>
                                </button>
                            </div>
                        </section>

                        {/* Section 3: Student Responses */}
                        <section className="card">
                            <h3 className="font-semibold mb-4">Student Responses</h3>
                            <div className="grid grid-3">
                                <button onClick={incrementRespShort} className="tally-btn">
                                    <span className="tally-count">{respShort}</span>
                                    <span className="tally-label">Short</span>
                                    <span className="tally-sublabel">1-2 words</span>
                                </button>
                                <button onClick={incrementRespExtended} className="tally-btn">
                                    <span className="tally-count">{respExtended}</span>
                                    <span className="tally-label">Academic</span>
                                    <span className="tally-sublabel">Full sentence</span>
                                </button>
                                <button onClick={incrementRespPeer} className="tally-btn">
                                    <span className="tally-count">{respPeer}</span>
                                    <span className="tally-label">Peer</span>
                                    <span className="tally-sublabel">Student → Student</span>
                                </button>
                            </div>
                        </section>

                        {/* Section 4: Wait Time & Environment */}
                        <section className="card">
                            <h3 className="font-semibold mb-4">Wait Time & Environment</h3>
                            <div className="grid grid-2 gap-4">
                                <button onClick={incrementCodeSwitching} className="tally-btn">
                                    <span className="tally-count">{codeSwitching}</span>
                                    <span className="tally-label">Code-Switch</span>
                                    <span className="tally-sublabel">EN ↔ MS</span>
                                </button>
                                <div className="tally-btn" style={{ cursor: 'default' }}>
                                    <span className="tally-count">{avgWaitTime.toFixed(1)}s</span>
                                    <span className="tally-label">Avg Wait Time</span>
                                    <span className="tally-sublabel">{waitTimes.length} samples</span>
                                </div>
                            </div>
                            <button
                                onMouseDown={handleWaitTimeStart}
                                onMouseUp={handleWaitTimeEnd}
                                onMouseLeave={() => isHoldingWaitTime && handleWaitTimeEnd()}
                                onTouchStart={handleWaitTimeStart}
                                onTouchEnd={handleWaitTimeEnd}
                                className={cn('btn btn-full', isHoldingWaitTime && 'btn-primary')}
                                style={{ marginTop: '16px', minHeight: '56px' }}
                            >
                                <Clock size={20} />
                                {isHoldingWaitTime ? 'Release when someone speaks...' : 'Hold for Wait Time'}
                            </button>
                        </section>

                        {/* Section 5: Student Understanding Check - MOVED HERE */}
                        <section className="card">
                            <h3 className="font-semibold mb-4">Student Understanding Check</h3>
                            <p className="text-sm text-muted mb-4">Ask a student: "What are you learning today?"</p>
                            <div className="grid grid-3">
                                {UNDERSTANDING_OPTIONS.map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => setStudentUnderstanding(option.value)}
                                        className={cn('tally-btn', studentUnderstanding === option.value && 'active')}
                                        style={{ minHeight: '64px' }}
                                    >
                                        <span className="text-xl">{option.value === 'None' ? '🤷' : option.value === 'Task' ? '📝' : '💡'}</span>
                                        <span className="tally-label text-xs">{option.label}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Section 6: Formative Methods Counters */}
                        <section className="card">
                            <h3 className="font-semibold mb-4">Formative Methods</h3>
                            <div className="grid grid-2 gap-3">
                                {FORMATIVE_TAGS.map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => incrementFormativeTag(tag)}
                                        className="tally-btn"
                                        style={{ minHeight: '60px' }}
                                    >
                                        <span className="tally-count">{formativeCounts[tag] || 0}</span>
                                        <span className="tally-label text-sm">{tag}</span>
                                    </button>
                                ))}
                            </div>
                        </section>

                        {/* Section 7: Qualitative Evidence */}
                        <section className="card">
                            <h3 className="font-semibold flex items-center gap-2 mb-4">
                                <MessageCircle size={18} className="text-accent" />
                                Qualitative Evidence
                            </h3>

                            {/* Verbatim Quotes */}
                            <div>
                                <label className="block text-sm font-medium text-secondary mb-3">
                                    Exact Quotes
                                    <span className="badge badge-neutral ml-2">
                                        {verbatimQuotes.split('\n').filter(q => q.trim().length > 0).length}
                                    </span>
                                </label>
                                <textarea
                                    value={verbatimQuotes}
                                    onChange={(e) => setVerbatimQuotes(e.target.value)}
                                    placeholder="Type or dictate notable quotes here..."
                                    className="input"
                                    style={{ minHeight: '100px', resize: 'none' }}
                                />
                            </div>
                        </section>
                    </div>
                )}
            </main>

            {/* Submit Button - Fixed Bottom */}
            {isObserving && masterTimer > 0 && (
                <div className="bottom-sheet">
                    {submitError && (
                        <div className="flex items-center gap-2 p-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertCircle size={18} className="text-amber-600" />
                            <span className="text-sm text-amber-800">{submitError}</span>
                        </div>
                    )}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="btn btn-primary btn-full"
                        style={{ minHeight: '48px' }}
                    >
                        {isSubmitting ? 'Submitting...' : 'End & Submit to Database'}
                    </button>
                </div>
            )}
        </div>
    );
}
