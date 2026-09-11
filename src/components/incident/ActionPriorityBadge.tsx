import { cn } from '../../lib/cn';
import { actionPriorityLabel, actionPriorityColor } from '../../lib/incidentHelpers';
import type { ActionPriority } from '../../data/types';

interface Props {
  priority: ActionPriority;
  className?: string;
  size?: 'sm' | 'md';
}

export function ActionPriorityBadge({ priority, className, size = 'md' }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-bold rounded tracking-wide',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        actionPriorityColor(priority),
        className
      )}
      aria-label={`Action priority: ${actionPriorityLabel(priority)}`}
    >
      {actionPriorityLabel(priority)}
    </span>
  );
}
