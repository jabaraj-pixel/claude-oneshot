import React from 'react';
import { useHealth } from '../hooks/useHealth';
import { Database, Server, Globe2, Shield } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { health } = useHealth();

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          System Environment & Configurations
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Centralised configuration values derived from FastAPI backend environment settings.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
            <div className="flex items-center space-x-2 text-slate-800 font-medium mb-3">
              <Server className="w-4 h-4 text-brand-600" />
              <span>Backend Core</span>
            </div>
            <dl className="space-y-2 text-slate-600">
              <div className="flex justify-between">
                <dt className="text-slate-500">Service Name:</dt>
                <dd className="font-mono">Chennai Mobility AI</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">FastAPI Version:</dt>
                <dd className="font-mono">{health?.version ?? '0.1.0'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Environment:</dt>
                <dd className="font-mono">{health?.environment ?? 'development'}</dd>
              </div>
            </dl>
          </div>

          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
            <div className="flex items-center space-x-2 text-slate-800 font-medium mb-3">
              <Database className="w-4 h-4 text-emerald-600" />
              <span>Database Connection</span>
            </div>
            <dl className="space-y-2 text-slate-600">
              <div className="flex justify-between">
                <dt className="text-slate-500">PostgreSQL Status:</dt>
                <dd className="font-mono">{health?.database.status ?? 'Checking...'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Connection Flag:</dt>
                <dd className="font-mono">
                  {health?.database.connected ? 'Connected' : 'Standalone / SQLite Dev'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
            <div className="flex items-center space-x-2 text-slate-800 font-medium mb-3">
              <Globe2 className="w-4 h-4 text-blue-600" />
              <span>Language Support</span>
            </div>
            <dl className="space-y-2 text-slate-600">
              <div className="flex justify-between">
                <dt className="text-slate-500">Primary Language:</dt>
                <dd className="font-mono">Tamil (ta)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Secondary / Code-Mix:</dt>
                <dd className="font-mono">English (en), Tanglish (ta-en)</dd>
              </div>
            </dl>
          </div>

          <div className="border border-slate-100 rounded-lg p-4 bg-slate-50/50">
            <div className="flex items-center space-x-2 text-slate-800 font-medium mb-3">
              <Shield className="w-4 h-4 text-purple-600" />
              <span>CORS & Security</span>
            </div>
            <dl className="space-y-2 text-slate-600">
              <div className="flex justify-between">
                <dt className="text-slate-500">Origins Allowed:</dt>
                <dd className="font-mono">localhost:5173, localhost:3000</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Error Handling:</dt>
                <dd className="font-mono">Standardized JSON Payloads</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
};
