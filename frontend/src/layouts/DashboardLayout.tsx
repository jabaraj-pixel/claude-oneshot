import React from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  Navigation,
  MessageSquareWarning,
  Send,
  Settings as SettingsIcon,
  Bus,
} from 'lucide-react';
import { PageId } from '../types';
import { HealthBadge } from '../components/HealthBadge';
import { useHealth } from '../hooks/useHealth';

interface DashboardLayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentPage,
  onNavigate,
  children,
}) => {
  const { health, loading, error, refresh } = useHealth();

  const navItems = [
    { id: 'overview' as PageId, label: 'Overview', icon: LayoutDashboard },
    { id: 'calls' as PageId, label: 'Calls', icon: PhoneCall, worker: 'Worker 1' },
    { id: 'journeys' as PageId, label: 'Journeys', icon: Navigation, worker: 'Worker 2' },
    { id: 'complaints' as PageId, label: 'Complaints', icon: MessageSquareWarning, worker: 'Worker 3' },
    { id: 'messaging' as PageId, label: 'Messaging', icon: Send, worker: 'Worker 3' },
    { id: 'settings' as PageId, label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white">
              <Bus className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-wide">
                Chennai Mobility AI
              </h1>
              <p className="text-[11px] text-slate-400">Foundation v0.1.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.worker && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isActive
                        ? 'bg-brand-700/80 text-white'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {item.worker}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 text-[11px] text-slate-500">
          <p className="font-semibold text-slate-400">Git Workflow</p>
          <p className="mt-0.5">Base: <code className="text-slate-300">main</code></p>
          <p>Lead-managed branches</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900 capitalize">
              {currentPage}
            </h2>
            <p className="text-xs text-slate-500">
              Multilingual Transportation Voice Assistant Foundation
            </p>
          </div>

          <HealthBadge
            health={health}
            loading={loading}
            error={error}
            onRefresh={refresh}
          />
        </header>

        {/* Content Body */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

