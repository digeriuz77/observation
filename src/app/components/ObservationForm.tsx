'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Save, CheckCircle } from 'lucide-react';

interface Props {
    observerName: string;
}

export function ObservationForm({ observerName }: Props) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        teacher_name: '',
        school_name: '',
        student_age_group: '',
        domain_1_notes: '',
        domain_2_notes: '',
        domain_3_notes: '',
        domain_4_notes: '',
        domain_5_notes: '',
        coaching_notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { error } = await supabase
                .from('observations')
                .insert([{ ...formData, observer_name: observerName }]);

            if (error) throw error;

            setSuccess(true);
            setFormData({
                teacher_name: '',
                school_name: '',
                student_age_group: '',
                domain_1_notes: '',
                domain_2_notes: '',
                domain_3_notes: '',
                domain_4_notes: '',
                domain_5_notes: '',
                coaching_notes: ''
            });
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error saving observation:', error);
            alert('Error saving observation. Please check your Supabase connection.');
        } finally {
            setLoading(false);
        }
    };

    const domains = [
        { id: 'domain_1_notes', title: 'Domain 1 — Content Planning', prompt: 'What is the lesson trying to help students understand?' },
        { id: 'domain_2_notes', title: 'Domain 2 — Formative Assessment', prompt: 'How do I know students are understanding it? Where are the learners at?' },
        { id: 'domain_3_notes', title: 'Domain 3 — Instruction', prompt: "What's the cognitive level of the tasks and questions? Is explanation appropriate?" },
        { id: 'domain_4_notes', title: 'Domain 4 — Community and Routines', prompt: 'What does the language environment look like? (predictable routines?)' },
        { id: 'domain_5_notes', title: 'Domain 5 — Language Environment', prompt: 'Is there teaching of that specific subject vocab? Where does the lesson lose students?' }
    ];

    return (
        <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="glass card space-y-4">
                <h2 className="text-xl font-bold text-teal-900 border-b pb-2">Observation Metadata</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Teacher Name</label>
                        <input
                            required
                            className="input-field"
                            value={formData.teacher_name}
                            onChange={(e) => setFormData({ ...formData, teacher_name: e.target.value })}
                            placeholder="Enter teacher name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">School</label>
                        <input
                            required
                            className="input-field"
                            value={formData.school_name}
                            onChange={(e) => setFormData({ ...formData, school_name: e.target.value })}
                            placeholder="Enter school name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Age Group / Class</label>
                        <input
                            className="input-field"
                            value={formData.student_age_group}
                            onChange={(e) => setFormData({ ...formData, student_age_group: e.target.value })}
                            placeholder="e.g. Year 5, Age 10"
                        />
                    </div>
                </div>
            </div>

            {domains.map((domain) => (
                <div key={domain.id} className="glass card space-y-3">
                    <h2 className="text-lg font-bold text-teal-800">{domain.title}</h2>
                    <p className="text-sm italic text-teal-600">{domain.prompt}</p>
                    <textarea
                        className="input-field min-h-[120px] resize-y"
                        value={(formData as any)[domain.id]}
                        onChange={(e) => setFormData({ ...formData, [domain.id]: e.target.value })}
                        placeholder="Enter your observations here..."
                    />
                </div>
            ))}

            <div className="glass card space-y-3 border-l-4 border-l-teal-600">
                <h2 className="text-lg font-bold text-teal-800">Coaching Notes</h2>
                <p className="text-sm italic text-teal-600">What I noticed that made me smile</p>
                <textarea
                    className="input-field min-h-[120px] resize-y"
                    value={formData.coaching_notes}
                    onChange={(e) => setFormData({ ...formData, coaching_notes: e.target.value })}
                    placeholder="Enter positive coaching feedback..."
                />
            </div>

            <div className="flex justify-end gap-4 pb-12">
                <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary flex items-center gap-2 px-8 py-3 text-lg"
                >
                    {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : success ? (
                        <>
                            <CheckCircle size={20} />
                            <span>Synced Successfully!</span>
                        </>
                    ) : (
                        <>
                            <Send size={20} />
                            <span>Sync to Shared Environment</span>
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
