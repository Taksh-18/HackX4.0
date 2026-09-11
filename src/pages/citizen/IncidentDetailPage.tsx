import { useParams, Link } from 'react-router-dom';
import { MapPin, Clock, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Navbar } from '../../components/layout/Navbar';
import { MapView } from '../../components/map/MapView';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { IncidentTimeline } from '../../components/incident/IncidentTimeline';
import { useIncidents } from '../../context/IncidentContext';
import { incidentTypeIcon, incidentTypeLabel } from '../../lib/incidentHelpers';

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { incidents } = useIncidents();
  const incident = incidents.find(i => i.id === id);

  if (!incident) {
    return (
      <div className="min-h-screen bg-surface-1">
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-slate-500">Incident not found.</p>
          <Link to="/" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Return home
          </Link>
        </div>
      </div>
    );
  }

  const TypeIcon = incidentTypeIcon(incident.type);

  return (
    <div className="min-h-screen bg-surface-1">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Back */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
        >
          <ArrowLeft size={14} aria-hidden /> Back
        </Link>

        {/* Header */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-card">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
              <TypeIcon size={18} className="text-slate-600" aria-hidden />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-slate-500 mb-0.5">
                {incidentTypeLabel(incident.type)}
              </p>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">
                {incident.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <StatusBadge state={incident.verificationState} />
            <SeverityBadge severity={incident.severity} />
          </div>

          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <MapPin size={14} aria-hidden /> {incident.locationName}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={14} aria-hidden /> Updated {format(new Date(incident.updatedAt), 'HH:mm')}
            </span>
          </div>
        </div>

        {/* Corroboration message */}
        {incident.verificationState === 'corroborated' && (
          <div className="flex items-start gap-2.5 bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
            <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" aria-hidden />
            <p className="text-sm text-green-800 font-medium">
              Information corroborated by multiple independent reports.
            </p>
          </div>
        )}

        {/* Map */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card mb-4">
          <div className="h-52">
            <MapView
              incidents={[incident]}
              center={incident.location}
              zoom={15}
              isResponder={false}
              height="100%"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4 shadow-card">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">What's happening</h2>
          <p className="text-sm text-slate-600">{incident.summary}</p>

          {incident.affectedArea && (
            <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <MapPin size={13} className="flex-shrink-0 mt-0.5" aria-hidden />
              <span>Affected area: {incident.affectedArea}</span>
            </div>
          )}
        </div>

        {/* Safety info */}
        {incident.safetyInfo && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-amber-800 mb-0.5">Safety Information</p>
                <p className="text-sm text-amber-700">{incident.safetyInfo}</p>
              </div>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Latest Updates</h2>
          <IncidentTimeline events={incident.timeline.slice(-5)} />
        </div>
      </div>
    </div>
  );
}
