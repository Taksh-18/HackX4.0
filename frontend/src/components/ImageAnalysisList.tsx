import { ImageOff } from "lucide-react";
import type { ImageAnalysis } from "../types/incident";

/** Vision-model image-content analysis — separate from pHash duplicate detection. */
export function ImageAnalysisList({ analyses }: { analyses: ImageAnalysis[] }) {
  if (analyses.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-ink-faint">
        <ImageOff size={14} />
        No image-content analysis available for this incident's media.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {analyses.map((analysis) => (
        <div key={analysis.report_id} className="rounded border border-border p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-mono text-xs text-ink-muted">{analysis.report_id}</span>
            {!analysis.analyzed && (
              <span className="text-xs text-ink-faint">Not analyzed</span>
            )}
          </div>
          {analysis.analyzed ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-ink-muted">
                {analysis.disaster_type && <span>Type: {analysis.disaster_type}</span>}
                {analysis.severity != null && (
                  <span>
                    Visual severity: <span className="font-mono">{analysis.severity}/10</span>
                  </span>
                )}
                {analysis.confidence != null && (
                  <span>
                    Confidence: <span className="font-mono">{Math.round(analysis.confidence)}%</span>
                  </span>
                )}
                {analysis.supports_text_claim != null && (
                  <span
                    className={
                      analysis.supports_text_claim ? "text-status-green" : "text-status-critical"
                    }
                  >
                    {analysis.supports_text_claim ? "Supports report text" : "Conflicts with report text"}
                  </span>
                )}
              </div>
              {analysis.visible_damage.length > 0 && (
                <p className="text-ink-muted">
                  Visible damage: {analysis.visible_damage.join(", ")}
                </p>
              )}
              {analysis.concerns.length > 0 && (
                <p className="text-status-amber">Concerns: {analysis.concerns.join(", ")}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-faint">
              {analysis.concerns[0] ?? "No vision provider configured for this deployment."}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
