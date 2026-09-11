import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Incident, ResponderState } from '../data/types';
import { incidents as initialIncidents } from '../data/incidents';
import { mockApi } from '../services/mockApi';

interface IncidentContextValue {
  incidents: Incident[];
  loading: boolean;
  refreshIncidents: () => Promise<void>;
  updateResponderState: (id: string, state: ResponderState) => Promise<void>;
  getIncident: (id: string) => Incident | undefined;
  metrics: {
    critical: number;
    active: number;
    developing: number;
    resolved: number;
  };
}

const IncidentContext = createContext<IncidentContextValue | null>(null);

export function IncidentProvider({ children }: { children: React.ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [loading, setLoading] = useState(false);

  const refreshIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mockApi.getIncidents();
      setIncidents(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateResponderState = useCallback(
    async (id: string, state: ResponderState) => {
      const updated = await mockApi.updateResponderState(id, state);
      if (updated) {
        setIncidents(prev =>
          prev.map(i => (i.id === id ? { ...updated } : i))
        );
      }
    },
    []
  );

  const getIncident = useCallback(
    (id: string) => incidents.find(i => i.id === id),
    [incidents]
  );

  const metrics = {
    critical: incidents.filter(
      i => i.severity === 'critical' && i.responderState !== 'resolved'
    ).length,
    active: incidents.filter(i =>
      ['unacknowledged', 'acknowledged', 'dispatched'].includes(i.responderState)
    ).length,
    developing: incidents.filter(i => i.verificationState === 'developing').length,
    resolved: incidents.filter(i => i.responderState === 'resolved').length,
  };

  return (
    <IncidentContext.Provider
      value={{
        incidents,
        loading,
        refreshIncidents,
        updateResponderState,
        getIncident,
        metrics,
      }}
    >
      {children}
    </IncidentContext.Provider>
  );
}

export function useIncidents() {
  const ctx = useContext(IncidentContext);
  if (!ctx) throw new Error('useIncidents must be used within IncidentProvider');
  return ctx;
}
