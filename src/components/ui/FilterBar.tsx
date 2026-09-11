import { cn } from '../../lib/cn';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface Props {
  options: FilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function FilterBar({ options, selected, onChange, multiple = false, className }: Props) {
  const toggle = (value: string) => {
    if (value === 'all') {
      onChange(['all']);
      return;
    }
    if (!multiple) {
      onChange([value]);
      return;
    }
    const without = selected.filter(v => v !== 'all');
    if (without.includes(value)) {
      const next = without.filter(v => v !== value);
      onChange(next.length === 0 ? ['all'] : next);
    } else {
      onChange([...without, value]);
    }
  };

  return (
    <div
      className={cn('flex items-center gap-1 flex-wrap', className)}
      role="group"
      aria-label="Filter options"
    >
      {options.map(opt => {
        const isActive =
          selected.includes(opt.value) ||
          (opt.value === 'all' && (selected.length === 0 || selected.includes('all')));
        return (
          <button
            key={opt.value}
            onClick={() => toggle(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
              isActive
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}
            aria-pressed={isActive}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span
                className={cn(
                  'text-xs rounded-full px-1.5 py-0',
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                )}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
