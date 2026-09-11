export function SeverityValue({ score }: { score: number }) {
  return (
    <span className="font-mono text-ink font-medium">
      {score.toFixed(1)} <span className="text-ink-faint font-normal">/ 10</span>
    </span>
  );
}

export function ConfidenceValue({ score }: { score: number }) {
  return <span className="font-mono text-ink font-medium">{Math.round(score)}%</span>;
}
