/** Google Material Symbols Outlined — the exact icon font Stitch uses. */
import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 18,
  className = "",
  fill = false,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  fill?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        ...style,
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
