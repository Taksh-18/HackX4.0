import { AlertTriangle } from "lucide-react";
import type { ContradictionGroup } from "../types/incident";

/**
 * Contradictory evidence must be visually obvious regardless of an
 * incident's overall score — this never hides behind a high confidence.
 */
export function ContradictionPanel({
  hasContradiction,
  groups,
}: {
  hasContradiction: boolean;
  groups: ContradictionGroup[];
}) {
  if (!hasContradiction && groups.length === 0) {
    return <p className="text-sm text-ink-muted">No conflicting reports detected.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded border border-status-critical-border bg-status-critical-bg px-3 py-2">
        <AlertTriangle size={15} className="shrink-0 text-status-critical" />
        <p className="text-sm font-medium text-status-critical">
          Conflicting claims detected in this cluster.
        </p>
      </div>
      {groups.length === 0 ? (
        <p className="text-sm text-ink-faint">
          Contradiction detected by text pattern; no structured claim group was recorded.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group, i) => (
            <div key={i} className="rounded border border-border p-3">
              <p className="mb-2 text-sm font-medium text-ink">
                {group.landmark ?? group.event_type ?? "Unlabeled claim group"}
              </p>
              <div className="flex flex-col gap-1.5 text-sm">
                <div>
                  <span className="text-status-green">Affirming</span>{" "}
                  <span className="font-mono text-ink-muted">
                    {group.affirming_report_ids.join(", ") || "none"}
                  </span>
                </div>
                <div>
                  <span className="text-status-critical">Denying</span>{" "}
                  <span className="font-mono text-ink-muted">
                    {group.denying_report_ids.join(", ") || "none"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
