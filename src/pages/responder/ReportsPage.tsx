import { useEffect, useState } from 'react';
import { Clock, MapPin, Image, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { FilterBar } from '../../components/ui/FilterBar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { mockApi } from '../../services/mockApi';
import type { Report } from '../../data/types';
import { incidentTypeIcon, incidentTypeLabel } from '../../lib/incidentHelpers';
import { cn } from '../../lib/cn';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'processing', label: 'Processing' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'corroborated', label: 'Corroborated' },
  { value: 'contradicted', label: 'Contradicted' },
];

const STATUS_BADGE: Record<
  Report['status'],
  { label: string; className: string }
> = {
  processing: { label: 'Processing', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  under_review: { label: 'Under Review', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  corroborated: { label: 'Corroborated', className: 'bg-green-50 text-green-700 border-green-200' },
  developing: { label: 'Developing', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  contradicted: { label: 'Contradicted', className: 'bg-red-50 text-red-700 border-red-200' },
  resolved: { label: 'Resolved', className: 'bg-slate-50 text-slate-600 border-slate-200' },
};

export function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string[]>(['all']);

  useEffect(() => {
    mockApi.getReports().then(data => {
      setReports(data);
      setLoading(false);
    });
  }, []);

  const filtered = reports.filter(r => {
    if (selected.includes('all')) return true;
    return selected.some(s => r.status === s);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="mb-3">
          <h1 className="text-base font-bold text-slate-900">Incoming Reports</h1>
          <p className="text-xs text-slate-500">
            Raw citizen submissions — {filtered.length} reports
          </p>
        </div>
        <FilterBar
          options={STATUS_FILTERS}
          selected={selected}
          onChange={setSelected}
        />
      </div>

      {/* Reports list */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState title="No reports" description="No reports match the current filter." />
        ) : (
          <div className="space-y-2">
            {filtered.map(report => {
              const TypeIcon = incidentTypeIcon(report.type);
              const statusBadge = STATUS_BADGE[report.status];

              return (
                <div
                  key={report.id}
                  className={cn(
                    'bg-white border rounded-xl p-4 shadow-card',
                    report.isDuplicate ? 'border-slate-100' : 'border-slate-200'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <TypeIcon size={15} className="text-slate-500" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div>
                          <h2 className="text-sm font-semibold text-slate-900 line-clamp-1">
                            {report.title}
                          </h2>
                          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
                            {incidentTypeLabel(report.type)} · {report.sourceType.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {report.isDuplicate && (
                            <span className="text-[10px] font-medium bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded">
                              Duplicate
                            </span>
                          )}
                          <span
                            className={cn(
                              'text-xs font-medium px-2 py-0.5 rounded-full border',
                              statusBadge.className
                            )}
                          >
                            {statusBadge.label}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 line-clamp-2 mb-2">{report.description}</p>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <MapPin size={10} aria-hidden /> {report.locationName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} aria-hidden />
                          {formatDistanceToNow(new Date(report.timestamp), { addSuffix: true })}
                        </span>
                        {report.media.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Image size={10} aria-hidden /> {report.media.length} media
                            {report.media.some(m => m.isRecycled) && (
                              <span className="text-amber-600 font-medium ml-1">⚠ recycled</span>
                            )}
                          </span>
                        )}
                        {report.incidentId && (
                          <a
                            href={`/responder/incidents/${report.incidentId}`}
                            className="flex items-center gap-1 text-blue-600 hover:underline"
                          >
                            <ExternalLink size={10} aria-hidden /> View incident
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
