import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Circle, Popup, useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import type { ActionPriority, MapIncident } from "../types/incident";
import { PriorityBadge } from "./Badge";

// Exact Stitch "Calm Intelligence" operational status colors.
const PRIORITY_COLOR: Record<ActionPriority, string> = {
  CRITICAL_DISPATCH: "#B91C1C",
  DEPLOY_SCOUT: "#B45309",
  MONITOR: "#515F74",
  SUPPRESSED: "#76777D",
};

function RecenterOnSelect({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [target, map]);
  return null;
}

export function IncidentMap({
  incidents,
  details,
  selectedId,
}: {
  incidents: MapIncident[];
  details: Map<
    string,
    { title: string; severity_score: number; confidence_score: number; responder_state: string }
  >;
  selectedId?: string | null;
}) {
  const center = useMemo<[number, number]>(() => {
    if (incidents.length === 0) return [28.6139, 77.209];
    return [incidents[0].center_lat, incidents[0].center_lon];
  }, [incidents]);

  const selectedTarget = useMemo<[number, number] | null>(() => {
    const found = incidents.find((i) => i.id === selectedId);
    return found ? [found.center_lat, found.center_lon] : null;
  }, [incidents, selectedId]);

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom className="h-full w-full">
      <RecenterOnSelect target={selectedTarget} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {incidents.map((incident) => {
        const detail = details.get(incident.id);
        const color = PRIORITY_COLOR[incident.action_priority];
        return (
          <div key={incident.id}>
            <Circle
              center={[incident.center_lat, incident.center_lon]}
              radius={incident.uncertainty_radius_m}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: "4 3",
              }}
            />
            <CircleMarker
              center={[incident.center_lat, incident.center_lon]}
              radius={incident.id === selectedId ? 11 : 8}
              pathOptions={{
                color: "#ffffff",
                fillColor: color,
                fillOpacity: 0.95,
                weight: 2,
              }}
            >
              <Popup>
                <div className="flex min-w-[180px] flex-col gap-2">
                  <p className="text-sm font-medium text-ink">{detail?.title ?? incident.id}</p>
                  {detail && (
                    <p className="text-sm text-ink-muted">
                      Severity {detail.severity_score.toFixed(1)}/10 · Confidence{" "}
                      {Math.round(detail.confidence_score)}%
                    </p>
                  )}
                  <PriorityBadge priority={incident.action_priority} />
                  <Link
                    to={`/incidents/${incident.id}`}
                    className="text-sm font-medium text-status-slate hover:underline"
                  >
                    View Incident
                  </Link>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        );
      })}
    </MapContainer>
  );
}

// Fix default marker icon paths (not used since CircleMarker is used, kept for safety).
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
