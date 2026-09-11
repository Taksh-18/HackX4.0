import { cn } from '../../lib/cn';
import type { SeverityLevel } from '../../data/types';

const config: Record<SeverityLevel, { label: string; className: string }> = {
  critical: {
    label: 'Critical',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
  high: {
    label: 'High',
    className: 'bg-orange-100 text-orange-700 border border-orange-200',
  },
  moderate: {
    label: 'Moderate',
    className: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
  },
  low: {
    label: 'Low',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
};

interface Props {
  severity: SeverityLevel;
  className?: string;
  size?: 'sm' | 'md';
}

export function SeverityBadge({ severity, className, size = 'md' }: Props) {
  const { label, className: sClass } = config[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-semibold rounded',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-0.5 text-xs',
        sClass,
        className
      )}
      aria-label={`Severity: ${label}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {label}
    </span>
  );
}
