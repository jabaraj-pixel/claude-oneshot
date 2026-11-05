import React from 'react';
import { EmptyState } from '../components/StateFeedback';
import { Bus, MapPin, Database } from 'lucide-react';

export const JourneysPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-900 mb-1">
          Chennai Transit & Journey Engine
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          Origin-destination route search, MTC bus schedules, CMRL metro timetables, and transfer points.
        </p>

        <EmptyState
          title="Transit Engine Uninitialised"
          description="GTFS timetable ingestion and multi-modal routing algorithms will be implemented by Worker 2 in the mobility workstream."
          workerBadge="Worker 2 (worker/mobility-backend)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 font-medium text-slate-700 mb-1">
            <Bus className="w-4 h-4 text-emerald-600" />
            <span>Route Search API</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Contract: <code className="bg-slate-100 px-1 py-0.5 rounded">POST /api/mobility/routes/search</code>
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 font-medium text-slate-700 mb-1">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span>Stops Lookup API</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Contract: <code className="bg-slate-100 px-1 py-0.5 rounded">GET /api/mobility/stops/search</code>
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200">
          <div className="flex items-center space-x-2 font-medium text-slate-700 mb-1">
            <Database className="w-4 h-4 text-purple-600" />
            <span>Local GTFS Fixtures</span>
          </div>
          <p className="text-slate-500 text-[11px]">
            Location: <code className="bg-slate-100 px-1 py-0.5 rounded">data/fixtures/</code>
          </p>
        </div>
      </div>
    </div>
  );
};
