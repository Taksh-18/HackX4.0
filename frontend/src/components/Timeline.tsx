import type { TimelineEntry } from "../types/incident";
import { formatClockTime } from "../lib/format";

/** Exact Stitch audit-timeline structure: left rail dot + connecting line. */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-on-surface-variant">No timeline events yet.</p>;
  }

  return (
    <div className="relative flex flex-col gap-3 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-px before:bg-[#c6c6cd] before:content-['']">
      {entries.map((entry, i) => {
        const isLast = i === entries.length - 1;
        return (
          <div key={`${entry.time}-${i}`} className="relative">
            <span
              className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white"
              style={{ backgroundColor: isLast ? "#BA1A1A" : "#c6c6cd" }}
            />
            <div className="flex flex-col">
              <span
                className="font-mono text-xs font-semibold"
                style={{ color: isLast ? "#BA1A1A" : "#151C27" }}
              >
                {formatClockTime(entry.time)}
              </span>
              <span
                className={`text-[13px] text-on-surface ${isLast ? "font-semibold" : ""}`}
              >
                {entry.event}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
