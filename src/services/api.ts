import type {
  ActionPriority,
  Incident,
  IncidentType,
  MediaItem,
  Report,
  ReportStatus,
  ResponderState,
  SeverityLevel,
  VerificationState,
} from '../data/types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api').replace(/\/$/, '');
export const CURRENT_SOURCE_USER = '@alex_johnson';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface BackendExtraction {
  relevant?: boolean | null;
  disaster_type?: string | null;
  claim?: string | null;
  landmark?: string | null;
  trapped_count?: number | null;
  resource_demands?: string[];
  severity?: number | null;
}

interface BackendReport {
  id: string;
  source_user: string;
  raw_text: string;
  media_url: string | null;
  timestamp: string;
  gps_lat: number | null;
  gps_lon: number | null;
  extracted_json: BackendExtraction;
}

interface BackendIncident {
  id: string;
  event_type: string;
  title: string;
  center_lat: number;
  center_lon: number;
  uncertainty_radius_m: number;
  severity_score: number;
  confidence_score: number;
  verification_status: string;
  action_priority: string;
  responder_state: string;
  evidence_json: {
    total_reports?: number;
    independent_sources?: number;
    unique_images?: number;
    recycled_media_detected?: number;
    geo_agreement?: number;
    fresh_media_ratio?: number;
    external_verification_hits?: number | null;
    has_contradiction?: boolean;
  };
  aggregated_needs_json: {
    estimated_trapped_total?: number;
    confirmed_by_sources?: number;
    priority_resources?: string[];
  };
  timeline_json: { time: string; event: string }[];
}

interface BackendIncidentDetail extends BackendIncident {
  report_links: {
    incident_id: string;
    report_id: string;
    distance_m: number;
    time_delta_s: number;
    report: BackendReport;
  }[];
}

interface BackendEvidence {
  media: {
    id: string;
    report_id: string;
    phash: string;
    is_duplicate_of: string | null;
  }[];
}

export interface SubmitReportInput {
  type: IncidentType;
  description: string;
  location: { lat: number; lng: number } | null;
  locationName: string;
  image: File | null;
  peopleTrapped: number | null;
  medicalNeeded: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError('Cannot reach the CDIS API. Start the FastAPI server and try again.', 0);
  }
  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) message = payload.detail;
    } catch {
      // Keep the status-based message when the response has no JSON body.
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

function eventType(value?: string | null): IncidentType {
  const normalized = value?.toLowerCase();
  if (normalized === 'flood' || normalized === 'fire' || normalized === 'other') return normalized;
  if (normalized === 'collapse' || normalized === 'structural') return 'structural';
  if (normalized === 'accident' || normalized === 'landslide' || normalized === 'weather') return normalized;
  return 'other';
}

function severity(score: number): SeverityLevel {
  if (score >= 8) return 'critical';
  if (score >= 6) return 'high';
  if (score >= 3) return 'moderate';
  return 'low';
}

function sourceScore(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 25;
  if (count === 2) return 43;
  if (count === 3) return 60;
  if (count === 4) return 80;
  return 100;
}

function mediaUrl(path: string): string {
  return path.includes('://') ? path : `${API_BASE_URL}/${path.replace(/^\//, '')}`;
}

function reportStatus(report: BackendReport, incident?: BackendIncident): ReportStatus {
  if (incident?.responder_state === 'RESOLVED') return 'resolved';
  if (incident?.verification_status === 'CONTRADICTED') return 'contradicted';
  if (incident?.verification_status === 'CORROBORATED') return 'corroborated';
  if (incident?.verification_status === 'DEVELOPING') return 'developing';
  return report.extracted_json?.relevant == null ? 'processing' : 'under_review';
}

function toMedia(report: BackendReport, recycled = false): MediaItem[] {
  if (!report.media_url) return [];
  const url = mediaUrl(report.media_url);
  return [{
    id: `media-${report.id}`,
    type: 'image',
    url,
    thumbnail: url,
    timestamp: report.timestamp,
    isRecycled: recycled,
    recycledNote: recycled ? 'This image matched known or duplicate media evidence.' : undefined,
  }];
}

function toReport(
  report: BackendReport,
  incident?: BackendIncident,
  distance?: number,
  recycled = false,
): Report {
  return {
    id: report.id,
    incidentId: incident?.id ?? null,
    authorId: report.source_user,
    isCurrentUser: report.source_user === CURRENT_SOURCE_USER,
    type: eventType(report.extracted_json?.disaster_type),
    title: report.extracted_json?.claim || `${eventType(report.extracted_json?.disaster_type)} report`,
    description: report.raw_text,
    location: {
      lat: report.gps_lat ?? incident?.center_lat ?? 28.6083,
      lng: report.gps_lon ?? incident?.center_lon ?? 77.2952,
    },
    locationName: report.extracted_json?.landmark || 'Location pending',
    media: toMedia(report, recycled),
    timestamp: report.timestamp,
    status: reportStatus(report, incident),
    processingStage: report.extracted_json?.relevant == null ? 'Queued for extraction' : 'Extraction complete',
    distance,
    sourceType: 'citizen',
  };
}

function toIncident(
  raw: BackendIncidentDetail,
  evidence: BackendEvidence = { media: [] },
): Incident {
  const recycledCount = raw.evidence_json?.recycled_media_detected ?? 0;
  const duplicateReportIds = new Set(
    evidence.media.filter(item => item.is_duplicate_of).map(item => item.report_id),
  );
  const reports = raw.report_links.map((link, index) => {
    const report = toReport(link.report, raw, Math.round(link.distance_m), index < recycledCount);
    report.isDuplicate = duplicateReportIds.has(link.report_id);
    return report;
  });
  const uniqueSources = new Map(reports.map(report => [report.authorId, report]));
  const overall = Math.round(raw.confidence_score);
  const sourceCount = raw.evidence_json?.independent_sources ?? 0;
  const firstTime = raw.timeline_json[0]?.time ?? new Date().toISOString();
  const lastTime = raw.timeline_json.at(-1)?.time ?? firstTime;
  const resources = new Set(raw.aggregated_needs_json?.priority_resources ?? []);
  const verification = raw.verification_status.toLowerCase() as VerificationState;

  return {
    id: raw.id,
    title: raw.title,
    type: eventType(raw.event_type),
    severity: severity(raw.severity_score),
    verificationState: verification,
    actionPriority: raw.action_priority.toLowerCase() as ActionPriority,
    responderState: raw.responder_state.toLowerCase() as ResponderState,
    confidence: {
      overall,
      sources: sourceScore(sourceCount),
      geolocation: Math.round((raw.evidence_json?.geo_agreement ?? 0) * 100),
      media: Math.round((raw.evidence_json?.fresh_media_ratio ?? 0) * 100),
      externalVerification: Math.min(100, (raw.evidence_json?.external_verification_hits ?? 0) * 34),
      contradictionPenalty: raw.evidence_json?.has_contradiction ? 45 : 0,
    },
    location: { lat: raw.center_lat, lng: raw.center_lon },
    locationName: reports.find(report => report.locationName !== 'Location pending')?.locationName || raw.title,
    affectedRadius: Math.max(250, raw.uncertainty_radius_m * 2),
    uncertaintyRadius: raw.uncertainty_radius_m,
    reportCount: raw.evidence_json?.total_reports ?? reports.length,
    independentSourceCount: sourceCount,
    uniqueImageCount: raw.evidence_json?.unique_images ?? 0,
    reports,
    independentSources: [...uniqueSources.entries()].map(([name, report]) => ({
      id: `source-${report.id}`,
      type: 'citizen',
      name,
      verified: !report.isDuplicate,
      timestamp: report.timestamp,
    })),
    media: reports.flatMap(report => report.media),
    timeline: raw.timeline_json.map((entry, index) => ({
      id: `${raw.id}-timeline-${index}`,
      timestamp: entry.time,
      title: entry.event,
      type: entry.event.startsWith('Responder') ? 'responder' : 'update',
    })),
    aggregatedNeeds: {
      peopleTrapped: raw.aggregated_needs_json?.estimated_trapped_total || undefined,
      medicalAssistance: resources.has('medical_evac') || resources.has('ambulance'),
      evacuation: resources.has('evacuation'),
      water: resources.has('water'),
      food: resources.has('food'),
      rescueEquipment: [...resources].some(item => item.includes('rescue') || item.includes('boat')),
    },
    summary: raw.title,
    responderNotes: raw.evidence_json?.has_contradiction
      ? 'Conflicting reports require on-site verification before escalation.'
      : undefined,
    createdAt: firstTime,
    updatedAt: lastTime,
    resolvedAt: raw.responder_state === 'RESOLVED' ? lastTime : undefined,
    hasRecycledMedia: recycledCount > 0,
    hasContradictions: raw.evidence_json?.has_contradiction ?? false,
    contradictionNote: raw.evidence_json?.has_contradiction
      ? 'At least one linked report disputes the incident claim.'
      : undefined,
    affectedArea: raw.title,
  };
}

async function getIncidentDetail(id: string): Promise<Incident> {
  const [detail, evidence] = await Promise.all([
    request<BackendIncidentDetail>(`/incidents/${encodeURIComponent(id)}`),
    request<BackendEvidence>(`/incidents/${encodeURIComponent(id)}/evidence`),
  ]);
  return toIncident(detail, evidence);
}

async function getIncidents(): Promise<Incident[]> {
  const rows = await request<BackendIncident[]>('/incidents?status=all');
  return Promise.all(rows.map(row => getIncidentDetail(row.id)));
}

async function updateResponderState(id: string, state: ResponderState): Promise<Incident> {
  const endpoint: Partial<Record<ResponderState, string>> = {
    acknowledged: 'acknowledge',
    dispatched: 'dispatch',
    resolved: 'resolve',
  };
  const action = endpoint[state];
  if (!action) throw new ApiError('Unsupported responder transition.', 400);
  await request(`/incidents/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
  return getIncidentDetail(id);
}

async function getReports(sourceUser?: string): Promise<Report[]> {
  const query = sourceUser ? `?source_user=${encodeURIComponent(sourceUser)}` : '';
  const [rows, incidents] = await Promise.all([
    request<BackendReport[]>(`/reports${query}`),
    getIncidents(),
  ]);
  return rows.map(row => {
    const report = toReport(row);
    const incident = incidents.find(item => item.reports.some(linked => linked.id === row.id));
    if (!incident) return report;
    const linked = incident.reports.find(item => item.id === row.id);
    return {
      ...report,
      incidentId: incident.id,
      location: incident.location,
      locationName: linked?.locationName || incident.locationName,
      status: incident.responderState === 'resolved'
        ? 'resolved'
        : incident.verificationState,
      distance: linked?.distance,
      isDuplicate: linked?.isDuplicate,
    };
  });
}

export const api = {
  getIncidents,
  getIncidentById: getIncidentDetail,
  updateResponderState,
  acknowledgeIncident: (id: string) => updateResponderState(id, 'acknowledged'),
  dispatchIncident: (id: string) => updateResponderState(id, 'dispatched'),
  resolveIncident: (id: string) => updateResponderState(id, 'resolved'),
  getReports: () => getReports(),
  getMyReports: () => getReports(CURRENT_SOURCE_USER),

  async submitReport(input: SubmitReportInput): Promise<{ id: string; referenceCode: string }> {
    let uploadedMedia: string | null = null;
    if (input.image) {
      const uploaded = await request<{ media_url: string }>('/media', {
        method: 'POST',
        headers: { 'Content-Type': input.image.type },
        body: input.image,
      });
      uploadedMedia = uploaded.media_url;
    }

    const needs = [
      input.peopleTrapped != null ? `${input.peopleTrapped} people reported trapped` : '',
      input.medicalNeeded ? 'medical evacuation requested' : '',
    ].filter(Boolean);
    const rawText = [
      input.description.trim(),
      `Reported disaster type: ${input.type}.`,
      input.locationName.trim() ? `Location: ${input.locationName.trim()}.` : '',
      needs.length ? `Additional details: ${needs.join('; ')}.` : '',
    ].filter(Boolean).join(' ');

    const report = await request<BackendReport>('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_user: CURRENT_SOURCE_USER,
        raw_text: rawText,
        media_url: uploadedMedia,
        timestamp: new Date().toISOString(),
        gps_lat: input.location?.lat ?? null,
        gps_lon: input.location?.lng ?? null,
      }),
    });
    return { id: report.id, referenceCode: `CDIS-${report.id.replace(/[^a-z0-9]/gi, '').toUpperCase()}` };
  },

  async getAnalytics() {
    const incidents = await getIncidents();
    const byType = Object.fromEntries(
      ['flood', 'fire', 'accident', 'structural', 'landslide', 'weather', 'other']
        .map(type => [type, incidents.filter(item => item.type === type).length]),
    );
    const byVerification = Object.fromEntries(
      ['corroborated', 'developing', 'contradicted']
        .map(state => [state, incidents.filter(item => item.verificationState === state).length]),
    );
    const byActionPriority = Object.fromEntries(
      ['critical_dispatch', 'deploy_scout', 'monitor', 'suppressed']
        .map(priority => [priority, incidents.filter(item => item.actionPriority === priority).length]),
    );
    const bySeverity = Object.fromEntries(
      ['critical', 'high', 'moderate', 'low']
        .map(level => [level, incidents.filter(item => item.severity === level).length]),
    );
    const hourly = new Map<string, number>();
    incidents.forEach(item => {
      const label = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      hourly.set(label, (hourly.get(label) ?? 0) + 1);
    });
    const locations = new Map<string, { count: number; severity: SeverityLevel }>();
    incidents.forEach(item => {
      const current = locations.get(item.locationName);
      locations.set(item.locationName, { count: (current?.count ?? 0) + 1, severity: item.severity });
    });
    return {
      totalIncidents: incidents.length,
      byType: byType as Record<IncidentType, number>,
      byVerification: byVerification as Record<VerificationState, number>,
      byActionPriority: byActionPriority as Record<ActionPriority, number>,
      bySeverity: bySeverity as Record<SeverityLevel, number>,
      incidentVolume: [...hourly].map(([time, count]) => ({ time, count })),
      hotspots: [...locations].map(([name, value]) => ({ name, ...value })),
    };
  },
};
