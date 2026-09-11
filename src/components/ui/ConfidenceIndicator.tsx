import { cn } from '../../lib/cn';
import type { ConfidenceBreakdown } from '../../data/types';
import { Shield, MapPin, Image, Globe } from 'lucide-react';

interface Props {
  confidence: ConfidenceBreakdown;
  showBreakdown?: boolean;
  className?: string;
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${value}%` }}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function ConfidenceIndicator({ confidence, showBreakdown = false, className }: Props) {
  const { overall } = confidence;
  const color =
    overall >= 75
      ? 'text-green-700'
      : overall >= 50
      ? 'text-yellow-700'
      : 'text-red-700';

  const barColor =
    overall >= 75
      ? 'bg-green-500'
      : overall >= 50
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield size={14} className={color} aria-hidden />
          <span className="text-sm font-semibold text-slate-700">Confidence</span>
        </div>
        <span className={cn('text-sm font-bold tabular-nums', color)}>
          {overall}%
        </span>
      </div>
      <Bar value={overall} color={barColor} />

      {showBreakdown && (
        <div className="pt-1 space-y-2">
          {[
            { icon: Shield, label: 'Sources', value: confidence.sources },
            { icon: MapPin, label: 'Geolocation', value: confidence.geolocation },
            { icon: Image, label: 'Media', value: confidence.media },
            { icon: Globe, label: 'External verification', value: confidence.externalVerification },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon size={12} className="text-slate-400 flex-shrink-0" aria-hidden />
              <span className="text-xs text-slate-500 w-28 flex-shrink-0">{label}</span>
              <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400"
                  style={{ width: `${value}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 tabular-nums w-7 text-right">{value}%</span>
            </div>
          ))}
          {confidence.contradictionPenalty > 0 && (
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-xs text-red-600 font-medium">
                Contradiction penalty: −{confidence.contradictionPenalty}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
