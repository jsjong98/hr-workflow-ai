"use client";

/**
 * SwimLaneOverlay — 4-partition horizontal swimlane overlay
 *
 * Rendered inside <ReactFlow> as a child. We use the useReactFlow + internal
 * viewport transform by placing our content inside the viewport layer via
 * a custom Panel-like wrapper that hooks into the viewport.
 *
 * Approach: We render an SVG in flow-coordinate space (not screen space).
 * By using `useViewport()` and applying the transform ourselves on an
 * absolutely positioned overlay, the lanes move with the canvas.
 */

import { useEffect, useRef } from "react";

interface Props {
  /** Lane labels, defaults to ["임원","팀장","HR 담당자","구성원"] */
  lanes?: string[];
  /** Total width of the swimlane region (px in RF coord space) */
  width?: number;
  /** Total height of the swimlane region */
  height?: number;
}

const DEFAULT_LANES = ["임원", "팀장", "HR 담당자", "구성원"];

const LANE_STYLES = [
  { color: "rgba(166,33,33,0.07)", border: "rgba(166,33,33,0.25)", labelColor: "#A62121" },
  { color: "rgba(217,85,120,0.07)", border: "rgba(217,85,120,0.25)", labelColor: "#A62121" },
  { color: "rgba(242,160,175,0.07)", border: "rgba(242,160,175,0.30)", labelColor: "#374151" },
  { color: "rgba(242,220,224,0.09)", border: "rgba(222,222,222,0.40)", labelColor: "#374151" },
];

/**
 * This component injects its SVG directly into the `.react-flow__viewport`
 * layer so it transforms automatically with zoom/pan — no manual viewport
 * math needed.
 */
export default function SwimLaneOverlay({
  lanes = DEFAULT_LANES,
  width = 6000,
  height = 4000,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Move our element into the react-flow__viewport layer on mount
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Find the closest ReactFlow wrapper, then its viewport layer
    const rfWrapper = el.closest(".react-flow");
    if (!rfWrapper) return;
    const viewport = rfWrapper.querySelector(".react-flow__viewport") as HTMLElement;
    if (!viewport) return;
    // Insert at the beginning so it's behind nodes/edges
    viewport.insertBefore(el, viewport.firstChild);
    // Cleanup: move back to original parent on unmount (React expects it there)
    return () => {
      // Element might already be removed by React
      try { if (el.parentNode === viewport) viewport.removeChild(el); } catch { /* */ }
    };
  }, []);

  const laneCount = lanes.length;
  const laneH = height / laneCount;

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {/* SVG bands + divider lines */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {lanes.map((label, i) => {
          const ly = i * laneH;
          const ls = LANE_STYLES[i % LANE_STYLES.length];
          return (
            <g key={label + i}>
              <rect x={0} y={ly} width={width} height={laneH} fill={ls.color} />
              {i > 0 && (
                <line
                  x1={0} y1={ly} x2={width} y2={ly}
                  stroke={ls.border} strokeWidth={2} strokeDasharray="12 6"
                />
              )}
            </g>
          );
        })}
        {/* Bottom border */}
        <line
          x1={0} y1={height} x2={width} y2={height}
          stroke="rgba(222,222,222,0.4)" strokeWidth={2} strokeDasharray="12 6"
        />
      </svg>

      {/* Label badges — positioned in flow coordinates */}
      {lanes.map((label, i) => {
        const ly = i * laneH;
        const ls = LANE_STYLES[i % LANE_STYLES.length];
        return (
          <div
            key={"lbl-" + i}
            style={{
              position: "absolute",
              left: 20,
              top: ly + 16,
              background: "rgba(255,255,255,0.94)",
              border: `1.5px solid ${ls.border}`,
              borderRadius: 6,
              padding: "4px 14px",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Noto Sans KR', sans-serif",
              color: ls.labelColor,
              whiteSpace: "nowrap",
              lineHeight: 1.4,
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
