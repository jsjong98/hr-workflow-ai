"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import type { Node } from "@xyflow/react";

/* ═══ 타입 ═══ */
interface RowData {
  nodeId: string;          // React Flow 내부 id
  level: "L2" | "L3" | "L4" | "L5";
  displayId: string;       // 표시 ID (1.1, 1.1.2 등)
  name: string;
  description: string;
  role: string;
  memo: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node[];
  setNodes: (updater: (nds: Node[]) => Node[]) => void;
}

/* ═══ 레벨 색상 ═══ */
const LEVEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  L2: { bg: "#A62121", text: "#FFFFFF", border: "#8A1B1B" },
  L3: { bg: "#D95578", text: "#FFFFFF", border: "#C44466" },
  L4: { bg: "#DEDEDE", text: "#000000", border: "#BBBBBB" },
  L5: { bg: "#FFFFFF", text: "#000000", border: "#DEDEDE" },
};

const LEVEL_OPTIONS = ["L2", "L3", "L4", "L5"] as const;

const ROLE_OPTIONS = [
  "", "HR 담당자", "임원 이상", "팀장급", "구성원", "인사팀장",
  "HRBP", "채용 담당자", "교육 담당자", "IT 시스템", "외부 업체", "기타",
];

/* ═══ 유틸 ═══ */
function nodeToRow(n: Node): RowData {
  const d = (n.data || {}) as Record<string, unknown>;
  return {
    nodeId: n.id,
    level: ((d.level as string) || "L4").toUpperCase() as RowData["level"],
    displayId: (d.id as string) || "",
    name: (d.label as string) || "",
    description: (d.description as string) || "",
    role: (d.role as string) || "",
    memo: (d.memo as string) || "",
  };
}

/* ═══ CSV 이스케이프 ═══ */
function csvEscape(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

/* ═══ 메인 컴포넌트 ═══ */
export default function NodeManagerPanel({ isOpen, onClose, nodes, setNodes }: Props) {
  /* 편집 모드 */
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<RowData | null>(null);

  /* 새 노드 추가 모드 */
  const [addMode, setAddMode] = useState(false);
  const [addForm, setAddForm] = useState<Omit<RowData, "nodeId">>({
    level: "L4", displayId: "", name: "", description: "", role: "", memo: "",
  });

  /* 드래그 상태 */
  const dragIdxRef = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  /* 노드 → 행 변환 (레벨 순서 유지) */
  const rows: RowData[] = useMemo(() => {
    const levelOrder = { L2: 0, L3: 1, L4: 2, L5: 3 };
    return nodes
      .map(nodeToRow)
      .sort((a, b) => (levelOrder[a.level] ?? 9) - (levelOrder[b.level] ?? 9));
  }, [nodes]);

  /* ── 편집 시작 ── */
  const startEdit = useCallback((idx: number) => {
    setEditingIdx(idx);
    setEditForm({ ...rows[idx] });
  }, [rows]);

  /* ── 편집 저장 ── */
  const saveEdit = useCallback(() => {
    if (editingIdx === null || !editForm) return;
    const targetNodeId = rows[editingIdx].nodeId;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== targetNodeId) return n;
        return {
          ...n,
          type: editForm.level.toLowerCase(),
          data: {
            ...(n.data as Record<string, unknown>),
            level: editForm.level,
            id: editForm.displayId,
            label: editForm.name,
            description: editForm.description,
            role: editForm.role,
            memo: editForm.memo,
          },
        };
      })
    );
    setEditingIdx(null);
    setEditForm(null);
  }, [editingIdx, editForm, rows, setNodes]);

  /* ── 편집 취소 ── */
  const cancelEdit = useCallback(() => {
    setEditingIdx(null);
    setEditForm(null);
  }, []);

  /* ── 삭제 ── */
  const deleteRow = useCallback((idx: number) => {
    const targetNodeId = rows[idx].nodeId;
    if (!confirm(`"${rows[idx].name || rows[idx].displayId}" 노드를 삭제하시겠습니까?`)) return;
    setNodes((nds) => nds.filter((n) => n.id !== targetNodeId));
  }, [rows, setNodes]);

  /* ── 추가 ── */
  const addRow = useCallback(() => {
    if (!addForm.name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }
    const levelKey = addForm.level.toLowerCase() as "l2" | "l3" | "l4" | "l5";
    const newId = `${levelKey}-mgr-${Date.now()}`;
    const newNode: Node = {
      id: newId,
      type: levelKey,
      position: { x: 400 + Math.random() * 100, y: 300 + Math.random() * 100 },
      data: {
        label: addForm.name.trim(),
        level: addForm.level,
        id: addForm.displayId.trim() || `${addForm.level}-${Date.now()}`,
        description: addForm.description.trim(),
        role: addForm.role,
        memo: addForm.memo.trim(),
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setAddForm({ level: "L4", displayId: "", name: "", description: "", role: "", memo: "" });
    setAddMode(false);
  }, [addForm, setNodes]);

  /* ── 드래그 앤 드랍 (순서 변경) ── */
  const handleDragStart = useCallback((idx: number) => {
    dragIdxRef.current = idx;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  }, []);

  const handleDrop = useCallback((dropIdx: number) => {
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === dropIdx) {
      dragIdxRef.current = null;
      setDragOverIdx(null);
      return;
    }
    // 순서 재배열: node 배열에서 실제 위치를 바꿈
    const orderedIds = rows.map((r) => r.nodeId);
    const [moved] = orderedIds.splice(fromIdx, 1);
    orderedIds.splice(dropIdx, 0, moved);
    // 노드 배열을 새 순서로 재정렬
    setNodes((nds) => {
      const map = new Map(nds.map((n) => [n.id, n]));
      const reordered: Node[] = [];
      for (const id of orderedIds) {
        const nd = map.get(id);
        if (nd) {
          reordered.push(nd);
          map.delete(id);
        }
      }
      // orderedIds에 없는 나머지 노드 (있을 경우)
      map.forEach((nd) => reordered.push(nd));
      return reordered;
    });
    dragIdxRef.current = null;
    setDragOverIdx(null);
  }, [rows, setNodes]);

  /* ── 엑셀(CSV) 내보내기 ── */
  const exportCsv = useCallback(() => {
    const header = ["Level", "ID", "이름", "설명", "수행주체", "메모"];
    const csvRows = rows.map((r) =>
      [r.level, r.displayId, r.name, r.description, r.role, r.memo].map(csvEscape).join(",")
    );
    const bom = "\uFEFF";
    const csvContent = bom + [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `workflow-nodes-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [rows]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] flex flex-col border border-gray-200">
        {/* ═══ Header ═══ */}
        <div className="px-6 py-4 rounded-t-xl bg-gradient-to-r from-[#A62121] to-[#D95578] text-white flex items-center justify-between flex-none">
          <div>
            <h2 className="text-lg font-bold">📋 노드 관리</h2>
            <p className="text-xs opacity-80 mt-0.5">추가 · 수정 · 삭제 · 드래그로 순서 변경 · 엑셀 내보내기</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              className="px-3 py-1.5 text-xs font-bold bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
              title="CSV(엑셀) 내보내기"
            >
              📥 엑셀 내보내기
            </button>
            <button
              onClick={onClose}
              className="text-2xl font-light opacity-70 hover:opacity-100 transition-opacity ml-2"
            >
              ×
            </button>
          </div>
        </div>

        {/* ═══ Toolbar ═══ */}
        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-none bg-gray-50/50">
          <button
            onClick={() => setAddMode(!addMode)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors ${
              addMode
                ? "bg-red-100 text-red-600 hover:bg-red-200"
                : "bg-blue-500 text-white hover:bg-blue-600"
            }`}
          >
            {addMode ? "✕ 추가 취소" : "➕ 새 노드 추가"}
          </button>
          <span className="text-xs text-gray-400">
            총 {rows.length}개 노드 · 드래그로 순서 변경 가능
          </span>
        </div>

        {/* ═══ Add Form (inline) ═══ */}
        {addMode && (
          <div className="px-6 py-3 border-b border-blue-100 bg-blue-50/50 flex-none">
            <div className="flex items-end gap-2 flex-wrap">
              {/* Level */}
              <div className="w-[80px]">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">레벨</label>
                <select
                  value={addForm.level}
                  onChange={(e) => setAddForm({ ...addForm, level: e.target.value as RowData["level"] })}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                >
                  {LEVEL_OPTIONS.map((lv) => (
                    <option key={lv} value={lv}>{lv}</option>
                  ))}
                </select>
              </div>
              {/* ID */}
              <div className="w-[100px]">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">ID</label>
                <input
                  value={addForm.displayId}
                  onChange={(e) => setAddForm({ ...addForm, displayId: e.target.value })}
                  placeholder="1.1.5"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                />
              </div>
              {/* 이름 */}
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">이름 *</label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="노드 이름"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                  autoFocus
                />
              </div>
              {/* 설명 */}
              <div className="flex-1 min-w-[120px]">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">설명</label>
                <input
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="설명"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                />
              </div>
              {/* 수행주체 */}
              <div className="w-[110px]">
                <label className="block text-[10px] font-semibold text-gray-500 mb-1">수행주체</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs"
                >
                  <option value="">선택</option>
                  {ROLE_OPTIONS.filter(Boolean).map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              {/* 추가 버튼 */}
              <button
                onClick={addRow}
                className="px-4 py-1.5 text-xs font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition whitespace-nowrap"
              >
                ✓ 추가
              </button>
            </div>
          </div>
        )}

        {/* ═══ Table ═══ */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="w-8 py-2 px-1 text-center text-gray-400 font-medium">⠿</th>
                <th className="w-[60px] py-2 px-2 text-left font-semibold text-gray-600">Level</th>
                <th className="w-[90px] py-2 px-2 text-left font-semibold text-gray-600">ID</th>
                <th className="min-w-[140px] py-2 px-2 text-left font-semibold text-gray-600">이름</th>
                <th className="min-w-[120px] py-2 px-2 text-left font-semibold text-gray-600">설명</th>
                <th className="w-[100px] py-2 px-2 text-left font-semibold text-gray-600">수행주체</th>
                <th className="min-w-[100px] py-2 px-2 text-left font-semibold text-gray-600">메모</th>
                <th className="w-[80px] py-2 px-2 text-center font-semibold text-gray-600">작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400">
                    캔버스에 노드가 없습니다. 위 &quot;새 노드 추가&quot; 버튼으로 추가하세요.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => {
                  const isEditing = editingIdx === idx;
                  const lc = LEVEL_COLORS[row.level] || LEVEL_COLORS.L4;
                  const isDragOver = dragOverIdx === idx;

                  return (
                    <tr
                      key={row.nodeId}
                      draggable={!isEditing}
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragLeave={() => setDragOverIdx(null)}
                      onDrop={() => handleDrop(idx)}
                      className={`border-b border-gray-100 transition-colors ${
                        isDragOver ? "bg-blue-50 border-blue-300" : "hover:bg-gray-50/50"
                      } ${isEditing ? "bg-yellow-50" : ""}`}
                    >
                      {/* 드래그 핸들 */}
                      <td className="py-2 px-1 text-center cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 select-none">
                        ⠿
                      </td>

                      {isEditing && editForm ? (
                        /* ── 편집 모드 ── */
                        <>
                          <td className="py-1.5 px-2">
                            <select
                              value={editForm.level}
                              onChange={(e) => setEditForm({ ...editForm, level: e.target.value as RowData["level"] })}
                              className="w-full border border-yellow-300 rounded px-1.5 py-1 text-xs bg-yellow-50"
                            >
                              {LEVEL_OPTIONS.map((lv) => (
                                <option key={lv} value={lv}>{lv}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              value={editForm.displayId}
                              onChange={(e) => setEditForm({ ...editForm, displayId: e.target.value })}
                              className="w-full border border-yellow-300 rounded px-1.5 py-1 text-xs bg-yellow-50"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full border border-yellow-300 rounded px-1.5 py-1 text-xs bg-yellow-50"
                              autoFocus
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="w-full border border-yellow-300 rounded px-1.5 py-1 text-xs bg-yellow-50"
                            />
                          </td>
                          <td className="py-1.5 px-2">
                            <select
                              value={editForm.role}
                              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                              className="w-full border border-yellow-300 rounded px-1.5 py-1 text-xs bg-yellow-50"
                            >
                              <option value="">선택</option>
                              {ROLE_OPTIONS.filter(Boolean).map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-1.5 px-2">
                            <input
                              value={editForm.memo}
                              onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                              className="w-full border border-yellow-300 rounded px-1.5 py-1 text-xs bg-yellow-50"
                            />
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={saveEdit}
                                className="px-2 py-1 text-[10px] font-bold bg-green-500 text-white rounded hover:bg-green-600 transition"
                              >
                                ✓
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="px-2 py-1 text-[10px] font-bold bg-gray-300 text-gray-600 rounded hover:bg-gray-400 transition"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        /* ── 표시 모드 ── */
                        <>
                          <td className="py-2 px-2">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ backgroundColor: lc.bg, color: lc.text, border: `1px solid ${lc.border}` }}
                            >
                              {row.level}
                            </span>
                          </td>
                          <td className="py-2 px-2 font-mono text-gray-500">{row.displayId}</td>
                          <td className="py-2 px-2 font-medium text-gray-800">{row.name}</td>
                          <td className="py-2 px-2 text-gray-500 truncate max-w-[200px]" title={row.description}>
                            {row.description || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-2 text-gray-500">
                            {row.role || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-2 text-gray-500 truncate max-w-[150px]" title={row.memo}>
                            {row.memo || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex gap-1 justify-center">
                              <button
                                onClick={() => startEdit(idx)}
                                className="px-2 py-1 text-[10px] font-bold bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition"
                                title="수정"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => deleteRow(idx)}
                                className="px-2 py-1 text-[10px] font-bold bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                                title="삭제"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ═══ Footer ═══ */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between flex-none bg-gray-50/50">
          <span className="text-[10px] text-gray-400">
            💡 ⠿ 아이콘을 드래그하여 순서를 변경하세요 · 변경사항은 캔버스에 즉시 반영됩니다
          </span>
          <div className="flex gap-2">
            <button
              onClick={exportCsv}
              className="px-4 py-2 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
            >
              📥 엑셀(CSV) 내보내기
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
