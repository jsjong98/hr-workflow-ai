"use client";

/**
 * PwC Logo Component — clean text-based SVG wordmark
 * Brand color: #D04A02 (PwC signature orange)
 */
export default function PwcLogo({
  width = 72,
  height = 28,
  color = "#D04A02",
}: {
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="PwC Logo"
    >
      <text
        x="0"
        y="36"
        fontFamily="'Georgia', 'Times New Roman', serif"
        fontSize="42"
        fontWeight="bold"
        fill={color}
        letterSpacing="-1"
      >
        pw
      </text>
      <text
        x="78"
        y="36"
        fontFamily="'Georgia', 'Times New Roman', serif"
        fontSize="42"
        fontWeight="bold"
        fontStyle="italic"
        fill={color}
        letterSpacing="-1"
      >
        C
      </text>
    </svg>
  );
}
