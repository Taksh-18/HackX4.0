import { cn } from '../../lib/cn';
import { format } from 'date-fns';
import type { TimelineEvent } from '../../data/types';
import {
  FileText, Layers, Image, Globe, CheckCircle, Shield, RefreshCw
} from 'lucide-react';

const eventConfig: Record<TimelineEvent['type'], { Icon: React.ElementType; color: string }> = {
  report: { Icon: FileText, color: 'text-blue-500' },
  cluster: { Icon: Layers, color: 'text-purple-500' },
  media: { Icon: Image, color: 'text-amber-500' },
  source: { Icon: Globe, color: 'text-teal-500' },
  verification: { Icon: CheckCircle, color: 'text-green-500' },
  responder: { Icon: Shield, color: 'text-slate-500' },
  update: { Icon: RefreshCw, color: 'text-slate-400' },
};

interface Props {
  events: TimelineEvent[];
  className?: string;
}

export function IncidentTimeline({ events, className }: Props) {
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <ol className={cn('relative space-y-0', className)} aria-label="Incident timeline">
      {sorted.map((event, idx) => {
        const { Icon, color } = eventConfig[event.type];
        const isLast = idx === sorted.length - 1;
        return (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {/* vertical line */}
            {!isLast && (
              <div
                className="absolute left-3 top-6 w-px bg-slate-200"
                style={{ height: 'calc(100% - 0px)' }}
                aria-hidden
              />
            )}
            {/* icon */}
            <div
              className={cn(
                'w-6 h-6 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0 z-10',
              )}
            >
              <Icon size={11} className={color} aria-hidden />
            </div>
            {/* content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{event.title}</span>
                <time
                  dateTime={event.timestamp}
                  className="text-xs text-slate-400 flex-shrink-0 tabular-nums"
                >
                  {format(new Date(event.timestamp), 'HH:mm')}
                </time>
              </div>
              {event.description && (
                <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
