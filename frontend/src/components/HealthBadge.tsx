import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { BackendHealth } from '../types';

interface HealthBadgeProps {
  health: BackendHealth | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const HealthBadge: React.FC<HealthBadgeProps> = ({
  health,
  loading,
  error,
  onRefresh,
}) => {
  if (loading && !health) {
    return (
      <div className="flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
        <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
        <span>Checking backend...</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex items-center space-x-2 text-xs text-red-700 bg-red-100 px-3 py-1.5 rounded-full">
        <XCircle className="w-3.5 h-3.5 text-red-600" />
        <span className="font-medium">Backend Offline</span>
        <button
          onClick={onRefresh}
          title="Retry health check"
          className="ml-1 hover:text-red-900"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const isDegraded = health.status === 'degraded' || !health.database.connected;

  return (
    <div className="flex items-center space-x-3">
      <div
        className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-full border ${
          isDegraded
            ? 'bg-amber-50 text-amber-800 border-amber-200'
            : 'bg-emerald-50 text-emerald-800 border-emerald-200'
        }`}
      >
        {isDegraded ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        )}
        <span className="font-medium">
          FastAPI v{health.version} ({health.status})
        </span>
        <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-1.5">
          DB: {health.database.status}
        </span>
      </div>
      <button
        onClick={onRefresh}
        title="Refresh backend status"
        className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
};

