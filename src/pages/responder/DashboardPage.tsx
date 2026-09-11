import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Bell, ArrowRight, AlertTriangle, FileText, Users, Image } from 'lucide-react';

import { formatDistanceToNow, format } from 'date-fns';
import { MapView } from '../../components/map/MapView';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ConfidenceIndicator } from '../../components/ui/ConfidenceIndicator';
import { ActionPriorityBadge } from '../../components/incident/ActionPriorityBadge';
import { EvidencePanel } from '../../components/incident/EvidencePanel';
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

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
};

export function DashboardPage() {
  const { incidents, metrics, refreshIncidents, loading, error } = useIncidents();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // CHANGED: use deterministic operational tie-breakers after action priority.
  const prioritized = useMemo(
    () =>
      [...incidents].sort((a, b) => {
        const priorityDelta =
          (PRIORITY_ORDER[a.actionPriority] ?? 9) -
          (PRIORITY_ORDER[b.actionPriority] ?? 9);
        if (priorityDelta !== 0) return priorityDelta;

        const severityDelta =
          (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
        if (severityDelta !== 0) return severityDelta;

        const confidenceDelta = b.confidence.overall - a.confidence.overall;
        if (confidenceDelta !== 0) return confidenceDelta;

        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    [incidents]
  );

  const activeFeed = useMemo(
    () => prioritized.filter(incident => incident.responderState !== 'resolved'),
    [prioritized]
  );

  // CHANGED: derive a valid default selection without an extra state/update cycle.
  const effectiveSelectedId = incidents.some(incident => incident.id === selectedId)
    ? selectedId
    : (activeFeed[0]?.id ?? null);

  const selectedIncident = useMemo(
    () => incidents.find(incident => incident.id === effectiveSelectedId) ?? null,
    [effectiveSelectedId, incidents]
  );

  const handleRefresh = async () => {
    try {
      await refreshIncidents();
      setLastUpdated(new Date());
    } catch {
      // The shared context exposes the API error below.
    }
  };

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
            onClick={handleRefresh}
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
        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden /> {error}
          </div>
        )}
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

        {/* CHANGED: responder workflow now reads left-to-right: feed, map, evidence. */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-5 items-start">
          {/* Priority Feed */}
          <section className="xl:col-span-1" aria-labelledby="priority-feed-title">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 id="priority-feed-title" className="text-sm font-semibold text-slate-800">
                  Priority Feed
                </h2>
                <Link
                  to="/responder/feed"
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                >
                  View all <ArrowRight size={12} aria-hidden />
                </Link>
              </div>
              <div className="divide-y divide-slate-100 max-h-[34rem] overflow-y-auto">
                {activeFeed.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-slate-400">
                    No active incidents.
                  </p>
                ) : (
                  activeFeed.map(incident => (
                    <FeedRow
                      key={incident.id}
                      incident={incident}
                      selected={incident.id === effectiveSelectedId}
                      onClick={() => setSelectedId(incident.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </section>

          {/* Map */}
          <section className="xl:col-span-2" aria-labelledby="incident-map-title">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 id="incident-map-title" className="text-sm font-semibold text-slate-800">
                  Incident Map
                </h2>
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
                  selectedIncidentId={effectiveSelectedId}
                  onIncidentSelect={setSelectedId}
                />
              </div>
            </div>
          </section>

          {/* CHANGED: inline evidence drawer reuses the existing evidence components. */}
          <aside className="xl:col-span-1" aria-labelledby="evidence-drawer-title">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h2 id="evidence-drawer-title" className="text-sm font-semibold text-slate-800">
                  Evidence &amp; Confidence
                </h2>
                {selectedIncident && (
                  <Link
                    to={`/responder/incidents/${selectedIncident.id}`}
                    className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                    aria-label={`Open full record for ${selectedIncident.title}`}
                  >
                    Full record <ArrowRight size={12} aria-hidden />
                  </Link>
                )}
              </div>
              <DashboardEvidenceDrawer incident={selectedIncident} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function FeedRow({
  incident,
  selected,
  onClick,
}: {
  incident: Incident;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 border-l-2 transition-colors',
        selected
          ? 'bg-slate-50 border-l-blue-600'
          : 'border-l-transparent hover:bg-slate-50'
      )}
      onClick={onClick}
      aria-pressed={selected}
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
          <span>
            {incident.reportCount} {incident.reportCount === 1 ? 'report' : 'reports'}
          </span>
          <span>·</span>
          <span>
            {incident.independentSourceCount}{' '}
            {incident.independentSourceCount === 1 ? 'source' : 'sources'}
          </span>
          <span>·</span>
          <span>{formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}</span>
        </div>
      </div>
      <SeverityBadge severity={incident.severity} size="sm" className="flex-shrink-0 mt-0.5" />
    </button>
  );
}

function DashboardEvidenceDrawer({ incident }: { incident: Incident | null }) {
  if (!incident) {
    return (
      <div className="px-4 py-10 text-center" aria-live="polite">
        <p className="text-sm font-medium text-slate-600">Select an incident</p>
        <p className="text-xs text-slate-400 mt-1">
          Its confidence and supporting evidence will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in" aria-live="polite">
      <div>
        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <ActionPriorityBadge priority={incident.actionPriority} size="sm" />
          <SeverityBadge severity={incident.severity} size="sm" />
          <StatusBadge state={incident.verificationState} size="sm" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 leading-snug">
          {incident.title}
        </h3>
        <p className="text-xs text-slate-500 mt-1">{incident.locationName}</p>
      </div>

      <div className="border border-slate-200 rounded-lg p-3">
        <ConfidenceIndicator confidence={incident.confidence} showBreakdown />
      </div>

      <div className="grid grid-cols-3 gap-2" aria-label="Evidence totals">
        {[
          { label: 'Reports', value: incident.reportCount, icon: FileText },
          { label: 'Sources', value: incident.independentSourceCount, icon: Users },
          { label: 'Images', value: incident.uniqueImageCount, icon: Image },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="border border-slate-200 rounded-lg px-2 py-2 text-center">
            <Icon size={12} className="mx-auto text-slate-400 mb-1" aria-hidden />
            <p className="text-sm font-bold text-slate-800 tabular-nums">{value}</p>
            <p className="text-[10px] text-slate-500">{label}</p>
          </div>
        ))}
      </div>

      {incident.hasContradictions && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3" role="alert">
          <AlertTriangle size={14} className="text-red-600 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-xs font-semibold text-red-800">Contradictory evidence</p>
            <p className="text-xs text-red-700 mt-0.5">
              {incident.contradictionNote ?? 'Reports disagree on a material incident fact.'}
            </p>
          </div>
        </div>
      )}

      {incident.hasRecycledMedia && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3" role="alert">
          <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="text-xs font-semibold text-amber-800">Recycled media detected</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Treat matching images as one witness until reviewed.
            </p>
          </div>
        </div>
      )}

      <EvidencePanel key={incident.id} incident={incident} />
    </div>
  );
}
