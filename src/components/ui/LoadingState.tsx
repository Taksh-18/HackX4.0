import { cn } from '../../lib/cn';

export function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-3 animate-pulse', className)}>
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-slate-200 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-slate-200 rounded w-3/4" />
              <div className="h-2.5 bg-slate-100 rounded w-1/2" />
            </div>
            <div className="w-16 h-5 bg-slate-200 rounded" />
          </div>
          <div className="h-2 bg-slate-100 rounded w-full" />
          <div className="h-2 bg-slate-100 rounded w-5/6" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn('h-3 bg-slate-200 rounded animate-pulse', className)} />;
}
