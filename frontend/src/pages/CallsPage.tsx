import React from 'react';
import { EmptyState } from '../components/StateFeedback';
import { Phone, Radio, Key } from 'lucide-react';

export const CallsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Telephony & Live Calls Stream
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Real-time telephone call sessions, live transcriptions, and audio streaming status.
        </p>

        <EmptyState
          title="No Active or Historic Calls"
          description="Inbound SIP/PSTN call webhooks and WebSocket streaming will appear here once Worker 1 connects Exotel and Sarvam AI engines."
          workerBadge="Worker 1 (worker/voice-telephony)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 font-medium text-slate-700 mb-1">
            <Radio className="w-4 h-4 text-indigo-500" />
            <span>Streaming Audio WS</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Contract: <code className="bg-slate-100 px-1 py-0.5 rounded">WS /telephony/audio/&#123;call_id&#125;</code>
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 font-medium text-slate-700 mb-1">
            <Phone className="w-4 h-4 text-emerald-500" />
            <span>Inbound Telephony Webhook</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Contract: <code className="bg-slate-100 px-1 py-0.5 rounded">POST /telephony/inbound</code>
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 font-medium text-slate-700 mb-1">
            <Key className="w-4 h-4 text-amber-500" />
            <span>Sarvam Multilingual STT</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Tamil, English, and Tanglish real-time recognition.
          </p>
        </div>
      </div>
    </div>
  );
};
