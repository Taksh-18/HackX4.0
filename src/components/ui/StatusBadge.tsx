import { cn } from '../../lib/cn';
import type { VerificationState } from '../../data/types';
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react';

const config: Record<
  VerificationState,
  { label: string; Icon: React.ElementType; className: string }
> = {
  corroborated: {
    label: 'Corroborated',
    Icon: CheckCircle,
    className: 'bg-green-50 text-green-700 border border-green-200',
  },
  developing: {
    label: 'Developing',
    Icon: AlertCircle,
    className: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
  },
  contradicted: {
    label: 'Contradicted',
    Icon: XCircle,
    className: 'bg-red-50 text-red-700 border border-red-200',
  },
};

interface Props {
  state: VerificationState;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ state, className, size = 'md' }: Props) {
  const { label, Icon, className: sClass } = config[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium rounded',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        sClass,
        className
      )}
      aria-label={`Verification: ${label}`}
    >
      <Icon size={size === 'sm' ? 10 : 12} aria-hidden />
      {label}
    </span>
  );
}
