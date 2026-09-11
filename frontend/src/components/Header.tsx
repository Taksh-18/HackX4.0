import { Icon } from "./Icon";
import { useHealth } from "../lib/useHealth";

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const connected = useHealth();

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-[#c6c6cd] bg-white px-4 md:left-64 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-low md:hidden"
          onClick={onMenuClick}
          aria-label="Open navigation"
        >
          <Icon name="menu" size={20} />
        </button>
        <div className="flex items-center gap-1.5 rounded-[2px] border border-[#c6c6cd] bg-surface-low px-2 py-1">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              connected ? "bg-status-critical-solid" : "bg-status-gray-solid"
            } ${connected ? "animate-pulse" : ""}`}
          />
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-on-surface">
            {connected === null
              ? "CONNECTING..."
              : connected
                ? "STATUS: ACTIVE MONITORING"
                : "STATUS: BACKEND UNREACHABLE"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-on-surface-variant">
        <Icon name="shield_person" size={18} />
        <span className="font-mono text-xs">Responder Console</span>
      </div>
    </header>
  );
}
