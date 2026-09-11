import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Clock, FileText, Users, Image,
  CheckCircle, Truck, Eye, XCircle, AlertTriangle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { SeverityBadge } from '../../components/ui/SeverityBadge';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ActionPriorityBadge } from '../../components/incident/ActionPriorityBadge';
import { ConfidenceIndicator } from '../../components/ui/ConfidenceIndicator';
import { IncidentTimeline } from '../../components/incident/IncidentTimeline';
import { EvidencePanel } from '../../components/incident/EvidencePanel';
import { MapView } from '../../components/map/MapView';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import { useIncidents } from '../../context/IncidentContext';
import { incidentTypeIcon, incidentTypeLabel } from '../../lib/incidentHelpers';
import { cn } from '../../lib/cn';
import type { ResponderState } from '../../data/types';

const RESPONDER_STATE_CONFIG: Record<
  ResponderState,
  { label: string; className: string }
> = {
  unacknowledged: { label: 'UNACKNOWLEDGED', className: 'text-slate-500 bg-slate-100' },
  acknowledged: { label: 'ACKNOWLEDGED', className: 'text-blue-700 bg-blue-50' },
  dispatched: { label: 'DISPATCHED', className: 'text-orange-700 bg-orange-50' },
  resolved: { label: 'RESOLVED', className: 'text-green-700 bg-green-50' },
};

type Modal = 'acknowledge' | 'dispatch' | 'scout' | 'resolve' | null;

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { incidents, updateResponderState } = useIncidents();
  const [modal, setModal] = useState<Modal>(null);

  const incident = incidents.find(i => i.id === id);

  if (!incident) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-slate-500 mb-4">Incident not found.</p>
          <Link to="/responder/feed" className="text-sm text-blue-600 hover:underline">
            Back to feed
          </Link>
        </div>
      </div>
    );
  }

  const TypeIcon = incidentTypeIcon(incident.type);
  const stateConf = RESPONDER_STATE_CONFIG[incident.responderState];

  const handleAction = async (state: ResponderState) => {
    try {
      await updateResponderState(incident.id, state);
    } finally {
      setModal(null);
    }
  };

  return (
    <>
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <Link
            to="/responder/feed"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 mb-3 transition-colors"
          >
            <ArrowLeft size={13} aria-hidden /> Back to Feed
          </Link>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                <TypeIcon size={18} className="text-slate-600" aria-hidden />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium mb-0.5">
                  {incidentTypeLabel(incident.type)}
                </p>
                <h1 className="text-lg font-bold text-slate-900 leading-tight mb-1">
                  {incident.title}
                </h1>
                <div className="flex items-center gap-2 flex-wrap">
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge state={incident.verificationState} />
                  <ActionPriorityBadge priority={incident.actionPriority} />
                  <span
                    className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider',
                      stateConf.className
                    )}
                  >
                    {stateConf.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {incident.responderState === 'unacknowledged' && (
                <button
                  onClick={() => setModal('acknowledge')}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <CheckCircle size={14} aria-hidden /> Acknowledge
                </button>
              )}
              {(incident.responderState === 'acknowledged') && (
                <>
                  <button
                    onClick={() => setModal('dispatch')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Truck size={14} aria-hidden /> Dispatch
                  </button>
                  <button
                    onClick={() => setModal('scout')}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    <Eye size={14} aria-hidden /> Deploy Scout
                  </button>
                </>
              )}
              {incident.responderState !== 'resolved' && (
                <button
                  onClick={() => setModal('resolve')}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors"
                >
                  <XCircle size={14} aria-hidden /> Mark Resolved
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <MapPin size={13} aria-hidden /> {incident.locationName}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={13} aria-hidden />
              Updated {formatDistanceToNow(new Date(incident.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            {/* Left column: Overview + Evidence */}
            <div className="xl:col-span-2 space-y-5">
              {/* Contradiction warning */}
              {incident.hasContradictions && incident.contradictionNote && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="text-sm font-semibold text-red-800 mb-0.5">Contradictions detected</p>
                    <p className="text-sm text-red-700">{incident.contradictionNote}</p>
                  </div>
                </div>
              )}

              {/* Aggregated needs */}
              {incident.aggregatedNeeds && incident.verificationState === 'corroborated' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h2 className="text-sm font-semibold text-amber-900 mb-3">Aggregated Needs</h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {incident.aggregatedNeeds.peopleTrapped != null && (
                      <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-center">
                        <p className="text-lg font-bold text-amber-800">
                          {incident.aggregatedNeeds.peopleTrapped}
                        </p>
                        <p className="text-xs text-amber-700">People trapped</p>
                      </div>
                    )}
                    {incident.aggregatedNeeds.injuredCount != null && (
                      <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-center">
                        <p className="text-lg font-bold text-amber-800">
                          {incident.aggregatedNeeds.injuredCount}
                        </p>
                        <p className="text-xs text-amber-700">Injured</p>
                      </div>
                    )}
                    {incident.aggregatedNeeds.medicalAssistance && (
                      <NeedTag label="Medical assistance" />
                    )}
                    {incident.aggregatedNeeds.evacuation && (
                      <NeedTag label="Evacuation" />
                    )}
                    {incident.aggregatedNeeds.rescueEquipment && (
                      <NeedTag label="Rescue equipment" />
                    )}
                  </div>
                </div>
              )}

              {/* Map */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-card">
                <div className="h-52">
                  <MapView
                    incidents={[incident]}
                    center={incident.location}
                    zoom={15}
                    isResponder
                    height="100%"
                  />
                </div>
              </div>

              {/* Responder notes */}
              {incident.responderNotes && (
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
                  <h2 className="text-sm font-semibold text-slate-800 mb-2">Responder Notes</h2>
                  <p className="text-sm text-slate-600">{incident.responderNotes}</p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
                <h2 className="text-sm font-semibold text-slate-800 mb-2">Summary</h2>
                <p className="text-sm text-slate-600">{incident.summary}</p>
              </div>

              {/* Evidence */}
              <EvidencePanel incident={incident} />
            </div>

            {/* Right column: Confidence + Timeline */}
            <div className="space-y-5">
              {/* Confidence */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">Confidence</h2>
                <ConfidenceIndicator confidence={incident.confidence} showBreakdown />
              </div>

              {/* Stats */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
                <h2 className="text-sm font-semibold text-slate-800 mb-3">Intelligence Summary</h2>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <FileText size={13} aria-hidden /> Reports
                    </span>
                    <span className="font-semibold text-slate-800">{incident.reportCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Users size={13} aria-hidden /> Independent sources
                    </span>
                    <span className="font-semibold text-slate-800">{incident.independentSourceCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <Image size={13} aria-hidden /> Unique images
                    </span>
                    <span className="font-semibold text-slate-800">{incident.uniqueImageCount}</span>
                  </div>
                  {incident.hasRecycledMedia && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        <AlertTriangle size={10} aria-hidden /> Recycled media detected
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-card">
                <h2 className="text-sm font-semibold text-slate-800 mb-4">Timeline</h2>
                <IncidentTimeline events={incident.timeline} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={modal === 'acknowledge'}
        title="Acknowledge incident?"
        message={`You are acknowledging "${incident.title}". This will record your unit as the primary responder.`}
        confirmLabel="Acknowledge"
        onConfirm={() => handleAction('acknowledged')}
        onCancel={() => setModal(null)}
      />
      <ConfirmationModal
        isOpen={modal === 'dispatch'}
        title="Dispatch units?"
        message={`Dispatch emergency response units to "${incident.title}"?`}
        confirmLabel="Dispatch"
        onConfirm={() => handleAction('dispatched')}
        onCancel={() => setModal(null)}
        variant="default"
      />
      <ConfirmationModal
        isOpen={modal === 'scout'}
        title="Deploy scout?"
        message="Deploy a scout team for visual assessment before full dispatch?"
        confirmLabel="Deploy Scout"
        onConfirm={() => handleAction('dispatched')}
        onCancel={() => setModal(null)}
      />
      <ConfirmationModal
        isOpen={modal === 'resolve'}
        title="Mark as resolved?"
        message={`This will mark "${incident.title}" as resolved and remove it from the active feed.`}
        confirmLabel="Mark Resolved"
        onConfirm={() => handleAction('resolved')}
        onCancel={() => setModal(null)}
        variant="danger"
      />
    </>
  );
}

function NeedTag({ label }: { label: string }) {
  return (
    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2 text-center">
      <p className="text-xs font-semibold text-amber-800">{label}</p>
      <p className="text-[10px] text-amber-600">Required</p>
    </div>
  );
}
