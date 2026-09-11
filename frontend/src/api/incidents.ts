import { http } from "./client";
import type {
  ActionResult,
  EvidenceRead,
  Incident,
  IncidentDetail,
  MapIncident,
  ReportCreatePayload,
  ReportRead,
} from "../types/incident";

/**
 * Thin, direct pass-through to the real FastAPI backend (see app/main.py).
 * No fallback/fabricated data: an empty list from the API means "no
 * incidents yet," and is rendered as an empty state, not papered over.
 */

export async function checkHealth(): Promise<boolean> {
  try {
    const result = await http.get<{ status: string }>("/health");
    return result.status === "ok";
  } catch {
    return false;
  }
}

export function listIncidents(
  status: "active" | "resolved" | "all" = "active",
): Promise<Incident[]> {
  return http.get<Incident[]>(`/incidents?status=${status}`);
}

export function getIncident(id: string): Promise<IncidentDetail> {
  return http.get<IncidentDetail>(`/incidents/${id}`);
}

export function getEvidence(id: string): Promise<EvidenceRead> {
  return http.get<EvidenceRead>(`/incidents/${id}/evidence`);
}

export function getMapIncidents(): Promise<MapIncident[]> {
  return http.get<MapIncident[]>("/map/incidents");
}

/** GET /incidents/updates?since=<ISO8601> — incidents changed at/after `since`. */
export function getIncidentUpdates(since: Date): Promise<Incident[]> {
  return http.get<Incident[]>(
    `/incidents/updates?since=${encodeURIComponent(since.toISOString())}`,
  );
}

export const acknowledgeIncident = (id: string) =>
  http.post<ActionResult>(`/incidents/${id}/acknowledge`);
export const dispatchIncident = (id: string) =>
  http.post<ActionResult>(`/incidents/${id}/dispatch`);
export const resolveIncident = (id: string) =>
  http.post<ActionResult>(`/incidents/${id}/resolve`);

export function submitReport(payload: ReportCreatePayload): Promise<ReportRead> {
  return http.post<ReportRead>("/reports", payload);
}

/**
 * POST /media — uploads real file bytes and returns a media_url the backend
 * can actually read back off disk (unlike sending a bare filename, which the
 * pipeline silently can't hash or analyze).
 */
export function uploadMedia(file: File): Promise<{ media_url: string }> {
  const form = new FormData();
  form.append("file", file);
  return http.postForm<{ media_url: string }>("/media", form);
}
