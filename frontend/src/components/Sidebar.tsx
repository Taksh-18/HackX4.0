import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";
import { useHealth } from "../lib/useHealth";

// Exact structure/labels from Stitch's sidebar nav. "Reports" has no
// backend endpoint (no way to list raw reports independently of an
// incident) and no distinct Stitch screen, so it isn't a route — everything
// else routes exactly as in the mockup.
const NAV_ITEMS = [
  { to: "/incidents", label: "Intelligence", icon: "radar" },
  { to: "/map", label: "Map", icon: "map" },
  { to: "/reports", label: "Citizen Submit", icon: "campaign", external: true },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const connected = useHealth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col justify-between border-r border-[#c6c6cd] bg-white transition-transform md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col">
          <div className="flex h-16 items-center gap-2 border-b border-[#c6c6cd] px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-[#151c27] text-white">
              <Icon name="emergency_home" size={18} />
            </div>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[16px] font-semibold leading-tight tracking-tight text-on-surface">
                Incident Ops
              </span>
              <span className="text-[12px] font-medium uppercase leading-none tracking-wider text-on-surface-variant">
                CDIS Responder
              </span>
            </div>
            <button
              type="button"
              className="ml-auto rounded p-1 text-on-surface-variant hover:bg-surface-low md:hidden"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className="p-3">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
              Console Dispatch
            </div>
            <nav className="flex flex-col gap-1" aria-label="Primary">
              {NAV_ITEMS.map(({ to, label, icon, external }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-[2px] px-2 py-2 text-[13px] transition-colors ${
                      isActive
                        ? "border-l-2 border-on-surface bg-surface-container font-semibold text-on-surface"
                        : "text-on-surface-variant hover:bg-surface-low hover:text-on-surface"
                    }`
                  }
                >
                  <Icon name={icon} size={18} />
                  <span className="truncate">{label}</span>
                  {external && (
                    <Icon name="open_in_new" size={14} className="ml-auto text-outline" />
                  )}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
        <div className="border-t border-[#c6c6cd] bg-white p-3">
          <div className="flex items-center gap-2 rounded-[2px] border border-[#c6c6cd] bg-surface-low px-2 py-1.5">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                connected === null
                  ? "bg-status-gray-solid"
                  : connected
                    ? "bg-status-green-solid"
                    : "bg-status-critical-solid"
              }`}
            />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[11px] font-semibold uppercase leading-tight text-on-surface">
                {connected === null ? "Checking API" : connected ? "API Connected" : "API Unreachable"}
              </span>
              <span className="font-mono text-[12px] leading-none text-on-surface-variant">
                {connected ? "FastAPI · /health" : "retrying every 15s"}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
