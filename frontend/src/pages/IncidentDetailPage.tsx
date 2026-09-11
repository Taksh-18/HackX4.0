import { Link, useParams } from "react-router-dom";
import {
  acknowledgeIncident,
  dispatchIncident,
  getEvidence,
  getIncident,
  resolveIncident,
} from "../api/incidents";
import { PriorityBadge, VerificationBadge } from "../components/Badge";
import { ConfidenceBreakdownPanel } from "../components/ConfidenceBreakdown";
import { ContradictionPanel } from "../components/ContradictionPanel";
import { EvidenceGrid } from "../components/EvidenceGrid";
import { Icon } from "../components/Icon";
import { ImageAnalysisList } from "../components/ImageAnalysisList";
import { IncidentActions } from "../components/IncidentActions";
import { LimitationsNote } from "../components/LimitationsNote";
import { MisinformationPanel } from "../components/MisinformationPanel";
import { NeedsPanel } from "../components/NeedsPanel";
import { ReportCard } from "../components/ReportCard";
import { EmptyState, ErrorState, LoadingState, Section } from "../components/States";
import { Timeline } from "../components/Timeline";
import { useAsync } from "../lib/useAsync";

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: incident, loading, error, refetch } = useAsync(() => getIncident(id!), [id]);
  const { data: evidenceRead, refetch: refetchEvidence } = useAsync(
    () => getEvidence(id!),
    [id],
  );

  if (loading) {
    return (
      <div className="p-6">
        <LoadingState label="Loading incident..." />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="p-6">
        <ErrorState message={error ?? "Incident not found"} onRetry={refetch} />
      </div>
    );
  }

  const evidence = evidenceRead?.evidence_json ?? incident.evidence_json;
  const refetchAll = () => {
    refetch();
    refetchEvidence();
  };
  const firstTimelineTime = incident.timeline_json[0]?.time;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 p-4 md:p-6">
      {/* Back link + session row */}
      <div className="flex items-center justify-between">
        <Link
          to="/incidents"
          className="group inline-flex items-center gap-1 text-[13px] text-on-surface-variant transition-colors hover:text-on-surface"
        >
          <Icon name="arrow_back" size={18} className="transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Intelligence Queue</span>
        </Link>
        <div className="flex items-center gap-1.5 font-mono text-xs text-on-surface-variant">
          <span>{incident.id}</span>
          {incident.updated_at && (
            <>
              <span>·</span>
              <span>Updated {new Date(incident.updated_at).toLocaleString()}</span>
            </>
          )}
        </div>
      </div>

      {/* Header card */}
      <div className="flex flex-col justify-between gap-4 rounded-[2px] border border-[#c6c6cd] bg-white p-4 shadow-sm md:flex-row md:items-center md:p-5">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-[2px] bg-surface-container px-2 py-0.5 font-mono text-xs font-semibold text-on-surface">
              {incident.id}
            </span>
            <PriorityBadge priority={incident.action_priority} />
            <VerificationBadge status={incident.verification_status} />
          </div>
          <h1 className="text-[20px] font-semibold uppercase tracking-tight text-on-surface">
            {incident.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-on-surface-variant">
            <span className="font-semibold text-on-surface">{incident.event_type}</span>
            <span>·</span>
            <span className="rounded-[2px] bg-surface-container px-1.5 py-0.5 text-on-surface">
              {incident.center_lat.toFixed(4)}° N, {incident.center_lon.toFixed(4)}° E
            </span>
            <span>·</span>
            <span className="text-on-surface">±{Math.round(incident.uncertainty_radius_m)}m uncertainty</span>
          </div>
        </div>

        {/* Metric cluster */}
        <div className="flex shrink-0 items-center gap-4 rounded-[2px] bg-surface-low p-2">
          <div className="flex flex-col items-center border-r border-[#c6c6cd] px-4">
            <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Severity</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-[20px] font-bold text-status-critical">
                {incident.severity_score.toFixed(1)}
              </span>
              <span className="text-xs text-on-surface-variant">/10</span>
            </div>
          </div>
          <div className="flex flex-col items-center border-r border-[#c6c6cd] px-4">
            <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Confidence</span>
            <span className="text-[20px] font-bold text-on-surface">
              {Math.round(incident.confidence_score)}%
            </span>
          </div>
          <div className="flex flex-col items-center px-4">
            <span className="text-[11px] font-semibold uppercase text-on-surface-variant">Trapped</span>
            <span className="text-[20px] font-bold text-on-surface">
              {incident.aggregated_needs_json.estimated_trapped_total} Max
            </span>
          </div>
        </div>
      </div>

      {/* Two-column tactical layout */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Section title="Intelligence Assessment" icon="verified_user" meta="CDIS Multi-Vector Verification">
            <ConfidenceBreakdownPanel
              breakdown={evidence.confidence_breakdown}
              confidenceScore={incident.confidence_score}
            />
            <div className="border-t border-[#e7eefe] pt-3">
              <EvidenceGrid evidence={evidence} />
            </div>
          </Section>

          <Section title="Citizen Reports & On-Ground Evidence" icon="record_voice_over" meta="Chronological clustering">
            {incident.report_links.length === 0 ? (
              <EmptyState title="No linked reports yet" />
            ) : (
              <div className="flex flex-col gap-2">
                {incident.report_links.map((link) => (
                  <ReportCard key={link.report_id} link={link} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Contradiction Signals" icon="account_tree">
            <ContradictionPanel
              hasContradiction={evidence.has_contradiction}
              groups={evidence.contradiction_groups}
            />
          </Section>

          <Section title="Misinformation Risk" icon="policy">
            <MisinformationPanel risk={evidence.misinformation} />
          </Section>

          <Section title="Media Intelligence" icon="image_search">
            <ImageAnalysisList analyses={evidence.image_analyses} />
          </Section>

          {evidence.limitations.length > 0 && <LimitationsNote limitations={evidence.limitations} />}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-4">
          <Section title="Responder Action" icon="bolt">
            <IncidentActions
              state={incident.responder_state}
              onAcknowledge={async () => {
                await acknowledgeIncident(incident.id);
                refetchAll();
              }}
              onDispatch={async () => {
                await dispatchIncident(incident.id);
                refetchAll();
              }}
              onResolve={async () => {
                await resolveIncident(incident.id);
                refetchAll();
              }}
            />
          </Section>

          <Section title="Aggregated Needs" icon="inventory_2">
            <NeedsPanel needs={incident.aggregated_needs_json} />
          </Section>

          <Section title="Audit Timeline" icon="history" meta={firstTimelineTime ? "UTC LOG" : undefined}>
            <Timeline entries={incident.timeline_json} />
          </Section>
        </div>
      </div>
    </div>
  );
}
