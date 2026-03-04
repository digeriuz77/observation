'use client';

import { useState, useCallback, useMemo } from 'react';
import { ObservationPage } from './components/ObservationPage';
import { Dashboard } from './components/Dashboard';
import { ClipboardList, LayoutDashboard, User, LogOut } from 'lucide-react';
import { cn } from '@/utils/classnames';

// Constants moved outside component to avoid recreation on every render
const OBSERVERS = ['Alisa', 'Eddy', 'Fameedah', 'Gary', 'Jen', 'Shamim'] as const;

export default function Home() {
  const [activeTab, setActiveTab] = useState<'observe' | 'dashboard'>('observe');
  const [observer, setObserver] = useState<string>('');

  // Memoized callback to avoid inline function creation
  const handleBack = useCallback(() => setObserver(''), []);
  const handleTabChange = useCallback((tab: 'observe' | 'dashboard') => setActiveTab(tab), []);

  if (!observer) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-primary)' }}>
        <div className="card max-w-sm w-full text-center animate-fade-in">
          <div className="mb-6">
            <div className="w-16 h-16 rounded-xl mx-auto flex items-center justify-center" style={{ background: 'var(--accent-primary)' }}>
              <span className="text-white text-2xl font-bold">S</span>
            </div>
          </div>
          <h1 className="text-xl font-bold mb-2">STEM Observation</h1>
          <p className="text-secondary text-sm mb-6">Select your name to continue</p>
          <div className="grid grid-2 gap-3">
            {OBSERVERS.map((name) => (
              <button
                key={name}
                onClick={() => setObserver(name)}
                className="btn btn-secondary"
                style={{ minHeight: '48px' }}
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
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="header">
        <div className="header-content">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold" style={{ background: 'var(--accent-primary)' }}>
              S
            </div>
            <span className="font-semibold hidden sm-block">STEM Obs</span>
          </div>

          {/* Navigation tabs */}
          <nav className="nav-tabs">
            <button
              onClick={() => handleTabChange('observe')}
              className={cn('nav-tab', activeTab === 'observe' && 'active')}
            >
              <ClipboardList size={16} />
              <span className="hidden sm-block">Observe</span>
              <span className="mobile-hidden">New</span>
            </button>
            <button
              onClick={() => handleTabChange('dashboard')}
              className={cn('nav-tab', activeTab === 'dashboard' && 'active')}
            >
              <LayoutDashboard size={16} />
              <span className="hidden sm-block">Dashboard</span>
              <span className="mobile-hidden">Data</span>
            </button>
          </nav>

          {/* User info & logout */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-subtle)' }}>
                <User size={14} className="text-secondary" />
              </div>
              <span className="font-medium text-secondary hidden sm-block">{observer}</span>
            </div>
            <button
              onClick={handleBack}
              className="btn btn-secondary btn-icon"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        {activeTab === 'observe' ? (
          <ObservationPage
            observerName={observer}
            onBack={handleBack}
          />
        ) : (
          <div className="container">
            <Dashboard />
          </div>
        )}
      </main>
    </div>
  );
}
