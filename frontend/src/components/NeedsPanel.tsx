import type { AggregatedNeeds } from "../types/incident";
import { Icon } from "./Icon";
import { titleCaseResource } from "../lib/format";

const RESOURCE_ICON: Record<string, string> = {
  rescue_boat: "sailing",
  life_jackets: "safety_check",
  first_aid: "medical_services",
  ambulance: "emergency",
  medical_evac: "medical_services",
  fire_engine: "local_fire_department",
  water_pump: "water_pump",
  police_barricade: "security",
  drinking_water: "water_drop",
  food: "restaurant",
  power_restoration: "electrical_services",
  technical_team: "engineering",
  rope: "link",
};

export function NeedsPanel({ needs }: { needs: AggregatedNeeds }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 rounded-[2px] bg-surface-low p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
            Estimated Trapped
          </span>
          <span className="text-[16px] font-extrabold text-on-surface">
            {needs.estimated_trapped_total} Person{needs.estimated_trapped_total === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-xs text-on-surface-variant">
          Maximum reported across {needs.confirmed_by_sources} source
          {needs.confirmed_by_sources === 1 ? "" : "s"} — the pipeline uses the max trapped count,
          never a sum across overlapping reports.
        </p>
      </div>
      {needs.priority_resources.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
            Priority Resources Needed
          </span>
          {needs.priority_resources.map((resource) => (
            <div
              key={resource}
              className="flex items-center justify-between rounded-[2px] bg-surface-low p-2"
            >
              <div className="flex items-center gap-1.5">
                <Icon name={RESOURCE_ICON[resource] ?? "inventory_2"} size={16} />
                <span className="text-[13px] font-semibold text-on-surface">
                  {titleCaseResource(resource)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
