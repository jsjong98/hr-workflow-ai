"use client";

/**
 * SwimLaneOverlay — PPT-proportioned slide frame overlay
 *
 * Supports per-lane height adjustment via drag handles.
 * Uses useNodes() to compute the SAME scale (sc) as the PPT export,
 * then maps the PPT slide boundary to canvas coordinates.
 */

import { useViewport, useNodes } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  lanes?: string[];
  swimHeight?: number;
  /** Per-lane heights in canvas pixels. Falls back to swimHeight/lanes.length. */
  laneHeights?: number[];
  /** Called when user drags a divider to resize lanes. */
  onLaneHeightsChange?: (heights: number[]) => void;
}

const DEFAULT_LANES = ["현업 임원", "팀장", "HR 담당자", "구성원"];
const MIN_LANE_H = 80;

/* ── PPT constants (must match ExportToolbar) ── */
const PPT_W         = 13.33;
const PPT_H         = 7.5;
const PPT_PAD_X     = 1.25;
const PPT_PAD_TOP   = 1.575;
const PPT_PAD_BOT   = 0.35;
const PPT_SL_BOTTOM = PPT_H - PPT_PAD_BOT + 0.05;  // 7.2"
const PPT_MAX_SWIM_H = PPT_SL_BOTTOM - 0.65;        // 6.55"

/* ── Node canvas sizes (must match ExportToolbar LS) ── */
const NS: Record<string, { w: number; h: number }> = {
  L2: { w: 720, h: 260 },
  L3: { w: 660, h: 240 },
  L4: { w: 600, h: 220 },
  L5: { w: 540, h: 389 },
};
const DEF_NS = NS.L4;
const SC_REF = 0.787 / DEF_NS.h;  // 0.003577

/* ── Styles ── */
const FRAME_STROKE  = "#94A3B8";
const DIVIDER_COLOR = "#B0B0B0";
const TITLE_FILL    = "rgba(241,245,249,0.5)";
const OVERFLOW_FILL = "rgba(254,226,226,0.15)";
const MARGIN_COLOR  = "#CBD5E1";
const HANDLE_HOVER  = "#6366F1";

export default function SwimLaneOverlay({
  lanes = DEFAULT_LANES,
  swimHeight: swimHeightProp = 2400,
  laneHeights: laneHeightsProp,
  onLaneHeightsChange,
}: Props) {
  const { x, y, zoom } = useViewport();
  const allNodes = useNodes();

  /* ── Effective lane heights ── */
  const defaultH = swimHeightProp / lanes.length;
  const baseHeights: number[] = (laneHeightsProp && laneHeightsProp.length === lanes.length)
    ? laneHeightsProp
    : Array(lanes.length).fill(defaultH);

  const [draggingHeights, setDraggingHeights] = useState<number[] | null>(null);
  const [hoveredDivider, setHoveredDivider] = useState<number | null>(null);
  const laneHeights = draggingHeights || baseHeights;
  const swimHeight = laneHeights.reduce((a, b) => a + b, 0);

  /* Cumulative Y positions (canvas pixels, y=0 = top of lane 0) */
  const cumulativeY: number[] = [];
  let acc = 0;
  for (let i = 0; i < laneHeights.length; i++) {
    cumulativeY.push(acc);
    acc += laneHeights[i];
  }

  /* ── Drag refs ── */
  const dragRef = useRef<{
    dividerIndex: number;
    startY: number;
    startHeights: number[];
  } | null>(null);
  const currentDragHeightsRef = useRef<number[] | null>(null);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const onChangeRef = useRef(onLaneHeightsChange);
  useEffect(() => { onChangeRef.current = onLaneHeightsChange; }, [onLaneHeightsChange]);

  /* Global mouse events for drag */
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const { dividerIndex, startY, startHeights } = dragRef.current;
      const dy = (e.clientY - startY) / zoomRef.current;
      const total = startHeights[dividerIndex] + startHeights[dividerIndex + 1];
      const newAbove = Math.max(MIN_LANE_H, Math.min(total - MIN_LANE_H, startHeights[dividerIndex] + dy));
      const newHeights = [...startHeights];
      newHeights[dividerIndex] = newAbove;
      newHeights[dividerIndex + 1] = total - newAbove;
      currentDragHeightsRef.current = newHeights;
      setDraggingHeights([...newHeights]);
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      if (currentDragHeightsRef.current) {
        onChangeRef.current?.(currentDragHeightsRef.current);
      }
      dragRef.current = null;
      currentDragHeightsRef.current = null;
      setDraggingHeights(null);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    // Also stop native event to prevent ReactFlow pan
    e.nativeEvent.stopImmediatePropagation();
    dragRef.current = {
      dividerIndex: idx,
      startY: e.clientY,
      startHeights: [...laneHeights],
    };
  }, [laneHeights]);

  /* ── Y-axis scale ── */
  const PPT_SWIM_BAND = Math.min(1.535, PPT_MAX_SWIM_H / lanes.length);
  const totalSwimIn = PPT_SWIM_BAND * lanes.length;
  const px1 = swimHeight / totalSwimIn;
  const slTop = PPT_SL_BOTTOM - totalSwimIn;

  /* ── X-axis: compute sc from bbox ── */
  let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
  for (const nd of allNodes) {
    const lv = (nd.data as Record<string, string>)?.level || "L4";
    const s = NS[lv] || DEF_NS;
    bMinX = Math.min(bMinX, nd.position.x);
    bMinY = Math.min(bMinY, nd.position.y);
    bMaxX = Math.max(bMaxX, nd.position.x + s.w);
    bMaxY = Math.max(bMaxY, nd.position.y + s.h);
  }
  if (!isFinite(bMinX)) { bMinX = 0; bMinY = 0; bMaxX = 3000; bMaxY = swimHeight; }
  const bRangeX = (bMaxX - bMinX) || 1;
  const bRangeY = (bMaxY - bMinY) || 1;

  const areaW = PPT_W - 2 * PPT_PAD_X;
  const areaH = PPT_H - PPT_PAD_TOP - PPT_PAD_BOT;
  const scFit = Math.min(areaW / bRangeX, areaH / bRangeY);
  const sc = Math.min(scFit, SC_REF);

  /* ── Frame in canvas coords ── */
  const frameL = bMinX - PPT_PAD_X / sc;
  const frameW = PPT_W / sc;
  const frameT = -(slTop * px1);
  const frameH = PPT_H * px1;

  const titleH = -frameT;
  const contentL = PPT_PAD_X / sc;
  const contentR = (PPT_W - PPT_PAD_X) / sc;

  const extW = frameW + 800;
  const extH = frameH + 300;

  const isDragging = draggingHeights !== null;

  return (
    <div style={{
      position: "absolute", top: 0, left: 0,
      width: "100%", height: "100%",
      overflow: "hidden", pointerEvents: "none", zIndex: 1,
    }}>
      <div style={{
        position: "absolute", left: 0, top: 0,
        transformOrigin: "0 0",
        transform: `translate(${x}px, ${y}px) scale(${zoom})`,
      }}>
        <svg
          width={extW}
          height={extH}
          style={{ position: "absolute", left: frameL, top: frameT }}
        >
          {/* Overflow zones */}
          <rect x={frameW} y={0} width={extW - frameW} height={frameH} fill={OVERFLOW_FILL} />
          <rect x={0} y={frameH} width={extW} height={extH - frameH} fill={OVERFLOW_FILL} />

          {/* Title area */}
          <rect x={1} y={1} width={frameW - 2} height={Math.max(titleH - 1, 0)} fill={TITLE_FILL} />

          {/* Bottom margin */}
          {(() => {
            const botY = titleH + swimHeight;
            const botH = frameH - botY;
            return botH > 1
              ? <rect x={1} y={botY} width={frameW - 2} height={botH - 1} fill={TITLE_FILL} />
              : null;
          })()}

          {/* Slide frame border */}
          <rect x={0} y={0} width={frameW} height={frameH}
            fill="none" stroke={FRAME_STROKE} strokeWidth={2} rx={2} />

          {/* Content margin guides */}
          <line x1={contentL} y1={titleH} x2={contentL} y2={titleH + swimHeight}
            stroke={MARGIN_COLOR} strokeWidth={1} strokeDasharray="6 4" opacity={0.5} />
          <line x1={contentR} y1={titleH} x2={contentR} y2={titleH + swimHeight}
            stroke={MARGIN_COLOR} strokeWidth={1} strokeDasharray="6 4" opacity={0.5} />

          {/* Swim lane dividers (top + between each lane + bottom) */}
          {Array.from({ length: lanes.length + 1 }, (_, i) => {
            const yPos = titleH + (i < lanes.length ? cumulativeY[i] : swimHeight);
            const isInner = i > 0 && i < lanes.length;
            const isHovered = isInner && hoveredDivider === i - 1;
            const isActiveDrag = isInner && isDragging && dragRef.current?.dividerIndex === i - 1;
            return (
              <line key={`d${i}`}
                x1={0} y1={yPos}
                x2={frameW} y2={yPos}
                stroke={isActiveDrag ? HANDLE_HOVER : isHovered ? HANDLE_HOVER : DIVIDER_COLOR}
                strokeWidth={isActiveDrag ? 2.5 : isHovered ? 2 : 1.5}
                strokeDasharray={isActiveDrag ? "none" : "10 6"}
                opacity={isActiveDrag ? 0.8 : 1}
              />
            );
          })}

          {/* Lane height labels when dragging */}
          {isDragging && laneHeights.map((h, i) => (
            <text key={`ht${i}`}
              x={frameW - 8}
              y={titleH + cumulativeY[i] + h / 2 + 4}
              fontSize={10} fill="#6366F1" textAnchor="end"
              fontFamily="'Noto Sans KR',sans-serif" opacity={0.8}>
              {Math.round(h)}px
            </text>
          ))}

          {/* PPT badge */}
          <rect x={6} y={6} width={120} height={20} rx={3} fill="white" fillOpacity={0.9} />
          <text x={12} y={20} fontSize={11} fill="#64748B" fontWeight="600"
            fontFamily="'Noto Sans KR',sans-serif">PPT 슬라이드</text>

          {titleH > 80 && (
            <text x={frameW / 2} y={titleH / 2 + 4} fontSize={12} fill="#94A3B8"
              textAnchor="middle" fontFamily="'Noto Sans KR',sans-serif">제목 영역</text>
          )}

          <text x={frameW + 12} y={titleH + swimHeight / 2} fontSize={11} fill="#EF4444"
            opacity={0.5} fontWeight="500" fontFamily="'Noto Sans KR',sans-serif">
            ← PPT 경계
          </text>
        </svg>

        {/* Lane labels */}
        {lanes.map((label, i) => (
          <div key={`lbl-${i}`} style={{
            position: "absolute",
            left: frameL + 12,
            top: cumulativeY[i] + 10,
            width: 120, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#FFF", border: "1.5px solid #B0B0B0", borderRadius: 2,
          }}>
            <span style={{
              fontSize: 13, fontWeight: 500,
              fontFamily: "'Noto Sans KR',sans-serif",
              color: "#333", whiteSpace: "nowrap", lineHeight: 1,
            }}>{label}</span>
          </div>
        ))}

      </div>

      {/* ── Drag handles: screen-space coordinates so hit area is always 20px regardless of zoom ── */}
      {onLaneHeightsChange && lanes.length > 1 && Array.from({ length: lanes.length - 1 }, (_, i) => {
        // Convert canvas divider Y to screen Y (relative to ReactFlow container)
        const screenY = y + cumulativeY[i + 1] * zoom;
        const screenX = Math.max(0, x + frameL * zoom);
        const screenW = frameW * zoom;
        const isActive = isDragging && dragRef.current?.dividerIndex === i;
        const isHovered = hoveredDivider === i;
        return (
          <div
            key={`handle-${i}`}
            className="nopan nodrag"
            style={{
              position: "absolute",
              left: screenX,
              top: screenY - 10,
              width: screenW,
              height: 20,
              cursor: "row-resize",
              pointerEvents: "auto",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={() => setHoveredDivider(i)}
            onMouseLeave={() => setHoveredDivider(null)}
            onMouseDown={(e) => handleDividerMouseDown(e, i)}
          >
            {/* Always-visible subtle grip dots */}
            <div style={{
              display: "flex", gap: 3, alignItems: "center",
              opacity: isActive ? 1 : isHovered ? 0.9 : 0.35,
              transition: "opacity 0.15s",
              pointerEvents: "none",
            }}>
              {[0,1,2,3,4].map(j => (
                <div key={j} style={{
                  width: isHovered || isActive ? 5 : 4,
                  height: isHovered || isActive ? 5 : 4,
                  borderRadius: "50%",
                  background: isActive ? HANDLE_HOVER : isHovered ? HANDLE_HOVER : "#888",
                  transition: "all 0.15s",
                }} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
