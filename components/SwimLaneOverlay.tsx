"use client";

/**
 * SwimLaneOverlay — 4-partition horizontal swimlane overlay
 * Renders behind React Flow nodes as labeled horizontal bands.
 * Sits inside the React Flow viewport so it zooms/pans with nodes.
 */

interface Lane {
  label: string;
  color: string;
  borderColor: string;
}

interface Props {
  /** Lane labels, defaults to ["임원","팀장","HR 담당자","구성원"] */
  lanes?: string[];
  /** Total width of the swimlane region (px in RF coord space) */
  width?: number;
  /** Total height of the swimlane region */
  height?: number;
  /** Starting Y */
  startY?: number;
  /** Starting X */
  startX?: number;
}

const DEFAULT_LANES = ["임원", "팀장", "HR 담당자", "구성원"];

const LANE_COLORS: Lane[] = [
  { label: "임원", color: "rgba(166,33,33,0.04)", borderColor: "rgba(166,33,33,0.18)" },
  { label: "팀장", color: "rgba(217,85,120,0.04)", borderColor: "rgba(217,85,120,0.18)" },
  { label: "HR 담당자", color: "rgba(242,160,175,0.04)", borderColor: "rgba(242,160,175,0.25)" },
  { label: "구성원", color: "rgba(242,220,224,0.06)", borderColor: "rgba(222,222,222,0.3)" },
];

export default function SwimLaneOverlay({
  lanes = DEFAULT_LANES,
  width = 4000,
  height = 3000,
  startY = -200,
  startX = -200,
}: Props) {
  const laneCount = lanes.length;
  const laneH = height / laneCount;

  return (
    <svg
      className="pointer-events-none absolute"
      style={{ left: startX, top: startY, width, height, zIndex: 0 }}
    >
      {lanes.map((label, i) => {
        const y = i * laneH;
        const lc = LANE_COLORS[i % LANE_COLORS.length];

        return (
          <g key={i}>
            {/* Band fill */}
            <rect
              x={0}
              y={y}
              width={width}
              height={laneH}
              fill={lc.color}
            />
            {/* Divider line */}
            {i > 0 && (
              <line
                x1={0}
                y1={y}
                x2={width}
                y2={y}
                stroke={lc.borderColor}
                strokeWidth={2}
                strokeDasharray="8 4"
              />
            )}
            {/* Label on left */}
            <rect
              x={4}
              y={y + 8}
              width={90}
              height={28}
              rx={4}
              fill="white"
              fillOpacity={0.85}
              stroke={lc.borderColor}
              strokeWidth={1}
            />
            <text
              x={49}
              y={y + 26}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fontFamily="'Noto Sans KR', sans-serif"
              fill={i < 2 ? "#A62121" : "#374151"}
            >
              {label}
            </text>
          </g>
        );
      })}
      {/* Bottom border */}
      <line
        x1={0}
        y1={height}
        x2={width}
        y2={height}
        stroke="rgba(222,222,222,0.3)"
        strokeWidth={2}
        strokeDasharray="8 4"
      />
    </svg>
  );
}
