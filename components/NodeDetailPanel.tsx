"use client";

import { useState, useEffect, useCallback } from "react";
import type { Node } from "@xyflow/react";

/* ── 수행 주체 선택지 ── */
const ROLE_OPTIONS = [
  "HR 담당자",
  "임원 이상",
  "팀장급",
  "구성원",
  "인사팀장",
  "HRBP",
  "채용 담당자",
  "교육 담당자",
  "IT 시스템",
  "외부 업체",
  "기타",
] as const;

export interface NodeMeta {
  memo?: string;
  role?: string;
  inputData?: string;
  outputData?: string;
  system?: string;
}

interface NodeDetailPanelProps {
  node: Node | null;
  onClose: () => void;
  onUpdate: (nodeId: string, meta: NodeMeta) => void;
}

function getNodeMeta(node: Node): NodeMeta {
  const d = node.data as Record<string, unknown>;
  return {
    memo: (d.memo as string) || "",
    role: (d.role as string) || "",
    inputData: (d.inputData as string) || "",
    outputData: (d.outputData as string) || "",
    system: (d.system as string) || "",
  };
}

export default function NodeDetailPanel({ node, onClose, onUpdate }: NodeDetailPanelProps) {
  const [meta, setMeta] = useState<NodeMeta>({});

  useEffect(() => {
    if (node) setMeta(getNodeMeta(node));
  }, [node]);

  const handleSave = useCallback(() => {
    if (!node) return;
    onUpdate(node.id, meta);
    onClose();
  }, [node, meta, onUpdate, onClose]);

  if (!node) return null;

  const d = node.data as Record<string, string>;
  const level = d.level || "L4";
  const label = d.label || "";
  const id = d.id || node.id;
  const desc = d.description || "";

  const levelColors: Record<string, { bg: string; text: string; border: string }> = {
    L2: { bg: "bg-[#A62121]", text: "text-white", border: "border-[#D95578]" },
    L3: { bg: "bg-[#D95578]", text: "text-white", border: "border-[#F2A0AF]" },
    L4: { bg: "bg-[#F2A0AF]", text: "text-[#3B0716]", border: "border-[#D95578]" },
    L5: { bg: "bg-[#F2DCE0]", text: "text-[#3B0716]", border: "border-[#F2A0AF]" },
  };
  const lc = levelColors[level] || levelColors.L4;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[380px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className={`px-5 py-4 ${lc.bg} ${lc.text} border-b-4 ${lc.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono opacity-70">{level} · {id}</span>
            <h3 className="text-base font-bold mt-0.5">{label}</h3>
            {desc && <p className="text-[11px] opacity-70 mt-0.5 line-clamp-2">{desc}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm transition"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* 메모 */}
        <fieldset>
          <legend className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            📝 메모
          </legend>
          <textarea
            value={meta.memo || ""}
            onChange={(e) => setMeta({ ...meta, memo: e.target.value })}
            placeholder="이 단계에 대한 메모를 입력하세요..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            rows={3}
          />
        </fieldset>

        {/* 수행 주체 */}
        <fieldset>
          <legend className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            👤 수행 주체
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map((role) => (
              <button
                key={role}
                onClick={() => setMeta({ ...meta, role: meta.role === role ? "" : role })}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  meta.role === role
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                }`}
              >
                {role}
              </button>
            ))}
          </div>
          {/* Custom role input */}
          {meta.role === "기타" && (
            <input
              type="text"
              placeholder="직접 입력..."
              className="mt-2 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={meta.role === "기타" ? "" : meta.role || ""}
              onChange={(e) => setMeta({ ...meta, role: e.target.value || "기타" })}
            />
          )}
        </fieldset>

        {/* Input Data */}
        <fieldset>
          <legend className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            📥 Input Data
          </legend>
          <textarea
            value={meta.inputData || ""}
            onChange={(e) => setMeta({ ...meta, inputData: e.target.value })}
            placeholder="예: 채용 요청서, 직무 기술서, 인력 계획..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            rows={2}
          />
        </fieldset>

        {/* Output Data */}
        <fieldset>
          <legend className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            📤 Output Data
          </legend>
          <textarea
            value={meta.outputData || ""}
            onChange={(e) => setMeta({ ...meta, outputData: e.target.value })}
            placeholder="예: 채용 결과 보고서, 합격자 명단..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            rows={2}
          />
        </fieldset>

        {/* 사용 시스템 및 툴 */}
        <fieldset>
          <legend className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
            🖥️ 사용 시스템 및 툴
          </legend>
          <textarea
            value={meta.system || ""}
            onChange={(e) => setMeta({ ...meta, system: e.target.value })}
            placeholder="예: SAP SuccessFactors, 그룹웨어, Excel..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
            rows={2}
          />
        </fieldset>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 text-sm py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
        >
          취소
        </button>
        <button
          onClick={handleSave}
          className="flex-1 text-sm py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
        >
          💾 저장
        </button>
      </div>
    </div>
  );
}
