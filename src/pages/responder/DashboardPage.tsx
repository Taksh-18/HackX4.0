import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Bell, ArrowRight } from 'lucide-react';

import { formatDistanceToNow, format } from 'date-fns';
import { MapView } from '../../components/map/MapView';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { ActionPriorityBadge } from '../../components/incident/ActionPriorityBadge';
import { MetricSummary } from '../../components/ui/MetricSummary';
import { useIncidents } from '../../context/IncidentContext';
import { cn } from '../../lib/cn';
import type { Incident } from '../../data/types';

const PRIORITY_ORDER: Record<string, number> = {
  critical_dispatch: 0,
  deploy_scout: 1,
  monitor: 2,
  suppressed: 3,
};

export function DashboardPage() {
  const { incidents, metrics, refreshIncidents, loading } = useIncidents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastUpdated] = useState(new Date());

  const prioritized = [...incidents].sort(
    (a, b) =>
      (PRIORITY_ORDER[a.actionPriority] ?? 9) - (PRIORITY_ORDER[b.actionPriority] ?? 9)
  );

  const activeFeed = prioritized.filter(i => i.responderState !== 'resolved').slice(0, 6);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-bold text-slate-900">Operational Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">Live verified incident intelligence</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Updated {format(lastUpdated, 'HH:mm')}
          </span>
          <button
            onClick={refreshIncidents}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors',
              loading && 'opacity-60 cursor-not-allowed'
            )}
            disabled={loading}
            aria-label="Refresh incidents"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} aria-hidden />
            Refresh
          </button>
          <button
            className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {metrics.critical > 0 && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" aria-hidden />
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Metrics */}
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-4 mb-5 shadow-card inline-flex">
          <MetricSummary
            metrics={[
              { label: 'Critical', value: metrics.critical, color: 'red' },
              { label: 'Active', value: metrics.active, color: 'orange' },
              { label: 'Developing', value: metrics.developing, color: 'yellow' },
              { label: 'Resolved', value: metrics.resolved, color: 'green' },
            ]}
          />
        </div>

        {/* Main grid: Map + Feed */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Map */}
          <div className="xl:col-span-2">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Incident Map</h2>
                <Link
                  to="/responder/map"
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                >
                  Full map <ArrowRight size={12} aria-hidden />
                </Link>
              </div>
              <div className="h-72 lg:h-96">
                <MapView
                  incidents={incidents}
                  center={{ lat: 28.6129, lng: 77.2295 }}
                  zoom={13}
                  isResponder
                  height="100%"
                  selectedIncidentId={selectedId}
                  onIncidentSelect={setSelectedId}
                />
              </div>
            </div>
          </div>

          {/* Priority Feed */}
          <div className="xl:col-span-1">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card h-full">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Priority Feed</h2>
                <Link
                  to="/responder/feed"
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                >
                  View all <ArrowRight size={12} aria-hidden />
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {activeFeed.map(incident => (
                  <FeedRow
                    key={incident.id}
                    incident={incident}
                    onClick={() => setSelectedId(incident.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedRow({ incident, onClick }: { incident: Incident; onClick: () => void }) {
  return (
    <Link
      to={`/responder/incidents/${incident.id}`}
      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <ActionPriorityBadge priority={incident.actionPriority} size="sm" />
        </div>
        <p className="text-xs font-semibold text-slate-800 line-clamp-1 mt-1">
          {incident.title}
        </p>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
          <span className="font-bold text-slate-600">{incident.confidence.overall}%</span>
          <span>{incident.reportCount} reports</span>
          <span>·</span>
          <span>{incident.independentSourceCount} sources</span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}</span>
        </div>
      </div>
      <SeverityBadge severity={incident.severity} size="sm" className="flex-shrink-0 mt-0.5" />
    </Link>
  );
}
