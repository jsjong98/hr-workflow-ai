"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  type Node,
  type Edge,
  type Connection,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { L2Node, L3Node, L4Node, L5Node } from "@/components/LevelNode";
import ChatPanel from "@/components/ChatPanel";
import ExportToolbar from "@/components/ExportToolbar";
import NodeDetailPanel, { type NodeMeta } from "@/components/NodeDetailPanel";
import SheetTabBar, { type Sheet, type SheetType } from "@/components/SheetTabBar";
import SwimLaneOverlay from "@/components/SwimLaneOverlay";
import {
  parseCsv,
  extractL2List,
  extractL3ByL2,
  extractL4ByL3,
  extractL5ByL4,
  createNodeFromItem,
  summarizeL3ForAI,
  buildFlowFromL3,
  type CsvRow,
  type L2Item,
  type L3Item,
  type L4Item,
  type L5Item,
} from "@/lib/csvToFlow";

/* ═══ Sheet data store (nodes + edges per sheet) ═══ */
interface SheetData {
  nodes: Node[];
  edges: Edge[];
}

/* ═══════════════════════════════════════════════ */
export default function Home() {
  /* ── nodeTypes ─────────────────────────────── */
  const nodeTypes = useMemo(
    () => ({ l2: L2Node, l3: L3Node, l4: L4Node, l5: L5Node }),
    []
  );

  /* ── Data State ────────────────────────────── */
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [l2List, setL2List] = useState<L2Item[]>([]);
  const [expandedL2, setExpandedL2] = useState<string | null>(null);
  const [l3Map, setL3Map] = useState<Record<string, L3Item[]>>({});
  const [selectedL3, setSelectedL3] = useState<string | null>(null);
  const [l4List, setL4List] = useState<L4Item[]>([]);
  const [l5Map, setL5Map] = useState<Record<string, L5Item[]>>({});
  const [expandedL4, setExpandedL4] = useState<string | null>(null);

  /* ── Canvas State ──────────────────────────── */
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const nodeCountRef = useRef(0);

  /* ── Sheet (multi-tab) State ───────────────── */
  const [sheets, setSheets] = useState<Sheet[]>([
    { id: "sheet-1", name: "시트 1", type: "blank" },
  ]);
  const [activeSheetId, setActiveSheetId] = useState("sheet-1");
  const sheetDataRef = useRef<Record<string, SheetData>>({});
  const sheetCountRef = useRef(1);
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null);

  /* Save current nodes/edges into sheetDataRef for the current sheet */
  const saveCurrentSheet = useCallback(() => {
    sheetDataRef.current[activeSheetId] = { nodes: [...nodes], edges: [...edges] };
  }, [activeSheetId, nodes, edges]);

  /* Switch to a different sheet */
  const handleSelectSheet = useCallback(
    (id: string) => {
      if (id === activeSheetId) return;
      // Save current sheet data
      sheetDataRef.current[activeSheetId] = { nodes, edges };
      // Load new sheet data
      const data = sheetDataRef.current[id] || { nodes: [], edges: [] };
      setNodes(data.nodes);
      setEdges(data.edges);
      nodeCountRef.current = data.nodes.length;
      setActiveSheetId(id);
      setSelectedNode(null);
    },
    [activeSheetId, nodes, edges, setNodes, setEdges]
  );

  /* Add a new sheet */
  const handleAddSheet = useCallback(
    (type: SheetType) => {
      // Save current sheet first
      sheetDataRef.current[activeSheetId] = { nodes, edges };
      // Create new
      sheetCountRef.current++;
      const newId = `sheet-${Date.now()}`;
      const label = type === "swimlane" ? "4분할 시트" : "빈 시트";
      const newSheet: Sheet = {
        id: newId,
        name: `${label} ${sheetCountRef.current}`,
        type,
        ...(type === "swimlane" ? { lanes: ["임원", "팀장", "HR 담당자", "구성원"] } : {}),
      };
      setSheets((prev) => [...prev, newSheet]);
      sheetDataRef.current[newId] = { nodes: [], edges: [] };
      // Switch to new
      setNodes([]);
      setEdges([]);
      nodeCountRef.current = 0;
      setActiveSheetId(newId);
      setSelectedNode(null);
      // Center the view on the new sheet after React renders
      setTimeout(() => {
        rfInstanceRef.current?.fitView({ padding: 0.5, duration: 300 });
      }, 100);
    },
    [activeSheetId, nodes, edges, setNodes, setEdges]
  );

  /* Delete a sheet */
  const handleDeleteSheet = useCallback(
    (id: string) => {
      if (sheets.length <= 1) return;
      const remaining = sheets.filter((s) => s.id !== id);
      delete sheetDataRef.current[id];
      setSheets(remaining);
      if (activeSheetId === id) {
        const nextId = remaining[0].id;
        const data = sheetDataRef.current[nextId] || { nodes: [], edges: [] };
        setNodes(data.nodes);
        setEdges(data.edges);
        nodeCountRef.current = data.nodes.length;
        setActiveSheetId(nextId);
      }
    },
    [sheets, activeSheetId, setNodes, setEdges]
  );

  /* Rename a sheet */
  const handleRenameSheet = useCallback(
    (id: string, name: string) => {
      setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, name } : s)));
    },
    []
  );

  /* Duplicate a sheet */
  const handleDuplicateSheet = useCallback(
    (id: string) => {
      // Save current first
      sheetDataRef.current[activeSheetId] = { nodes, edges };
      const src = sheets.find((s) => s.id === id);
      if (!src) return;
      sheetCountRef.current++;
      const newId = `sheet-${Date.now()}`;
      const newSheet: Sheet = { ...src, id: newId, name: `${src.name} (복사)` };
      const srcData = sheetDataRef.current[id] || { nodes: [], edges: [] };
      // Deep copy nodes/edges with new IDs to avoid conflicts
      const newNodes = srcData.nodes.map((n) => ({ ...n }));
      const newEdges = srcData.edges.map((e) => ({ ...e }));
      sheetDataRef.current[newId] = { nodes: newNodes, edges: newEdges };
      setSheets((prev) => [...prev, newSheet]);
      // Switch to copy
      setNodes(newNodes);
      setEdges(newEdges);
      nodeCountRef.current = newNodes.length;
      setActiveSheetId(newId);
    },
    [activeSheetId, sheets, nodes, edges, setNodes, setEdges]
  );

  /* Get current active sheet object */
  const activeSheet = useMemo(
    () => sheets.find((s) => s.id === activeSheetId) || sheets[0],
    [sheets, activeSheetId]
  );

  /* Get sheet data for a specific sheet (used by ExportToolbar JSON save) */
  const getSheetData = useCallback(
    (id: string) => sheetDataRef.current[id] || { nodes: [], edges: [] },
    []
  );

  /* ── Chat Panel ────────────────────────────── */
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitData, setChatInitData] = useState<string>("");

  /* ── Node Detail Panel ─────────────────────── */
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  /* ── React Flow wrapper ref (for export) ───── */
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  /* ── Search ────────────────────────────────── */
  const [searchTerm, setSearchTerm] = useState("");

  /* ═══════════════════════════════════════════════
   * CSV Load
   * ═══════════════════════════════════════════════ */
  const loadCsvText = useCallback(
    (text: string, name: string) => {
      const rows = parseCsv(text);
      setCsvRows(rows);
      setFileName(name);
      const l2s = extractL2List(rows);
      setL2List(l2s);
      const m: Record<string, L3Item[]> = {};
      for (const l2 of l2s) {
        m[l2.id] = extractL3ByL2(rows, l2.id);
      }
      setL3Map(m);
      if (l2s.length > 0) setExpandedL2(l2s[0].id);
      setSelectedL3(null);
      setL4List([]);
      setL5Map({});
      setExpandedL4(null);
      setNodes([]);
      setEdges([]);
    },
    [setNodes, setEdges]
  );

  /* CSV 자동 로드 제거 — 사용자가 직접 업로드해야 함 */

  /* ── File Upload ───────────────────────────── */
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        loadCsvText(ev.target?.result as string, file.name);
      };
      reader.readAsText(file, "utf-8");
    },
    [loadCsvText]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file || !file.name.endsWith(".csv")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        loadCsvText(ev.target?.result as string, file.name);
      };
      reader.readAsText(file, "utf-8");
    },
    [loadCsvText]
  );

  /* ═══ L3 Select → load L4/L5 ═══ */
  const handleSelectL3 = useCallback(
    (l3Id: string) => {
      setSelectedL3(l3Id);
      const l4s = extractL4ByL3(csvRows, l3Id);
      setL4List(l4s);
      const m5: Record<string, L5Item[]> = {};
      for (const l4 of l4s) {
        m5[l4.id] = extractL5ByL4(csvRows, l4.id);
      }
      setL5Map(m5);
      setExpandedL4(null);
    },
    [csvRows]
  );

  /* ═══ Add node to canvas (click) — supports ALL levels ═══ */
  const addNodeToCanvas = useCallback(
    (
      level: "l2" | "l3" | "l4" | "l5",
      item: { id: string; name: string; description?: string }
    ) => {
      nodeCountRef.current++;
      const colMap = { l2: 0, l3: 1, l4: 2, l5: 3 };
      const col = colMap[level];
      const row = nodeCountRef.current;
      const x = 100 + col * 320 + Math.random() * 30;
      const y = 60 + row * 90;
      const node = createNodeFromItem(level, item, { x, y });
      setNodes((nds) => [...nds, node]);
    },
    [setNodes]
  );

  /* ═══ Edge connect (drag handles) ═══ */
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...connection,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#d95578", strokeWidth: 2.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
              color: "#d95578",
            },
          },
          eds
        )
      );
    },
    [setEdges]
  );

  /* ═══ Toggle edge direction (right-click) ═══ */
  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      setEdges((eds) =>
        eds.map((e) => {
          if (e.id !== edge.id) return e;
          const hasBoth = !!e.markerStart;
          const color = ((e.style as Record<string, unknown>)?.stroke as string) || "#d95578";
          if (hasBoth) {
            // bidirectional → one-way (remove markerStart)
            const { markerStart: _, ...rest } = e;
            return { ...rest, data: { ...((e.data || {}) as Record<string, unknown>), bidirectional: false } };
          } else {
            // one-way → bidirectional (add markerStart)
            return {
              ...e,
              markerStart: { type: MarkerType.ArrowClosed, width: 20, height: 20, color },
              data: { ...((e.data || {}) as Record<string, unknown>), bidirectional: true },
            };
          }
        })
      );
    },
    [setEdges]
  );

  /* ═══ Node click → open detail panel ═══ */
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
    },
    []
  );

  /* ═══ Update node metadata ═══ */
  const updateNodeMeta = useCallback(
    (nodeId: string, meta: NodeMeta) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            data: {
              ...(n.data as Record<string, unknown>),
              ...meta,
            },
          };
        })
      );
      setSelectedNode(null);
    },
    [setNodes]
  );

  /* ═══ Full tree view ═══ */
  const handleViewFullTree = useCallback(() => {
    if (!selectedL3) return;
    const { nodes: n, edges: e } = buildFlowFromL3(csvRows, selectedL3);
    setNodes(n);
    setEdges(e);
    nodeCountRef.current = n.length;
  }, [csvRows, selectedL3, setNodes, setEdges]);

  /* ═══ Clear canvas ═══ */
  const handleClearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    nodeCountRef.current = 0;
  }, [setNodes, setEdges]);

  /* ═══ Apply workflow from Chat AI ═══ */
  const handleApplyWorkflow = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setNodes(newNodes);
      setEdges(newEdges);
      nodeCountRef.current = newNodes.length;
    },
    [setNodes, setEdges]
  );

  /* ═══ Listen for JSON load events (from ExportToolbar) ═══ */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.sheets && Array.isArray(detail.sheets)) {
        /* ── Multi-sheet JSON format ── */
        const loadedSheets: Sheet[] = detail.sheets.map((s: { id: string; name: string; type: SheetType; lanes?: string[] }) => ({
          id: s.id,
          name: s.name,
          type: s.type || "blank",
          lanes: s.lanes,
        }));
        setSheets(loadedSheets);
        for (const sd of detail.sheets as { id: string; nodes: Node[]; edges: Edge[] }[]) {
          sheetDataRef.current[sd.id] = { nodes: sd.nodes || [], edges: sd.edges || [] };
        }
        const firstId = loadedSheets[0].id;
        const firstData = sheetDataRef.current[firstId] || { nodes: [], edges: [] };
        setNodes(firstData.nodes);
        setEdges(firstData.edges);
        nodeCountRef.current = firstData.nodes.length;
        setActiveSheetId(firstId);
      } else if (detail?.nodes && detail?.edges) {
        /* ── Legacy single-sheet JSON format ── */
        setNodes(detail.nodes);
        setEdges(detail.edges);
        nodeCountRef.current = detail.nodes.length;
      }
    };
    window.addEventListener("loadWorkflow", handler);
    return () => window.removeEventListener("loadWorkflow", handler);
  }, [setNodes, setEdges]);

  /* ═══ Search filter ═══ */
  const filteredL4 = useMemo(() => {
    if (!searchTerm.trim()) return l4List;
    const t = searchTerm.toLowerCase();
    return l4List.filter(
      (i) => i.name.toLowerCase().includes(t) || i.id.includes(t)
    );
  }, [l4List, searchTerm]);

  /* ═══════════════════════════════════════════════
   * RENDER
   * ═══════════════════════════════════════════════ */
  return (
    <div className="flex h-screen bg-gray-100">
      {/* ═══════════ LEFT PANEL ═══════════ */}
      <div className="w-[340px] min-w-[300px] border-r border-gray-200 flex flex-col bg-white">
        {/* Header + File Upload */}
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <span className="text-xl">📋</span> HR Workflow Builder
          </h1>
          <p className="text-[11px] text-gray-400 mt-0.5">
            두산 As-is 프로세스 · 클릭하여 Flowsheet 구성
          </p>
          <div
            className="mt-3 border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById("csv-upload")?.click()}
          >
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
            {fileName ? (
              <div className="text-xs text-gray-600">
                <span className="font-medium text-blue-600">
                  {"📄 " + fileName}
                </span>
                <span className="text-gray-400 ml-1">
                  {"· " + csvRows.length + "행"}
                </span>
              </div>
            ) : (
              <div className="text-xs text-gray-400">
                CSV 파일을 드래그하거나 클릭하여 업로드
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-1.5">
          {[
            { l: "L2", c: "bg-[#A62121] text-white" },
            { l: "L3", c: "bg-[#D95578] text-white" },
            { l: "L4", c: "bg-[#F2A0AF] text-[#3B0716] font-bold" },
            { l: "L5", c: "bg-[#F2DCE0] text-[#3B0716] font-bold border border-[#F2A0AF]" },
          ].map((i) => (
            <span
              key={i.l}
              className={
                "text-[9px] font-bold px-2 py-0.5 rounded-full " + i.c
              }
            >
              {i.l}
            </span>
          ))}
        </div>

        {/* L2 → L3 Accordion */}
        <div className="flex-none max-h-[35%] overflow-y-auto border-b border-gray-100">
          {l2List.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400">
              CSV 파일을 업로드하세요
            </div>
          ) : (
            l2List.map((l2) => (
              <div key={l2.id}>
                <div className="flex items-stretch">
                  <button
                    className={
                      "flex-1 text-left px-4 py-2.5 text-sm font-bold flex items-center justify-between transition-colors " +
                      (expandedL2 === l2.id
                        ? "bg-[#A62121] text-white"
                        : "bg-red-50/50 text-gray-700 hover:bg-red-50")
                    }
                    onClick={() =>
                      setExpandedL2(expandedL2 === l2.id ? null : l2.id)
                    }
                  >
                    <span>
                      <span className="text-[10px] opacity-60 mr-1">
                        {l2.id + "."}
                      </span>
                      {l2.name}
                    </span>
                    <span className="text-xs opacity-60">
                      {expandedL2 === l2.id ? "▼" : "▶"}
                    </span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      addNodeToCanvas("l2", l2);
                    }}
                    className={
                      "px-2 text-[10px] font-bold transition-colors " +
                      (expandedL2 === l2.id
                        ? "bg-[#8A1B1B] text-red-200 hover:text-white hover:bg-[#A62121]"
                        : "bg-red-50/50 text-gray-400 hover:text-[#A62121] hover:bg-red-100")
                    }
                    title="캔버스에 추가"
                  >
                    +
                  </button>
                </div>
                {expandedL2 === l2.id && l3Map[l2.id] && (
                  <div className="bg-gray-50">
                    {l3Map[l2.id].map((l3) => (
                      <div key={l3.id} className="flex items-stretch">
                        <button
                          onClick={() => handleSelectL3(l3.id)}
                          className={
                            "flex-1 text-left px-6 py-2 text-xs transition-colors border-l-[3px] " +
                            (selectedL3 === l3.id
                              ? "bg-red-50 text-[#A62121] border-l-[#A62121] font-semibold"
                              : "text-gray-600 hover:bg-gray-100 border-l-transparent")
                          }
                        >
                          <span className="text-[9px] text-gray-400 font-mono mr-1">
                            {l3.id}
                          </span>
                          {l3.name}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addNodeToCanvas("l3", {
                              id: l3.id,
                              name: l3.name,
                            });
                          }}
                          className={
                            "px-2 text-[10px] font-bold transition-colors " +
                            (selectedL3 === l3.id
                              ? "bg-red-50 text-[#D95578] hover:text-[#A62121]"
                              : "text-gray-300 hover:text-[#A62121] hover:bg-red-50")
                          }
                          title="캔버스에 추가"
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* L4 / L5 Palette */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedL3 ? (
            <>
              <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="L4/L5 검색..."
                  className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="px-4 py-2 border-b border-gray-100 flex gap-1.5">
                <button
                  onClick={handleViewFullTree}
                  className="flex-1 text-[10px] font-medium bg-[#A62121] text-white rounded py-1.5 hover:bg-[#8A1B1B] transition"
                >
                  {"🌳 전체 트리"}
                </button>
                <button
                  onClick={() => {
                    setChatOpen(true);
                    if (selectedL3) {
                      const pd = summarizeL3ForAI(csvRows, selectedL3);
                      setChatInitData(pd);
                    }
                  }}
                  className="flex-1 text-[10px] font-medium bg-[#D95578] text-white rounded py-1.5 hover:bg-[#C44466] transition"
                >
                  {"🤖 AI Workflow"}
                </button>
                <button
                  onClick={handleClearCanvas}
                  className="text-[10px] font-medium bg-gray-200 text-gray-600 rounded px-2 py-1.5 hover:bg-gray-300 transition"
                >
                  {"🗑️"}
                </button>
              </div>
              {/* Export toolbar */}
              <div className="px-4 py-2 border-b border-gray-100">
                <ExportToolbar
                  nodes={nodes}
                  edges={edges}
                  reactFlowWrapper={reactFlowWrapper}
                  sheets={sheets}
                  getSheetData={getSheetData}
                  activeSheetId={activeSheetId}
                />
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2">
                <p className="text-[9px] text-gray-400 px-2 mb-1">
                  💡 항목 클릭 → 캔버스 추가 · Handle 드래그 → 화살표 연결
                </p>
                {filteredL4.map((l4) => (
                  <div key={l4.id} className="mb-1">
                    <div className="flex items-stretch">
                      <button
                        onClick={() => addNodeToCanvas("l4", l4)}
                        className="flex-1 text-left px-3 py-2.5 text-sm font-bold text-[#3B0716] bg-white border-2 border-[#F2A0AF] rounded-l-lg hover:bg-[#F2DCE0]/50 hover:border-[#D95578] transition-colors"
                        title={l4.description || l4.name}
                      >
                        <span className="text-[9px] text-[#A62121] font-mono mr-1.5 bg-[#F2DCE0] px-1 py-0.5 rounded">
                          {l4.id}
                        </span>
                        {l4.name}
                        {l4.description && (
                          <span className="block text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                            {l4.description}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          setExpandedL4(
                            expandedL4 === l4.id ? null : l4.id
                          )
                        }
                        className="px-2 bg-white border-y-2 border-r-2 border-[#F2A0AF] rounded-r-lg text-gray-400 hover:text-[#A62121] hover:bg-[#F2DCE0]/50 text-[10px] transition-colors"
                      >
                        {expandedL4 === l4.id
                          ? "▼"
                          : "▶ " + (l5Map[l4.id] || []).length}
                      </button>
                    </div>
                    {expandedL4 === l4.id && l5Map[l4.id] && (
                      <div className="ml-3 mt-0.5 space-y-0.5">
                        {l5Map[l4.id].map((l5) => (
                          <button
                            key={l5.id}
                            onClick={() => addNodeToCanvas("l5", l5)}
                            className="w-full text-left px-2.5 py-1.5 text-[11px] font-semibold text-[#3B0716] bg-[#F2DCE0] border border-[#F2A0AF]/50 rounded hover:bg-[#F2A0AF]/30 hover:border-[#F2A0AF] transition-colors"
                            title={l5.description || l5.name}
                          >
                            <span className="text-[9px] text-[#D95578] font-mono mr-1">
                              {l5.id}
                            </span>
                            {l5.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 flex items-center justify-center">
                <p className="text-xs text-gray-400 text-center px-4">
                  ← L3 프로세스를 선택하면
                  <br />
                  하위 L4·L5 목록이 표시됩니다
                </p>
              </div>
              {nodes.length > 0 && (
                <div className="px-4 py-2 border-t border-gray-100">
                  <ExportToolbar
                    nodes={nodes}
                    edges={edges}
                    reactFlowWrapper={reactFlowWrapper}
                    sheets={sheets}
                    getSheetData={getSheetData}
                    activeSheetId={activeSheetId}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-gray-100 text-[9px] text-gray-300 text-center">
          {"PwC · 두산 HR AX · " + csvRows.length + "행 로드"}
        </div>
      </div>

      {/* ═══════════ RIGHT PANEL — CANVAS + TABS + CHAT ═══════════ */}
      <div className="flex-1 flex relative">
        {/* Canvas area + SheetTabBar */}
        <div className="flex-1 flex flex-col relative">
          {/* Canvas */}
          <div className="flex-1 relative" ref={reactFlowWrapper}>
            {csvRows.length === 0 ? (
              <div
                className="flex items-center justify-center h-full text-gray-400"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="text-center">
                  <div className="text-6xl mb-4">📂</div>
                  <p className="text-lg font-medium">CSV 파일을 업로드하세요</p>
                  <p className="text-sm mt-1 text-gray-300">
                    좌측 패널 또는 이 영역에 파일을 드래그하세요
                  </p>
                </div>
              </div>
            ) : (
              <div className="w-full h-full relative">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onEdgeContextMenu={onEdgeContextMenu}
                onNodeDoubleClick={onNodeDoubleClick}
                nodeTypes={nodeTypes}
                onInit={(instance) => { rfInstanceRef.current = instance; }}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.05}
                maxZoom={2.5}
                connectionLineStyle={{ stroke: "#d95578", strokeWidth: 2 }}
                defaultEdgeOptions={{
                  type: "smoothstep",
                  animated: true,
                  style: { stroke: "#d95578", strokeWidth: 2 },
                }}
                deleteKeyCode={["Backspace", "Delete"]}
              >
                {/* Background: grid for blank, dots for swimlane */}
                {activeSheet.type === "swimlane" ? (
                  <Background key="bg" color="#f1f5f9" gap={40} size={0.5} />
                ) : (
                  <Background key="bg" color="#e2e8f0" gap={20} size={1} />
                )}

                {/* Swimlane overlay — uses useViewport(), must be inside ReactFlow */}
                {activeSheet.type === "swimlane" && (
                  <SwimLaneOverlay key="swimlane" lanes={activeSheet.lanes} />
                )}

                <Controls key="controls" position="bottom-right" />
                <MiniMap
                  key="minimap"
                  nodeColor={(node) => {
                    switch (node.type) {
                      case "l2":
                        return "#A62121";
                      case "l3":
                        return "#D95578";
                      case "l4":
                        return "#F2A0AF";
                      case "l5":
                        return "#F2DCE0";
                      default:
                        return "#d1d5db";
                    }
                  }}
                  maskColor="rgba(0,0,0,0.08)"
                  position="bottom-left"
                  style={
                    activeSheet.type === "swimlane"
                      ? {
                          background:
                            "linear-gradient(to bottom, rgba(166,33,33,0.15) 0% 25%, rgba(217,85,120,0.12) 25% 50%, rgba(242,160,175,0.12) 50% 75%, rgba(242,220,224,0.15) 75% 100%)",
                        }
                      : undefined
                  }
                />
                <Panel key="info" position="top-right">
                  <div className="bg-white/90 backdrop-blur rounded-lg shadow-sm border border-gray-200 px-3 py-2 text-[10px] text-gray-500 space-y-0.5">
                    <div>
                      {"📦 노드: " +
                        nodes.length +
                        " · 🔗 엣지: " +
                        edges.length}
                    </div>
                    <div>
                      {"📋 시트: " + activeSheet.name + (activeSheet.type === "swimlane" ? " (4분할)" : " (격자)")}
                    </div>
                    <div>💡 Handle 드래그 → 화살표 연결</div>
                    <div>🖱️ 노드 더블클릭 → 메모/메타 편집</div>
                    <div>🔄 화살표 우클릭 → 양방향 전환</div>
                    <div>⌫ Delete 키로 선택 항목 삭제</div>
                  </div>
                </Panel>
              </ReactFlow>

              {/* Node Detail Panel (overlay) */}
              {selectedNode && (
                <NodeDetailPanel
                  node={selectedNode}
                  onClose={() => setSelectedNode(null)}
                  onUpdate={updateNodeMeta}
                />
              )}
              </div>
            )}
          </div>

          {/* ═══ Sheet Tab Bar (bottom of canvas) ═══ */}
          <SheetTabBar
            sheets={sheets}
            activeSheetId={activeSheetId}
            onSelect={handleSelectSheet}
            onAdd={handleAddSheet}
            onDelete={handleDeleteSheet}
            onRename={handleRenameSheet}
            onDuplicate={handleDuplicateSheet}
          />
        </div>

        {/* Chat Panel */}
        <ChatPanel
          nodes={nodes}
          edges={edges}
          onApplyWorkflow={handleApplyWorkflow}
          isOpen={chatOpen}
          onToggle={() => setChatOpen(!chatOpen)}
          processData={chatInitData}
          onProcessDataConsumed={() => setChatInitData("")}
        />
      </div>
    </div>
  );
}
