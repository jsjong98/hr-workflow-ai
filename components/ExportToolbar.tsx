"use client";

import { useCallback, useRef } from "react";
import { toPng, toSvg } from "html-to-image";
import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import type { Node, Edge } from "@xyflow/react";
import type { Sheet } from "./SheetTabBar";

interface ExportToolbarProps {
  nodes: Node[];
  edges: Edge[];
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
  /** Optional: all sheets for multi-sheet JSON save */
  sheets?: Sheet[];
  /** Get sheet data (nodes+edges) by sheet id */
  getSheetData?: (id: string) => { nodes: Node[]; edges: Edge[] };
  /** Current nodes/edges (for saving current active sheet) */
  activeSheetId?: string;
}

export default function ExportToolbar({
  nodes,
  edges,
  reactFlowWrapper,
  sheets,
  getSheetData,
  activeSheetId,
}: ExportToolbarProps) {
  const isExporting = useRef(false);

  /* ═══ PNG Export ═══ */
  const handleExportPNG = useCallback(async () => {
    if (isExporting.current) return;
    isExporting.current = true;
    try {
      const el = reactFlowWrapper.current?.querySelector(
        ".react-flow__viewport"
      ) as HTMLElement;
      if (!el) {
        alert("캔버스를 찾을 수 없습니다.");
        return;
      }
      const dataUrl = await toPng(el, {
        backgroundColor: "#f3f4f6",
        quality: 1,
        pixelRatio: 2,
        filter: (node) => {
          // Exclude minimap, controls, panel overlays from export
          const exclude = ["react-flow__minimap", "react-flow__controls", "react-flow__panel"];
          return !exclude.some((cls) =>
            (node as HTMLElement)?.classList?.contains(cls)
          );
        },
      });
      const link = document.createElement("a");
      link.download = `hr-workflow-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG export error:", err);
      alert("PNG 내보내기에 실패했습니다.");
    } finally {
      isExporting.current = false;
    }
  }, [reactFlowWrapper]);

  /* ═══ SVG Export ═══ */
  const handleExportSVG = useCallback(async () => {
    if (isExporting.current) return;
    isExporting.current = true;
    try {
      const el = reactFlowWrapper.current?.querySelector(
        ".react-flow__viewport"
      ) as HTMLElement;
      if (!el) {
        alert("캔버스를 찾을 수 없습니다.");
        return;
      }
      const dataUrl = await toSvg(el, {
        backgroundColor: "#f3f4f6",
        filter: (node) => {
          const exclude = ["react-flow__minimap", "react-flow__controls", "react-flow__panel"];
          return !exclude.some((cls) =>
            (node as HTMLElement)?.classList?.contains(cls)
          );
        },
      });
      const link = document.createElement("a");
      link.download = `hr-workflow-${Date.now()}.svg`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("SVG export error:", err);
      alert("SVG 내보내기에 실패했습니다.");
    } finally {
      isExporting.current = false;
    }
  }, [reactFlowWrapper]);

  /* ═══ JSON Save (multi-sheet aware) ═══ */
  const handleSaveJSON = useCallback(() => {
    if (sheets && getSheetData && activeSheetId) {
      /* Multi-sheet format */
      const sheetPayloads = sheets.map((s) => {
        const sd = s.id === activeSheetId ? { nodes, edges } : getSheetData(s.id);
        return { id: s.id, name: s.name, type: s.type, lanes: s.lanes, nodes: sd.nodes, edges: sd.edges };
      });
      const data = {
        version: "2.0",
        exportedAt: new Date().toISOString(),
        sheets: sheetPayloads,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      saveAs(blob, `hr-workflow-${Date.now()}.json`);
    } else {
      /* Legacy single-sheet format */
      const data = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        nodes,
        edges,
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      saveAs(blob, `hr-workflow-${Date.now()}.json`);
    }
  }, [nodes, edges, sheets, getSheetData, activeSheetId]);

  /* ═══ JSON Load ═══ */
  const handleLoadJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          if (data.nodes && data.edges) {
            // Dispatch custom event to load workflow
            window.dispatchEvent(
              new CustomEvent("loadWorkflow", {
                detail: { nodes: data.nodes, edges: data.edges },
              })
            );
          } else {
            alert("유효하지 않은 워크플로우 파일입니다.");
          }
        } catch {
          alert("JSON 파싱에 실패했습니다.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  /* ═══ PPT Export (Native Shapes + Arrows) ═══ */
  const handleExportPPT = useCallback(async () => {
    if (isExporting.current) return;
    if (nodes.length === 0) { alert("캔버스에 노드가 없습니다."); return; }
    isExporting.current = true;
    try {
      const pptx = new PptxGenJS();
      pptx.layout = "LAYOUT_WIDE"; // 13.33" x 7.5"
      pptx.author = "HR Workflow Builder";
      pptx.title = "HR Workflow";
      pptx.subject = "As-is 프로세스 워크플로우";
      const SLIDE_W = 13.33;
      const SLIDE_H = 7.5;

      /* ── Level style config ── */
      /* L3: 해당색 채우기+흰글씨 | L4: light gray 채우기 | L5: 흰바탕+light gray 윤곽 */
      const LIGHT_GRAY = "DEDEDE";
      const FONT_FACE = "Noto Sans KR";

      const LS: Record<string, { bg: string; border: string; text: string; fontSize: number; pxW: number; pxH: number; pptW: number; pptH: number }> = {
        L2: { bg: "A62121", border: "A62121", text: "FFFFFF", fontSize: 12, pxW: 720, pxH: 260, pptW: 1.90, pptH: 0.68 },
        L3: { bg: "D95578", border: "D95578", text: "FFFFFF", fontSize: 12, pxW: 660, pxH: 240, pptW: 1.73, pptH: 0.63 },
        L4: { bg: LIGHT_GRAY, border: LIGHT_GRAY, text: "000000", fontSize: 12, pxW: 600, pxH: 220, pptW: 1.58, pptH: 0.58 },
        L5: { bg: "FFFFFF", border: LIGHT_GRAY, text: "000000", fontSize: 9, pxW: 540, pxH: 389, pptW: 1.24, pptH: 0.894 },
      };
      /* L5 2-box 고정 치수 (인치) — 스케일링 무시, 항상 이 크기 */
      const L5_FIXED_W  = 1.240;  // 3.15cm
      const L5_UPPER_H  = 0.685;  // 1.74cm
      const L5_LOWER_H  = 0.213;  // 0.54cm
      const L5_GAP      = 0.020;  // 0.05cm
      const L5_FIXED_H  = L5_UPPER_H + L5_GAP + L5_LOWER_H; // 0.918" = 2.33cm
      const DEF = LS.L4;
      const getLevel = (n: Node) => (n.data as Record<string, string>).level || "L4";
      const getLabel = (n: Node) => (n.data as Record<string, string>).label || "";
      const getId = (n: Node) => (n.data as Record<string, string>).id || n.id;
      /* Format ID: strip level prefix, show only number (e.g. "L4-1.2.3" → "1.2.3") */
      const getDisplayId = (n: Node) => {
        const raw = getId(n);
        return raw.replace(/^[Ll]\d[-_.\s]*/g, "").trim() || raw;
      };
      const getDesc = (n: Node) => (n.data as Record<string, string>).description || "";
      const getMeta = (n: Node) => {
        const d = n.data as Record<string, string>;
        return {
          memo: d.memo || "",
          role: d.role || "",
          inputData: d.inputData || "",
          outputData: d.outputData || "",
          system: d.system || "",
        };
      };
      const nodeMap = new Map<string, Node>();
      for (const n of nodes) nodeMap.set(n.id, n);

      /* ═══════════════════════════════════════════
       * SLIDE 1 — Title
       * ═══════════════════════════════════════════ */
      const s1 = pptx.addSlide();
      s1.background = { color: "0F172A" };
      s1.addText("HR Workflow", {
        x: 1, y: 2.0, w: 11.33, h: 1.2,
        fontSize: 44, fontFace: FONT_FACE, color: "FFFFFF", bold: true, align: "center",
      });
      s1.addText(
        `노드 ${nodes.length}개  ·  연결 ${edges.length}개  ·  ${new Date().toLocaleDateString("ko-KR")}`,
        { x: 1, y: 3.3, w: 11.33, h: 0.5, fontSize: 13, fontFace: FONT_FACE, color: "64748B", align: "center" },
      );
      // Level legend on title
      let lx = 3.2;
      for (const [lvl, cfg] of Object.entries(LS)) {
        s1.addText(lvl, {
          x: lx, y: 5.0, w: 1.3, h: 0.38,
          shape: pptx.ShapeType.rect,
          fill: { color: cfg.bg }, line: { color: cfg.border, width: 1 },
          fontSize: 11, fontFace: FONT_FACE, color: cfg.text, bold: true, align: "center", valign: "middle",
        });
        lx += 1.7;
      }

      /* ═══════════════════════════════════════════
       * SLIDE 2 — Workflow Diagram (Native Shapes)
       * ═══════════════════════════════════════════ */
      // 슬라이드 제목: 자식 레벨 존재 + 단일 부모 → 부모 정보 + 부모 레벨 프로세스 맵
      // 예: L5들이 같은 L4에 속함 → "L4_ID L4_Name — L4 프로세스 맵"
      const currentSheet = sheets?.find((s) => s.id === activeSheetId);
      const slideTitle = (() => {
        const levelOrder = ["L2", "L3", "L4", "L5"];
        const lvCounts: Record<string, number> = {};
        const lvFirst: Record<string, Node> = {};
        for (const nd of nodes) {
          const lv = getLevel(nd);
          lvCounts[lv] = (lvCounts[lv] || 0) + 1;
          if (!lvFirst[lv]) lvFirst[lv] = nd;
        }
        // 깊은 레벨부터 탐색: 자식 존재 + 부모 1개 → 부모 정보 사용
        for (let i = levelOrder.length - 1; i >= 1; i--) {
          const childLv = levelOrder[i];
          const parentLv = levelOrder[i - 1];
          if ((lvCounts[childLv] || 0) > 0 && (lvCounts[parentLv] || 0) === 1) {
            const nd = lvFirst[parentLv];
            const label = getLabel(nd);
            const dispId = getDisplayId(nd);
            return label ? `${dispId} ${label} — ${parentLv} 프로세스 맵` : `${dispId} — ${parentLv} 프로세스 맵`;
          }
        }
        // fallback: 가장 높은 단일 레벨 노드
        for (const lv of levelOrder) {
          if (lvFirst[lv]) {
            const nd = lvFirst[lv];
            const label = getLabel(nd);
            const dispId = getDisplayId(nd);
            return label ? `${dispId} ${label} — ${lv} 프로세스 맵` : `${dispId} — ${lv} 프로세스 맵`;
          }
        }
        return currentSheet?.name || "워크플로우 다이어그램";
      })();
      const s2 = pptx.addSlide();
      s2.background = { color: "F8FAFC" };
      s2.addText(slideTitle, {
        x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
        fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
      });

      /* ── SwimLane background bands (if active sheet is swimlane) ── */
      const isSwimLane = currentSheet?.type === "swimlane";
      const swimLanes = currentSheet?.lanes || ["임원", "팀장", "HR 담당자", "구성원"];
      const SWIM_COLORS = [
        { fill: "F5F5F5", border: "C0C0C0" },
        { fill: "FFFFFF", border: "C0C0C0" },
        { fill: "F5F5F5", border: "C0C0C0" },
        { fill: "FFFFFF", border: "C0C0C0" },
      ];
      const SWIM_LABEL_W = 0.45; // vertical label column width (레거시: 점선 시작 x)
      const PAD_X = isSwimLane ? 1.25 : 0.4; // 레이블 박스(1.05") 뒤로 밀기
      const PAD_TOP = 1.575; // 4cm 상단 여백
      const PAD_BOTTOM = 0.35;
      // 수영레인 밴드 상수 (Phase 2.6에서도 재사용)
      const SWIM_BAND_H = 1.535; // 3.9cm per lane (기본 균등 높이)
      const SL_BAND_BOTTOM = SLIDE_H - PAD_BOTTOM + 0.05; // 7.2"
      const SL_BAND_TOP = SL_BAND_BOTTOM - SWIM_BAND_H * swimLanes.length; // ~1.06"
      const TOTAL_SWIM_H = SWIM_BAND_H * swimLanes.length;

      // ── 동적 레인 높이: 2행 레인에 더 많은 공간 배분 ──
      const dynamicLaneH: number[] = swimLanes.map(() => SWIM_BAND_H);
      const dynamicLaneTops: number[] = [];
      if (isSwimLane) {
        const CL_H = 600; // canvas lane height (csvToFlow: 2400/4)
        const laneRowCounts: number[] = [];
        for (let li = 0; li < swimLanes.length; li++) {
          const ys: number[] = [];
          for (const nd of nodes) {
            const idx = Math.min(Math.max(Math.floor(nd.position.y / CL_H), 0), swimLanes.length - 1);
            if (idx === li) ys.push(nd.position.y);
          }
          ys.sort((a, b) => a - b);
          let rows = 0, lastY = -Infinity;
          for (const y of ys) { if (y - lastY > 50) { rows++; lastY = y; } }
          laneRowCounts.push(Math.max(rows, 1));
        }
        const totalW = laneRowCounts.reduce((s, c) => s + c, 0);
        const MIN_H = 0.7; // 최소 레인 높이
        for (let i = 0; i < swimLanes.length; i++) {
          dynamicLaneH[i] = Math.max(TOTAL_SWIM_H * laneRowCounts[i] / totalW, MIN_H);
        }
        // 정규화: 합 = TOTAL_SWIM_H
        const hSum = dynamicLaneH.reduce((s, h) => s + h, 0);
        for (let i = 0; i < dynamicLaneH.length; i++) dynamicLaneH[i] *= TOTAL_SWIM_H / hSum;
      }
      // 레인 상단 좌표 계산
      { let ct = SL_BAND_TOP; for (let i = 0; i < swimLanes.length; i++) { dynamicLaneTops.push(ct); ct += dynamicLaneH[i]; } }

      if (isSwimLane) {
        // 수평 구분선: 동적 높이 기반 (점선)
        let ly = SL_BAND_TOP;
        for (let i = 0; i <= swimLanes.length; i++) {
          s2.addShape("line", {
            x: 0, y: ly, w: SLIDE_W, h: 0,
            line: { color: "B0B0B0", width: 0.75, dashType: "dash" },
          });
          if (i < swimLanes.length) ly += dynamicLaneH[i];
        }
        // 레이블 박스: 각 레인 상단 좌측 (가로 텍스트, 흰색 배경)
        const LBL_BOX_W = 1.05;
        const LBL_BOX_H = 0.26;
        for (let i = 0; i < swimLanes.length; i++) {
          const labelY = dynamicLaneTops[i] + 0.06;
          s2.addText(swimLanes[i], {
            x: 0.04, y: labelY, w: LBL_BOX_W, h: LBL_BOX_H,
            shape: pptx.ShapeType.rect,
            fill: { color: "FFFFFF" },
            line: { color: "B0B0B0", width: 0.5 },
            fontSize: 9, fontFace: FONT_FACE, color: "333333",
            align: "center", valign: "middle",
          });
        }
      }

      // ── Coordinate mapping: RF bbox → PPT ──
      // 노드의 실제 bbox(좌상단 x,y + 크기)로 전체 범위 계산
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      for (const nd of nodes) {
        const s = LS[getLevel(nd)] || DEF;
        const x0 = nd.position.x, y0 = nd.position.y;
        const x1 = x0 + s.pxW, y1 = y0 + s.pxH;
        bMinX = Math.min(bMinX, x0); bMinY = Math.min(bMinY, y0);
        bMaxX = Math.max(bMaxX, x1); bMaxY = Math.max(bMaxY, y1);
      }
      const bRangeX = (bMaxX - bMinX) || 1;
      const bRangeY = (bMaxY - bMinY) || 1;

      // 여백 설정 (가로 13.33" x 7.5")
      const areaW = SLIDE_W - 2 * PAD_X;
      const areaH = SLIDE_H - PAD_TOP - PAD_BOTTOM;

      // 가로/세로 비율 중 작은 쪽으로 단일 스케일 결정
      const scFit = Math.min(areaW / bRangeX, areaH / bRangeY);
      // 기준 스케일: L4 노드 세로 2cm(0.787") 기준 (노드 규격 통일)
      const scRef = 0.787 / DEF.pxH;
      const sc = Math.min(scFit, scRef);

      // RF 좌표 → PPT 좌표 (좌상단 시작)
      const toPpt = (rfX: number, rfY: number) => ({
        x: PAD_X + (rfX - bMinX) * sc,
        y: PAD_TOP + (rfY - bMinY) * sc,
      });

      // 노드 폰트 크기 고정 (12pt)
      const NODE_FONT_SIZE = 12;

      // ── Phase 1: RF 좌표 기반 raw 위치 계산 ─────────────────────────────────────
      const rawPos: Record<string, { rfX: number; rfY: number; w: number; h: number }> = {};
      for (const nd of nodes) {
        const s = LS[getLevel(nd)] || DEF;
        const isL5 = getLevel(nd) === "L5";
        rawPos[nd.id] = {
          rfX: nd.position.x, rfY: nd.position.y,
          w: isL5 ? L5_FIXED_W : s.pxW * sc,
          h: isL5 ? L5_FIXED_H : s.pxH * sc,
        };
      }

      // ── Phase 2: 콜럼 정규화 — 같은 X군 안에서 X 스냅 + 세로 등간격 ────────────────
      // RF 60px 이내 = 같은 콜럼
      const pColVis = new Set<string>();
      const pColGrps: string[][] = [];
      for (const id of Object.keys(rawPos).sort((a, b) => rawPos[a].rfX - rawPos[b].rfX)) {
        if (pColVis.has(id)) continue;
        const grp = [id]; pColVis.add(id);
        for (const id2 of Object.keys(rawPos)) {
          if (!pColVis.has(id2) && Math.abs(rawPos[id2].rfX - rawPos[id].rfX) <= 60) {
            grp.push(id2); pColVis.add(id2);
          }
        }
        pColGrps.push(grp);
      }
      const nodeBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const grp of pColGrps) {
        grp.sort((a, b) => rawPos[a].rfY - rawPos[b].rfY);
        const snapX = PAD_X + (Math.min(...grp.map(id => rawPos[id].rfX)) - bMinX) * sc;
        const y0 = PAD_TOP + (rawPos[grp[0]].rfY - bMinY) * sc;
        if (grp.length === 1) {
          nodeBoxes[grp[0]] = { x: snapX, y: y0, w: rawPos[grp[0]].w, h: rawPos[grp[0]].h };
        } else {
          const lastId = grp[grp.length - 1];
          const yLast = PAD_TOP + (rawPos[lastId].rfY - bMinY) * sc;
          const span = yLast + rawPos[lastId].h - y0;
          const sumH = grp.reduce((acc, id) => acc + rawPos[id].h, 0);
          const gap = Math.max((span - sumH) / (grp.length - 1), 0.06);
          let curY = y0;
          for (const id of grp) {
            nodeBoxes[id] = { x: snapX, y: curY, w: rawPos[id].w, h: rawPos[id].h };
            curY += rawPos[id].h + gap;
          }
        }
      }

      // ── Phase 2.5: Cross-column Y 정렬 (수영레인 모드에서는 스킵) ──
      if (!isSwimLane) {
        for (const grp of pColGrps) {
          if (grp.length !== 1) continue;
          const nid = grp[0];
          const box = nodeBoxes[nid];
          if (!box) continue;
          const connCenterYs: number[] = [];
          for (const e of edges) {
            const cid = e.target === nid ? e.source : e.source === nid ? e.target : null;
            if (!cid) continue;
            const cb = nodeBoxes[cid];
            if (cb && Math.abs(cb.x - box.x) > 0.3) connCenterYs.push(cb.y + cb.h / 2);
          }
          if (connCenterYs.length === 0) continue;
          connCenterYs.sort((a, b) => a - b);
          const medianCy = connCenterYs[Math.floor(connCenterYs.length / 2)];
          const newY = medianCy - box.h / 2;
          box.y = Math.max(PAD_TOP, Math.min(newY, SLIDE_H - PAD_BOTTOM - box.h));
        }
      }

      // ── Phase 2.6: 수영레인 Y좌표 — 캔버스 비례 매핑 + 동적 레인 높이 ──
      if (isSwimLane) {
        const CANVAS_LANE_H = 600;
        const laneMap: Record<number, string[]> = {};
        for (const nd of nodes) {
          const box = nodeBoxes[nd.id];
          if (!box) continue;
          const rfY = nd.position.y;
          const laneIdx = Math.min(Math.max(Math.floor(rfY / CANVAS_LANE_H), 0), swimLanes.length - 1);
          if (!laneMap[laneIdx]) laneMap[laneIdx] = [];
          laneMap[laneIdx].push(nd.id);
        }
        for (const [li, ids] of Object.entries(laneMap)) {
          const laneIdx = Number(li);
          const laneTop = dynamicLaneTops[laneIdx];
          const laneH = dynamicLaneH[laneIdx];
          const pad = 0.06;
          // 캔버스 Y 범위
          const items = ids.map(id => {
            const nd = nodes.find(n => n.id === id)!;
            return { id, rfY: nd.position.y, h: nodeBoxes[id].h };
          });
          const rfYMin = Math.min(...items.map(c => c.rfY));
          const rfYMax = Math.max(...items.map(c => c.rfY));
          const rfSpan = rfYMax - rfYMin;

          if (rfSpan < 50) {
            // 같은 행: 레인 중앙 — 동일 높이 노드들은 동일 Y로 스냅
            // L5는 커넥터가 upper box 중앙(L5_UPPER_H/2)에 붙으므로,
            // 동일 row 내 L4/L5 스냅: 커넥터 Y가 일치하도록 보정
            const l5Items = items.filter(c => {
              const nd = nodes.find(n => n.id === c.id)!;
              return getLevel(nd) === "L5";
            });
            const otherItems = items.filter(c => {
              const nd = nodes.find(n => n.id === c.id)!;
              return getLevel(nd) !== "L5";
            });
            // L5 노드: 레인 중앙 정렬 (커넥터Y = y + L5_UPPER_H/2)
            for (const { id, h } of l5Items) {
              nodeBoxes[id].y = laneTop + (laneH - h) / 2;
            }
            // 비-L5 노드: L5 커넥터Y에 맞춰서 정렬 (connY = y + h/2 == l5ConnY)
            if (l5Items.length > 0 && otherItems.length > 0) {
              const l5Y0 = nodeBoxes[l5Items[0].id].y;
              const l5ConnY = l5Y0 + L5_UPPER_H / 2;
              for (const { id, h } of otherItems) {
                nodeBoxes[id].y = l5ConnY - h / 2;
              }
            } else {
              for (const { id, h } of otherItems) {
                nodeBoxes[id].y = laneTop + (laneH - h) / 2;
              }
            }
          } else {
            // 비례 매핑: 캔버스 상대위치 → PPT 레인 내 위치 (두 행 그대로 유지)
            const maxH = Math.max(...items.map(c => c.h));
            const availSpan = laneH - 2 * pad - maxH;
            for (const { id, rfY, h } of items) {
              const ratio = (rfY - rfYMin) / rfSpan;
              nodeBoxes[id].y = laneTop + pad + ratio * Math.max(availSpan, 0);
            }
          }
        }
      }

      // ── Phase 3: 노드 그리기 ─────────────────────────────────────────────────────
      for (const nd of nodes) {
        const level = getLevel(nd);
        const s = LS[level] || DEF;
        const box = nodeBoxes[nd.id];
        if (!box) continue;
        const dispLabel = getLabel(nd);
        const dispId = getDisplayId(nd);

        if (level === "L5") {
          /* ── L5 전용 2-box: 고정 치수 (3.15cm×1.74cm + 0.05cm + 0.54cm) ── */
          // 위쪽 박스: 흰 배경, 0.25pt 테두리, ID + Label
          s2.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
            x: box.x, y: box.y, w: L5_FIXED_W, h: L5_UPPER_H,
            shape: pptx.ShapeType.rect,
            fill: { color: "FFFFFF" },
            line: { color: "DEDEDE", width: 0.25 },
            fontSize: 9, bold: true, color: "000000",
            fontFace: FONT_FACE, valign: "middle", align: "center",
          });
          // 아래쪽 박스: 연회색(DEDEDE) 채우기, 선 없음, 시스템명
          const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
          const sysStr = (nd.data as Record<string, string>).system || "";
          let sysName = "시스템명";
          if (sysStr) {
            sysName = sysStr;
          } else if (sysMap) {
            const SYS_KEYS = [
              { key: "hr", label: "HR시스템" }, { key: "groupware", label: "그룹웨어" },
              { key: "office", label: "오피스" }, { key: "manual", label: "수작업" }, { key: "etc", label: "기타툴" },
            ];
            const active = SYS_KEYS.filter(k => sysMap[k.key]?.trim());
            if (active.length > 0) sysName = active.map(k => k.label).join(", ");
          }
          s2.addText(sysName, {
            x: box.x, y: box.y + L5_UPPER_H + L5_GAP, w: L5_FIXED_W, h: L5_LOWER_H,
            shape: pptx.ShapeType.rect,
            fill: { color: "DEDEDE" },
            line: { width: 0 },
            fontSize: 7, bold: false, color: "000000",
            fontFace: FONT_FACE, valign: "middle", align: "center",
          });
        } else {
          /* ── L2~L4: 기존 단일 박스 ── */
          s2.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
            x: box.x, y: box.y, w: box.w, h: box.h,
            shape: pptx.ShapeType.rect,
            fill: { color: s.bg },
            line: { color: s.border, width: 0.25 },
            fontSize: NODE_FONT_SIZE, bold: true, color: s.text,
            fontFace: FONT_FACE, valign: "middle", align: "center",
          });
          const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
          if (sysMap) {
            const SYS_KEYS: { key: string; label: string }[] = [
              { key: "hr", label: "HR시스템" }, { key: "groupware", label: "그룹웨어" },
              { key: "office", label: "오피스" }, { key: "manual", label: "수작업" }, { key: "etc", label: "기타툴" },
            ];
            const activeSys = SYS_KEYS.filter(k => sysMap[k.key]?.trim());
            if (activeSys.length > 0) {
              s2.addText(activeSys.map(k => `🖥 ${k.label}`).join("  "), {
                x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2,
                fontSize: Math.max(NODE_FONT_SIZE - 2, 6), color: s.bg,
                fontFace: FONT_FACE, align: "center", bold: true,
              });
            }
          }
        }
      }

      // ── Phase 4: 엣지 메타 수집 (실제 그리기는 PPTX 후처리에서 진짜 커넥터로) ──────
      // nodeBoxes의 노드 이름을 Phase 3의 addText 순서와 매핑하기 위해 순서 기록
      const nodeDrawOrder: string[] = [];
      // Phase 3에서 그린 노드 순서 재현 (위 Phase 3 루프와 동일 순서)
      for (const nd of nodes) {
        if (nodeBoxes[nd.id]) nodeDrawOrder.push(nd.id);
      }

      interface ConnectorMeta {
        srcNodeId: string; tgtNodeId: string;
        srcBox: { x: number; y: number; w: number; h: number };
        tgtBox: { x: number; y: number; w: number; h: number };
        srcIsL5: boolean; tgtIsL5: boolean;
        isStraight: boolean;  // true=직선, false=꺾인선
        isHorizontal: boolean; // true=가로 우세, false=세로 우세
        bidi: boolean;
      }
      const connectors: ConnectorMeta[] = [];

      // 노드 레벨 룩업
      const nodeLevelMap: Record<string, string> = {};
      for (const nd of nodes) nodeLevelMap[nd.id] = getLevel(nd);

      const yOverlap = (a: { y: number; h: number }, b: { y: number; h: number }) =>
        a.y < b.y + b.h && b.y < a.y + a.h;
      const xOverlap = (a: { x: number; w: number }, b: { x: number; w: number }) =>
        a.x < b.x + b.w && b.x < a.x + a.w;

      for (const e of edges) {
        const src = nodeBoxes[e.source];
        const tgt = nodeBoxes[e.target];
        if (!src || !tgt) continue;
        const bidi = !!(e.markerStart || (e.data as Record<string, unknown>)?.bidirectional);
        const srcCx = src.x + src.w / 2, tgtCx = tgt.x + tgt.w / 2;
        const dx = tgtCx - srcCx, dy = (tgt.y + tgt.h / 2) - (src.y + src.h / 2);
        const sameRow = yOverlap(src, tgt);
        const sameCol = xOverlap(src, tgt);
        const isStraight = (sameRow && !sameCol) || (sameCol && !sameRow);
        const isHorizontal = sameRow ? true : sameCol ? false : Math.abs(dx) >= Math.abs(dy);
        connectors.push({
          srcNodeId: e.source, tgtNodeId: e.target,
          srcBox: src, tgtBox: tgt,
          srcIsL5: nodeLevelMap[e.source] === "L5",
          tgtIsL5: nodeLevelMap[e.target] === "L5",
          isStraight, isHorizontal, bidi,
        });
      }

      // Slide 2 legend bar
      let lg2x = 0.4;
      for (const [lvl, cfg] of Object.entries(LS)) {
        s2.addText("", {
          x: lg2x, y: SLIDE_H - 0.28, w: 0.22, h: 0.22,
          shape: pptx.ShapeType.rect,
          fill: { color: cfg.bg }, line: { color: cfg.border, width: 0.5 },
        });
        s2.addText(lvl, { x: lg2x + 0.28, y: SLIDE_H - 0.28, w: 0.5, h: 0.22, fontSize: 8, color: "64748B", fontFace: FONT_FACE, valign: "middle" });
        lg2x += 0.9;
      }
      s2.addText("── 실선  ▶ 화살표: 진행 방향", {
        x: 4.0, y: SLIDE_H - 0.28, w: 4.0, h: 0.22, fontSize: 7, color: "94A3B8", fontFace: FONT_FACE, valign: "middle",
      });

      /* ═══════════════════════════════════════════
       * SLIDE 3 — Process Flow Sequence
       * ═══════════════════════════════════════════ */
      // Topological sort (Kahn's algorithm)
      const adj: Record<string, string[]> = {};
      const inDeg: Record<string, number> = {};
      for (const n of nodes) { adj[n.id] = []; inDeg[n.id] = 0; }
      for (const e of edges) {
        if (adj[e.source]) adj[e.source].push(e.target);
        if (inDeg[e.target] !== undefined) inDeg[e.target]++;
      }
      const topoQueue: string[] = [];
      for (const [id, deg] of Object.entries(inDeg)) { if (deg === 0) topoQueue.push(id); }
      topoQueue.sort((a, b) => {
        const na = nodeMap.get(a), nb = nodeMap.get(b);
        if (!na || !nb) return 0;
        const la = getLevel(na), lb = getLevel(nb);
        if (la !== lb) return la.localeCompare(lb);
        return na.position.y - nb.position.y;
      });
      const sorted: string[] = [];
      while (topoQueue.length > 0) {
        const curr = topoQueue.shift()!;
        sorted.push(curr);
        for (const next of (adj[curr] || []).sort((a, b) => {
          const na = nodeMap.get(a), nb = nodeMap.get(b);
          return (na?.position.y ?? 0) - (nb?.position.y ?? 0);
        })) {
          inDeg[next]--;
          if (inDeg[next] === 0) topoQueue.push(next);
        }
      }
      for (const n of nodes) { if (!sorted.includes(n.id)) sorted.push(n.id); }

      const s3 = pptx.addSlide();
      s3.background = { color: "FFFFFF" };
      s3.addText("프로세스 흐름 순서", {
        x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
        fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
      });
      s3.addText("토폴로지 정렬 기반 실행 순서 · 번호는 선후행 관계를 반영합니다", {
        x: 0.3, y: 0.5, w: SLIDE_W - 0.6, h: 0.3, fontSize: 9, fontFace: FONT_FACE, color: "94A3B8",
      });

      // Serpentine flow layout (3열 가로 배치)
      const COLS = 3, BW = 3.8, BH = 0.52, GX = 0.28, GY = 0.35, SX = 0.4, SY = 0.95;
      const maxSteps = Math.min(sorted.length, 24);
      for (let i = 0; i < maxSteps; i++) {
        const nd = nodeMap.get(sorted[i]);
        if (!nd) continue;
        const level = getLevel(nd);
        const s = LS[level] || DEF;

        const row = Math.floor(i / COLS);
        const colInRow = i % COLS;
        const isRev = row % 2 === 1;
        const col = isRev ? (COLS - 1 - colInRow) : colInRow;
        const bx = SX + col * (BW + GX);
        const by = SY + row * (BH + GY);

        // Step box with text inside (single object)
        const stepLabel = getLabel(nd);
        const stepText = stepLabel ? `${i + 1}. ${stepLabel}` : `${i + 1}. ${getDisplayId(nd)}`;
        s3.addText(stepText, {
          x: bx, y: by, w: BW, h: BH,
          shape: pptx.ShapeType.rect,
          fill: { color: s.bg },
          line: { color: s.border, width: level === "L5" ? 1.5 : 0.5 },
          fontSize: 10, fontFace: FONT_FACE, bold: true, color: s.text,
          align: "center", valign: "middle",
        });

        // Arrow to next step
        if (i < maxSteps - 1) {
          const nRow = Math.floor((i + 1) / COLS);
          const nColInRow = (i + 1) % COLS;
          const nIsRev = nRow % 2 === 1;
          const nCol = nIsRev ? (COLS - 1 - nColInRow) : nColInRow;

          if (nRow === row) {
            // Same row: horizontal arrow
            if (!isRev) {
              s3.addShape("line", {
                x: bx + BW, y: by + BH / 2, w: GX, h: 0.01,
                line: { color: LIGHT_GRAY, width: 1.0, endArrowType: "triangle" },
              });
            } else {
              const nBx = SX + nCol * (BW + GX);
              s3.addShape("line", {
                x: nBx + BW, y: by + BH / 2, w: GX, h: 0.01, flipH: true,
                line: { color: LIGHT_GRAY, width: 1.0, endArrowType: "triangle" },
              });
            }
          } else {
            // Row transition: vertical down arrow
            s3.addShape("line", {
              x: bx + BW / 2, y: by + BH, w: 0.01, h: GY,
              line: { color: LIGHT_GRAY, width: 1.0, endArrowType: "triangle" },
            });
          }
        }
      }
      if (sorted.length > maxSteps) {
        const lastRow = Math.ceil(maxSteps / COLS);
        s3.addText(`... 외 ${sorted.length - maxSteps}개 단계`, {
          x: SX, y: SY + lastRow * (BH + GY), w: 5, h: 0.35,
          fontSize: 10, color: "94A3B8", fontFace: FONT_FACE,
        });
      }

      /* ═══════════════════════════════════════════
       * SLIDE 4 — Connection Map (Edges Table)
       * ═══════════════════════════════════════════ */
      const s4 = pptx.addSlide();
      s4.background = { color: "FFFFFF" };
      s4.addText("연결 관계 (화살표) 목록", {
        x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
        fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
      });
      s4.addText(`총 ${edges.length}개의 연결 화살표`, {
        x: 0.3, y: 0.5, w: SLIDE_W - 0.6, h: 0.3, fontSize: 9, fontFace: FONT_FACE, color: "94A3B8",
      });

      const hdrOpts = { bold: true as const, color: "FFFFFF", fill: { color: "1E293B" }, fontSize: 9 };
      const connRows: PptxGenJS.TableRow[] = [[
        { text: "#", options: { ...hdrOpts, align: "center" as const } },
        { text: "출발 노드", options: hdrOpts },
        { text: "레벨", options: { ...hdrOpts, align: "center" as const } },
        { text: "→", options: { ...hdrOpts, align: "center" as const } },
        { text: "도착 노드", options: hdrOpts },
        { text: "레벨", options: { ...hdrOpts, align: "center" as const } },
        { text: "라벨", options: hdrOpts },
      ]];
      edges.forEach((edge, idx) => {
        const sn = nodeMap.get(edge.source), tn = nodeMap.get(edge.target);
        const sl = sn ? getLevel(sn) : "?", tl = tn ? getLevel(tn) : "?";
        const ss = LS[sl] || DEF, ts = LS[tl] || DEF;
        const isBidi = !!(edge.markerStart || ((edge.data as Record<string, unknown>)?.bidirectional));
        connRows.push([
          { text: String(idx + 1), options: { fontSize: 8, align: "center" as const, color: "64748B" } },
          { text: sn ? getLabel(sn) : edge.source, options: { fontSize: 8, bold: true as const } },
          { text: sl, options: { fontSize: 8, align: "center" as const, color: ss.text, fill: { color: ss.bg }, bold: true as const } },
          { text: isBidi ? "⇄" : "→", options: { fontSize: 10, align: "center" as const, bold: true as const, color: isBidi ? "A62121" : "D95578" } },
          { text: tn ? getLabel(tn) : edge.target, options: { fontSize: 8, bold: true as const } },
          { text: tl, options: { fontSize: 8, align: "center" as const, color: ts.text, fill: { color: ts.bg }, bold: true as const } },
          { text: edge.label ? String(edge.label) : "", options: { fontSize: 8, color: "64748B", italic: true as const } },
        ]);
      });
      s4.addTable(connRows, {
        x: 0.3, y: 0.9, w: SLIDE_W - 0.6,
        colW: [0.4, 3.5, 0.7, 0.4, 3.5, 0.7, 3.0],
        border: { pt: 0.5, color: "E2E8F0" }, rowH: 0.32,
        autoPage: true, autoPageRepeatHeader: true,
      });

      /* ═══════════════════════════════════════════
       * SLIDE 5 — Node Details Table
       * ═══════════════════════════════════════════ */
      const s5 = pptx.addSlide();
      s5.background = { color: "FFFFFF" };
      s5.addText("노드 상세 목록", {
        x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
        fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
      });
      const nhdr = { bold: true as const, color: "FFFFFF", fill: { color: "1E293B" }, fontSize: 9 };
      const nodeRows: PptxGenJS.TableRow[] = [[
        { text: "Level", options: { ...nhdr, align: "center" as const } },
        { text: "ID", options: nhdr },
        { text: "이름", options: nhdr },
        { text: "설명", options: nhdr },
        { text: "In/Out", options: { ...nhdr, align: "center" as const } },
      ]];
      const sortedN = [...nodes].sort((a, b) => {
        const la = getLevel(a), lb = getLevel(b);
        return la.localeCompare(lb) || a.id.localeCompare(b.id, undefined, { numeric: true });
      });
      for (const nd of sortedN) {
        const level = getLevel(nd);
        const s = LS[level] || DEF;
        const inE = edges.filter((e) => e.target === nd.id).length;
        const outE = edges.filter((e) => e.source === nd.id).length;
        nodeRows.push([
          { text: level, options: { fontSize: 9, color: s.text, fill: { color: s.bg }, align: "center" as const, bold: true as const } },
          { text: getId(nd), options: { fontSize: 8, color: "374151" } },
          { text: getLabel(nd), options: { fontSize: 9, bold: true as const } },
          { text: getDesc(nd), options: { fontSize: 8, color: "6B7280" } },
          { text: `↓${inE}  ↑${outE}`, options: { fontSize: 8, color: "64748B", align: "center" as const } },
        ]);
      }
      s5.addTable(nodeRows, {
        x: 0.3, y: 0.65, w: SLIDE_W - 0.6,
        colW: [0.7, 1.4, 3.2, 6.0, 1.3],
        border: { pt: 0.5, color: "E2E8F0" }, rowH: 0.32,
        autoPage: true, autoPageRepeatHeader: true,
      });

      /* ═══════════════════════════════════════════
       * SLIDE 6 — Node Metadata (메모 · 수행주체 · I/O · 시스템)
       * ═══════════════════════════════════════════ */
      const nodesWithMeta = sortedN.filter((nd) => {
        const m = getMeta(nd);
        return m.memo || m.role || m.inputData || m.outputData || m.system;
      });
      if (nodesWithMeta.length > 0) {
        const s6 = pptx.addSlide();
        s6.background = { color: "FFFFFF" };
        s6.addText("노드 메타 정보 (메모 · 수행주체 · I/O · 시스템)", {
          x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
          fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
        });
        s6.addText(`메타데이터가 입력된 ${nodesWithMeta.length}개 노드`, {
          x: 0.3, y: 0.5, w: SLIDE_W - 0.6, h: 0.3, fontSize: 9, fontFace: FONT_FACE, color: "94A3B8",
        });

        const mhdr = { bold: true as const, color: "FFFFFF", fill: { color: "A62121" }, fontSize: 8 };
        const metaRows: PptxGenJS.TableRow[] = [[
          { text: "Level", options: { ...mhdr, align: "center" as const } },
          { text: "이름", options: mhdr },
          { text: "수행 주체", options: { ...mhdr, align: "center" as const } },
          { text: "Input Data", options: mhdr },
          { text: "Output Data", options: mhdr },
          { text: "시스템/툴", options: mhdr },
          { text: "메모", options: mhdr },
        ]];
        for (const nd of nodesWithMeta) {
          const level = getLevel(nd);
          const s = LS[level] || DEF;
          const m = getMeta(nd);
          metaRows.push([
            { text: level, options: { fontSize: 8, color: s.text, fill: { color: s.bg }, align: "center" as const, bold: true as const } },
            { text: getLabel(nd), options: { fontSize: 8, bold: true as const } },
            { text: m.role, options: { fontSize: 8, color: "374151", align: "center" as const } },
            { text: m.inputData, options: { fontSize: 7.5, color: "059669" } },
            { text: m.outputData, options: { fontSize: 7.5, color: "DC2626" } },
            { text: m.system, options: { fontSize: 7.5, color: "7C3AED" } },
            { text: m.memo, options: { fontSize: 7.5, color: "6B7280", italic: true as const } },
          ]);
        }
        s6.addTable(metaRows, {
          x: 0.3, y: 0.9, w: SLIDE_W - 0.6,
          colW: [0.6, 2.2, 1.2, 2.1, 2.1, 1.8, 3.3],
          border: { pt: 0.5, color: "E2E8F0" }, rowH: 0.35,
          autoPage: true, autoPageRepeatHeader: true,
        });
      }

      // ── JSZip 후처리: 진짜 <p:cxnSp> 커넥터 주입 ──────────────────────────
      const EMU = 914400;
      const pptxBlob = await pptx.write({ outputType: "blob" }) as Blob;
      const zip = await JSZip.loadAsync(pptxBlob);

      const slide2Path = "ppt/slides/slide2.xml";
      const slide2Xml = await zip.file(slide2Path)?.async("string");
      if (slide2Xml && connectors.length > 0) {
        // shape ID ↔ nodeId 매핑 (EMU 좌표로 매칭)
        const shapeIdMap: Record<string, string> = {};   // nodeId → cNvPr id
        let maxShapeId = 0;

        const spBlocks = slide2Xml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
        for (const block of spBlocks) {
          const idMatch = block.match(/<p:cNvPr\s[^>]*?id="(\d+)"/);
          if (!idMatch) continue;
          const sid = parseInt(idMatch[1]);
          if (sid > maxShapeId) maxShapeId = sid;

          const offBlock = block.match(/<a:off\s([^>]*)\/?>/)
          if (!offBlock) continue;
          const xm = offBlock[1].match(/x="(\d+)"/);
          const ym = offBlock[1].match(/y="(\d+)"/);
          if (!xm || !ym) continue;
          const xEmu = parseInt(xm[1]), yEmu = parseInt(ym[1]);
          const tol = Math.round(EMU * 0.02);

          for (const [nid, box] of Object.entries(nodeBoxes)) {
            if (shapeIdMap[nid]) continue;
            const ex = Math.round(box.x * EMU), ey = Math.round(box.y * EMU);
            if (Math.abs(xEmu - ex) < tol && Math.abs(yEmu - ey) < tol) {
              shapeIdMap[nid] = idMatch[1];
              break;
            }
          }
        }

        // 커넥터 XML 생성
        let cxnXml = "";
        let nextId = maxShapeId + 1;
        for (const c of connectors) {
          const srcSid = shapeIdMap[c.srcNodeId];
          const tgtSid = shapeIdMap[c.tgtNodeId];
          if (!srcSid || !tgtSid) continue;

          const src = c.srcBox, tgt = c.tgtBox;
          // L5: stCxn이 위쪽 박스를 참조하므로 위쪽 박스 중앙 Y 사용
          let srcConnY = c.srcIsL5 ? src.y + L5_UPPER_H / 2 : src.y + src.h / 2;
          let tgtConnY = c.tgtIsL5 ? tgt.y + L5_UPPER_H / 2 : tgt.y + tgt.h / 2;
          // Y 스냅: 미세한 차이(≤0.08") → 동일 Y (대각선 방지)
          if (Math.abs(srcConnY - tgtConnY) < 0.08) {
            const avgY = (srcConnY + tgtConnY) / 2;
            srcConnY = avgY; tgtConnY = avgY;
          }

          // roundRect 커넥션포인트: idx=3=오른쪽, idx=1=왼쪽
          const stIdx = 3, endIdx = 1;
          const x1 = src.x + src.w;  // source right edge
          const y1 = srcConnY;
          const x2 = tgt.x;          // target left edge
          const y2 = tgtConnY;
          // 같은 행 → 직선, 다른 행 → 꺾인선(bentConnector3)
          const prst = c.isStraight ? "straightConnector1" : "bentConnector3";

          const offX = Math.round(Math.min(x1, x2) * EMU);
          const offY = Math.round(Math.min(y1, y2) * EMU);
          const extCx = Math.max(Math.round(Math.abs(x2 - x1) * EMU), 1);
          const extCy = Math.max(Math.round(Math.abs(y2 - y1) * EMU), 1);
          const flipH = x2 < x1 ? ' flipH="1"' : "";
          const flipV = y2 < y1 ? ' flipV="1"' : "";
          // OOXML: tailEnd = 끝점(target) 화살표, headEnd = 시작점(source) 화살표(양방향)
          const headArrow = c.bidi ? '<a:headEnd type="triangle" w="med" len="med"/>' : "";
          // 엣지 색상: L5↔L5 = 회색(DEDEDE), 나머지 = 검정(333333)
          const isL5Edge = c.srcIsL5 && c.tgtIsL5;
          const lineClr = isL5Edge ? "DEDEDE" : "333333";

          cxnXml += `<p:cxnSp><p:nvCxnSpPr>`
            + `<p:cNvPr id="${nextId}" name="Connector ${nextId}"/>`
            + `<p:cNvCxnSpPr>`
            + `<a:stCxn id="${srcSid}" idx="${stIdx}"/>`
            + `<a:endCxn id="${tgtSid}" idx="${endIdx}"/>`
            + `</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr>`
            + `<p:spPr>`
            + `<a:xfrm${flipH}${flipV}>`
            + `<a:off x="${offX}" y="${offY}"/>`
            + `<a:ext cx="${extCx}" cy="${extCy}"/>`
            + `</a:xfrm>`
            + `<a:prstGeom prst="${prst}"><a:avLst>${prst === "bentConnector3" ? '<a:gd name="adj1" fmla="val 50000"/>' : ""}</a:avLst></a:prstGeom>`
            + `<a:ln w="6350">`
            + `<a:solidFill><a:srgbClr val="${lineClr}"/></a:solidFill>`
            + headArrow
            + `<a:tailEnd type="triangle" w="med" len="med"/>`
            + `</a:ln></p:spPr></p:cxnSp>`;
          nextId++;
        }

        if (cxnXml) {
          const modified = slide2Xml.replace("</p:spTree>", cxnXml + "</p:spTree>");
          zip.file(slide2Path, modified);
        }
      }

      // 다운로드
      const finalBlob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hr-workflow-${Date.now()}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PPT export error:", err);
      alert("PPT 내보내기에 실패했습니다.");
    } finally {
      isExporting.current = false;
    }
  }, [nodes, edges]);

  /* ═══ PPT Export — All Sheets (다이어그램만) ═══ */
  const handleExportAllPPT = useCallback(async () => {
    if (isExporting.current) return;

    // 모든 시트 데이터 수집 (현재 활성 시트는 live state 사용)
    const allSheetsData = (sheets || []).map((sheet) => {
      const sd =
        sheet.id === activeSheetId
          ? { nodes, edges }
          : getSheetData
          ? getSheetData(sheet.id)
          : { nodes: [], edges: [] };
      return { sheet, nodes: sd.nodes, edges: sd.edges };
    });

    if (allSheetsData.length === 0) {
      allSheetsData.push({
        sheet: { id: "sheet-1", name: "시트 1", type: "blank" as const },
        nodes,
        edges,
      });
    }

    const validSheets = allSheetsData.filter((d) => d.nodes.length > 0);
    if (validSheets.length === 0) {
      alert("저장할 노드가 있는 시트가 없습니다.");
      return;
    }

    isExporting.current = true;
    try {
      const pptx = new PptxGenJS();
      pptx.author = "HR Workflow Builder";
      pptx.title = "HR Workflow";
      pptx.subject = "As-is 프로세스 워크플로우";
      pptx.layout = "LAYOUT_WIDE"; // 13.33" x 7.5"
      const SLIDE_W = 13.33;
      const SLIDE_H = 7.5;

      const LIGHT_GRAY = "DEDEDE";
      const FONT_FACE = "Noto Sans KR";

      const LS: Record<
        string,
        { bg: string; border: string; text: string; fontSize: number; pxW: number; pxH: number; pptW: number; pptH: number }
      > = {
        L2: { bg: "A62121", border: "A62121", text: "FFFFFF", fontSize: 12, pxW: 720, pxH: 260, pptW: 1.90, pptH: 0.68 },
        L3: { bg: "D95578", border: "D95578", text: "FFFFFF", fontSize: 12, pxW: 660, pxH: 240, pptW: 1.73, pptH: 0.63 },
        L4: { bg: LIGHT_GRAY, border: LIGHT_GRAY, text: "000000", fontSize: 12, pxW: 600, pxH: 220, pptW: 1.58, pptH: 0.58 },
        L5: { bg: "FFFFFF", border: LIGHT_GRAY, text: "000000", fontSize: 9, pxW: 540, pxH: 389, pptW: 1.24, pptH: 0.894 },
      };
      /* L5 2-box 고정 치수 (인치) — 스케일링 무시, 항상 이 크기 */
      const L5_FIXED_W_ALL  = 1.240;  // 3.15cm
      const L5_UPPER_H_ALL  = 0.685;  // 1.74cm
      const L5_LOWER_H_ALL  = 0.213;  // 0.54cm
      const L5_GAP_ALL      = 0.020;  // 0.05cm
      const L5_FIXED_H_ALL  = L5_UPPER_H_ALL + L5_GAP_ALL + L5_LOWER_H_ALL; // 0.918"
      const DEF = LS.L4;
      const getLevel = (n: Node) => (n.data as Record<string, string>).level || "L4";
      const getLabel = (n: Node) => (n.data as Record<string, string>).label || "";
      const getId = (n: Node) => (n.data as Record<string, string>).id || n.id;
      const getDisplayId = (n: Node) => {
        const raw = getId(n);
        return raw.replace(/^[Ll]\d[-_.\s]*/g, "").trim() || raw;
      };

      /* ── 타이틀 슬라이드 ── */
      const totalNodes = validSheets.reduce((a, d) => a + d.nodes.length, 0);
      const totalEdges = validSheets.reduce((a, d) => a + d.edges.length, 0);

      const s1 = pptx.addSlide();
      s1.background = { color: "0F172A" };
      s1.addText("HR Workflow", {
        x: 1, y: 1.5, w: 11.33, h: 1.2,
        fontSize: 44, fontFace: FONT_FACE, color: "FFFFFF", bold: true, align: "center",
      });
      s1.addText(
        `시트 ${validSheets.length}개  ·  노드 ${totalNodes}개  ·  연결 ${totalEdges}개  ·  ${new Date().toLocaleDateString("ko-KR")}`,
        { x: 1, y: 2.9, w: 11.33, h: 0.5, fontSize: 13, fontFace: FONT_FACE, color: "64748B", align: "center" },
      );
      // 시트 목록
      let listY = 3.7;
      for (const { sheet, nodes: sn } of validSheets) {
        const tag = sheet.type === "swimlane" ? " (수영레인)" : "";
        s1.addText(`• ${sheet.name}${tag}  —  노드 ${sn.length}개`, {
          x: 3.5, y: listY, w: 6.33, h: 0.3,
          fontSize: 12, fontFace: FONT_FACE, color: "CBD5E1", align: "center",
        });
        listY += 0.33;
      }
      // 레벨 범례
      let lx = 3.2;
      for (const [lvl, cfg] of Object.entries(LS)) {
        s1.addText(lvl, {
          x: lx, y: Math.max(listY + 0.2, 5.8), w: 1.3, h: 0.38,
          shape: pptx.ShapeType.rect,
          fill: { color: cfg.bg }, line: { color: cfg.border, width: 1 },
          fontSize: 11, fontFace: FONT_FACE, color: cfg.text, bold: true, align: "center", valign: "middle",
        });
        lx += 1.7;
      }

      /* ── 시트별 다이어그램 슬라이드 ── */
      const SWIM_COLORS = [
        { fill: "F5F5F5", border: "C0C0C0" },
        { fill: "FFFFFF", border: "C0C0C0" },
        { fill: "F5F5F5", border: "C0C0C0" },
        { fill: "FFFFFF", border: "C0C0C0" },
      ];
      const SWIM_LABEL_W = 0.45;

      // 슬라이드별 커넥터 메타 수집
      const allSlideConnectors: {
        slideIndex: number;
        connectors: { srcNodeId: string; tgtNodeId: string; srcBox: { x: number; y: number; w: number; h: number }; tgtBox: { x: number; y: number; w: number; h: number }; srcIsL5: boolean; tgtIsL5: boolean; isStraight: boolean; isHorizontal: boolean; bidi: boolean }[];
        nodeBoxes: Record<string, { x: number; y: number; w: number; h: number }>;
      }[] = [];
      let slideIdx = 2; // slide1=타이틀, slide2부터 시트

      for (const { sheet, nodes: sNodes, edges: sEdges } of validSheets) {
        const slide = pptx.addSlide();
        slide.background = { color: "F8FAFC" };

        // 수영레인 설정
        const isSwimLane = sheet.type === "swimlane";
        const swimLanes = sheet.lanes || ["임원", "팀장", "HR 담당자", "구성원"];

        // bbox 기반 좌표 변환
        let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
        for (const nd of sNodes) {
          const s = LS[getLevel(nd)] || DEF;
          bMinX = Math.min(bMinX, nd.position.x);
          bMinY = Math.min(bMinY, nd.position.y);
          bMaxX = Math.max(bMaxX, nd.position.x + s.pxW);
          bMaxY = Math.max(bMaxY, nd.position.y + s.pxH);
        }
        const bRangeX = (bMaxX - bMinX) || 1;
        const bRangeY = (bMaxY - bMinY) || 1;

        const sPadX = isSwimLane ? 1.25 : 0.4; // 레이블 박스(1.05") 뒤로 밀기
        const sPadTop = 1.575; // 4cm 상단 여백
        const sPadBottom = 0.35;
        // 수영레인 밴드 상수
        const SWIM_BAND_H_S = 1.535; // 3.9cm per lane (기본 균등 높이)
        const SL_BOTTOM_S = SLIDE_H - sPadBottom + 0.05;
        const SL_TOP_S = SL_BOTTOM_S - SWIM_BAND_H_S * swimLanes.length;
        const TOTAL_SWIM_H_S = SWIM_BAND_H_S * swimLanes.length;

        // ── 동적 레인 높이: 2행 레인에 더 많은 공간 배분 ──
        const dynLH_S: number[] = swimLanes.map(() => SWIM_BAND_H_S);
        const dynLT_S: number[] = [];
        if (isSwimLane) {
          const CL_H_S = 600;
          const lrc: number[] = [];
          for (let li = 0; li < swimLanes.length; li++) {
            const ys: number[] = [];
            for (const nd of sNodes) {
              const idx = Math.min(Math.max(Math.floor(nd.position.y / CL_H_S), 0), swimLanes.length - 1);
              if (idx === li) ys.push(nd.position.y);
            }
            ys.sort((a, b) => a - b);
            let rows = 0, lastY = -Infinity;
            for (const y of ys) { if (y - lastY > 50) { rows++; lastY = y; } }
            lrc.push(Math.max(rows, 1));
          }
          const tw = lrc.reduce((s, c) => s + c, 0);
          const MN = 0.7;
          for (let i = 0; i < swimLanes.length; i++) dynLH_S[i] = Math.max(TOTAL_SWIM_H_S * lrc[i] / tw, MN);
          const hs = dynLH_S.reduce((s, h) => s + h, 0);
          for (let i = 0; i < dynLH_S.length; i++) dynLH_S[i] *= TOTAL_SWIM_H_S / hs;
        }
        { let ct = SL_TOP_S; for (let i = 0; i < swimLanes.length; i++) { dynLT_S.push(ct); ct += dynLH_S[i]; } }

        const sAreaW = SLIDE_W - 2 * sPadX;
        const sAreaH = SLIDE_H - sPadTop - sPadBottom;
        const scFit = Math.min(sAreaW / bRangeX, sAreaH / bRangeY);
        // 기준 스케일: L4 노드 세로 2cm(0.787") 기준
        const scRef = 0.787 / DEF.pxH;
        const scRatio = Math.min(scFit, scRef);

        const toPpt = (rfX: number, rfY: number) => ({
          x: sPadX + (rfX - bMinX) * scRatio,
          y: sPadTop + (rfY - bMinY) * scRatio,
        });

        const NODE_FONT_SIZE_S = 12; // 노드 폰트 12pt 고정

        // 슬라이드 제목: 자식 레벨 존재 + 단일 부모 → 부모 정보 + 부모 레벨 프로세스 맵
        const sLevelOrder = ["L2", "L3", "L4", "L5"];
        let sheetSlideTitle = sheet.name;
        {
          const lc: Record<string, number> = {};
          const lf: Record<string, Node> = {};
          for (const nd of sNodes) {
            const lv = getLevel(nd);
            lc[lv] = (lc[lv] || 0) + 1;
            if (!lf[lv]) lf[lv] = nd;
          }
          let found = false;
          for (let i = sLevelOrder.length - 1; i >= 1 && !found; i--) {
            const childLv = sLevelOrder[i];
            const parentLv = sLevelOrder[i - 1];
            if ((lc[childLv] || 0) > 0 && (lc[parentLv] || 0) === 1) {
              const nd = lf[parentLv];
              const label = getLabel(nd);
              const dispId = getDisplayId(nd);
              sheetSlideTitle = label ? `${dispId} ${label} — ${parentLv} 프로세스 맵` : `${dispId} — ${parentLv} 프로세스 맵`;
              found = true;
            }
          }
          if (!found) {
            for (const lv of sLevelOrder) {
              if (lf[lv]) {
                const nd = lf[lv];
                const label = getLabel(nd);
                const dispId = getDisplayId(nd);
                sheetSlideTitle = label ? `${dispId} ${label} — ${lv} 프로세스 맵` : `${dispId} — ${lv} 프로세스 맵`;
                break;
              }
            }
          }
        }
        slide.addText(sheetSlideTitle, {
          x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
          fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
        });

        // 수영레인 배경: 동적 높이 기반
        if (isSwimLane) {
          let ly = SL_TOP_S;
          for (let i = 0; i <= swimLanes.length; i++) {
            slide.addShape("line", {
              x: 0, y: ly, w: SLIDE_W, h: 0,
              line: { color: "B0B0B0", width: 0.75, dashType: "dash" },
            });
            if (i < swimLanes.length) ly += dynLH_S[i];
          }
          const LBL_BOX_W_S = 1.05;
          const LBL_BOX_H_S = 0.26;
          for (let i = 0; i < swimLanes.length; i++) {
            const labelY = dynLT_S[i] + 0.06;
            slide.addText(swimLanes[i], {
              x: 0.04, y: labelY, w: LBL_BOX_W_S, h: LBL_BOX_H_S,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFFFFF" },
              line: { color: "B0B0B0", width: 0.5 },
              fontSize: 9, fontFace: FONT_FACE, color: "333333",
              align: "center", valign: "middle",
            });
          }
        }

        // ── Phase 1: raw PPT 위치 ──────────────────────────────────────────────
        const sRawPos: Record<string, { rfX: number; rfY: number; w: number; h: number }> = {};
        for (const nd of sNodes) {
          const sv = LS[getLevel(nd)] || DEF;
          const isL5 = getLevel(nd) === "L5";
          sRawPos[nd.id] = {
            rfX: nd.position.x, rfY: nd.position.y,
            w: isL5 ? L5_FIXED_W_ALL : sv.pxW * scRatio,
            h: isL5 ? L5_FIXED_H_ALL : sv.pxH * scRatio,
          };
        }

        // ── Phase 2: 컬럼 정규화 (X스냅 + 세로 등간격) ─────────────────────────
        const sColVis = new Set<string>();
        const sColGrps: string[][] = [];
        for (const id of Object.keys(sRawPos).sort((a, b) => sRawPos[a].rfX - sRawPos[b].rfX)) {
          if (sColVis.has(id)) continue;
          const grp = [id]; sColVis.add(id);
          for (const id2 of Object.keys(sRawPos)) {
            if (!sColVis.has(id2) && Math.abs(sRawPos[id2].rfX - sRawPos[id].rfX) <= 60) {
              grp.push(id2); sColVis.add(id2);
            }
          }
          sColGrps.push(grp);
        }
        const nodeBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
        for (const grp of sColGrps) {
          grp.sort((a, b) => sRawPos[a].rfY - sRawPos[b].rfY);
          const sSnapX = sPadX + (Math.min(...grp.map(id => sRawPos[id].rfX)) - bMinX) * scRatio;
          const sY0 = sPadTop + (sRawPos[grp[0]].rfY - bMinY) * scRatio;
          if (grp.length === 1) {
            nodeBoxes[grp[0]] = { x: sSnapX, y: sY0, w: sRawPos[grp[0]].w, h: sRawPos[grp[0]].h };
          } else {
            const lastId = grp[grp.length - 1];
            const yLast = sPadTop + (sRawPos[lastId].rfY - bMinY) * scRatio;
            const span = yLast + sRawPos[lastId].h - sY0;
            const sumH = grp.reduce((acc, id) => acc + sRawPos[id].h, 0);
            const gap = Math.max((span - sumH) / (grp.length - 1), 0.06);
            let curY = sY0;
            for (const id of grp) {
              nodeBoxes[id] = { x: sSnapX, y: curY, w: sRawPos[id].w, h: sRawPos[id].h };
              curY += sRawPos[id].h + gap;
            }
          }
        }

        // ── Phase 2.5: Cross-column Y 정렬 (수영레인 모드에서는 스킵) ──
        if (!isSwimLane) {
        for (const grp of sColGrps) {
          if (grp.length !== 1) continue;
          const nid = grp[0];
          const box = nodeBoxes[nid];
          if (!box) continue;
          const connCenterYs: number[] = [];
          for (const e of sEdges) {
            const cid = e.target === nid ? e.source : e.source === nid ? e.target : null;
            if (!cid) continue;
            const cb = nodeBoxes[cid];
            if (cb && Math.abs(cb.x - box.x) > 0.3) connCenterYs.push(cb.y + cb.h / 2);
          }
          if (connCenterYs.length === 0) continue;
          connCenterYs.sort((a, b) => a - b);
          const medianCy = connCenterYs[Math.floor(connCenterYs.length / 2)];
          const newY = medianCy - box.h / 2;
          box.y = Math.max(sPadTop, Math.min(newY, SLIDE_H - 0.35 - box.h));
        }
        } // end if(!isSwimLane)

        // ── Phase 2.6: 수영레인 Y좌표 — 캔버스 비례 매핑 + 동적 레인 높이 ──
        if (isSwimLane) {
          const CANVAS_LANE_H = 600;
          const laneMap2: Record<number, string[]> = {};
          for (const nd of sNodes) {
            const box = nodeBoxes[nd.id];
            if (!box) continue;
            const rfY = nd.position.y;
            const laneIdx = Math.min(Math.max(Math.floor(rfY / CANVAS_LANE_H), 0), swimLanes.length - 1);
            if (!laneMap2[laneIdx]) laneMap2[laneIdx] = [];
            laneMap2[laneIdx].push(nd.id);
          }
          for (const [li, ids] of Object.entries(laneMap2)) {
            const laneIdx = Number(li);
            const laneTop = dynLT_S[laneIdx];
            const laneH = dynLH_S[laneIdx];
            const pad = 0.06;
            const items = ids.map(id => {
              const nd = sNodes.find(n => n.id === id)!;
              return { id, rfY: nd.position.y, h: nodeBoxes[id].h };
            });
            const rfYMin = Math.min(...items.map(c => c.rfY));
            const rfYMax = Math.max(...items.map(c => c.rfY));
            const rfSpan = rfYMax - rfYMin;
            if (rfSpan < 50) {
              // 같은 행: L5/비-L5 커넥터 Y 일치 스냅
              const l5Items = items.filter(c => {
                const nd = sNodes.find(n => n.id === c.id)!;
                return getLevel(nd) === "L5";
              });
              const otherItems = items.filter(c => {
                const nd = sNodes.find(n => n.id === c.id)!;
                return getLevel(nd) !== "L5";
              });
              for (const { id, h } of l5Items) {
                nodeBoxes[id].y = laneTop + (laneH - h) / 2;
              }
              if (l5Items.length > 0 && otherItems.length > 0) {
                const l5Y0 = nodeBoxes[l5Items[0].id].y;
                const l5ConnY = l5Y0 + L5_UPPER_H_ALL / 2;
                for (const { id, h } of otherItems) {
                  nodeBoxes[id].y = l5ConnY - h / 2;
                }
              } else {
                for (const { id, h } of otherItems) {
                  nodeBoxes[id].y = laneTop + (laneH - h) / 2;
                }
              }
            } else {
              const maxH = Math.max(...items.map(c => c.h));
              const availSpan = laneH - 2 * pad - maxH;
              for (const { id, rfY, h } of items) {
                const ratio = (rfY - rfYMin) / rfSpan;
                nodeBoxes[id].y = laneTop + pad + ratio * Math.max(availSpan, 0);
              }
            }
          }
        }

        // ── Phase 3: 노드 그리기 ─────────────────────────────────────────────
        for (const nd of sNodes) {
          const level = getLevel(nd);
          const sv = LS[level] || DEF;
          const box = nodeBoxes[nd.id];
          if (!box) continue;
          const dispLabel = getLabel(nd);
          const dispId = getDisplayId(nd);

          if (level === "L5") {
            /* ── L5 전용 2-box: 고정 치수 (3.15cm×1.74cm + 0.05cm + 0.54cm) ── */
            slide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
              x: box.x, y: box.y, w: L5_FIXED_W_ALL, h: L5_UPPER_H_ALL,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFFFFF" },
              line: { color: "DEDEDE", width: 0.25 },
              fontSize: 9, bold: true, color: "000000",
              fontFace: FONT_FACE, valign: "middle", align: "center",
            });
            const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
            const sysStr = (nd.data as Record<string, string>).system || "";
            let sysName = "시스템명";
            if (sysStr) {
              sysName = sysStr;
            } else if (sysMap) {
              const SYS_KEYS = [
                { key: "hr", label: "HR시스템" }, { key: "groupware", label: "그룹웨어" },
                { key: "office", label: "오피스" }, { key: "manual", label: "수작업" }, { key: "etc", label: "기타툴" },
              ];
              const active = SYS_KEYS.filter(k => sysMap[k.key]?.trim());
              if (active.length > 0) sysName = active.map(k => k.label).join(", ");
            }
            // 아래쪽 박스: DEDEDE 채우기, 선 없음
            slide.addText(sysName, {
              x: box.x, y: box.y + L5_UPPER_H_ALL + L5_GAP_ALL, w: L5_FIXED_W_ALL, h: L5_LOWER_H_ALL,
              shape: pptx.ShapeType.rect,
              fill: { color: "DEDEDE" },
              line: { width: 0 },
              fontSize: 7, bold: false, color: "000000",
              fontFace: FONT_FACE, valign: "middle", align: "center",
            });
          } else {
            /* ── L2~L4: 기존 단일 박스 ── */
            slide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
              x: box.x, y: box.y, w: box.w, h: box.h,
              shape: pptx.ShapeType.rect,
              fill: { color: sv.bg },
              line: { color: sv.border, width: 0.25 },
              fontSize: NODE_FONT_SIZE_S, bold: true, color: sv.text,
              fontFace: FONT_FACE, valign: "middle", align: "center",
            });
            const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
            if (sysMap) {
              const SYS_KEYS: { key: string; label: string }[] = [
                { key: "hr", label: "HR시스템" }, { key: "groupware", label: "그룹웨어" },
                { key: "office", label: "오피스" }, { key: "manual", label: "수작업" }, { key: "etc", label: "기타툴" },
              ];
              const activeSys = SYS_KEYS.filter(k => sysMap[k.key]?.trim());
              if (activeSys.length > 0) {
                slide.addText(activeSys.map(k => `🖥 ${k.label}`).join("  "), {
                  x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2,
                  fontSize: Math.max(NODE_FONT_SIZE_S - 2, 6), color: sv.bg,
                  fontFace: FONT_FACE, align: "center", bold: true,
                });
              }
            }
          }
        }

        // ── Phase 4: 엣지 메타 수집 (JSZip 후처리에서 진짜 커넥터로) ─────
        {
          interface CxnMeta {
            srcNodeId: string; tgtNodeId: string;
            srcBox: { x: number; y: number; w: number; h: number };
            tgtBox: { x: number; y: number; w: number; h: number };
            srcIsL5: boolean; tgtIsL5: boolean;
            isStraight: boolean; isHorizontal: boolean; bidi: boolean;
          }
          const yOverlap = (a: { y: number; h: number }, b: { y: number; h: number }) =>
            a.y < b.y + b.h && b.y < a.y + a.h;
          const xOverlap = (a: { x: number; w: number }, b: { x: number; w: number }) =>
            a.x < b.x + b.w && b.x < a.x + a.w;

          const sheetConnectors: CxnMeta[] = [];
          for (const e of sEdges) {
            const src = nodeBoxes[e.source];
            const tgt = nodeBoxes[e.target];
            if (!src || !tgt) continue;
            const bidi = !!(e.markerStart || (e.data as Record<string, unknown>)?.bidirectional);
            const srcCx = src.x + src.w / 2, tgtCx = tgt.x + tgt.w / 2;
            const dx = tgtCx - srcCx, dy = (tgt.y + tgt.h / 2) - (src.y + src.h / 2);
            const sameRow = yOverlap(src, tgt);
            const sameCol = xOverlap(src, tgt);
            const isStraight = (sameRow && !sameCol) || (sameCol && !sameRow);
            const isHorizontal = sameRow ? true : sameCol ? false : Math.abs(dx) >= Math.abs(dy);
            const srcNd = sNodes.find(n => n.id === e.source);
            const tgtNd = sNodes.find(n => n.id === e.target);
            sheetConnectors.push({
              srcNodeId: e.source, tgtNodeId: e.target, srcBox: src, tgtBox: tgt,
              srcIsL5: srcNd ? getLevel(srcNd) === "L5" : false,
              tgtIsL5: tgtNd ? getLevel(tgtNd) === "L5" : false,
              isStraight, isHorizontal, bidi,
            });
          }
          allSlideConnectors.push({ slideIndex: slideIdx, connectors: sheetConnectors, nodeBoxes: { ...nodeBoxes } });
          slideIdx++;
        }

        // 레벨 범례 바
        let lgx = 0.4;
        for (const [lvl, cfg] of Object.entries(LS)) {
          slide.addText("", {
            x: lgx, y: SLIDE_H - 0.28, w: 0.22, h: 0.22,
            shape: pptx.ShapeType.rect,
            fill: { color: cfg.bg }, line: { color: cfg.border, width: 0.5 },
          });
          slide.addText(lvl, { x: lgx + 0.28, y: SLIDE_H - 0.28, w: 0.5, h: 0.22, fontSize: 8, color: "64748B", fontFace: FONT_FACE, valign: "middle" });
          lgx += 0.9;
        }
      }

      // ── JSZip 후처리: 각 시트 슬라이드에 진짜 <p:cxnSp> 커넥터 주입 ──────
      const EMU = 914400;
      const pptxBlob = await pptx.write({ outputType: "blob" }) as Blob;
      const zip = await JSZip.loadAsync(pptxBlob);

      for (const sc of allSlideConnectors) {
        if (sc.connectors.length === 0) continue;
        const slidePath = `ppt/slides/slide${sc.slideIndex}.xml`;
        const slideXml = await zip.file(slidePath)?.async("string");
        if (!slideXml) continue;

        // shape ID ↔ nodeId 매핑 (EMU 좌표 매칭)
        const shapeIdMap: Record<string, string> = {};
        let maxShapeId = 0;
        const spBlocks = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
        for (const block of spBlocks) {
          const idMatch = block.match(/<p:cNvPr\s[^>]*?id="(\d+)"/);
          if (!idMatch) continue;
          const sid = parseInt(idMatch[1]);
          if (sid > maxShapeId) maxShapeId = sid;
          const offBlock = block.match(/<a:off\s([^>]*)\/?>/)
          if (!offBlock) continue;
          const xm = offBlock[1].match(/x="(\d+)"/);
          const ym = offBlock[1].match(/y="(\d+)"/);
          if (!xm || !ym) continue;
          const xEmu = parseInt(xm[1]), yEmu = parseInt(ym[1]);
          const tol = Math.round(EMU * 0.02);
          for (const [nid, box] of Object.entries(sc.nodeBoxes)) {
            if (shapeIdMap[nid]) continue;
            if (Math.abs(xEmu - Math.round(box.x * EMU)) < tol && Math.abs(yEmu - Math.round(box.y * EMU)) < tol) {
              shapeIdMap[nid] = idMatch[1];
              break;
            }
          }
        }

        let cxnXml = "";
        let nextId = maxShapeId + 1;
        for (const c of sc.connectors) {
          const srcSid = shapeIdMap[c.srcNodeId], tgtSid = shapeIdMap[c.tgtNodeId];
          if (!srcSid || !tgtSid) continue;
          const src = c.srcBox, tgt = c.tgtBox;
          let srcConnY2 = c.srcIsL5 ? src.y + L5_UPPER_H_ALL / 2 : src.y + src.h / 2;
          let tgtConnY2 = c.tgtIsL5 ? tgt.y + L5_UPPER_H_ALL / 2 : tgt.y + tgt.h / 2;
          if (Math.abs(srcConnY2 - tgtConnY2) < 0.08) {
            const avgY = (srcConnY2 + tgtConnY2) / 2;
            srcConnY2 = avgY; tgtConnY2 = avgY;
          }
          const stIdx = 3, endIdx = 1;
          const x1 = src.x + src.w, y1 = srcConnY2, x2 = tgt.x, y2 = tgtConnY2;
          const prst = c.isStraight ? "straightConnector1" : "bentConnector3";
          const offX = Math.round(Math.min(x1, x2) * EMU), offY = Math.round(Math.min(y1, y2) * EMU);
          const extCx2 = Math.max(Math.round(Math.abs(x2 - x1) * EMU), 1);
          const extCy2 = Math.max(Math.round(Math.abs(y2 - y1) * EMU), 1);
          const flipH2 = x2 < x1 ? ' flipH="1"' : "", flipV2 = y2 < y1 ? ' flipV="1"' : "";
          const headArr2 = c.bidi ? '<a:headEnd type="triangle" w="med" len="med"/>' : "";
          const isL5Edge2 = c.srcIsL5 && c.tgtIsL5;
          const lineClr2 = isL5Edge2 ? "DEDEDE" : "333333";
          cxnXml += `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${nextId}" name="Connector ${nextId}"/><p:cNvCxnSpPr><a:stCxn id="${srcSid}" idx="${stIdx}"/><a:endCxn id="${tgtSid}" idx="${endIdx}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm${flipH2}${flipV2}><a:off x="${offX}" y="${offY}"/><a:ext cx="${extCx2}" cy="${extCy2}"/></a:xfrm><a:prstGeom prst="${prst}"><a:avLst>${prst === "bentConnector3" ? '<a:gd name="adj1" fmla="val 50000"/>' : ""}</a:avLst></a:prstGeom><a:ln w="6350"><a:solidFill><a:srgbClr val="${lineClr2}"/></a:solidFill>${headArr2}<a:tailEnd type="triangle" w="med" len="med"/></a:ln></p:spPr></p:cxnSp>`;
          nextId++;
        }
        if (cxnXml) zip.file(slidePath, slideXml.replace("</p:spTree>", cxnXml + "</p:spTree>"));
      }

      const finalBlob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `hr-workflow-all-${Date.now()}.pptx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PPT export (all sheets) error:", err);
      alert("전체 시트 PPT 내보내기에 실패했습니다.");
    } finally {
      isExporting.current = false;
    }
  }, [nodes, edges, sheets, getSheetData, activeSheetId]);

  return (
    <div className="flex gap-1">
      <button
        onClick={handleExportPNG}
        className="text-[10px] font-medium bg-green-600 text-white rounded px-2 py-1.5 hover:bg-green-700 transition"
        title="PNG 이미지 저장"
      >
        🖼️ PNG
      </button>
      <button
        onClick={handleExportSVG}
        className="text-[10px] font-medium bg-teal-600 text-white rounded px-2 py-1.5 hover:bg-teal-700 transition"
        title="SVG 이미지 저장"
      >
        📐 SVG
      </button>
      <button
        onClick={handleExportPPT}
        className="text-[10px] font-medium bg-orange-500 text-white rounded px-2 py-1.5 hover:bg-orange-600 transition"
        title="현재 시트 PPT 저장 (다이어그램 + 상세 목록)"
      >
        📊 PPT
      </button>
      <button
        onClick={handleExportAllPPT}
        className="text-[10px] font-medium bg-purple-600 text-white rounded px-2 py-1.5 hover:bg-purple-700 transition"
        title="전체 시트 PPT 저장 — 시트 1장당 슬라이드 1장 (다이어그램만)"
      >
        📋 전체 PPT
      </button>
      <button
        onClick={handleSaveJSON}
        className="text-[10px] font-medium bg-blue-600 text-white rounded px-2 py-1.5 hover:bg-blue-700 transition"
        title="JSON 저장"
      >
        💾 저장
      </button>
      <button
        onClick={handleLoadJSON}
        className="text-[10px] font-medium bg-gray-500 text-white rounded px-2 py-1.5 hover:bg-gray-600 transition"
        title="JSON 불러오기"
      >
        📂 불러오기
      </button>
    </div>
  );
}
