import { useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { MapView } from '../../components/map/MapView';
import { FilterBar } from '../../components/ui/FilterBar';
import { useIncidents } from '../../context/IncidentContext';


const USER_LOCATION = { lat: 28.6140, lng: 77.2300 };

const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'flood', label: 'Flood' },
  { value: 'fire', label: 'Fire' },
  { value: 'accident', label: 'Accident' },
  { value: 'structural', label: 'Structural' },
  { value: 'landslide', label: 'Landslide' },
  { value: 'other', label: 'Other' },
];

export function MapPage() {
  const { incidents } = useIncidents();
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['all']);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = incidents.filter(incident => {
    if (incident.verificationState === 'contradicted') return false;
    if (incident.responderState === 'resolved') return false;
    if (selectedTypes.includes('all')) return true;
    return selectedTypes.includes(incident.type);
  });

  return (
    <div className="h-screen flex flex-col bg-surface-1">
      <Navbar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter bar */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto">
            <FilterBar
              options={TYPE_FILTERS}
              selected={selectedTypes}
              onChange={setSelectedTypes}
              multiple
            />
          </div>
        </div>

        {/* Full map */}
        <div className="flex-1 relative">
          <MapView
            incidents={filtered}
            center={USER_LOCATION}
            zoom={13}
            userLocation={USER_LOCATION}
            isResponder={false}
            height="100%"
            className="w-full h-full"
            selectedIncidentId={selectedId}
            onIncidentSelect={setSelectedId}
          />

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white border border-slate-200 rounded-xl shadow-panel px-4 py-3 text-xs space-y-1.5 pointer-events-none">
            <p className="font-semibold text-slate-700 mb-2">Severity</p>
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
          </div>
        </div>
      </div>
    </div>
  );
}
