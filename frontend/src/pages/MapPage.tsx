import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getMapIncidents, listIncidents } from "../api/incidents";
import { Icon } from "../components/Icon";
import { IncidentMap } from "../components/IncidentMap";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAsync } from "../lib/useAsync";

const PRIORITY_DOT: Record<string, string> = {
  CRITICAL_DISPATCH: "#B91C1C",
  DEPLOY_SCOUT: "#B45309",
  MONITOR: "#515F74",
  SUPPRESSED: "#76777D",
};

export function MapPage() {
  const { data: mapIncidents, loading, error, refetch } = useAsync(getMapIncidents, []);
  const { data: incidents } = useAsync(() => listIncidents("all"), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const details = useMemo(() => {
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

  const unresolved = incidents?.filter((i) => i.responder_state !== "RESOLVED") ?? [];
  const counts = {
    all: unresolved.length,
    critical: unresolved.filter((i) => i.action_priority === "CRITICAL_DISPATCH").length,
    scout: unresolved.filter((i) => i.action_priority === "DEPLOY_SCOUT").length,
    monitor: unresolved.filter((i) => i.action_priority === "MONITOR").length,
    suppressed: unresolved.filter((i) => i.action_priority === "SUPPRESSED").length,
  };

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-surface-low">
      <div className="relative h-full flex-1 overflow-hidden bg-[#e8ecf4]">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-surface-low">
            <LoadingState label="Loading map..." />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-surface-low">
            <ErrorState message={error} onRetry={refetch} />
          </div>
        )}
        {!loading && !error && mapIncidents && mapIncidents.length === 0 && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-surface-low">
            <EmptyState
              title="No unresolved incidents to display"
              description="Incidents appear here once the backend has resolved their location."
            />
          </div>
        )}
        {!loading && !error && mapIncidents && mapIncidents.length > 0 && (
          <IncidentMap incidents={mapIncidents} details={details} selectedId={selectedId} />
        )}

        {/* Floating header/control strip */}
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-[1000] flex flex-wrap items-center justify-between gap-2">
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-md">
            <span className="h-2 w-2 shrink-0 rounded-full bg-status-critical-solid" />
            <div className="flex flex-col">
              <span className="text-[14px] font-bold leading-tight text-on-surface">
                Operational Map
              </span>
              <span className="text-[11px] uppercase leading-tight tracking-wide text-on-surface-variant">
                {unresolved.length} unresolved incident{unresolved.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-white p-1 shadow-md">
            <div className="flex items-center gap-2 rounded-lg bg-surface-low px-2 py-1 text-[11px] font-semibold uppercase">
              <span>All ({counts.all})</span>
              <span style={{ color: PRIORITY_DOT.CRITICAL_DISPATCH }}>Critical ({counts.critical})</span>
              <span style={{ color: PRIORITY_DOT.DEPLOY_SCOUT }}>Scout ({counts.scout})</span>
              <span style={{ color: PRIORITY_DOT.MONITOR }}>Monitor ({counts.monitor})</span>
              <span className="text-outline">Suppressed ({counts.suppressed})</span>
            </div>
          </div>
        </div>

        {/* Legend + scale (bottom-left) */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-white px-3 py-1.5 shadow-md">
            {(["Critical", "Scout", "Monitor", "Suppressed"] as const).map((label, i) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: [
                      PRIORITY_DOT.CRITICAL_DISPATCH,
                      PRIORITY_DOT.DEPLOY_SCOUT,
                      PRIORITY_DOT.MONITOR,
                      PRIORITY_DOT.SUPPRESSED,
                    ][i],
                  }}
                />
                <span className="text-[11px] text-on-surface">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right drawer: real incident intelligence, not fabricated sensors */}
      <aside className="hidden h-full w-96 flex-col bg-white shadow-xl xl:flex">
        <div className="flex items-center gap-2 bg-surface-low p-4">
          <Icon name="analytics" size={20} />
          <div className="flex flex-col">
            <h3 className="text-[15px] font-bold leading-tight text-on-surface">
              Incident Intelligence
            </h3>
            <span className="text-[11px] uppercase tracking-wide text-on-surface-variant">
              Unresolved, sorted by severity
            </span>
          </div>
        </div>
        <div className="flex-1 divide-y divide-[#e7eefe] overflow-y-auto">
          {unresolved.length === 0 && (
            <div className="p-4">
              <EmptyState title="No unresolved incidents" />
            </div>
          )}
          {unresolved.map((incident) => (
            <button
              key={incident.id}
              type="button"
              onClick={() => setSelectedId(incident.id)}
              className={`w-full p-4 text-left transition-colors hover:bg-surface-low ${
                selectedId === incident.id ? "bg-surface-low" : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: PRIORITY_DOT[incident.action_priority] }}
                  />
                  <span className="font-mono text-xs font-semibold text-on-surface">
                    {incident.id}
                  </span>
                </div>
              </div>
              <h4 className="mt-1 text-[14px] font-semibold text-on-surface">{incident.title}</h4>
              <div className="mt-2 flex items-center justify-between">
                <span
                  className="text-xs font-semibold"
                  style={{ color: PRIORITY_DOT[incident.action_priority] }}
                >
                  {Math.round(incident.confidence_score)}% Confidence
                </span>
                <Link
                  to={`/incidents/${incident.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 text-[11px] font-semibold uppercase text-status-slate hover:text-on-surface"
                >
                  <Icon name="arrow_forward" size={13} />
                  Open
                </Link>
              </div>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
