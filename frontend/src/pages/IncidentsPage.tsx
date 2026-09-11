import { useMemo, useState } from "react";
import { acknowledgeIncident, getMapIncidents, listIncidents } from "../api/incidents";
import { Icon } from "../components/Icon";
import { IncidentCard } from "../components/IncidentCard";
import { IncidentFilters, type IncidentFilterState } from "../components/IncidentFilters";
import { IncidentMap } from "../components/IncidentMap";
import { IncidentSummary } from "../components/IncidentSummary";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAsync } from "../lib/useAsync";
import { useLiveUpdates } from "../lib/useLiveUpdates";

const DEFAULT_FILTERS: IncidentFilterState = { tab: "all", search: "" };

export function IncidentsPage() {
  const [filters, setFilters] = useState<IncidentFilterState>(DEFAULT_FILTERS);
  const { data: incidents, loading, error, refetch } = useAsync(
    () => listIncidents("all"),
    [],
  );
  const { data: mapIncidents, refetch: refetchMap } = useAsync(getMapIncidents, []);

  const lastChecked = useLiveUpdates(() => {
    refetch();
    refetchMap();
  });

  const filtered = useMemo(() => {
    if (!incidents) return [];
    const q = filters.search.trim().toLowerCase();
    return incidents.filter((incident) => {
      if (
        q &&
        !incident.title.toLowerCase().includes(q) &&
        !incident.id.toLowerCase().includes(q) &&
        !incident.event_type.toLowerCase().includes(q)
      ) {
        return false;
      }
      switch (filters.tab) {
        case "critical":
          return incident.action_priority === "CRITICAL_DISPATCH";
        case "developing":
          return incident.verification_status === "DEVELOPING";
        case "monitor":
          return incident.action_priority === "MONITOR";
        case "resolved":
          return incident.responder_state === "RESOLVED";
        default:
          return true;
      }
    });
  }, [incidents, filters]);

  const mapDetails = useMemo(() => {
    const map = new Map<
      string,
      { title: string; severity_score: number; confidence_score: number; responder_state: string }
    >();
    incidents?.forEach((incident) => {
      map.set(incident.id, {
        title: incident.title,
        severity_score: incident.severity_score,
        confidence_score: incident.confidence_score,
        responder_state: incident.responder_state,
      });
    });
    return map;
  }, [incidents]);

  const handleAcknowledge = async (id: string) => {
    await acknowledgeIncident(id);
    refetch();
  };

  return (
    <div className="flex flex-col gap-3 p-4 md:p-6">
      {/* Top header card */}
      <div className="flex flex-col gap-3 rounded-[2px] border border-[#c6c6cd] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] md:px-5 md:py-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-[22px] font-bold tracking-tight text-on-surface">
              Disaster Intelligence
            </h1>
            {incidents && <IncidentSummary incidents={incidents} />}
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-on-surface-variant">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-status-green-solid" />
              Auto-check 10s
            </span>
            <span className="text-outline-variant">|</span>
            <span>Last check: {lastChecked.toLocaleTimeString()}</span>
            <Icon
              name="sync"
              size={15}
              className="cursor-pointer text-outline transition-colors hover:text-on-surface"
            />
          </div>
        </div>
        {incidents && (
          <IncidentFilters filters={filters} onChange={setFilters} incidents={incidents} />
        )}
      </div>

      {/* Dual-pane: prioritized feed (left) + operational map (right) */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
        <div className="flex flex-col gap-2 xl:col-span-7">
          <div className="mb-1 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-on-surface">
              <span className="h-1.5 w-1.5 rounded-full bg-black" />
              Triage Incident Queue
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {filtered.length} item{filtered.length === 1 ? "" : "s"} displayed
            </span>
          </div>

          {loading && <LoadingState label="Loading incidents..." />}
          {error && <ErrorState message={error} onRetry={refetch} />}
          {!loading && !error && filtered.length === 0 && (
            <EmptyState
              title="No incidents match your filters"
              description="Try adjusting the search or status tab, or check back after new reports arrive."
            />
          )}
          {!loading && !error && filtered.length > 0 && (
            <div className="flex flex-col gap-3">
              {filtered.map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  onAcknowledge={handleAcknowledge}
                />
              ))}
            </div>
          )}
        </div>

        <div className="hidden xl:sticky xl:top-20 xl:col-span-5 xl:flex xl:flex-col xl:gap-2">
          <div className="flex items-center justify-between rounded-[2px] border border-[#c6c6cd] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center gap-2">
              <Icon name="layers" size={18} />
              <span className="text-[14px] font-bold text-on-surface">Operational Map</span>
            </div>
            <span className="rounded-[2px] border border-[#c6c6cd] bg-surface-container px-2 py-0.5 font-mono text-[11px] font-medium text-on-surface">
              Active ({incidents?.filter((i) => i.responder_state !== "RESOLVED").length ?? 0})
            </span>
          </div>
          <div className="h-[650px] overflow-hidden rounded-[2px] border border-[#c6c6cd] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            {mapIncidents && mapIncidents.length > 0 ? (
              <IncidentMap incidents={mapIncidents} details={mapDetails} />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#EAEFE9]">
                <EmptyState
                  title="No mapped incidents"
                  description="Unresolved incidents with a resolved location appear here."
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
