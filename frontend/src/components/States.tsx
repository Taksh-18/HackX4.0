import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-on-surface-variant">
      <Icon name="sync" size={22} className="animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <Icon name="error" size={22} className="text-status-critical" />
      <p className="text-sm text-on-surface-variant">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-[2px] border border-[#c6c6cd] px-3 py-1.5 text-sm font-medium text-on-surface hover:bg-surface-low"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <Icon name="inbox" size={22} className="text-outline" />
      <p className="text-sm font-medium text-on-surface">{title}</p>
      {description && <p className="max-w-sm text-sm text-on-surface-variant">{description}</p>}
    </div>
  );
}

/** Exact Stitch section chrome: white card, icon+uppercase header, meta on the right. */
export function Section({
  title,
  icon,
  meta,
  children,
}: {
  title: string;
  icon: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-[2px] border border-[#c6c6cd] bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-1 border-b border-[#e7eefe] pb-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name={icon} size={19} />
          <h2 className="text-[15px] font-semibold uppercase tracking-tight text-on-surface">
            {title}
          </h2>
        </div>
        {meta && <span className="font-mono text-[11px] text-on-surface-variant">{meta}</span>}
      </div>
      {children}
    </section>
  );
}
