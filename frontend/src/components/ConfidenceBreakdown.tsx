import type { ConfidenceBreakdown as ConfidenceBreakdownType } from "../types/incident";
import { ConfidenceBar } from "./ConfidenceBar";

const ROWS: { key: keyof ConfidenceBreakdownType; label: string; kind: "positive" | "penalty" }[] = [
  { key: "source_score", label: "Independent sources (30%)", kind: "positive" },
  { key: "geo_score", label: "Geographic agreement (25%)", kind: "positive" },
  { key: "media_score", label: "Fresh media ratio (20%)", kind: "positive" },
  { key: "external_score", label: "External verification (25%)", kind: "positive" },
  { key: "contradiction_penalty", label: "Contradiction penalty", kind: "penalty" },
  { key: "misinformation_penalty", label: "Misinformation penalty", kind: "penalty" },
];

/** How confidence_score was actually computed — never a decorative gauge. */
export function ConfidenceBreakdownPanel({
  breakdown,
  confidenceScore,
}: {
  breakdown: ConfidenceBreakdownType;
  confidenceScore: number;
}) {
  const hasBreakdown = Object.keys(breakdown).length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-sm text-ink-muted">Confidence score</span>
          <span className="font-mono text-lg font-semibold text-ink">
            {Math.round(confidenceScore)}%
          </span>
        </div>
        <ConfidenceBar score={confidenceScore} />
      </div>
      {!hasBreakdown ? (
        <p className="text-sm text-ink-faint">
          No confidence breakdown available for this incident yet.
        </p>
      ) : (
        <dl className="flex flex-col gap-1.5 border-t border-border-subtle pt-3">
          {ROWS.filter((row) => breakdown[row.key] !== undefined).map((row) => {
            const value = breakdown[row.key] ?? 0;
            return (
              <div key={row.key} className="flex items-center justify-between text-sm">
                <dt className="text-ink-muted">{row.label}</dt>
                <dd
                  className={`font-mono ${row.kind === "penalty" && value > 0 ? "text-status-critical" : "text-ink"}`}
                >
                  {row.kind === "penalty" && value > 0 ? "-" : ""}
                  {value.toFixed(1)}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
    </div>
  );
}
