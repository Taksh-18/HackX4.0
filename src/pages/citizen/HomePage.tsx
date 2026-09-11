import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Navbar } from '../../components/layout/Navbar';
import { MapView } from '../../components/map/MapView';
import { StatusBadge } from '../../components/ui/StatusBadge';

import { useIncidents } from '../../context/IncidentContext';
import { incidentTypeIcon } from '../../lib/incidentHelpers';

const USER_LOCATION = { lat: 28.6140, lng: 77.2300 };

export function HomePage() {
  const { incidents, error } = useIncidents();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nearbyIncidents = incidents
    .filter(i => i.verificationState !== 'contradicted' && i.responderState !== 'resolved')
    .slice(0, 5);

  const criticalNearby = nearbyIncidents.filter(i => i.severity === 'critical').length;

  return (
    <div className="min-h-screen bg-surface-1">
      <Navbar />

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden /> {error}
          </div>
        </div>
      )}

      {/* Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 md:py-12">
          <div className="max-w-xl">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Stay informed. Stay safe.
            </h1>
            <p className="text-base text-slate-500">
              View incidents affecting your area and report what you see.
            </p>

            <div className="mt-5 flex items-start gap-3">
              <div className="flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin size={14} className="text-blue-600" aria-hidden />
                <span className="font-medium text-slate-700">Your area:</span>
                <span>Central District</span>
              </div>
            </div>

            {/* Status summary */}
            <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg ${criticalNearby > 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
              {criticalNearby > 0 ? (
                <>
                  <AlertTriangle size={16} className="text-red-600" aria-hidden />
                  <span className="text-sm font-semibold text-red-700">
                    {nearbyIncidents.length} incident{nearbyIncidents.length !== 1 ? 's' : ''} reported nearby
                    {criticalNearby > 0 && ` — ${criticalNearby} critical`}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500" aria-hidden />
                  <span className="text-sm font-semibold text-green-700">
                    {nearbyIncidents.length > 0
                      ? `${nearbyIncidents.length} incident${nearbyIncidents.length !== 1 ? 's' : ''} nearby — no critical alerts`
                      : 'No incidents reported nearby'}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Map + Sidebar layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="h-80 md:h-96 lg:h-[420px]">
                <MapView
                  incidents={incidents}
                  center={USER_LOCATION}
                  zoom={14}
                  userLocation={USER_LOCATION}
                  isResponder={false}
                  height="100%"
                  selectedIncidentId={selectedId}
                  onIncidentSelect={setSelectedId}
                />
              </div>
            </div>
          </div>

          {/* Sidebar: Nearby Incidents + Report CTA */}
          <div className="space-y-4">
            {/* Report CTA */}
            <Link
              to="/report"
              className="block bg-red-600 text-white rounded-xl p-5 hover:bg-red-700 transition-colors shadow-card group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold mb-1">Report an Incident</h2>
                  <p className="text-sm text-red-200">
                    Send a photo, video, location, or description of what you see.
                  </p>
                </div>
                <ArrowRight
                  size={20}
                  className="flex-shrink-0 mt-0.5 group-hover:translate-x-1 transition-transform"
                  aria-hidden
                />
              </div>
            </Link>

            {/* Nearby incidents */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Nearby Incidents</h2>
                <Link
                  to="/map"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  View all <ArrowRight size={12} aria-hidden />
                </Link>
              </div>

              <div className="divide-y divide-slate-100">
                {nearbyIncidents.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <p className="text-sm font-medium text-slate-700">No incidents nearby</p>
                    <p className="text-xs text-slate-400 mt-1">
                      There are currently no reported incidents in your area.
                    </p>
                  </div>
                ) : (
                  nearbyIncidents.map(incident => {
                    const TypeIcon = incidentTypeIcon(incident.type);
                    return (
                      <Link
                        key={incident.id}
                        to={`/incidents/${incident.id}`}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                        onClick={() => setSelectedId(incident.id)}
                      >
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <TypeIcon size={14} className="text-slate-500" aria-hidden />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 line-clamp-1 mb-0.5">
                            {incident.title}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <MapPin size={10} aria-hidden /> {incident.locationName}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge state={incident.verificationState} size="sm" />
                          <span className="text-[10px] text-slate-400">
                            {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}
                          </span>
                        </div>
                      </Link>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
