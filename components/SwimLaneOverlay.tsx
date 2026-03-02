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

const LANE_STYLES = [
  { fill: "rgba(166,33,33,0.13)",  border: "#A6212138", labelBg: "#A62121", labelColor: "#fff" },
  { fill: "rgba(217,85,120,0.10)", border: "#D9557838", labelBg: "#D95578", labelColor: "#fff" },
  { fill: "rgba(242,160,175,0.10)", border: "#F2A0AF45", labelBg: "#F2A0AF", labelColor: "#333" },
  { fill: "rgba(242,220,224,0.12)", border: "#DEDEDE55", labelBg: "#DEDEDE", labelColor: "#333" },
];

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
          {lanes.map((label, i) => {
            const ly = i * laneH;
            const ls = LANE_STYLES[i % LANE_STYLES.length];
            return (
              <g key={i}>
                <rect x={0} y={ly} width={width} height={laneH} fill={ls.fill} />
                {i > 0 && (
                  <line
                    x1={0} y1={ly} x2={width} y2={ly}
                    stroke={ls.border} strokeWidth={2} strokeDasharray="14 7"
                  />
                )}
              </g>
            );
          })}
          <line
            x1={0} y1={height} x2={width} y2={height}
            stroke="#DEDEDE55" strokeWidth={2} strokeDasharray="14 7"
          />
        </svg>

        {/* Lane label badges — flow coordinates, will scale with zoom */}
        {lanes.map((label, i) => {
          const ly = i * laneH;
          const ls = LANE_STYLES[i % LANE_STYLES.length];
          return (
            <div
              key={"lbl-" + i}
              style={{
                position: "absolute",
                left: 40,
                top: ly + laneH / 2,
                transform: "translateY(-50%)",
                display: "flex",
                alignItems: "center",
                gap: 18,
                background: ls.labelBg,
                borderRadius: 18,
                padding: "14px 36px 14px 28px",
                boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              }}
            >
              {/* Color dot */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  backgroundColor: "#fff",
                  opacity: 0.35,
                  flexShrink: 0,
                }}
              />
              {/* Label text */}
              <span
                style={{
                  fontSize: 54,
                  fontWeight: 800,
                  fontFamily: "'Noto Sans KR', sans-serif",
                  color: ls.labelColor,
                  whiteSpace: "nowrap",
                  lineHeight: 1.2,
                  letterSpacing: "0.03em",
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
