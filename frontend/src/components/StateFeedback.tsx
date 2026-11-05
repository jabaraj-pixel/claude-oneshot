import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading data from backend...',
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-lg border border-slate-200">
    <Loader2 className="w-8 h-8 animate-spin text-brand-600 mb-3" />
    <p className="text-sm font-medium">{message}</p>
  </div>
);

interface EmptyStateProps {
  title: string;
  description: string;
  workerBadge?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  workerBadge,
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-lg border border-slate-200">
    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
      <Inbox className="w-6 h-6" />
    </div>
    <h3 className="text-base font-semibold text-slate-800 mb-1">{title}</h3>
    <p className="text-sm text-slate-500 max-w-md mb-4">{description}</p>
    {workerBadge && (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
        Assigned: {workerBadge}
      </span>
    )}
  </div>
);

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Failed to load data',
  message,
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center p-8 text-center bg-red-50 rounded-lg border border-red-200 text-red-900">
    <AlertCircle className="w-8 h-8 text-red-600 mb-2" />
    <h4 className="text-sm font-semibold">{title}</h4>
    <p className="text-xs text-red-700 mt-1 max-w-sm">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="mt-4 px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
      >
        Retry Request
      </button>
    )}
  </div>
);

