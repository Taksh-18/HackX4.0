import { useState } from "react";
import type { ResponderState } from "../types/incident";
import { Icon } from "./Icon";

const STEPS: { label: string; state: ResponderState }[] = [
  { label: "1. Unack", state: "UNACKNOWLEDGED" },
  { label: "2. Acked", state: "ACKNOWLEDGED" },
  { label: "3. Dispatched", state: "DISPATCHED" },
  { label: "4. Resolved", state: "RESOLVED" },
];

const NEXT_ACTION: Record<
  ResponderState,
  { label: string; icon: string; state: ResponderState } | null
> = {
  UNACKNOWLEDGED: { label: "Acknowledge Incident", icon: "assignment_turned_in", state: "ACKNOWLEDGED" },
  ACKNOWLEDGED: { label: "Dispatch Responders", icon: "send", state: "DISPATCHED" },
  DISPATCHED: { label: "Resolve Incident", icon: "task_alt", state: "RESOLVED" },
  RESOLVED: null,
};

const ORDER: ResponderState[] = ["UNACKNOWLEDGED", "ACKNOWLEDGED", "DISPATCHED", "RESOLVED"];

export function IncidentActions({
  state,
  onAcknowledge,
  onDispatch,
  onResolve,
}: {
  state: ResponderState;
  onAcknowledge: () => Promise<void>;
  onDispatch: () => Promise<void>;
  onResolve: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const currentIndex = ORDER.indexOf(state);
  const next = NEXT_ACTION[state];

  const handlers: Record<ResponderState, () => Promise<void>> = {
    UNACKNOWLEDGED: onAcknowledge,
    ACKNOWLEDGED: onDispatch,
    DISPATCHED: onResolve,
    RESOLVED: async () => {},
  };

  const handleClick = async () => {
    if (!next) return;
    setPending(true);
    try {
      await handlers[state]();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-center text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
        {STEPS.map((step, i) => (
          <span key={step.state} style={{ color: i === currentIndex ? "#BA1A1A" : undefined }}>
            {step.label}
            {i < STEPS.length - 1 && <span className="ml-1 text-outline">→</span>}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1">
        {STEPS.map((step, i) => (
          <div
            key={step.state}
            className="h-1.5 rounded-[2px]"
            style={{ backgroundColor: i <= currentIndex ? "#BA1A1A" : "#dce2f3" }}
          />
        ))}
      </div>

      {next ? (
        <button
          type="button"
          onClick={handleClick}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-[2px] bg-black px-4 py-3 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-neutral-800 disabled:opacity-60"
        >
          <Icon name={pending ? "sync" : next.icon} size={20} className={pending ? "animate-spin" : ""} />
          <span>{pending ? "Working..." : next.label}</span>
        </button>
      ) : (
        <div className="flex w-full items-center justify-center gap-2 rounded-[2px] bg-status-green-bg px-4 py-3 text-[15px] font-semibold text-status-green">
          <Icon name="task_alt" size={20} />
          <span>Resolved</span>
        </div>
      )}
    </div>
  );
}
