import { useEffect, useState } from "react";
import { checkHealth } from "../api/incidents";

const POLL_MS = 15000;

/** Real GET /health polling — never fabricated "sync/latency" telemetry. */
export function useHealth() {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = () => {
      checkHealth().then((ok) => {
        if (!cancelled) setConnected(ok);
      });
    };
    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return connected;
}
