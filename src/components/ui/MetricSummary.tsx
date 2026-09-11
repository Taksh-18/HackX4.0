import { cn } from '../../lib/cn';

interface Metric {
  label: string;
  value: number | string;
  color?: 'red' | 'orange' | 'yellow' | 'green' | 'slate';
}

interface Props {
  metrics: Metric[];
  className?: string;
}

const colorMap: Record<string, string> = {
  red: 'text-red-600',
  orange: 'text-orange-600',
  yellow: 'text-yellow-600',
  green: 'text-green-600',
  slate: 'text-slate-700',
};

export function MetricSummary({ metrics, className }: Props) {
  return (
    <div className={cn('flex items-center divide-x divide-slate-200', className)}>
      {metrics.map((m) => (
        <div key={m.label} className="flex flex-col items-center px-4 first:pl-0 last:pr-0">
          <span
            className={cn(
              'text-2xl font-bold tabular-nums leading-none',
              colorMap[m.color ?? 'slate']
            )}
          >
            {m.value}
          </span>
          <span className="text-xs text-slate-500 mt-0.5 font-medium uppercase tracking-wide">
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}
