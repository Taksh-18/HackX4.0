import { useState } from 'react';
import { MapPin, Image, Globe, AlertTriangle, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Incident } from '../../data/types';
import { MediaGallery } from '../ui/MediaGallery';
import { cn } from '../../lib/cn';

interface Props {
  incident: Incident;
  className?: string;
}

type Tab = 'reports' | 'sources' | 'media';

export function EvidencePanel({ incident, className }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('reports');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'reports', label: 'Citizen Reports', count: incident.reportCount },
    { id: 'sources', label: 'Independent Sources', count: incident.independentSourceCount },
    { id: 'media', label: 'Media', count: incident.uniqueImageCount },
  ];

  return (
    <div className={cn('bg-white border border-slate-200 rounded-xl overflow-hidden', className)}>
      {/* Tab bar */}
      <div className="flex border-b border-slate-200">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-medium transition-colors border-b-2',
              activeTab === tab.id
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            )}
            aria-selected={activeTab === tab.id}
            role="tab"
          >
            {tab.label}
            <span
              className={cn(
                'px-1.5 rounded-full text-[10px]',
                activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4" role="tabpanel">
        {/* Reports tab */}
        {activeTab === 'reports' && (
          <div className="space-y-3">
            {incident.reports.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No citizen reports attached.</p>
            ) : (
              incident.reports.map(report => (
                <div
                  key={report.id}
                  className={cn(
                    'border rounded-lg p-3 text-sm',
                    report.isDuplicate
                      ? 'border-slate-100 bg-slate-50'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="font-medium text-slate-800 line-clamp-1">{report.title}</span>
                    {report.isDuplicate && (
                      <span className="text-[10px] font-medium bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">
                        Duplicate
                      </span>
                    )}
                  </div>
                  <p className="text-slate-600 text-xs line-clamp-2 mb-2">{report.description}</p>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <MapPin size={10} aria-hidden />
                      {report.distance != null ? `~${report.distance}m from centre` : report.locationName}
                    </span>
                    <span>{formatDistanceToNow(new Date(report.timestamp), { addSuffix: true })}</span>
                    {report.media.length > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Image size={10} aria-hidden />
                        {report.media.length}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Sources tab */}
        {activeTab === 'sources' && (
          <div className="space-y-3">
            {incident.independentSources.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No independent sources detected yet.</p>
            ) : (
              incident.independentSources.map(source => (
                <div key={source.id} className="flex items-start gap-3 border border-slate-200 rounded-lg p-3">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <Globe size={14} className="text-slate-500" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-slate-800">{source.name}</span>
                      {source.verified ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                          <CheckCircle size={9} aria-hidden /> Verified
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          Unverified
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 capitalize">
                      {source.type.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Media tab */}
        {activeTab === 'media' && (
          <div className="space-y-3">
            {incident.hasRecycledMedia && (
              <div
                className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3"
                role="alert"
              >
                <AlertTriangle size={14} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-xs font-semibold text-amber-800 mb-0.5">Potential recycled media detected</p>
                  <p className="text-xs text-amber-700">
                    One or more images may match previously published content. Review carefully before acting on this media.
                  </p>
                </div>
              </div>
            )}
            <MediaGallery media={incident.media} />
          </div>
        )}
      </div>
    </div>
  );
}
