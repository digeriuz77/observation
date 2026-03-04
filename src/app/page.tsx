'use client';

import { useState } from 'react';
import { ObservationForm } from './components/ObservationForm';
import { Dashboard } from './components/Dashboard';
import { ClipboardList, LayoutDashboard } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'observe' | 'dashboard'>('observe');
  const [observer, setObserver] = useState<string>('');

  const observers = ['Observer 1', 'Observer 2', 'Observer 3', 'Observer 4', 'Observer 5', 'Observer 6'];

  if (!observer) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-teal-50 to-slate-100">
        <div className="glass card max-w-md w-full text-center animate-in fade-in zoom-in duration-500">
          <h1 className="text-3xl font-bold text-teal-900 mb-6">STEM Observation</h1>
          <p className="text-slate-600 mb-8">Please select your name to continue</p>
          <div className="grid grid-cols-1 gap-3">
            {observers.map((name) => (
              <button
                key={name}
                onClick={() => setObserver(name)}
                className="btn-primary"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <nav className="glass sticky top-0 z-10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-teal-700 rounded-lg flex items-center justify-center text-white font-bold">S</div>
          <span className="font-bold text-xl tracking-tight text-teal-900">STEM Obs</span>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('observe')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${activeTab === 'observe' ? 'bg-teal-700 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <ClipboardList size={18} />
            <span>New Observation</span>
          </button>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${activeTab === 'dashboard' ? 'bg-teal-700 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>
        </div>
        <div className="text-sm font-medium text-slate-500">
          Logged in as: <span className="text-teal-700">{observer}</span>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 mt-8">
        {activeTab === 'observe' ? (
          <ObservationForm observerName={observer} />
        ) : (
          <Dashboard />
        )}
      </div>
    </main>
  );
}
