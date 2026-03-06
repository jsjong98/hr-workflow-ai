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
    font: "text-4xl font-extrabold tracking-tight",
    descFont: "text-lg",
    minW: "min-w-[720px]",
    maxW: "max-w-[900px]",
    py: "py-14 px-12",
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
    font: "text-3xl font-bold",
    descFont: "text-base",
    minW: "min-w-[650px]",
    maxW: "max-w-[820px]",
    py: "py-12 px-11",
    rounded: "rounded-xl",
    handleTarget: "!bg-[#F2DCE0]",
    handleSource: "!bg-[#F2A0AF]",
  },
  L4: {
    bg: "bg-[#DEDEDE]",
    text: "text-[#000000]",
    border: "border-[#DEDEDE]",
    badge: "bg-[#A62121] text-white",
    shadow: "shadow-md shadow-[#AAAAAA]/30",
    font: "text-2xl font-bold",
    descFont: "text-base font-medium",
    minW: "min-w-[580px]",
    maxW: "max-w-[760px]",
    py: "py-11 px-10",
    rounded: "rounded-lg",
    handleTarget: "!bg-[#888888]",
    handleSource: "!bg-[#555555]",
  },
  L5: {
    bg: "bg-[#FFFFFF]",
    text: "text-[#000000]",
    border: "border-[#DEDEDE]",
    badge: "bg-[#555555] text-white",
    shadow: "shadow-sm shadow-[#DEDEDE]/60",
    font: "text-[15px] font-bold",
    descFont: "text-sm font-medium",
    minW: "min-w-[300px]",
    maxW: "max-w-[380px]",
    py: "py-0 px-0",
    rounded: "rounded-none",
    handleTarget: "!bg-[#888888]",
    handleSource: "!bg-[#555555]",
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
  /* ── CSV-parsed systems (L5) ── */
  systems?: {
    hr: string;
    groupware: string;
    office: string;
    manual: string;
    etc: string;
  };
}

/* 시스템 라벨 매핑 */
const SYSTEM_TAGS: { key: keyof NonNullable<NodeData["systems"]>; label: string }[] = [
  { key: "hr",        label: "HR시스템" },
  { key: "groupware", label: "그룹웨어" },
  { key: "office",    label: "오피스"   },
  { key: "manual",    label: "수작업"   },
  { key: "etc",       label: "기타툴"   },
];

/* helper: check if any metadata exists */
function hasMeta(d: NodeData): boolean {
  return !!(d.memo || d.role || d.inputData || d.outputData || d.system);
}

/* ─── Helper: get system display name for L5 ── */
function getL5SystemName(data: NodeData): string {
  if (data.system) return data.system;
  if (data.systems) {
    const activeTags = SYSTEM_TAGS.filter(t => data.systems![t.key]?.trim());
    if (activeTags.length > 0) return activeTags.map(t => t.label).join(", ");
  }
  return "시스템명";
}

/* ─── L5 전용 2-Box 노드 (위: ID+레이블, 아래: 시스템명) ── */
function L5NodeBase({ data }: { data: NodeData }) {
  const s = LEVEL_STYLES.L5;
  const sysName = getL5SystemName(data);

  return (
    <div
      className="min-w-[300px] max-w-[380px] select-none relative shadow-md transition-shadow hover:shadow-lg border border-[#BFBFBF] rounded-sm"
    >
      {/* ── Target handles ── */}
      <Handle type="target" position={Position.Top} id="t-top" className="!w-5 !h-5 !bg-transparent !border-0 !-top-2.5" />
      <Handle type="target" position={Position.Bottom} id="t-bottom" className="!w-5 !h-5 !bg-transparent !border-0 !-bottom-2.5" />
      <Handle type="target" position={Position.Left} id="t-left" className="!w-5 !h-5 !bg-transparent !border-0 !-left-2.5" />
      <Handle type="target" position={Position.Right} id="t-right" className="!w-5 !h-5 !bg-transparent !border-0 !-right-2.5" />

      {/* ── Source handles ── */}
      <Handle type="source" position={Position.Top} id="top" className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-top-2.5 !z-10`} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-bottom-2.5 !z-10`} />
      <Handle type="source" position={Position.Left} id="left" className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-left-2.5 !z-10`} />
      <Handle type="source" position={Position.Right} id="right" className={`!w-5 !h-5 ${s.handleSource} !border-2 !border-white !-right-2.5 !z-10`} />

      {/* ── 위쪽 박스: ID + 레이블 (흰 배경, 0.25pt 테두리) ── */}
      <div className="bg-white px-4 py-3 flex flex-col items-center justify-center" style={{ minHeight: 110, border: '0.25pt solid #DEDEDE' }}>
        <div className="text-[13px] font-bold text-black text-center leading-snug">
          {data.id || ""}
        </div>
        <div className="text-[13px] font-bold text-black text-center leading-snug mt-0.5">
          {data.label}
        </div>
      </div>

      {/* ── 간격: 0.05cm ── */}
      <div style={{ height: 2 }} />

      {/* ── 아래쪽 박스: 시스템명 (연회색 채우기, 선 없음) ── */}
      <div className="bg-[#DEDEDE] px-3 py-1.5 flex items-center justify-center" style={{ minHeight: 36 }}>
        <div className="text-[11px] font-medium text-black text-center">
          {sysName}
        </div>
      </div>
    </div>
  );
}

/* ─── Generic level node with 4-directional handles (L2~L4) ── */
function LevelNodeBase({ data }: { data: NodeData }) {
  const s = LEVEL_STYLES[data.level] ?? LEVEL_STYLES.L5;
  const metaPresent = hasMeta(data);

  /* L5는 전용 2-box 노드 사용 */
  if (data.level === "L5") {
    return <L5NodeBase data={data} />;
  }

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
          data.level === "L4"
            ? "bg-black/10 text-black/70"
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

/* ─── Decision (판정 로직) 마름모 노드 ── */
interface DecisionNodeData {
  label: string;
  description?: string;
  id?: string;
  memo?: string;
  level?: string;
}

function DecisionNodeBase({ data }: { data: DecisionNodeData }) {
  /* L3(#D95578) 보다 옅은 색상 */
  const bgColor = "#F2A0AF";        // L3 옅은 톤
  const borderColor = "#D95578";     // L3 기준 테두리
  const textColor = "#3B0716";

  return (
    <div
      className="select-none relative"
      style={{ width: 220, height: 220 }}
    >
      {/* ── Target handles ── */}
      <Handle type="target" position={Position.Top} id="t-top"
        className="!w-5 !h-5 !bg-transparent !border-0"
        style={{ top: -10, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle type="target" position={Position.Bottom} id="t-bottom"
        className="!w-5 !h-5 !bg-transparent !border-0"
        style={{ bottom: -10, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle type="target" position={Position.Left} id="t-left"
        className="!w-5 !h-5 !bg-transparent !border-0"
        style={{ left: -10, top: '50%', transform: 'translateY(-50%)' }}
      />
      <Handle type="target" position={Position.Right} id="t-right"
        className="!w-5 !h-5 !bg-transparent !border-0"
        style={{ right: -10, top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* ── Source handles (Yes → bottom, No → right) ── */}
      <Handle type="source" position={Position.Bottom} id="yes"
        className="!w-5 !h-5 !bg-[#333333] !border-2 !border-white !z-10"
        style={{ bottom: -10, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle type="source" position={Position.Right} id="no"
        className="!w-5 !h-5 !bg-[#333333] !border-2 !border-white !z-10"
        style={{ right: -10, top: '50%', transform: 'translateY(-50%)' }}
      />
      <Handle type="source" position={Position.Top} id="top"
        className="!w-5 !h-5 !bg-[#D95578] !border-2 !border-white !z-10"
        style={{ top: -10, left: '50%', transform: 'translateX(-50%)' }}
      />
      <Handle type="source" position={Position.Left} id="left"
        className="!w-5 !h-5 !bg-[#D95578] !border-2 !border-white !z-10"
        style={{ left: -10, top: '50%', transform: 'translateY(-50%)' }}
      />

      {/* ── Diamond SVG ── */}
      <svg
        viewBox="0 0 220 220"
        width="220"
        height="220"
        className="absolute inset-0 drop-shadow-lg"
      >
        <polygon
          points="110,8 212,110 110,212 8,110"
          fill={bgColor}
          stroke={borderColor}
          strokeWidth="2.5"
        />
      </svg>

      {/* ── Content overlay ── */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center px-8"
        style={{ color: textColor }}
      >
        <span className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-1">
          ◆ 판정 로직
        </span>
        <div className="text-[14px] font-bold text-center leading-snug">
          {data.label || "판정 조건"}
        </div>
        {data.description && (
          <div className="text-[11px] text-center mt-1 opacity-70 leading-tight line-clamp-2">
            {data.description}
          </div>
        )}
      </div>

      {/* ── Yes/No 라벨 표시 ── */}
      <div
        className="absolute text-[10px] font-bold text-gray-700 bg-white/80 px-1.5 py-0.5 rounded border border-gray-300"
        style={{ bottom: -26, left: '50%', transform: 'translateX(-50%)' }}
      >
        Yes ↓
      </div>
      <div
        className="absolute text-[10px] font-bold text-gray-700 bg-white/80 px-1.5 py-0.5 rounded border border-gray-300"
        style={{ right: -32, top: '50%', transform: 'translateY(-50%)' }}
      >
        No →
      </div>
    </div>
  );
}

export const DecisionNode = memo(({ data }: { data: DecisionNodeData }) => (
  <DecisionNodeBase data={data} />
));
DecisionNode.displayName = "DecisionNode";

export default LevelNodeBase;
