import React from 'react';
import { AlertCircle } from 'lucide-react';
import { IntegrationsStatus } from '../types';

interface IntegrationNoticeProps {
  integrations?: IntegrationsStatus;
}

export const IntegrationNotice: React.FC<IntegrationNoticeProps> = ({
  integrations,
}) => {
  return (
    <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="ml-3">
          <h4 className="text-sm font-semibold text-amber-900">
            Common Foundation Baseline Active
          </h4>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            External telephone carriers (Exotel), Tamil speech engines (Sarvam AI),
            production GTFS transit routing, and SMS/WhatsApp dispatch are
            intentionally unconfigured in this common foundation. No simulated or
            fake data is presented. Developers will implement each subsystem in their
            dedicated worker branches.
          </p>

          {integrations && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-white/80 px-2 py-1.5 rounded border border-amber-200/50">
                <span className="text-slate-500">Exotel Telephony: </span>
                <span className={integrations.exotel_telephony ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                  {integrations.exotel_telephony ? 'Configured' : 'Pending (Worker 1)'}
                </span>
              </div>
              <div className="bg-white/80 px-2 py-1.5 rounded border border-amber-200/50">
                <span className="text-slate-500">Sarvam AI STT/TTS: </span>
                <span className={integrations.sarvam_ai ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                  {integrations.sarvam_ai ? 'Configured' : 'Pending (Worker 1)'}
                </span>
              </div>
              <div className="bg-white/80 px-2 py-1.5 rounded border border-amber-200/50">
                <span className="text-slate-500">Transit GTFS: </span>
                <span className={integrations.gtfs_fixtures ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                  {integrations.gtfs_fixtures ? 'Fixtures Ready' : 'Pending (Worker 2)'}
                </span>
              </div>
              <div className="bg-white/80 px-2 py-1.5 rounded border border-amber-200/50">
                <span className="text-slate-500">Messaging: </span>
                <span className={integrations.whatsapp_messaging ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                  {integrations.whatsapp_messaging ? 'Configured' : 'Pending (Worker 3)'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
