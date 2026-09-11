import { ShieldAlert } from "lucide-react";
import type { MisinformationRisk } from "../types/incident";
import { MisinformationRiskBadge } from "./Badge";

/**
 * Misinformation risk is shown separately from confidence on purpose — it
 * is a heuristic signal, never proof. `proven_false` from the backend is
 * always false; this never implies "not proven false" means "true."
 */
export function MisinformationPanel({ risk }: { risk: MisinformationRisk }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">Misinformation risk</span>
        <MisinformationRiskBadge level={risk.risk_level} />
      </div>
      <p className="text-sm leading-relaxed text-ink">{risk.assessment}</p>
      {risk.signals.length > 0 && (
        <ul className="flex flex-col gap-1">
          {risk.signals.map((signal, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm text-ink-muted">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
              {signal}
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-1.5 rounded border border-status-slate-border bg-status-slate-bg px-2.5 py-2 text-xs text-status-slate">
        <ShieldAlert size={13} className="mt-0.5 shrink-0" />
        <span>
          This is a heuristic risk estimate, not a determination of truth. A low score
          never means a claim has been proven true, and a high score never means it has
          been proven false. proven_false: {String(risk.proven_false)}.
        </span>
      </div>
    </div>
  );
}
