import type { Incident } from "../types/incident";
import { Icon } from "./Icon";

export type StatusTab = "all" | "critical" | "developing" | "monitor" | "resolved";

export interface IncidentFilterState {
  tab: StatusTab;
  search: string;
}

const TAB_COLOR: Record<StatusTab, string> = {
  all: "#000000",
  critical: "#B91C1C",
  developing: "#B45309",
  monitor: "#515F74",
  resolved: "#45464C",
};

function tabCount(incidents: Incident[], tab: StatusTab): number {
  switch (tab) {
    case "all":
      return incidents.length;
    case "critical":
      return incidents.filter((i) => i.action_priority === "CRITICAL_DISPATCH").length;
    case "developing":
      return incidents.filter((i) => i.verification_status === "DEVELOPING").length;
    case "monitor":
      return incidents.filter((i) => i.action_priority === "MONITOR").length;
    case "resolved":
      return incidents.filter((i) => i.responder_state === "RESOLVED").length;
  }
}

export function IncidentFilters({
  filters,
  onChange,
  incidents,
}: {
  filters: IncidentFilterState;
  onChange: (filters: IncidentFilterState) => void;
  incidents: Incident[];
}) {
  const tabs: StatusTab[] = ["all", "critical", "developing", "monitor", "resolved"];

  return (
    <div className="flex flex-col gap-2 border-t border-[#c6c6cd] pt-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:w-80">
        <Icon
          name="search"
          size={16}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-outline"
        />
        <input
          type="text"
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          placeholder="Search incidents, locations, keywords..."
          aria-label="Search incidents"
          className="w-full rounded-[2px] border border-[#c6c6cd] bg-surface-low py-1.5 pl-8 pr-3 text-[13px] text-on-surface placeholder:text-outline focus:border-black focus:bg-white focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 sm:pb-0">
        {tabs.map((tab) => {
          const active = filters.tab === tab;
          const count = tabCount(incidents, tab);
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange({ ...filters, tab })}
              className="whitespace-nowrap rounded-[2px] border px-2.5 py-1 text-[11px] font-semibold transition-colors"
              style={
                active
                  ? { backgroundColor: "#000000", color: "#ffffff", borderColor: "#000000" }
                  : { backgroundColor: "#f0f3ff", color: TAB_COLOR[tab], borderColor: "#c6c6cd" }
              }
            >
              {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
