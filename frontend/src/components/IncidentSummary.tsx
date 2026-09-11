import type { Incident } from "../types/incident";

/** Exact Stitch telemetry-dot summary row: colored dot + bold count + label. */
export function IncidentSummary({ incidents }: { incidents: Incident[] }) {
  const active = incidents.filter((i) => i.responder_state !== "RESOLVED").length;
  const critical = incidents.filter((i) => i.action_priority === "CRITICAL_DISPATCH").length;
  const contradicted = incidents.filter((i) => i.verification_status === "CONTRADICTED").length;

  const items: { label: string; value: number; color: string }[] = [
    { label: "active", value: active, color: "#151C27" },
    { label: "critical", value: critical, color: "#B91C1C" },
    { label: "contradicted", value: contradicted, color: "#B91C1C" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-on-surface-variant">
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1">
          {i > 0 && <span className="mr-1 text-outline-variant">·</span>}
          <span
            className="inline-flex items-center gap-1.5 font-semibold"
            style={{ color: item.color }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.value} {item.label}
          </span>
        </span>
      ))}
    </div>
  );
}
