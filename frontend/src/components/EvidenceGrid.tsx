import type { Evidence } from "../types/incident";
import { formatPercent } from "../lib/format";

export function EvidenceGrid({ evidence }: { evidence: Evidence }) {
  const items: { label: string; value: string }[] = [
    { label: "Total reports", value: String(evidence.total_reports) },
    { label: "Independent sources (est.)", value: String(evidence.independent_sources) },
    { label: "Unique images", value: String(evidence.unique_images) },
    {
      label: "Duplicate image groups",
      value: String(evidence.duplicate_image_groups),
    },
    {
      label: "Duplicate text groups",
      value: String(evidence.duplicate_text_groups),
    },
    {
      label: "Recycled media",
      value:
        evidence.recycled_media_detected > 0
          ? String(evidence.recycled_media_detected)
          : "None detected",
    },
    { label: "Geo agreement", value: formatPercent(evidence.geo_agreement) },
    { label: "Fresh media ratio", value: formatPercent(evidence.fresh_media_ratio) },
    {
      label: "External verification",
      value:
        evidence.external_verification_hits == null
          ? "Not configured"
          : String(evidence.external_verification_hits),
    },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-sm text-ink-muted">{item.label}</dt>
          <dd className="font-mono text-sm font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
