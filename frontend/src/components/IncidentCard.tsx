import { Link } from "react-router-dom";
import type { ActionPriority, Incident } from "../types/incident";
import { PriorityBadge, ResponderStateBadge, VerificationBadge } from "./Badge";
import { ConfidenceBar } from "./ConfidenceBar";
import { Icon } from "./Icon";
import { formatRelativeTime } from "../lib/format";

const LEFT_ACCENT: Record<ActionPriority, string> = {
  CRITICAL_DISPATCH: "#B91C1C",
  DEPLOY_SCOUT: "#B45309",
  MONITOR: "#515F74",
  SUPPRESSED: "#76777D",
};

const CONFIDENCE_DOT: Record<string, string> = {
  green: "#15803D",
  amber: "#B45309",
  critical: "#DC2626",
};

function confidenceTone(score: number) {
  if (score >= 70) return "green";
  if (score >= 40) return "amber";
  return "critical";
}

/** Evidence checklist line derived only from real evidence_json fields —
 * mirrors Stitch's "Strong geo agreement · Fresh media · No contradiction
 * detected" row, but every clause is computed from a real field. */
function evidenceLine(incident: Incident): { icon: string; color: string; text: string } {
  const e = incident.evidence_json;
  if (e.has_contradiction) {
    return { icon: "cancel", color: "#DC2626", text: "Contradiction detected in cluster" };
  }
  const clauses = [
    e.geo_agreement >= 0.7
      ? "Strong geo agreement"
      : e.geo_agreement >= 0.4
        ? "Moderate geo agreement"
        : "Weak geo agreement",
    e.fresh_media_ratio >= 0.5 ? "Fresh media verified" : "No fresh media",
    "No contradiction detected",
  ];
  const icon =
    e.geo_agreement >= 0.7 && e.fresh_media_ratio >= 0.5
      ? "verified"
      : e.geo_agreement < 0.4
        ? "warning"
        : "check_circle";
  const color = icon === "verified" ? "#15803D" : icon === "warning" ? "#B45309" : "#76777D";
  return { icon, color, text: clauses.join(" · ") };
}

export function IncidentCard({
  incident,
  onAcknowledge,
}: {
  incident: Incident;
  onAcknowledge: (id: string) => void;
}) {
  const e = incident.evidence_json;
  const line = evidenceLine(incident);
  const tone = confidenceTone(incident.confidence_score);

  return (
    <article
      className="flex flex-col gap-2 rounded-[2px] border border-[#c6c6cd] bg-white p-3 shadow-[0_1px_3px_rgba(0,0,0,0.03)]"
      style={{ borderLeftWidth: 4, borderLeftColor: LEFT_ACCENT[incident.action_priority] }}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-bold text-on-surface">{incident.id}</span>
          <PriorityBadge priority={incident.action_priority} />
          <VerificationBadge status={incident.verification_status} />
        </div>
        <span className="text-xs text-on-surface-variant">
          {incident.updated_at ? formatRelativeTime(incident.updated_at) : ""}
          {e.total_reports > 0 && ` · ${e.total_reports} report${e.total_reports === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-baseline justify-between gap-2">
          <Link to={`/incidents/${incident.id}`}>
            <h2 className="text-[17px] font-bold tracking-tight text-on-surface hover:underline">
              {incident.title}
            </h2>
          </Link>
          <span
            className="shrink-0 font-mono text-xs font-bold"
            style={{ color: LEFT_ACCENT[incident.action_priority] }}
          >
            Severity {incident.severity_score.toFixed(1)} / 10
          </span>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wide text-on-surface-variant">
          {incident.event_type} · {incident.center_lat.toFixed(4)}° N, {incident.center_lon.toFixed(4)}° E
        </span>
      </div>

      <div className="flex flex-col gap-1 pt-1">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[13px] font-semibold text-on-surface">
              {Math.round(incident.confidence_score)}% Confidence
            </span>
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: CONFIDENCE_DOT[tone] }}
            />
          </div>
          <span className="text-xs text-on-surface-variant">
            {e.independent_sources} independent source{e.independent_sources === 1 ? "" : "s"}
            {e.unique_images > 0 && ` · ${e.unique_images} unique image${e.unique_images === 1 ? "" : "s"}`}
            {incident.aggregated_needs_json.estimated_trapped_total > 0 &&
              ` · ${incident.aggregated_needs_json.estimated_trapped_total} estimated trapped`}
          </span>
        </div>
        <ConfidenceBar score={incident.confidence_score} />
        <div className="flex items-center gap-1 text-[11px] font-mono text-on-surface-variant">
          <Icon name={line.icon} size={14} style={{ color: line.color }} />
          <span>{line.text}</span>
        </div>
      </div>

      <div className="mt-0.5 flex items-center justify-between border-t border-[#e7eefe] pt-1.5">
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          {e.unique_images > 0 && (
            <span className="flex items-center gap-1">
              <Icon name="photo_camera" size={15} /> {e.unique_images} Photo
              {e.unique_images === 1 ? "" : "s"}
            </span>
          )}
          <ResponderStateBadge state={incident.responder_state} />
        </div>
        <div className="flex items-center gap-2">
          {incident.responder_state === "UNACKNOWLEDGED" && (
            <button
              type="button"
              onClick={() => onAcknowledge(incident.id)}
              className="inline-flex items-center gap-1 rounded-[2px] bg-[#000000] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-neutral-800"
            >
              Acknowledge
            </button>
          )}
          <Link
            to={`/incidents/${incident.id}`}
            className="inline-flex items-center gap-1.5 rounded-[2px] border border-[#c6c6cd] bg-white px-3 py-1.5 text-[13px] font-medium text-on-surface hover:bg-surface-low"
          >
            <span>View Incident</span>
            <Icon name="arrow_forward" size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
