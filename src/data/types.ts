// ─── Enums & Union Types ─────────────────────────────────────────────────────

export type SeverityLevel = 'critical' | 'high' | 'moderate' | 'low';

export type VerificationState = 'corroborated' | 'developing' | 'contradicted';

export type ActionPriority = 'critical_dispatch' | 'deploy_scout' | 'monitor' | 'suppressed';

export type ResponderState = 'unacknowledged' | 'acknowledged' | 'dispatched' | 'resolved';

export type IncidentType =
  | 'flood'
  | 'fire'
  | 'accident'
  | 'structural'
  | 'landslide'
  | 'weather'
  | 'other';

export type ReportStatus =
  | 'processing'
  | 'under_review'
  | 'corroborated'
  | 'developing'
  | 'contradicted'
  | 'resolved';

export type MediaType = 'image' | 'video';

export type SourceType = 'citizen' | 'news' | 'government' | 'social_media' | 'sensor';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface LatLng {
  lat: number;
  lng: number;
}

export interface MediaItem {
  id: string;
  type: MediaType;
  url: string;
  thumbnail: string;
  isRecycled?: boolean;
  recycledNote?: string;
  timestamp: string;
}

export interface IndependentSource {
  id: string;
  type: SourceType;
  name: string;
  verified: boolean;
  url?: string;
  timestamp: string;
}

export interface ConfidenceBreakdown {
  overall: number;       // 0–100
  sources: number;       // 0–100
  geolocation: number;   // 0–100
  media: number;         // 0–100
  externalVerification: number; // 0–100
  contradictionPenalty: number; // 0–100 penalty deducted
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  type: 'report' | 'cluster' | 'media' | 'source' | 'verification' | 'responder' | 'update';
}

export interface AggregatedNeeds {
  peopleTrapped?: number;
  injuredCount?: number;
  medicalAssistance?: boolean;
  evacuation?: boolean;
  water?: boolean;
  food?: boolean;
  rescueEquipment?: boolean;
}

export interface Report {
  id: string;
  incidentId: string | null;
  authorId: string;         // 'citizen' or 'responder' userId
  isCurrentUser?: boolean;  // for my-reports page
  type: IncidentType;
  title: string;
  description: string;
  location: LatLng;
  locationName: string;
  media: MediaItem[];
  timestamp: string;
  status: ReportStatus;
  processingStage?: string;
  distance?: number;        // metres from incident centre
  sourceType: SourceType;
  isDuplicate?: boolean;
}

export interface Incident {
  id: string;
  title: string;
  type: IncidentType;
  severity: SeverityLevel;
  verificationState: VerificationState;
  actionPriority: ActionPriority;
  responderState: ResponderState;
  confidence: ConfidenceBreakdown;

  location: LatLng;
  locationName: string;
  affectedRadius: number;   // metres — for danger zone circle
  uncertaintyRadius: number; // metres — geolocation uncertainty

  reportCount: number;
  independentSourceCount: number;
  uniqueImageCount: number;
  reports: Report[];
  independentSources: IndependentSource[];
  media: MediaItem[];

  timeline: TimelineEvent[];
  aggregatedNeeds?: AggregatedNeeds;

  summary: string;          // citizen-safe summary
  responderNotes?: string;  // responder-only notes

  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;

  hasRecycledMedia?: boolean;
  hasContradictions?: boolean;
  contradictionNote?: string;

  // Citizen-facing safety info
  safetyInfo?: string;
  affectedArea?: string;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export interface FilterState {
  types: IncidentType[];
  verification: VerificationState[];
  severity: SeverityLevel[];
  actionPriority: ActionPriority[];
}

export interface UserRole {
  role: 'citizen' | 'responder';
  name: string;
  area: string;
  location: LatLng;
}
