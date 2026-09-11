import type { LinkedReport } from "../types/incident";
import { Icon } from "./Icon";
import { formatDistance, formatRelativeTime } from "../lib/format";

function locationTag(link: LinkedReport): string {
  const { report } = link;
  if (report.gps_lat != null && report.gps_lon != null) return "Location: GPS Verified";
  if (report.extracted_json.landmark)
    return `Location: Landmark Match (${report.extracted_json.landmark})`;
  return "Location: Not resolved";
}

/** Exact Stitch citizen-report block: left accent, quote, extracted-facts chips. */
export function ReportCard({ link }: { link: LinkedReport }) {
  const { report } = link;
  const extracted = report.extracted_json;
  const facts: string[] = [];
  if (extracted.trapped_count != null) facts.push(`${extracted.trapped_count} trapped`);
  if (extracted.resource_demands.length > 0) facts.push(extracted.resource_demands.join(", "));
  if (extracted.access_impediment) facts.push("Access impediment");

  return (
    <div
      className="flex flex-col gap-1.5 rounded-[2px] bg-surface-low/40 p-3"
      style={{ borderLeftWidth: 4, borderLeftColor: extracted.relevant === false ? "#76777d" : "#BA1A1A" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-on-surface">{report.source_user}</span>
          <span className="text-xs text-on-surface-variant">
            · {formatRelativeTime(report.timestamp)}
          </span>
          {link.distance_m > 0 && (
            <span className="rounded-[2px] bg-surface-container px-1 font-mono text-xs text-on-surface-variant">
              {formatDistance(link.distance_m)} from centroid
            </span>
          )}
        </div>
      </div>
      <blockquote className="border-l-2 border-[#c6c6cd] pl-2 text-[14px] italic text-on-surface">
        “{report.raw_text}”
      </blockquote>
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <span className="rounded-[2px] bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface">
          {locationTag(link)}
        </span>
        <span className="flex items-center gap-1 rounded-[2px] bg-surface-container px-2 py-0.5 text-[11px] font-medium text-on-surface">
          <Icon name={report.media_url ? "image" : "hide_image"} size={12} />
          {report.media_url ? "Media attached" : "No media"}
        </span>
        {facts.length > 0 && (
          <span className="rounded-[2px] bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
            Extracted: {facts.join(" • ")}
          </span>
        )}
      </div>
    </div>
  );
}
