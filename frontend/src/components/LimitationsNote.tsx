import { Info } from "lucide-react";

/** Plain-language caveats from evidence_json.limitations — never omitted or softened. */
export function LimitationsNote({ limitations }: { limitations: string[] }) {
  if (limitations.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded border border-border bg-canvas px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        <Info size={13} />
        Limitations
      </div>
      <ul className="flex flex-col gap-1">
        {limitations.map((note, i) => (
          <li key={i} className="text-xs leading-relaxed text-ink-faint">
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
}
