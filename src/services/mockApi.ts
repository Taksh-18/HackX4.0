import type { Incident, Report, ResponderState } from '../data/types';
import { incidents as mockIncidents, allReports } from '../data/incidents';

// Simulate async network calls with small delay
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// Mutable state copy so actions persist within session
let incidentState: Incident[] = mockIncidents.map(i => ({ ...i }));

export const mockApi = {
  // ── Incidents ────────────────────────────────────────────────────────────

  async getIncidents(): Promise<Incident[]> {
    await delay(400);
    return [...incidentState];
  },

  async getIncidentById(id: string): Promise<Incident | null> {
    await delay(300);
    return incidentState.find(i => i.id === id) ?? null;
  },

  async updateResponderState(
    id: string,
    state: ResponderState
  ): Promise<Incident | null> {
    await delay(200);
    const idx = incidentState.findIndex(i => i.id === id);
    if (idx === -1) return null;
    const updated: Incident = {
      ...incidentState[idx],
      responderState: state,
      updatedAt: new Date().toISOString(),
      ...(state === 'resolved' ? { resolvedAt: new Date().toISOString() } : {}),
    };
    // Add timeline event
    const newEvent = {
      id: `t-action-${Date.now()}`,
      timestamp: new Date().toISOString(),
      title:
        state === 'acknowledged'
          ? 'Responder acknowledged incident'
          : state === 'dispatched'
          ? 'Units dispatched to incident'
          : state === 'resolved'
          ? 'Incident marked as resolved'
          : 'Responder state updated',
      type: 'responder' as const,
    };
    updated.timeline = [...(updated.timeline ?? []), newEvent];
    incidentState[idx] = updated;
    return { ...updated };
  },

  async acknowledgeIncident(id: string): Promise<Incident | null> {
    return mockApi.updateResponderState(id, 'acknowledged');
  },

  async dispatchIncident(id: string): Promise<Incident | null> {
    return mockApi.updateResponderState(id, 'dispatched');
  },

  async resolveIncident(id: string): Promise<Incident | null> {
    return mockApi.updateResponderState(id, 'resolved');
  },

  // ── Reports ──────────────────────────────────────────────────────────────

  async getReports(): Promise<Report[]> {
    await delay(400);
    return allReports;
  },

  async getMyReports(): Promise<Report[]> {
    await delay(300);
    return allReports.filter(r => r.isCurrentUser);
  },

  async submitReport(_report: Omit<Report, 'id' | 'status' | 'timestamp' | 'authorId' | 'isCurrentUser'>): Promise<{ id: string; referenceCode: string }> {
    await delay(800);
    const id = `rep-${Date.now()}`;
    const referenceCode = `CDIS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    return { id, referenceCode };
  },

  // ── Analytics ─────────────────────────────────────────────────────────────

  async getAnalytics() {
    await delay(500);
    const data = incidentState;
    return {
      totalIncidents: data.length,
      byType: {
        flood: data.filter(i => i.type === 'flood').length,
        fire: data.filter(i => i.type === 'fire').length,
        accident: data.filter(i => i.type === 'accident').length,
        structural: data.filter(i => i.type === 'structural').length,
        landslide: data.filter(i => i.type === 'landslide').length,
        weather: data.filter(i => i.type === 'weather').length,
        other: data.filter(i => i.type === 'other').length,
      },
      byVerification: {
        corroborated: data.filter(i => i.verificationState === 'corroborated').length,
        developing: data.filter(i => i.verificationState === 'developing').length,
        contradicted: data.filter(i => i.verificationState === 'contradicted').length,
      },
      byActionPriority: {
        critical_dispatch: data.filter(i => i.actionPriority === 'critical_dispatch').length,
        deploy_scout: data.filter(i => i.actionPriority === 'deploy_scout').length,
        monitor: data.filter(i => i.actionPriority === 'monitor').length,
        suppressed: data.filter(i => i.actionPriority === 'suppressed').length,
      },
      bySeverity: {
        critical: data.filter(i => i.severity === 'critical').length,
        high: data.filter(i => i.severity === 'high').length,
        moderate: data.filter(i => i.severity === 'moderate').length,
        low: data.filter(i => i.severity === 'low').length,
      },
      incidentVolume: [
        { time: '06:00', count: 1 },
        { time: '07:00', count: 2 },
        { time: '08:00', count: 4 },
        { time: '09:00', count: 6 },
        { time: '10:00', count: 7 },
        { time: '11:00', count: 8 },
        { time: '12:00', count: 8 },
        { time: '13:00', count: 8 },
      ],
      hotspots: [
        { name: 'Central District', count: 1, severity: 'critical' as const },
        { name: 'Riverfront', count: 1, severity: 'high' as const },
        { name: 'Old Quarter', count: 1, severity: 'high' as const },
        { name: 'Highway 7', count: 1, severity: 'moderate' as const },
        { name: 'Northern Hills', count: 1, severity: 'moderate' as const },
      ],
    };
  },
};
