"use client";

/**
 * SwimLaneOverlay — 4-partition horizontal swimlane overlay
 *
 * Rendered as a direct child of <ReactFlow>.
 * Uses useViewport() to get {x, y, zoom} and applies the same CSS
 * transform as .react-flow__viewport so lanes zoom/pan with the canvas.
 */

import { useViewport } from "@xyflow/react";

interface Props {
  lanes?: string[];
  width?: number;
  height?: number;
}

const DEFAULT_LANES = ["임원", "팀장", "HR 담당자", "구성원"];

/* 통일된 배경 — 줄무늬 교대 (짝수: 좀 더 진하게, 홀수: 연하게) */
const LANE_FILLS = [
  "rgba(180,180,190,0.10)",
  "rgba(200,200,210,0.06)",
  "rgba(180,180,190,0.10)",
  "rgba(200,200,210,0.06)",
];
const LANE_BORDER = "#C0C0C040";
const LABEL_BG   = "#4A4A5A";
const LABEL_COLOR = "#FFFFFF";
const LABEL_WIDTH = 64;  // px — 세로 박스 폭

export default function SwimLaneOverlay({
  lanes = DEFAULT_LANES,
  width = 6000,
  height = 4000,
}: Props) {
  const { x, y, zoom } = useViewport();
  const laneH = height / lanes.length;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {/* Inner: apply same transform as .react-flow__viewport */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          transformOrigin: "0 0",
          transform: `translate(${x}px, ${y}px) scale(${zoom})`,
          width,
          height,
        }}
      >
        {/* Lane band fills + divider lines */}
        <svg
          width={width}
          height={height}
          style={{ position: "absolute", left: 0, top: 0 }}
        >
          {lanes.map((_label, i) => {
            const ly = i * laneH;
            return (
              <g key={i}>
                <rect x={0} y={ly} width={width} height={laneH} fill={LANE_FILLS[i % LANE_FILLS.length]} />
                {i > 0 && (
                  <line
                    x1={0} y1={ly} x2={width} y2={ly}
                    stroke={LANE_BORDER} strokeWidth={2} strokeDasharray="14 7"
                  />
                )}
              </g>
            );
          })}
          <line
            x1={0} y1={height} x2={width} y2={height}
            stroke={LANE_BORDER} strokeWidth={2} strokeDasharray="14 7"
          />
        </svg>

        {/* Lane labels — full-height vertical boxes on the left */}
        {lanes.map((label, i) => {
          const ly = i * laneH;
          return (
            <div
              key={"lbl-" + i}
              style={{
                position: "absolute",
                left: 0,
                top: ly,
                width: LABEL_WIDTH,
                height: laneH,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: LABEL_BG,
                borderRight: "3px solid rgba(255,255,255,0.25)",
                writingMode: "vertical-rl",
                textOrientation: "mixed",
              }}
            >
              <span
                style={{
                  fontSize: 48,
                  fontWeight: 800,
                  fontFamily: "'Noto Sans KR', sans-serif",
                  color: LABEL_COLOR,
                  whiteSpace: "nowrap",
                  lineHeight: 1,
                  letterSpacing: "0.15em",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
