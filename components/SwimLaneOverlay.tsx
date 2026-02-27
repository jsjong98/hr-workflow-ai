"use client";

/**
 * SwimLaneOverlay — 4-partition horizontal swimlane overlay
 *
 * Uses useViewport() from @xyflow/react so it zooms/pans with the canvas.
 * Must be rendered as a child of <ReactFlow> (or inside ReactFlowProvider).
 */

import { useViewport } from "@xyflow/react";

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
}

const DEFAULT_LANES = ["임원", "팀장", "HR 담당자", "구성원"];

const LANE_COLORS: Lane[] = [
  { label: "임원", color: "rgba(166,33,33,0.06)", borderColor: "rgba(166,33,33,0.22)" },
  { label: "팀장", color: "rgba(217,85,120,0.06)", borderColor: "rgba(217,85,120,0.22)" },
  { label: "HR 담당자", color: "rgba(242,160,175,0.06)", borderColor: "rgba(242,160,175,0.28)" },
  { label: "구성원", color: "rgba(242,220,224,0.08)", borderColor: "rgba(222,222,222,0.35)" },
];

export default function SwimLaneOverlay({
  lanes = DEFAULT_LANES,
  width = 4000,
  height = 3000,
}: Props) {
  const { x, y, zoom } = useViewport();
  const laneCount = lanes.length;
  const laneH = height / laneCount;

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 0 }}
    >
      <svg
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: width * zoom,
          height: height * zoom,
          transform: `translate(${x}px, ${y}px)`,
          transformOrigin: "0 0",
        }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        {lanes.map((label, i) => {
          const laneY = i * laneH;
          const lc = LANE_COLORS[i % LANE_COLORS.length];

          return (
            <g key={label + i}>
              {/* Band fill */}
              <rect
                x={0}
                y={laneY}
                width={width}
                height={laneH}
                fill={lc.color}
              />
              {/* Divider line between lanes */}
              {i > 0 && (
                <line
                  x1={0}
                  y1={laneY}
                  x2={width}
                  y2={laneY}
                  stroke={lc.borderColor}
                  strokeWidth={2}
                  strokeDasharray="10 5"
                />
              )}
            </g>
          );
        })}
        {/* Bottom border */}
        <line
          x1={0}
          y1={height}
          x2={width}
          y2={height}
          stroke="rgba(222,222,222,0.35)"
          strokeWidth={2}
          strokeDasharray="10 5"
        />
      </svg>

      {/* Label badges — HTML divs for crisp text at any zoom */}
      {lanes.map((label, i) => {
        const laneY = i * laneH;
        const lc = LANE_COLORS[i % LANE_COLORS.length];
        return (
          <div
            key={"label-" + i}
            style={{
              position: "absolute",
              left: x + 12 * zoom,
              top: y + (laneY + 10) * zoom,
              background: "rgba(255,255,255,0.92)",
              border: `1.5px solid ${lc.borderColor}`,
              borderRadius: Math.max(3, 5 * zoom),
              padding: `${Math.max(2, 3 * zoom)}px ${Math.max(5, 10 * zoom)}px`,
              fontSize: Math.max(10, 13 * zoom),
              fontWeight: 700,
              fontFamily: "'Noto Sans KR', sans-serif",
              color: i < 2 ? "#A62121" : "#374151",
              whiteSpace: "nowrap",
              lineHeight: 1.4,
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
