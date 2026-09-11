import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident, LatLng } from '../../data/types';
import { IncidentPreview } from '../incident/IncidentPreview';

// Fix Leaflet default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const SEVERITY_COLORS: Record<string, { fill: string; stroke: string }> = {
  critical: { fill: '#DC2626', stroke: '#991B1B' },
  high: { fill: '#EA580C', stroke: '#9A3412' },
  moderate: { fill: '#CA8A04', stroke: '#854D0E' },
  low: { fill: '#16A34A', stroke: '#14532D' },
};

// CHANGED: responder pins encode action priority, matching the priority feed.
const PRIORITY_COLORS: Record<string, { fill: string; stroke: string }> = {
  critical_dispatch: { fill: '#DC2626', stroke: '#991B1B' },
  deploy_scout: { fill: '#EA580C', stroke: '#9A3412' },
  monitor: { fill: '#64748B', stroke: '#334155' },
  suppressed: { fill: '#94A3B8', stroke: '#64748B' },
};

const VERIFICATION_OPACITY: Record<string, number> = {
  corroborated: 0.18,
  developing: 0.12,
  contradicted: 0.08,
};

function createIncidentIcon(incident: Incident, isResponder: boolean) {
  // CHANGED: responders see operational priority; citizens retain severity cues.
  const colors = isResponder
    ? (PRIORITY_COLORS[incident.actionPriority] ?? PRIORITY_COLORS.suppressed)
    : (SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.low);
  const isResolved = incident.responderState === 'resolved';
  const size = isResponder
    ? incident.actionPriority === 'critical_dispatch'
      ? 18
      : incident.actionPriority === 'deploy_scout'
        ? 15
        : incident.actionPriority === 'monitor'
          ? 13
          : 11
    : incident.severity === 'critical'
      ? 18
      : incident.severity === 'high'
        ? 15
        : 12;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size + 8}" height="${size + 8}" viewBox="0 0 ${size + 8} ${size + 8}">
      <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${size / 2 + 3}"
        fill="${colors.fill}" fill-opacity="${isResolved ? 0.3 : 0.15}" />
      <circle cx="${(size + 8) / 2}" cy="${(size + 8) / 2}" r="${size / 2}"
        fill="${isResolved ? '#94A3B8' : colors.fill}" stroke="${isResolved ? '#64748B' : colors.stroke}"
        stroke-width="2" />
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [size + 8, size + 8],
    iconAnchor: [(size + 8) / 2, (size + 8) / 2],
  });
}

interface Props {
  incidents: Incident[];
  center?: LatLng;
  zoom?: number;
  userLocation?: LatLng;
  isResponder?: boolean;
  className?: string;
  height?: string;
  selectedIncidentId?: string | null;
  onIncidentSelect?: (id: string | null) => void;
}

export function MapView({
  incidents,
  center = { lat: 28.6129, lng: 77.2295 },
  zoom = 13,
  userLocation,
  isResponder = false,
  className = '',
  height = '100%',
  selectedIncidentId,
  onIncidentSelect,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const zonesRef = useRef<L.Circle[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // User location
    if (userLocation) {
      const userIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;background:#2563EB;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(37,99,235,0.2)"></div>`,
        className: '',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
        .addTo(map)
        .bindTooltip('Your location', { permanent: false, direction: 'top' });
    }

    map.on('click', () => {
      setSelectedIncident(null);
      setPreviewPos(null);
      onIncidentSelect?.(null);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers when incidents change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers/zones
    markersRef.current.forEach(m => m.remove());
    zonesRef.current.forEach(z => z.remove());
    markersRef.current = [];
    zonesRef.current = [];

    const filteredIncidents = isResponder
      ? incidents
      : incidents.filter(i => i.verificationState !== 'contradicted' && i.responderState !== 'resolved');

    filteredIncidents.forEach(incident => {
      const colors = SEVERITY_COLORS[incident.severity] ?? SEVERITY_COLORS.low;
      const zoneOpacity = VERIFICATION_OPACITY[incident.verificationState] ?? 0.1;

      // Danger zone circle
      const zone = L.circle([incident.location.lat, incident.location.lng], {
        radius: incident.affectedRadius,
        fillColor: incident.verificationState === 'contradicted' ? '#94A3B8' : colors.fill,
        fillOpacity: zoneOpacity,
        color: incident.verificationState === 'contradicted' ? '#94A3B8' : colors.fill,
        weight: 1,
        opacity: 0.4,
        dashArray: incident.verificationState === 'developing' ? '6 4' : undefined,
        interactive: false,
      }).addTo(map);
      zonesRef.current.push(zone);

      // Uncertainty radius (only for responder)
      if (isResponder && incident.uncertaintyRadius > 0) {
        const uncertaintyZone = L.circle([incident.location.lat, incident.location.lng], {
          radius: incident.uncertaintyRadius,
          fillColor: 'transparent',
          color: colors.fill,
          weight: 1,
          opacity: 0.2,
          dashArray: '3 6',
          interactive: false,
        }).addTo(map);
        zonesRef.current.push(uncertaintyZone);
      }

      // Marker
      const icon = createIncidentIcon(incident, isResponder);
      const marker = L.marker([incident.location.lat, incident.location.lng], { icon })
        .addTo(map)
        .bindTooltip(incident.title, { direction: 'top', offset: [0, -12] });

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        setSelectedIncident(incident);
        const point = map.latLngToContainerPoint([incident.location.lat, incident.location.lng]);
        setPreviewPos({ x: point.x, y: point.y });
        onIncidentSelect?.(incident.id);
      });

      markersRef.current.push(marker);
    });
  }, [incidents, isResponder, onIncidentSelect]);

  // Fly to selected incident
  useEffect(() => {
    if (selectedIncidentId && mapRef.current) {
      const incident = incidents.find(i => i.id === selectedIncidentId);
      if (incident) {
        mapRef.current.flyTo([incident.location.lat, incident.location.lng], 15, {
          duration: 0.8,
        });
        setSelectedIncident(incident);
      }
    }
  }, [selectedIncidentId, incidents]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Incident preview popup */}
      {selectedIncident && previewPos && (
        <div
          className="absolute z-[1000] pointer-events-auto"
          style={{
            left: Math.min(previewPos.x + 16, window.innerWidth - 310),
            top: Math.max(previewPos.y - 180, 8),
          }}
        >
          <IncidentPreview
            incident={selectedIncident}
            isResponder={isResponder}
            onClose={() => {
              setSelectedIncident(null);
              setPreviewPos(null);
              onIncidentSelect?.(null);
            }}
          />
        </div>
      )}
    </div>
  );
}
