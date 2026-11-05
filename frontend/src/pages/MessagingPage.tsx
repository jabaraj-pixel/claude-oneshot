import React from 'react';
import { EmptyState } from '../components/StateFeedback';
import { MessageSquareCheck, ShieldCheck } from 'lucide-react';

export const MessagingPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3 text-xs text-blue-900">
        <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Consent Verification Policy:</span>{' '}
          SMS or WhatsApp journey summaries may only be dispatched if the passenger explicitly confirms consent during the voice call. Dispatches without verified consent are rejected by the system.
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Post-Call Summary Messaging
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Outbound SMS and WhatsApp delivery queue, delivery status tracking, and consent audit logs.
        </p>

        <EmptyState
          title="No Messages Queued or Dispatched"
          description="Outbound WhatsApp Cloud API and SMS provider adapters will be implemented by Worker 3."
          workerBadge="Worker 3 (worker/frontend-messaging)"
        />
      </div>

      <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs text-slate-600">
        <div className="flex items-center space-x-2 font-medium text-slate-800 mb-2">
          <MessageSquareCheck className="w-4 h-4 text-brand-600" />
          <span>Dispatch API Contract</span>
        </div>
        <p className="text-slate-500 text-[11px]">
          Endpoint: <code className="bg-slate-100 px-1 py-0.5 rounded">POST /api/messages/send</code>
          — requires <code className="bg-slate-100 px-1 py-0.5 rounded">user_consent_granted: true</code>.
        </p>
      </div>
    </div>
  );
};
