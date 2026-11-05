import React from 'react';
import { EmptyState } from '../components/StateFeedback';
import { ShieldAlert } from 'lucide-react';

export const ComplaintsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3 text-xs text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Compliance & Authorization Rule:</span>{' '}
          Complaints recorded through conversational phone calls are stored for internal tracking only. Official government or MTC dispatch will not be claimed without an authorised official ticketing API integration.
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Passenger Complaint Records
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Logged transit grievances regarding bus delays, crew conduct, overcrowding, and station infrastructure.
        </p>

        <EmptyState
          title="No Complaints Logged"
          description="Complaint capture from voice dialogues will be connected by Worker 3 in the messaging and complaint management workstream."
          workerBadge="Worker 3 (worker/frontend-messaging)"
        />
      </div>
    </div>
  );
};
