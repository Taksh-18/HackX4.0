import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Incident, ResponderState } from '../data/types';
import { api } from '../services/api';

interface IncidentContextValue {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
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
  // CHANGED: the shared store now reflects the persistent FastAPI database.
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshIncidents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getIncidents();
      setIncidents(data);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load incidents.';
      setError(message);
      throw cause;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateResponderState = useCallback(
    async (id: string, state: ResponderState) => {
      setError(null);
      const updated = await api.updateResponderState(id, state);
      if (updated) {
        setIncidents(prev =>
          prev.map(i => (i.id === id ? { ...updated } : i))
        );
      }
    },
    []
  );

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- initial API synchronization
    refreshIncidents().catch(() => undefined);
  }, [refreshIncidents]);

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
        error,
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
