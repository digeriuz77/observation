'use client';

import { useState } from 'react';
import { ObservationPage } from './components/ObservationPage';
import { Dashboard } from './components/Dashboard';
import { ClipboardList, LayoutDashboard, User, LogOut } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'observe' | 'dashboard'>('observe');
  const [observer, setObserver] = useState<string>('');

  const observers = ['Alisa', 'Eddy', 'Fameedah', 'Gary', 'Jen', 'Shamim'];

  if (!observer) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50">
        <div className="glass card max-w-md w-full text-center animate-fade-in">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-cyan-200">
              <span className="text-white text-2xl font-bold">S</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">STEM Observation</h1>
          <p className="text-slate-500 mb-8">Select your name to continue</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {observers.map((name) => (
              <button
                key={name}
                onClick={() => setObserver(name)}
                className="btn-primary py-4 text-sm sm:text-base"
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
    <div className="min-h-screen bg-slate-50">
      {/* Mobile-optimized header */}
      <header className="glass sticky top-0 z-50 border-b border-white/50">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold shadow-md">
                S
              </div>
              <span className="font-bold text-lg text-slate-800 hidden sm:block">STEM Obs</span>
            </div>

            {/* Navigation tabs */}
            <nav className="flex bg-slate-100/80 rounded-full p-1">
              <button
                onClick={() => setActiveTab('observe')}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'observe'
                    ? 'bg-white text-cyan-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <ClipboardList size={16} />
                <span className="hidden sm:inline">Observe</span>
                <span className="sm:hidden">New</span>
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'dashboard'
                    ? 'bg-white text-cyan-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                  }`}
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Dashboard</span>
                <span className="sm:hidden">Data</span>
              </button>
            </nav>

            {/* User info & logout */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-8 h-8 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center">
                  <User size={14} className="text-cyan-700" />
                </div>
                <span className="font-medium text-slate-700 hidden sm:block">{observer}</span>
              </div>
              <button
                onClick={() => setObserver('')}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto">
        {activeTab === 'observe' ? (
          <ObservationPage
            observerName={observer}
            onBack={() => setObserver('')}
          />
        ) : (
          <div className="p-4 sm:p-6">
            <Dashboard />
          </div>
        )}
      </main>
    </div>
  );
}
