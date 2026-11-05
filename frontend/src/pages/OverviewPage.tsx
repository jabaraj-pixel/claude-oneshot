import React from 'react';
import { PhoneCall, Navigation, MessageSquareWarning, Send } from 'lucide-react';
import { IntegrationNotice } from '../components/IntegrationNotice';
import { useHealth } from '../hooks/useHealth';

export const OverviewPage: React.FC = () => {
  const { health } = useHealth();

  const metrics = [
    {
      label: 'Calls Processed',
      value: '0',
      note: 'Awaiting Worker 1 (Telephony)',
      icon: PhoneCall,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Route Inquiries',
      value: '0',
      note: 'Awaiting Worker 2 (Mobility)',
      icon: Navigation,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Complaints Recorded',
      value: '0',
      note: 'Awaiting Worker 3 (Messaging)',
      icon: MessageSquareWarning,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Summaries Dispatched',
      value: '0',
      note: 'Awaiting Worker 3 (Messaging)',
      icon: Send,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
  ];

  return (
    <div className="space-y-6">
      <IntegrationNotice integrations={health?.integrations} />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">{item.label}</span>
                <div className={`p-2 rounded-lg ${item.bg}`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">{item.value}</p>
              <p className="text-[11px] text-slate-400 mt-1">{item.note}</p>
            </div>
          );
        })}
      </div>

      {/* Project Architecture Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 text-indigo-700 font-semibold text-sm mb-3">
            <PhoneCall className="w-4 h-4" />
            <span>Worker 1: Voice AI & Telephony</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Owns Exotel inbound telephony, Sarvam STT/TTS audio streaming, conversation state management, and Tamil/English/Tanglish speech recognition.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            branch: worker/voice-telephony
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 text-emerald-700 font-semibold text-sm mb-3">
            <Navigation className="w-4 h-4" />
            <span>Worker 2: Mobility Backend</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Owns GTFS transit timetable ingestion, Chennai stops/routes matching, multi-modal transfer planning (MTC buses, CMRL metro, suburban trains).
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            branch: worker/mobility-backend
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 text-blue-700 font-semibold text-sm mb-3">
            <Send className="w-4 h-4" />
            <span>Worker 3: Frontend & Messaging</span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Owns this control dashboard, browser voice testing workbench, post-call SMS/WhatsApp delivery with verified consent, and complaint intake.
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
            branch: worker/frontend-messaging
          </div>
        </div>
      </div>
    </div>
  );
};
