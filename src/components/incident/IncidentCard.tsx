import { MapPin, Clock, Users, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import type { Incident } from '../../data/types';
import { SeverityBadge } from '../ui/SeverityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { ActionPriorityBadge } from './ActionPriorityBadge';
import { incidentTypeIcon } from '../../lib/incidentHelpers';
import { cn } from '../../lib/cn';

interface Props {
  incident: Incident;
  isResponder?: boolean;
  className?: string;
  onClick?: () => void;
}

export function IncidentCard({ incident, isResponder = false, className, onClick }: Props) {
  const TypeIcon = incidentTypeIcon(incident.type);
  const timeAgo = formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true });

  const content = (
    <div
      className={cn(
        'bg-white border border-slate-200 rounded-lg p-4 hover:border-slate-300 hover:shadow-card transition-all cursor-pointer animate-fade-in',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <TypeIcon size={16} className="text-slate-600" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-slate-900 leading-snug line-clamp-2">
              {incident.title}
            </h3>
            <SeverityBadge severity={incident.severity} size="sm" className="flex-shrink-0" />
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
            <span className="flex items-center gap-1">
              <MapPin size={11} aria-hidden /> {incident.locationName}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} aria-hidden /> {timeAgo}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <StatusBadge state={incident.verificationState} size="sm" />
            {isResponder && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-0.5">
                  <FileText size={11} aria-hidden /> {incident.reportCount}
                </span>
                <span className="flex items-center gap-0.5">
                  <Users size={11} aria-hidden /> {incident.independentSourceCount} sources
                </span>
                <span className="font-semibold text-slate-600">
                  {incident.confidence.overall}%
                </span>
              </div>
            )}
          </div>

          {isResponder && (
            <div className="mt-2">
              <ActionPriorityBadge priority={incident.actionPriority} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (onClick) return content;

  return (
    <Link
      to={isResponder ? `/responder/incidents/${incident.id}` : `/incidents/${incident.id}`}
      className="block"
    >
      {content}
    </Link>
  );
}
