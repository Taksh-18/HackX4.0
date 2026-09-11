import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clock, MapPin, Image, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Navbar } from '../../components/layout/Navbar';
import { mockApi } from '../../services/mockApi';
import type { Report } from '../../data/types';
import { incidentTypeIcon } from '../../lib/incidentHelpers';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { cn } from '../../lib/cn';

const STATUS_CONFIG: Record<
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

export function MyReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mockApi.getMyReports().then(data => {
      setReports(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-surface-1">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">My Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Reports you have submitted to CDIS.</p>
        </div>

        {loading ? (
          <LoadingState />
        ) : reports.length === 0 ? (
          <EmptyState
            title="No reports yet"
            description="You haven't submitted any reports. When you do, they'll appear here."
            action={
              <Link
                to="/report"
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
              >
                Submit a Report <ArrowRight size={14} />
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {reports.map(report => {
              const TypeIcon = incidentTypeIcon(report.type);
              const status = STATUS_CONFIG[report.status];
              return (
                <Link
                  key={report.id}
                  to={report.incidentId ? `/incidents/${report.incidentId}` : '#'}
                  className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 hover:shadow-card transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <TypeIcon size={16} className="text-slate-600" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h2 className="text-sm font-semibold text-slate-900 line-clamp-1">
                          {report.title}
                        </h2>
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0',
                            status.className
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <MapPin size={10} aria-hidden /> {report.locationName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={10} aria-hidden />
                          {formatDistanceToNow(new Date(report.timestamp), { addSuffix: true })}
                        </span>
                        {report.media.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Image size={10} aria-hidden /> {report.media.length}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{report.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
