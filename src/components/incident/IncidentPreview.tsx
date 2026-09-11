import { MapPin, Clock, FileText, Users, Image, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { Link } from 'react-router-dom';
import type { Incident } from '../../data/types';
import { SeverityBadge } from '../ui/SeverityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { ConfidenceIndicator } from '../ui/ConfidenceIndicator';
import { ActionPriorityBadge } from './ActionPriorityBadge';
import { incidentTypeIcon, incidentTypeLabel } from '../../lib/incidentHelpers';
import { cn } from '../../lib/cn';

interface Props {
  incident: Incident;
  onClose?: () => void;
  isResponder?: boolean;
  className?: string;
}

export function IncidentPreview({ incident, onClose, isResponder = false, className }: Props) {
  const TypeIcon = incidentTypeIcon(incident.type);
  const timeAgo = formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true });

  return (
    <div className={cn('bg-white rounded-xl shadow-panel border border-slate-200 w-72 overflow-hidden animate-slide-in-up', className)}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 mb-1">
          <TypeIcon size={14} className="text-slate-500" aria-hidden />
          <span className="text-xs font-medium text-slate-500">{incidentTypeLabel(incident.type)}</span>
        </div>
        <h3 className="text-sm font-semibold text-slate-900 leading-snug mb-2">
          {incident.title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={incident.severity} size="sm" />
          <StatusBadge state={incident.verificationState} size="sm" />
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <MapPin size={12} aria-hidden />
          <span>{incident.locationName}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={12} aria-hidden />
          <span>Updated {timeAgo}</span>
        </div>

        {isResponder && (
          <>
            <div className="flex items-center gap-3 text-xs text-slate-600 pt-1">
              <span className="flex items-center gap-1">
                <FileText size={11} aria-hidden /> {incident.reportCount} reports
              </span>
              <span className="flex items-center gap-1">
                <Users size={11} aria-hidden /> {incident.independentSourceCount} sources
              </span>
              <span className="flex items-center gap-1">
                <Image size={11} aria-hidden /> {incident.uniqueImageCount} images
              </span>
            </div>

            <ConfidenceIndicator confidence={incident.confidence} />

            <ActionPriorityBadge priority={incident.actionPriority} />
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 pb-4">
        <Link
          to={isResponder ? `/responder/incidents/${incident.id}` : `/incidents/${incident.id}`}
          className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
          onClick={onClose}
        >
          Open Incident
          <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
