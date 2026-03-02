"use client";

import { Handle, Position } from "@xyflow/react";
import { memo } from "react";

/* ─────────────────────────────────────────────
 * 레벨별 차별화 디자인 시스템 (진한→연한 그라디언트)
 * L2: #A62121  →  L3: #D95578  →  L4: #F2A0AF  →  L5: #F2DCE0
 * ───────────────────────────────────────────── */
export const LEVEL_STYLES = {
  L2: {
    bg: "bg-gradient-to-br from-[#A62121] to-[#8A1B1B]",
    text: "text-white",
    border: "border-[#D95578]",
    badge: "bg-[#F2A0AF]/40 text-white",
    shadow: "shadow-xl shadow-[#A62121]/30",
    font: "text-3xl font-extrabold tracking-tight",
    descFont: "text-base",
    minW: "min-w-[530px]",
    maxW: "max-w-[660px]",
    py: "py-9 px-10",
    rounded: "rounded-2xl",
    handleTarget: "!bg-[#F2A0AF]",
    handleSource: "!bg-[#D95578]",
  },
  L3: {
    bg: "bg-gradient-to-br from-[#D95578] to-[#C44466]",
    text: "text-white",
    border: "border-[#F2A0AF]",
    badge: "bg-white/20 text-white",
    shadow: "shadow-lg shadow-[#D95578]/25",
    font: "text-2xl font-bold",
    descFont: "text-base",
    minW: "min-w-[460px]",
    maxW: "max-w-[580px]",
    py: "py-8 px-9",
    rounded: "rounded-xl",
    handleTarget: "!bg-[#F2DCE0]",
    handleSource: "!bg-[#F2A0AF]",
  },
  L4: {
    bg: "bg-[#F2A0AF]",
    text: "text-[#3B0716]",
    border: "border-[#D95578]",
    badge: "bg-[#A62121] text-white",
    shadow: "shadow-md shadow-[#F2A0AF]/30",
    font: "text-xl font-bold",
    descFont: "text-sm font-medium",
    minW: "min-w-[400px]",
    maxW: "max-w-[530px]",
    py: "py-7 px-8",
    rounded: "rounded-lg",
    handleTarget: "!bg-[#D95578]",
    handleSource: "!bg-[#A62121]",
  },
  L5: {
    bg: "bg-[#F2DCE0]",
    text: "text-[#3B0716]",
    border: "border-[#F2A0AF]",
    badge: "bg-[#D95578] text-white",
    shadow: "shadow-sm shadow-[#F2DCE0]/40",
    font: "text-lg font-bold",
    descFont: "text-sm font-medium",
    minW: "min-w-[340px]",
    maxW: "max-w-[480px]",
    py: "py-6 px-7",
    rounded: "rounded-md",
    handleTarget: "!bg-[#D95578]",
    handleSource: "!bg-[#F2A0AF]",
  },
} as const;

type LevelKey = keyof typeof LEVEL_STYLES;

interface NodeData {
  label: string;
  level: LevelKey;
  id?: string;
  description?: string;
  /* ── Add-on metadata ── */
  memo?: string;
  role?: string;
  inputData?: string;
  outputData?: string;
  system?: string;
}

/* helper: check if any metadata exists */
function hasMeta(d: NodeData): boolean {
  return !!(d.memo || d.role || d.inputData || d.outputData || d.system);
}

/* ─── Generic level node with 4-directional handles ── */
function LevelNodeBase({ data }: { data: NodeData }) {
  const s = LEVEL_STYLES[data.level] ?? LEVEL_STYLES.L5;
  const metaPresent = hasMeta(data);

  return (
    <div
      className={`${s.bg} ${s.border} ${s.shadow} ${s.minW} ${s.maxW} ${s.py} ${s.rounded} border-2 select-none relative transition-shadow hover:shadow-lg`}
    >
      {/* 4방향 Handle — target을 먼저, source를 나중에 (source가 위에 와야 드래그 시작 시 올바른 방향) */}

      {/* ── Target handles (invisible, rendered first = below) ── */}
      <Handle
        type="target"
        position={Position.Top}
        id="t-top"
        className="!w-5 !h-5 !bg-transparent !border-0 !-top-2.5"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        id="t-bottom"
        className="!w-5 !h-5 !bg-transparent !border-0 !-bottom-2.5"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="t-left"
        className="!w-5 !h-5 !bg-transparent !border-0 !-left-2.5"
      />
      <Handle
        type="target"
        position={Position.Right}
        id="t-right"
        className="!w-5 !h-5 !bg-transparent !border-0 !-right-2.5"
      />

      {/* ── Source handles (visible, rendered last = on top) ── */}
      <Handle
        type="source"
        position={Position.Top}
        id="top"
        className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-top-2.5 !z-10`}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-bottom-2.5 !z-10`}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="left"
        className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-left-2.5 !z-10`}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-right-2.5 !z-10`}
      />

      {/* Level badge + meta indicators */}
      <div className="flex items-center gap-3 mb-3">
        <span
          className={`inline-block text-sm font-bold px-4 py-1.5 rounded-full ${s.badge}`}
        >
          {data.level}
          {data.id ? ` · ${data.id}` : ""}
        </span>
        {/* Meta icons */}
        {metaPresent && (
          <div className="flex items-center gap-1.5">
            {data.memo && <span className="text-base" title="메모">📝</span>}
            {data.role && <span className="text-base" title={`수행: ${data.role}`}>👤</span>}
            {data.inputData && <span className="text-base" title="Input">📥</span>}
            {data.outputData && <span className="text-base" title="Output">📤</span>}
            {data.system && <span className="text-base" title={`시스템: ${data.system}`}>🖥️</span>}
          </div>
        )}
      </div>

      {/* Label */}
      <div className={`${s.font} ${s.text} leading-snug`}>{data.label}</div>

      {/* Description */}
      {data.description && (
        <div
          className={`mt-1.5 ${s.descFont} leading-snug ${s.text} line-clamp-2 ${
            data.level === "L2" || data.level === "L3" ? "opacity-80" : "opacity-90"
          }`}
        >
          {data.description}
        </div>
      )}

      {/* Role badge (compact) */}
      {data.role && (
        <div className={`mt-3 inline-block text-sm px-3.5 py-1.5 rounded-full font-semibold ${
          data.level === "L4" || data.level === "L5"
            ? "bg-[#A62121]/15 text-[#A62121]"
            : "bg-white/20 text-white/90"
        }`}>
          👤 {data.role}
        </div>
      )}
    </div>
  );
}

/* ─── Export individual level nodes for nodeTypes registration ─── */
export const L2Node = memo(({ data }: { data: NodeData }) => (
  <LevelNodeBase data={{ ...data, level: "L2" }} />
));
L2Node.displayName = "L2Node";

export const L3Node = memo(({ data }: { data: NodeData }) => (
  <LevelNodeBase data={{ ...data, level: "L3" }} />
));
L3Node.displayName = "L3Node";

export const L4Node = memo(({ data }: { data: NodeData }) => (
  <LevelNodeBase data={{ ...data, level: "L4" }} />
));
L4Node.displayName = "L4Node";

export const L5Node = memo(({ data }: { data: NodeData }) => (
  <LevelNodeBase data={{ ...data, level: "L5" }} />
));
L5Node.displayName = "L5Node";

export default LevelNodeBase;
