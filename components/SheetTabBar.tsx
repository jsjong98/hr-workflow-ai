"use client";

import { useCallback, useState, useRef, useEffect } from "react";

export type SheetType = "blank" | "swimlane";

export interface Sheet {
  id: string;
  name: string;
  type: SheetType;
  /** swimlane labels (only for swimlane type) */
  lanes?: string[];
}

interface Props {
  sheets: Sheet[];
  activeSheetId: string;
  onSelect: (id: string) => void;
  onAdd: (type: SheetType) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
}

export default function SheetTabBar({
  sheets,
  activeSheetId,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  onDuplicate,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const addMenuDivRef = useRef<HTMLDivElement>(null);

  /* Close context menu on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) setCtxMenu(null);
    };
    if (ctxMenu) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxMenu]);

  /* Close add menu on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        addBtnRef.current && !addBtnRef.current.contains(t) &&
        addMenuDivRef.current && !addMenuDivRef.current.contains(t)
      ) {
        setAddMenuOpen(false);
      }
    };
    if (addMenuOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [addMenuOpen]);

  /* Focus input when editing starts */
  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = useCallback((id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setCtxMenu(null);
  }, []);

  const commitRename = useCallback(() => {
    if (editingId && editName.trim()) {
      onRename(editingId, editName.trim());
    }
    setEditingId(null);
  }, [editingId, editName, onRename]);

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 bg-gray-100 border-t border-gray-200 select-none overflow-x-auto">
      {sheets.map((sheet) => {
        const isActive = sheet.id === activeSheetId;
        const isEditing = editingId === sheet.id;

        return (
          <div
            key={sheet.id}
            className={
              "group flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-t-md cursor-pointer transition-colors relative " +
              (isActive
                ? "bg-white text-gray-800 border border-b-0 border-gray-200 shadow-sm -mb-[1px] z-10"
                : "bg-gray-50 text-gray-500 hover:bg-gray-200/60 border border-transparent")
            }
            onClick={() => onSelect(sheet.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              setCtxMenu({ id: sheet.id, x: e.clientX, y: e.clientY });
            }}
            onDoubleClick={() => startRename(sheet.id, sheet.name)}
          >
            {/* Icon */}
            <span className="text-[10px]">
              {sheet.type === "swimlane" ? "🏊" : "📄"}
            </span>

            {/* Name or Input */}
            {isEditing ? (
              <input
                ref={inputRef}
                className="text-[11px] w-20 px-1 py-0 border border-blue-400 rounded outline-none bg-white"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  if (e.key === "Escape") setEditingId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate max-w-[100px]">{sheet.name}</span>
            )}
          </div>
        );
      })}

      {/* Add Sheet Button */}
      <div className="relative ml-1">
        <button
          ref={addBtnRef}
          onClick={() => setAddMenuOpen(!addMenuOpen)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors text-sm font-bold"
          title="새 시트 추가"
        >
          +
        </button>
        {addMenuOpen && addBtnRef.current && (() => {
          const rect = addBtnRef.current!.getBoundingClientRect();
          return (
            <div
              ref={addMenuDivRef}
              className="fixed bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-44 z-[9999]"
              style={{ left: rect.left, bottom: window.innerHeight - rect.top + 4 }}
            >
              <button
                className="w-full text-left px-3 py-2 text-[11px] hover:bg-blue-50 transition-colors flex items-center gap-2"
                onClick={() => { onAdd("blank"); setAddMenuOpen(false); }}
              >
                <span>📄</span>
                <div>
                  <div className="font-semibold text-gray-700">빈 시트 (격자)</div>
                  <div className="text-[9px] text-gray-400">흰 도화지 + 격자선</div>
                </div>
              </button>
              <button
                className="w-full text-left px-3 py-2 text-[11px] hover:bg-blue-50 transition-colors flex items-center gap-2"
                onClick={() => { onAdd("swimlane"); setAddMenuOpen(false); }}
              >
                <span>🏊</span>
                <div>
                  <div className="font-semibold text-gray-700">4분할 시트</div>
                  <div className="text-[9px] text-gray-400">임원 · 팀장 · HR 담당자 · 구성원</div>
                </div>
              </button>
            </div>
          );
        })()}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div
          ref={menuRef}
          className="fixed bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-36 z-50"
          style={{ left: ctxMenu.x, top: ctxMenu.y - 120 }}
        >
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-blue-50 transition"
            onClick={() => startRename(ctxMenu.id, sheets.find((s) => s.id === ctxMenu.id)?.name || "")}
          >
            ✏️ 이름 변경
          </button>
          <button
            className="w-full text-left px-3 py-1.5 text-[11px] text-gray-700 hover:bg-blue-50 transition"
            onClick={() => { onDuplicate(ctxMenu.id); setCtxMenu(null); }}
          >
            📋 복제
          </button>
          {sheets.length > 1 && (
            <button
              className="w-full text-left px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50 transition"
              onClick={() => { onDelete(ctxMenu.id); setCtxMenu(null); }}
            >
              🗑️ 삭제
            </button>
          )}
        </div>
      )}
    </div>
  );
}
