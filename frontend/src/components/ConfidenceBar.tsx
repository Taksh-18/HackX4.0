function toneFor(score: number) {
  if (score >= 70) return "#16A34A";
  if (score >= 40) return "#D97706";
  return "#DC2626";
}

/** Exact Stitch confidence-meter styling: h-1.5, 2px radius, solid fill. */
export function ConfidenceBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-[2px] bg-surface-container">
      <div
        className="h-full rounded-[2px]"
        style={{ width: `${clamped}%`, backgroundColor: toneFor(clamped) }}
      />
    </div>
  );
}
