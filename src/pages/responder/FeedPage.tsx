import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, MapPin, Clock, FileText, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ActionPriorityBadge } from '../../components/incident/ActionPriorityBadge';
import { FilterBar } from '../../components/ui/FilterBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { useIncidents } from '../../context/IncidentContext';
import type { Incident } from '../../data/types';
import { cn } from '../../lib/cn';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'critical', label: 'Critical' },
  { value: 'developing', label: 'Developing' },
  { value: 'corroborated', label: 'Corroborated' },
  { value: 'contradicted', label: 'Contradicted' },
  { value: 'resolved', label: 'Resolved' },
];

type SortKey = 'priority' | 'severity' | 'confidence' | 'time';

const PRIORITY_ORDER: Record<string, number> = {
  critical_dispatch: 0,
  deploy_scout: 1,
  monitor: 2,
  suppressed: 3,
};
const SEVERITY_ORDER: Record<string, number> = {
  critical: 0, high: 1, moderate: 2, low: 3,
};

export function FeedPage() {
  const { incidents } = useIncidents();
  const [selected, setSelected] = useState<string[]>(['all']);
  const [sortKey, setSortKey] = useState<SortKey>('priority');

  const filtered = incidents.filter(i => {
    if (selected.includes('all')) return true;
    if (selected.includes('critical')) return i.severity === 'critical';
    if (selected.includes('developing')) return i.verificationState === 'developing';
    if (selected.includes('corroborated')) return i.verificationState === 'corroborated';
    if (selected.includes('contradicted')) return i.verificationState === 'contradicted';
    if (selected.includes('resolved')) return i.responderState === 'resolved';
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === 'priority') return (PRIORITY_ORDER[a.actionPriority] ?? 9) - (PRIORITY_ORDER[b.actionPriority] ?? 9);
    if (sortKey === 'severity') return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    if (sortKey === 'confidence') return b.confidence.overall - a.confidence.overall;
    if (sortKey === 'time') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    return 0;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Incident Feed</h1>
            <p className="text-xs text-slate-500">Prioritized operational list — {sorted.length} incidents</p>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <ArrowUpDown size={13} className="text-slate-400" aria-hidden />
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value as SortKey)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white text-slate-700 font-medium"
              aria-label="Sort by"
            >
              <option value="priority">Sort: Priority</option>
              <option value="severity">Sort: Severity</option>
              <option value="confidence">Sort: Confidence</option>
              <option value="time">Sort: Time</option>
            </select>
          </div>
        </div>

        <FilterBar
          options={FILTER_OPTIONS}
          selected={selected}
          onChange={setSelected}
        />
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-6">
        {sorted.length === 0 ? (
          <EmptyState
            title="No incidents"
            description="No incidents match the current filters."
          />
        ) : (
          <div className="space-y-2">
            {sorted.map(incident => (
              <FeedItem key={incident.id} incident={incident} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedItem({ incident }: { incident: Incident }) {
  return (
    <Link
      to={`/responder/incidents/${incident.id}`}
      className="block bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:shadow-card transition-all"
    >
      <div className="flex items-start gap-4 p-4">
        {/* Priority */}
        <div className="flex-shrink-0 pt-0.5">
          <ActionPriorityBadge priority={incident.actionPriority} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="text-sm font-semibold text-slate-900 line-clamp-1">
              {incident.title}
            </h2>
            <SeverityBadge severity={incident.severity} size="sm" className="flex-shrink-0" />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
            <span className="flex items-center gap-1">
              <MapPin size={11} aria-hidden /> {incident.locationName}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} aria-hidden />
              {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            <StatusBadge state={incident.verificationState} size="sm" />
            <span className="text-xs text-slate-600 font-semibold">
              Confidence {incident.confidence.overall}%
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <FileText size={10} aria-hidden /> {incident.reportCount} reports
            </span>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Users size={10} aria-hidden /> {incident.independentSourceCount} sources
            </span>
            {incident.uniqueImageCount > 0 && (
              <span className="text-xs text-slate-400">
                · {incident.uniqueImageCount} images
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Responder state bar */}
      <div className={cn(
        'px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider border-t',
        incident.responderState === 'unacknowledged'
          ? 'border-slate-100 text-slate-400'
          : incident.responderState === 'acknowledged'
          ? 'border-blue-100 text-blue-600 bg-blue-50'
          : incident.responderState === 'dispatched'
          ? 'border-orange-100 text-orange-600 bg-orange-50'
          : 'border-green-100 text-green-600 bg-green-50'
      )}>
        {incident.responderState.replace('_', ' ')}
      </div>
    </Link>
  );
}
