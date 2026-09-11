import { useEffect, useRef, useState } from "react";
import { getIncidentUpdates } from "../api/incidents";

const POLL_MS = 10000;

/**
 * Polls GET /incidents/updates?since=<last check>. This is honestly a
 * poll, not a push stream — the backend has no websocket/SSE endpoint.
 * Calls `onChanged` (with the changed incident count) whenever the poll
 * finds anything newer than the last check.
 */
export function useLiveUpdates(onChanged: (count: number) => void) {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const sinceRef = useRef(new Date());
  const onChangedRef = useRef(onChanged);

  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const since = sinceRef.current;
      const checkedAt = new Date();
      try {
        const changed = await getIncidentUpdates(since);
        if (cancelled) return;
        sinceRef.current = checkedAt;
        setLastChecked(checkedAt);
        if (changed.length > 0) onChangedRef.current(changed.length);
      } catch {
        // Polling failure is silent — the manual refresh path still works.
      }
    };
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return lastChecked;
}
