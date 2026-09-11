import { useState } from 'react';
import { MapView } from '../../components/map/MapView';
import { FilterBar } from '../../components/ui/FilterBar';
import { useIncidents } from '../../context/IncidentContext';


const TYPE_FILTERS = [
  { value: 'all', label: 'All Types' },
  { value: 'flood', label: 'Flood' },
  { value: 'fire', label: 'Fire' },
  { value: 'accident', label: 'Accident' },
  { value: 'structural', label: 'Structural' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'other', label: 'Other' },
];

const SEV_FILTERS = [
  { value: 'all', label: 'All Severity' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'low', label: 'Low' },
];

export function ResponderMapPage() {
  const { incidents } = useIncidents();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all']);
  const [selectedSeverity, setSelectedSeverity] = useState<string[]>(['all']);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = incidents.filter(i => {
    const typeOk = selectedTypes.includes('all') || selectedTypes.includes(i.type);
    const sevOk = selectedSeverity.includes('all') || selectedSeverity.includes(i.severity);
    return typeOk && sevOk;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 space-y-2">
        <h1 className="text-sm font-bold text-slate-900">Incident Intelligence Map</h1>
        <div className="flex flex-wrap gap-2">
          <FilterBar
            options={TYPE_FILTERS}
            selected={selectedTypes}
            onChange={setSelectedTypes}
            multiple
          />
          <div className="w-px bg-slate-200 mx-1" />
          <FilterBar
            options={SEV_FILTERS}
            selected={selectedSeverity}
            onChange={setSelectedSeverity}
          />
        </div>
      </div>

      {/* Full map */}
      <div className="flex-1 relative">
        <MapView
          incidents={filtered}
          center={{ lat: 28.6129, lng: 77.2295 }}
          zoom={13}
          isResponder
          height="100%"
          className="w-full h-full"
          selectedIncidentId={selectedId}
          onIncidentSelect={setSelectedId}
        />

        {/* Legend */}
        <div className="absolute bottom-6 left-4 bg-white border border-slate-200 rounded-xl shadow-panel px-4 py-3 text-xs space-y-2 pointer-events-none">
          <p className="font-semibold text-slate-700">Severity</p>
          {[
            { label: 'Critical', color: 'bg-red-500' },
            { label: 'High', color: 'bg-orange-500' },
            { label: 'Moderate', color: 'bg-yellow-500' },
            { label: 'Low', color: 'bg-green-500' },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${color}`} aria-hidden />
              <span className="text-slate-600">{label}</span>
            </div>
          ))}
          <p className="font-semibold text-slate-700 pt-2 border-t border-slate-100">Zones</p>
          <div className="flex items-center gap-2">
            <span className="w-8 h-2 bg-red-200 rounded border border-red-300" aria-hidden />
            <span className="text-slate-600">Affected area</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-px bg-slate-400 border-dashed border border-slate-400" style={{ borderStyle: 'dashed' }} aria-hidden />
            <span className="text-slate-600">Uncertainty</span>
          </div>
        </div>

        {/* Incident count */}
        <div className="absolute top-4 right-4 bg-white border border-slate-200 rounded-lg shadow-card px-3 py-1.5">
          <span className="text-xs font-medium text-slate-600">
            Showing {filtered.length} incident{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
