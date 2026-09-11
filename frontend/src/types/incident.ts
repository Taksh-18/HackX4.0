// Mirrors app/schemas.py exactly. Do not add fields the backend doesn't return.

export type DisasterType = "FLOOD" | "FIRE" | "COLLAPSE" | "OTHER";

export type VerificationStatus = "CORROBORATED" | "DEVELOPING" | "CONTRADICTED";

export type ActionPriority =
  | "CRITICAL_DISPATCH"
  | "DEPLOY_SCOUT"
  | "MONITOR"
  | "SUPPRESSED";

export type ResponderState =
  | "UNACKNOWLEDGED"
  | "ACKNOWLEDGED"
  | "DISPATCHED"
  | "RESOLVED";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface Extraction {
  relevant?: boolean | null;
  disaster_type?: DisasterType | null;
  claim?: string | null;
  landmark?: string | null;
  trapped_count?: number | null;
  resource_demands: string[];
  access_impediment: boolean;
  severity?: number | null;
  event_time_hint?: string | null;
}

export interface Report {
  id: string;
  source_user: string;
  raw_text: string;
  media_url?: string | null;
  timestamp: string;
  gps_lat?: number | null;
  gps_lon?: number | null;
  extracted_json: Extraction;
}

export interface LinkedReport {
  incident_id: string;
  report_id: string;
  distance_m: number;
  time_delta_s: number;
  report: Report;
}

// app/image_analysis.py::ImageAnalysis, plus schemas.py's ImageAnalysisRead.report_id
export interface ImageAnalysis {
  report_id: string;
  analyzed: boolean;
  contains_disaster_evidence?: boolean | null;
  disaster_type?: DisasterType | null;
  visible_damage: string[];
  visible_people_at_risk?: boolean | null;
  access_blocked?: boolean | null;
  severity?: number | null;
  supports_text_claim?: boolean | null;
  concerns: string[];
  confidence?: number | null;
  provider: string;
}

// app/misinformation.py::MisinformationRisk
export interface MisinformationRisk {
  risk_score: number;
  risk_level: RiskLevel;
  signals: string[];
  contradiction_groups: number;
  image_text_mismatches: number;
  recycled_media_reports: number;
  duplicate_claim_groups: number;
  assessment: string;
  proven_false: boolean;
}

export interface ContradictionGroup {
  event_type?: string | null;
  landmark?: string | null;
  affirming_report_ids: string[];
  denying_report_ids: string[];
}

// Named components behind confidence_score; see app.scoring.confidence_breakdown.
export interface ConfidenceBreakdown {
  source_score?: number;
  geo_score?: number;
  media_score?: number;
  external_score?: number;
  contradiction_penalty?: number;
  misinformation_penalty?: number;
  final_confidence?: number;
}

export interface Evidence {
  total_reports: number;
  independent_sources: number;
  unique_images: number;
  recycled_media_detected: number;
  geo_agreement: number;
  fresh_media_ratio: number;
  external_verification_hits?: number | null;
  has_contradiction: boolean;
  duplicate_image_groups: number;
  duplicate_text_groups: number;
  contradiction_groups: ContradictionGroup[];
  image_analyses: ImageAnalysis[];
  misinformation: MisinformationRisk;
  confidence_breakdown: ConfidenceBreakdown;
  limitations: string[];
}

export interface AggregatedNeeds {
  estimated_trapped_total: number;
  confirmed_by_sources: number;
  priority_resources: string[];
}

export interface TimelineEntry {
  time: string;
  event: string;
}

export interface Incident {
  id: string;
  event_type: string;
  title: string;
  center_lat: number;
  center_lon: number;
  uncertainty_radius_m: number;
  severity_score: number;
  confidence_score: number;
  verification_status: VerificationStatus;
  action_priority: ActionPriority;
  responder_state: ResponderState;
  evidence_json: Evidence;
  aggregated_needs_json: AggregatedNeeds;
  timeline_json: TimelineEntry[];
  updated_at?: string | null;
}

export interface IncidentDetail extends Incident {
  report_links: LinkedReport[];
}

export interface MapIncident {
  id: string;
  center_lat: number;
  center_lon: number;
  uncertainty_radius_m: number;
  action_priority: ActionPriority;
}

export interface ActionResult {
  incident_id: string;
  responder_state: ResponderState;
  stub?: boolean;
  message?: string;
}

export interface Media {
  id: string;
  report_id: string;
  phash: string;
  is_duplicate_of?: string | null;
  analysis_json?: ImageAnalysis | null;
}

export interface EvidenceRead {
  incident_id: string;
  evidence_json: Evidence;
  reports: LinkedReport[];
  media: Media[];
}

export interface ReportCreatePayload {
  source_user: string;
  raw_text: string;
  media_url?: string | null;
  timestamp?: string;
  gps_lat?: number | null;
  gps_lon?: number | null;
}

export interface ReportRead extends ReportCreatePayload {
  id: string;
  extracted_json: Extraction;
}
