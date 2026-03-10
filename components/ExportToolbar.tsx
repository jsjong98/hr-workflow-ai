"use client";

import { useCallback, useRef } from "react";
import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import type { Node, Edge } from "@xyflow/react";
import type { Sheet } from "./SheetTabBar";
import { buildTemplateCsvString, buildMergedCsvString, buildMergedRows, type MergedRow, type CsvRow, extractL2List, extractL3ByL2, extractL4ByL3, extractL5ByL4 } from "@/lib/csvToFlow";

/** CSV 머지 결과를 색상 강조 Excel(.xls) Blob으로 변환
 *  - unchanged: 흰색 / modified: 노란색 / new: 초록색 */
function buildColoredXls(rows: MergedRow[]): Blob {
  const BG: Record<string, string> = {
    new: "#C8E6C9",
    modified: "#FFF9C4",
    unchanged: "#FFFFFF",
  };
  const HEADER = [
    "ID","두산 L2","ID","Name","ID","Name","Description",
    "ID","Name","Description",
    "수행주체_현업 임원","수행주체_HR","수행주체_현업 팀장","수행주체_현업 구성원",
    "관리주체","담당자 수","주 담당자","평균 건당 소요시간","발생 빈도_건수",
    "사용 시스템_HR 전용시스템","사용 시스템_그룹웨어_협업툴","사용 시스템_오피스_문서도구",
    "사용 시스템_수작업_오프라인","사용 시스템_기타 전문 Tool",
    "Pain Point_시간_속도","Pain Point_정확성","Pain Point_반복/수작업",
    "Pain Point_정보_데이터","Pain Point_시스템_도구","Pain Point_의사소통_협업","Pain Point_기타",
    "Input_시스템 데이터","Input_문서_서류","Input_외부 정보","Input_구두_메일 요청","Input_기타",
    "Output_시스템 반영","Output_문서_보고서","Output_커뮤니케이션","Output_의사결정","Output_기타",
    "업무 판단 로직_Rule_based","업무 판단 로직_사람 판단","업무 판단 로직_혼합",
  ];
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="UTF-8"/>` +
    `<style>td,th{border:1px solid #ccc;font-family:"Malgun Gothic",sans-serif;font-size:10px;` +
    `padding:3px 5px;white-space:nowrap;}th{background:#D3D3D3;font-weight:bold;}</style>` +
    `</head><body><table>`;
  html += `<tr>${HEADER.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>`;
  for (const row of rows) {
    const bg = BG[row.status] ?? "#FFFFFF";
    html += `<tr style="background-color:${bg};">`;
    html += row.cols.map((c) => `<td>${esc(c)}</td>`).join("");
    html += "</tr>";
  }
  html += "</table></body></html>";
  return new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
}

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
  /** CSV raw rows for batch PPT generation */
  csvRows?: CsvRow[];
}

export default function ExportToolbar({
  nodes,
  edges,
  reactFlowWrapper,
  sheets,
  getSheetData,
  activeSheetId,
  csvRows,
}: ExportToolbarProps) {
  const isExporting = useRef(false);

  /* ═══ JSON Save (multi-sheet aware) ═══ */
  const handleSaveJSON = useCallback(() => {
    if (sheets && getSheetData && activeSheetId) {
      /* Multi-sheet format */
      const sheetPayloads = sheets.map((s) => {
        // 현재 활성 시트는 라이브 상태(nodes/edges) 직접 사용, 나머지는 sheetDataRef
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
          if (data.version === "2.0" && Array.isArray(data.sheets)) {
            /* v2.0 멀티시트 포맷 */
            window.dispatchEvent(
              new CustomEvent("loadWorkflow", { detail: { sheets: data.sheets } })
            );
          } else if (data.nodes && data.edges) {
            /* v1.0 레거시 단일시트 포맷 */
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
      const DECISION_W = 1.240;  // 3.15cm
      const DECISION_H = 0.433;  // 1.1cm
      const MEMO_W = 1.5;   // ~3.8cm
      const MEMO_H = 0.5;   // ~1.27cm
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
        const lvAll: Record<string, Node[]> = {};
        for (const nd of nodes) {
          const lv = getLevel(nd);
          if (lv === "DECISION") continue;
          lvCounts[lv] = (lvCounts[lv] || 0) + 1;
          if (!lvFirst[lv]) lvFirst[lv] = nd;
          if (!lvAll[lv]) lvAll[lv] = [];
          lvAll[lv].push(nd);
        }
        // 1단계: 깊은 레벨부터 — 자식 존재 + 부모 1개 ON canvas → 부모 정보
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
        // 2단계: 자식만 있고 부모 없는 경우 → 노드 데이터/ID에서 부모 유추
        const parentFieldMap: Record<string, { idKey: string; nameKey: string; parentLv: string }> = {
          L5: { idKey: "l4Id", nameKey: "l4Name", parentLv: "L4" },
          L4: { idKey: "l3Id", nameKey: "l3Name", parentLv: "L3" },
          L3: { idKey: "l2Id", nameKey: "l2Name", parentLv: "L2" },
        };
        for (let i = levelOrder.length - 1; i >= 1; i--) {
          const childLv = levelOrder[i];
          const parentLv = levelOrder[i - 1];
          if ((lvCounts[childLv] || 0) > 0 && !(lvCounts[parentLv])) {
            const childNodes = lvAll[childLv] || [];
            const pf = parentFieldMap[childLv];
            if (pf) {
              // Method A: node data에 부모 ID/이름이 있는 경우
              const parentIds = new Set<string>();
              let parentName = "";
              for (const cn of childNodes) {
                const cd = cn.data as Record<string, string>;
                const pId = cd[pf.idKey];
                if (pId) parentIds.add(pId);
                if (!parentName && cd[pf.nameKey]) parentName = cd[pf.nameKey];
              }
              if (parentIds.size === 1) {
                const pId = Array.from(parentIds)[0];
                const dispPId = pId.replace(/^[Ll]\d[-_.\s]*/g, "").trim() || pId;
                return parentName
                  ? `${dispPId} ${parentName} — ${parentLv} 프로세스 맵`
                  : `${dispPId} — ${parentLv} 프로세스 맵`;
              }
            }
            // Method B: ID 패턴에서 부모 유추 (dot-separated)
            const parentIdsFromId = new Set<string>();
            for (const cn of childNodes) {
              const cId = getDisplayId(cn);
              const lastDot = cId.lastIndexOf(".");
              if (lastDot > 0) parentIdsFromId.add(cId.substring(0, lastDot));
            }
            if (parentIdsFromId.size === 1) {
              const pId = Array.from(parentIdsFromId)[0];
              return `${pId} — ${parentLv} 프로세스 맵`;
            }
          }
        }
        // 3단계 fallback: 가장 높은 단일 레벨 노드
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
      const swimLanes = currentSheet?.lanes || ["현업 임원", "팀장", "HR 담당자", "구성원"];
      const SWIM_COLORS = swimLanes.map((_, i) => ({
        fill: i % 2 === 0 ? "F5F5F5" : "FFFFFF",
        border: "C0C0C0",
      }));
      const SWIM_LABEL_W = 0.45; // vertical label column width (레거시: 점선 시작 x)
      const PAD_X = isSwimLane ? 1.25 : 0.4; // 레이블 박스(1.05") 뒤로 밀기
      const PAD_TOP = 1.575; // 4cm 상단 여백
      const PAD_BOTTOM = 0.35;
      // 수영레인 밴드 상수 (Phase 2.6에서도 재사용)
      const SL_BAND_BOTTOM = SLIDE_H - PAD_BOTTOM + 0.05; // 7.2"
      const SWIM_BAND_H = Math.min(1.535, (SL_BAND_BOTTOM - 0.65) / swimLanes.length); // dynamic per lane count
      const SL_BAND_TOP = SL_BAND_BOTTOM - SWIM_BAND_H * swimLanes.length;
      const TOTAL_SWIM_H = SWIM_BAND_H * swimLanes.length;

      // ── 동적 레인 높이: 2행 레인에 더 많은 공간 배분 ──
      const dynamicLaneH: number[] = swimLanes.map(() => SWIM_BAND_H);
      const dynamicLaneTops: number[] = [];
      if (isSwimLane) {
        const CL_H = 2400 / swimLanes.length; // canvas lane height (dynamic)
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
        const isDec = getLevel(nd) === "DECISION";
        const isMemo = getLevel(nd) === "MEMO";
        rawPos[nd.id] = {
          rfX: nd.position.x, rfY: nd.position.y,
          w: isMemo ? MEMO_W : isDec ? DECISION_W : isL5 ? L5_FIXED_W : s.pxW * sc,
          h: isMemo ? MEMO_H : isDec ? DECISION_H : isL5 ? L5_FIXED_H : s.pxH * sc,
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
        const CANVAS_LANE_H = 2400 / swimLanes.length;
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
      // 노드별 그룹화를 위한 EMU 좌표 수집
      interface NodeShapeMeta { x: number; y: number; w: number; h: number }
      const nodeGroupShapes: Record<string, NodeShapeMeta[]> = {};

      for (const nd of nodes) {
        const level = getLevel(nd);
        const s = LS[level] || DEF;
        const box = nodeBoxes[nd.id];
        if (!box) continue;
        const dispLabel = getLabel(nd);
        const dispId = getDisplayId(nd);
        const shapeList: NodeShapeMeta[] = [];

        if (level === "DECISION") {
          /* ── DECISION 마름모 (2cm × 2cm, 11pt) ── */
          s2.addText(dispLabel || "판정 조건", {
            x: box.x, y: box.y, w: DECISION_W, h: DECISION_H,
            shape: pptx.ShapeType.diamond,
            fill: { color: "F2A0AF" },
            line: { color: "D95578", width: 1.5 },
            fontSize: 7, bold: true, color: "3B0716",
            fontFace: "Noto Sans KR", valign: "middle", align: "center",
            objectName: `GRP_${nd.id}_${shapeList.length}`,
          });
          shapeList.push({ x: box.x, y: box.y, w: DECISION_W, h: DECISION_H });
        } else if (level === "MEMO") {
          /* ── MEMO 노란 네모 (9pt) ── */
          const memoText = (nd.data as Record<string, string>).text || dispLabel || "";
          s2.addText(memoText || "", {
            x: box.x, y: box.y, w: MEMO_W, h: MEMO_H,
            shape: pptx.ShapeType.rect,
            fill: { color: "FFF9C4" },
            line: { color: "FBC02D", width: 0.75 },
            fontSize: 9, color: "6D4C00",
            fontFace: FONT_FACE, valign: "top", align: "left",
            margin: [4, 4, 4, 4],
            objectName: `GRP_${nd.id}_${shapeList.length}`,
          });
          shapeList.push({ x: box.x, y: box.y, w: MEMO_W, h: MEMO_H });
        } else if (level === "L5") {
          /* ── L5 전용: 기타 역할 바 (위에 얹기) + 2-box ── */
          const ROLE_BAR_H = 0.142;  // 0.36cm
          const roleVal = (nd.data as Record<string, string>).role || "";
          let l5YOffset = 0;
          if (roleVal.startsWith("기타:") && roleVal.slice(3).trim()) {
            s2.addText(roleVal.slice(3).trim(), {
              x: box.x, y: box.y, w: L5_FIXED_W, h: ROLE_BAR_H,
              shape: pptx.ShapeType.rect,
              fill: { color: "DBEAFE" },
              line: { color: "93C5FD", width: 0.5 },
              fontSize: 7, bold: true, color: "1D4ED8",
              fontFace: FONT_FACE, valign: "middle", align: "center",
              objectName: `GRP_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y, w: L5_FIXED_W, h: ROLE_BAR_H });
            l5YOffset = ROLE_BAR_H;
          }
          // 위쪽 박스: 흰 배경, 0.25pt 테두리, ID + Label
          s2.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
            x: box.x, y: box.y + l5YOffset, w: L5_FIXED_W, h: L5_UPPER_H,
            shape: pptx.ShapeType.rect,
            fill: { color: "FFFFFF" },
            line: { color: "DEDEDE", width: 0.25 },
            fontSize: 9, bold: true, color: "000000",
            fontFace: FONT_FACE, valign: "middle", align: "center",
            objectName: `GRP_${nd.id}_${shapeList.length}`,
          });
          shapeList.push({ x: box.x, y: box.y + l5YOffset, w: L5_FIXED_W, h: L5_UPPER_H });
          // 아래쪽 박스: 연회색(DEDEDE) 채우기, 선 없음, 시스템명
          const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
          const sysStr = (nd.data as Record<string, string>).system || "";
          let sysName = "시스템명";
          if (sysStr) {
            sysName = sysStr;
          } else if (sysMap) {
            const parts: string[] = [];
            if (sysMap.hr?.trim()) parts.push(sysMap.hr.trim());
            if (sysMap.groupware?.trim()) parts.push(sysMap.groupware.trim());
            if (sysMap.office?.trim()) parts.push(sysMap.office.trim());
            if (sysMap.manual?.trim()) parts.push(sysMap.manual.trim());
            if (sysMap.etc?.trim()) parts.push(sysMap.etc.trim());
            if (parts.length > 0) sysName = parts.join(" / ");
          }
          s2.addText(sysName, {
            x: box.x, y: box.y + l5YOffset + L5_UPPER_H + L5_GAP, w: L5_FIXED_W, h: L5_LOWER_H,
            shape: pptx.ShapeType.rect,
            fill: { color: "DEDEDE" },
            line: { width: 0 },
            fontSize: 7, bold: false, color: "000000",
            fontFace: FONT_FACE, valign: "middle", align: "center",
            objectName: `GRP_${nd.id}_${shapeList.length}`,
          });
          shapeList.push({ x: box.x, y: box.y + l5YOffset + L5_UPPER_H + L5_GAP, w: L5_FIXED_W, h: L5_LOWER_H });
        } else {
          /* ── L2~L4: 기존 단일 박스 ── */
          s2.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
            x: box.x, y: box.y, w: box.w, h: box.h,
            shape: pptx.ShapeType.rect,
            fill: { color: s.bg },
            line: { color: s.border, width: 0.25 },
            fontSize: NODE_FONT_SIZE, bold: true, color: s.text,
            fontFace: FONT_FACE, valign: "middle", align: "center",
            objectName: `GRP_${nd.id}_${shapeList.length}`,
          });
          shapeList.push({ x: box.x, y: box.y, w: box.w, h: box.h });
          const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
          if (sysMap) {
            const SYS_KEYS: { key: string }[] = [
              { key: "hr" }, { key: "groupware" },
              { key: "office" }, { key: "manual" }, { key: "etc" },
            ];
            const activeSys = SYS_KEYS.filter(k => sysMap[k.key]?.trim());
            if (activeSys.length > 0) {
              s2.addText(activeSys.map(k => `🖥 ${sysMap[k.key]!.trim()}`).join("  "), {
                x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2,
                fontSize: Math.max(NODE_FONT_SIZE - 2, 6), color: s.bg,
                fontFace: FONT_FACE, align: "center", bold: true,
                objectName: `GRP_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2 });
            }
          }
        }

        // Custom role tag (기타:value) — L5는 위에서 이미 바로 처리, 나머지만 오른쪽 위 오버랩
        if (level !== "L5") {
          const roleStr = (nd.data as Record<string, string>).role || "";
          if (roleStr.startsWith("기타:")) {
            const customName = roleStr.slice(3);
            if (customName) {
              const tagW = Math.max(box.w, L5_FIXED_W);
              const tagH = 0.142;  // 0.36cm
              s2.addText(customName, {
                x: box.x, y: box.y - tagH,
                w: tagW, h: tagH,
                shape: pptx.ShapeType.rect,
                fill: { color: "DBEAFE" },
                line: { color: "93C5FD", width: 0.5 },
                fontSize: 7, bold: true, color: "1D4ED8",
                fontFace: FONT_FACE, valign: "middle", align: "center",
                objectName: `GRP_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: box.y - tagH, w: tagW, h: tagH });
            }
          }
        }

        // Memo yellow box (노란색 네모 칸, 9pt)
        const memoStr = (nd.data as Record<string, string>).memo || "";
        if (memoStr) {
          const memoW = Math.max(box.w, 1.0);
          const memoH = 0.28;
          s2.addText(memoStr, {
            x: box.x, y: box.y + box.h + 0.04,
            w: memoW, h: memoH,
            shape: pptx.ShapeType.rect,
            fill: { color: "FFF9C4" },
            line: { color: "FBC02D", width: 0.5 },
            fontSize: 9, color: "6D4C00",
            fontFace: FONT_FACE, valign: "middle", align: "left",
            margin: [0, 4, 0, 4],
            objectName: `GRP_${nd.id}_${shapeList.length}`,
          });
          shapeList.push({ x: box.x, y: box.y + box.h + 0.04, w: memoW, h: memoH });
        }
        // 노드별 그룹 등록 (2개 이상 도형이 있을 때만)
        if (shapeList.length > 1) nodeGroupShapes[nd.id] = shapeList;
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
        srcIsDec: boolean; tgtIsDec: boolean;
        isStraight: boolean;  // true=직선, false=꺾인선
        isHorizontal: boolean; // true=가로 우세, false=세로 우세
        bidi: boolean;
        label?: string;
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
          srcIsDec: nodeLevelMap[e.source] === "DECISION",
          tgtIsDec: nodeLevelMap[e.target] === "DECISION",
          isStraight, isHorizontal, bidi,
          label: e.label ? String(e.label) : undefined,
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
          // 중심점
          const srcCx = src.x + src.w / 2, srcCy = src.y + src.h / 2;
          const tgtCx = tgt.x + tgt.w / 2, tgtCy = tgt.y + tgt.h / 2;
          const cdx = tgtCx - srcCx, cdy = tgtCy - srcCy;
          // L5: 위쪽 박스 중앙 Y 사용
          const srcConnY = c.srcIsL5 ? src.y + L5_UPPER_H / 2 : srcCy;
          const tgtConnY = c.tgtIsL5 ? tgt.y + L5_UPPER_H / 2 : tgtCy;

          // diamond: 방향에 따라 0(위)/1(오른)/2(아래)/3(왼) | roundRect: right=3, left=1
          let stIdx: number, x1: number, y1: number;
          let endIdx: number, x2: number, y2: number;

          if (c.srcIsDec) {
            if (Math.abs(cdx) >= Math.abs(cdy)) {
              if (cdx >= 0) { stIdx = 1; x1 = src.x + src.w; y1 = srcCy; }
              else          { stIdx = 3; x1 = src.x;          y1 = srcCy; }
            } else {
              if (cdy >= 0) { stIdx = 2; x1 = srcCx; y1 = src.y + src.h; }
              else          { stIdx = 0; x1 = srcCx; y1 = src.y;          }
            }
          } else {
            stIdx = 3; x1 = src.x + src.w; y1 = srcConnY;
          }

          if (c.tgtIsDec) {
            if (Math.abs(cdx) >= Math.abs(cdy)) {
              if (cdx >= 0) { endIdx = 3; x2 = tgt.x;         y2 = tgtCy; }
              else          { endIdx = 1; x2 = tgt.x + tgt.w; y2 = tgtCy; }
            } else {
              if (cdy >= 0) { endIdx = 0; x2 = tgtCx; y2 = tgt.y;          }
              else          { endIdx = 2; x2 = tgtCx; y2 = tgt.y + tgt.h;  }
            }
          } else {
            endIdx = 1; x2 = tgt.x; y2 = tgtConnY;
          }

          // Y 스냅: 비-DECISION 수평 연결에서 미세한 Y 차이 방지
          if (!c.srcIsDec && !c.tgtIsDec && Math.abs(y1 - y2) < 0.08) {
            const avgY = (y1 + y2) / 2; y1 = avgY; y2 = avgY;
          }
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

        // Yes/No label text boxes near connectors
        for (const c of connectors) {
          if (!c.label) continue;
          const src = c.srcBox, tgt = c.tgtBox;
          const srcCY = c.srcIsL5 ? src.y + L5_UPPER_H / 2 : src.y + src.h / 2;
          const tgtCY = c.tgtIsL5 ? tgt.y + L5_UPPER_H / 2 : tgt.y + tgt.h / 2;
          const x1 = src.x + src.w, x2 = tgt.x;
          const midX = (x1 + x2) / 2;
          const midY = (srcCY + tgtCY) / 2;
          const lblW = 0.35, lblH = 0.18;
          const lx = Math.round((midX - lblW / 2) * EMU);
          const ly = Math.round((midY - lblH - 0.04) * EMU);
          const lcx = Math.round(lblW * EMU);
          const lcy = Math.round(lblH * EMU);
          cxnXml += `<p:sp><p:nvSpPr><p:cNvPr id="${nextId}" name="Label ${nextId}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
            + `<p:spPr><a:xfrm><a:off x="${lx}" y="${ly}"/><a:ext cx="${lcx}" cy="${lcy}"/></a:xfrm>`
            + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`
            + `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`
            + `<a:ln w="3175"><a:solidFill><a:srgbClr val="999999"/></a:solidFill></a:ln>`
            + `</p:spPr><p:txBody>`
            + `<a:bodyPr wrap="square" anchor="ctr" anchorCtr="1" lIns="0" tIns="0" rIns="0" bIns="0"/>`
            + `<a:p><a:pPr algn="ctr"/><a:r>`
            + `<a:rPr lang="en-US" sz="800" b="1" dirty="0"><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:rPr>`
            + `<a:t>${c.label}</a:t></a:r></a:p></p:txBody></p:sp>`;
          nextId++;
        }

        if (cxnXml) {
          const modified = slide2Xml.replace("</p:spTree>", cxnXml + "</p:spTree>");
          zip.file(slide2Path, modified);
        }
      }

      // ── JSZip 후처리: 도형 그룹화 (objectName 기반 매칭) ──────
      if (Object.keys(nodeGroupShapes).length > 0) {
        let grpSlideXml = await zip.file(slide2Path)?.async("string") || "";
        if (grpSlideXml) {
          let grpMaxId = 0;
          for (const m of grpSlideXml.match(/id="(\d+)"/g) || []) {
            const n = parseInt(m.match(/\d+/)![0]);
            if (n > grpMaxId) grpMaxId = n;
          }
          let grpNextId = grpMaxId + 1;

          for (const [nodeId, shapes] of Object.entries(nodeGroupShapes)) {
            if (shapes.length < 2) continue;
            // objectName 기반으로 <p:sp> 블록 매칭
            const spBlocks = grpSlideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
            const matched: string[] = [];

            for (let i = 0; i < shapes.length; i++) {
              const targetName = `GRP_${nodeId}_${i}`;
              for (const blk of spBlocks) {
                if (matched.includes(blk)) continue;
                // name="GRP_nodeId_N" 패턴으로 매칭
                if (blk.includes(`name="${targetName}"`)) {
                  matched.push(blk); break;
                }
              }
            }
            if (matched.length < 2) continue;

            // Compute bounding box in EMU
            let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
            for (const blk of matched) {
              const om = blk.match(/<a:off\s([^>]*)\/?>/);
              const em = blk.match(/<a:ext\s([^>]*)\/?>/);
              if (!om || !em) continue;
              const bx = parseInt(om[1].match(/x="(\d+)"/)![1]);
              const by = parseInt(om[1].match(/y="(\d+)"/)![1]);
              const bcx = parseInt(em[1].match(/cx="(\d+)"/)![1]);
              const bcy = parseInt(em[1].match(/cy="(\d+)"/)![1]);
              gMinX = Math.min(gMinX, bx); gMinY = Math.min(gMinY, by);
              gMaxX = Math.max(gMaxX, bx + bcx); gMaxY = Math.max(gMaxY, by + bcy);
            }

            // Remove matched shapes from XML, then insert group
            for (const blk of matched) grpSlideXml = grpSlideXml.replace(blk, "");
            const grpSp = `<p:grpSp>`
              + `<p:nvGrpSpPr><p:cNvPr id="${grpNextId}" name="Group ${grpNextId}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
              + `<p:grpSpPr><a:xfrm>`
              + `<a:off x="${gMinX}" y="${gMinY}"/><a:ext cx="${gMaxX - gMinX}" cy="${gMaxY - gMinY}"/>`
              + `<a:chOff x="${gMinX}" y="${gMinY}"/><a:chExt cx="${gMaxX - gMinX}" cy="${gMaxY - gMinY}"/>`
              + `</a:xfrm></p:grpSpPr>`
              + matched.join("")
              + `</p:grpSp>`;
            grpNextId++;
            grpSlideXml = grpSlideXml.replace("</p:spTree>", grpSp + "</p:spTree>");
          }
          zip.file(slide2Path, grpSlideXml);
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
        DECISION: { bg: "F2A0AF", border: "D95578", text: "3B0716", fontSize: 7, pxW: 220, pxH: 220, pptW: 1.240, pptH: 0.433 },
      };
      /* L5 2-box 고정 치수 (인치) — 스케일링 무시, 항상 이 크기 */
      const L5_FIXED_W_ALL  = 1.240;  // 3.15cm
      const L5_UPPER_H_ALL  = 0.685;  // 1.74cm
      const L5_LOWER_H_ALL  = 0.213;  // 0.54cm
      const L5_GAP_ALL      = 0.020;  // 0.05cm
      const L5_FIXED_H_ALL  = L5_UPPER_H_ALL + L5_GAP_ALL + L5_LOWER_H_ALL; // 0.918"
      const DECISION_W_ALL = 1.240;  // 3.15cm
      const DECISION_H_ALL = 0.433;  // 1.1cm
      const MEMO_W_ALL = 1.5;
      const MEMO_H_ALL = 0.5;
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
        const tag = sheet.type === "swimlane" ? ` (${(sheet.lanes?.length || 4)}분할 수영레인)` : "";
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
      const SWIM_LABEL_W = 0.45;

      // 슬라이드별 커넥터 메타 수집
      const allSlideConnectors: {
        slideIndex: number;
        connectors: { srcNodeId: string; tgtNodeId: string; srcBox: { x: number; y: number; w: number; h: number }; tgtBox: { x: number; y: number; w: number; h: number }; srcIsL5: boolean; tgtIsL5: boolean; srcIsDec: boolean; tgtIsDec: boolean; isStraight: boolean; isHorizontal: boolean; bidi: boolean; label?: string }[];
        nodeBoxes: Record<string, { x: number; y: number; w: number; h: number }>;
        nodeGroupShapes: Record<string, { x: number; y: number; w: number; h: number }[]>;
      }[] = [];
      let slideIdx = 2; // slide1=타이틀, slide2부터 시트

      for (const { sheet, nodes: sNodes, edges: sEdges } of validSheets) {
        const slide = pptx.addSlide();
        slide.background = { color: "F8FAFC" };

        // 수영레인 설정
        const isSwimLane = sheet.type === "swimlane";
        const swimLanes = sheet.lanes || ["현업 임원", "팀장", "HR 담당자", "구성원"];

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
        const SL_BOTTOM_S = SLIDE_H - sPadBottom + 0.05;
        const SWIM_BAND_H_S = Math.min(1.535, (SL_BOTTOM_S - 0.65) / swimLanes.length); // dynamic per lane count
        const SL_TOP_S = SL_BOTTOM_S - SWIM_BAND_H_S * swimLanes.length;
        const TOTAL_SWIM_H_S = SWIM_BAND_H_S * swimLanes.length;

        // ── 동적 레인 높이: 2행 레인에 더 많은 공간 배분 ──
        const dynLH_S: number[] = swimLanes.map(() => SWIM_BAND_H_S);
        const dynLT_S: number[] = [];
        if (isSwimLane) {
          const CL_H_S = 2400 / swimLanes.length; // canvas lane height (dynamic)
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
          const la: Record<string, Node[]> = {};
          for (const nd of sNodes) {
            const lv = getLevel(nd);
            if (lv === "DECISION") continue;
            lc[lv] = (lc[lv] || 0) + 1;
            if (!lf[lv]) lf[lv] = nd;
            if (!la[lv]) la[lv] = [];
            la[lv].push(nd);
          }
          let found = false;
          // 1단계: 자식 존재 + 부모 1개 ON canvas
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
          // 2단계: 자식만 있고 부모 없는 경우 → 노드 데이터/ID에서 부모 유추
          if (!found) {
            const parentFieldMap: Record<string, { idKey: string; nameKey: string }> = {
              L5: { idKey: "l4Id", nameKey: "l4Name" },
              L4: { idKey: "l3Id", nameKey: "l3Name" },
              L3: { idKey: "l2Id", nameKey: "l2Name" },
            };
            for (let i = sLevelOrder.length - 1; i >= 1 && !found; i--) {
              const childLv = sLevelOrder[i];
              const parentLv = sLevelOrder[i - 1];
              if ((lc[childLv] || 0) > 0 && !(lc[parentLv])) {
                const childNodes = la[childLv] || [];
                const pf = parentFieldMap[childLv];
                if (pf) {
                  const parentIds = new Set<string>();
                  let parentName = "";
                  for (const cn of childNodes) {
                    const cd = cn.data as Record<string, string>;
                    const pId = cd[pf.idKey];
                    if (pId) parentIds.add(pId);
                    if (!parentName && cd[pf.nameKey]) parentName = cd[pf.nameKey];
                  }
                  if (parentIds.size === 1) {
                    const pId = Array.from(parentIds)[0];
                    const dispPId = pId.replace(/^[Ll]\d[-_.\s]*/g, "").trim() || pId;
                    sheetSlideTitle = parentName
                      ? `${dispPId} ${parentName} — ${parentLv} 프로세스 맵`
                      : `${dispPId} — ${parentLv} 프로세스 맵`;
                    found = true;
                  }
                }
                if (!found) {
                  const parentIdsFromId = new Set<string>();
                  for (const cn of childNodes) {
                    const cId = getDisplayId(cn);
                    const lastDot = cId.lastIndexOf(".");
                    if (lastDot > 0) parentIdsFromId.add(cId.substring(0, lastDot));
                  }
                  if (parentIdsFromId.size === 1) {
                    const pId = Array.from(parentIdsFromId)[0];
                    sheetSlideTitle = `${pId} — ${parentLv} 프로세스 맵`;
                    found = true;
                  }
                }
              }
            }
          }
          // 3단계 fallback
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
          const isDec = getLevel(nd) === "DECISION";
          const isMemo = getLevel(nd) === "MEMO";
          sRawPos[nd.id] = {
            rfX: nd.position.x, rfY: nd.position.y,
            w: isMemo ? MEMO_W_ALL : isDec ? DECISION_W_ALL : isL5 ? L5_FIXED_W_ALL : sv.pxW * scRatio,
            h: isMemo ? MEMO_H_ALL : isDec ? DECISION_H_ALL : isL5 ? L5_FIXED_H_ALL : sv.pxH * scRatio,
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
          const CANVAS_LANE_H = 2400 / swimLanes.length;
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
        interface GrpShapeMeta { x: number; y: number; w: number; h: number }
        const sheetGroupShapes: Record<string, GrpShapeMeta[]> = {};

        for (const nd of sNodes) {
          const level = getLevel(nd);
          const sv = LS[level] || DEF;
          const box = nodeBoxes[nd.id];
          if (!box) continue;
          const dispLabel = getLabel(nd);
          const dispId = getDisplayId(nd);
          const shapeList: GrpShapeMeta[] = [];

          if (level === "DECISION") {
            /* ── DECISION 마름모 (3.15cm × 1.1cm, 7pt) ── */
            slide.addText(dispLabel || "판정 조건", {
              x: box.x, y: box.y, w: DECISION_W_ALL, h: DECISION_H_ALL,
              shape: pptx.ShapeType.diamond,
              fill: { color: "F2A0AF" },
              line: { color: "D95578", width: 1.5 },
              fontSize: 7, bold: true, color: "3B0716",
              fontFace: "Noto Sans KR", valign: "middle", align: "center",
              objectName: `GRP_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y, w: DECISION_W_ALL, h: DECISION_H_ALL });
          } else if (level === "MEMO") {
            const memoText = (nd.data as Record<string, string>).text || dispLabel || "";
            slide.addText(memoText || "", {
              x: box.x, y: box.y, w: MEMO_W_ALL, h: MEMO_H_ALL,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFF9C4" },
              line: { color: "FBC02D", width: 0.75 },
              fontSize: 9, color: "6D4C00",
              fontFace: FONT_FACE, valign: "top", align: "left",
              margin: [4, 4, 4, 4],
              objectName: `GRP_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y, w: MEMO_W_ALL, h: MEMO_H_ALL });
          } else if (level === "L5") {
            /* ── L5: 기타 역할 바 (위에 얹기) + 2-box ── */
            const ROLE_BAR_H_S = 0.142;  // 0.36cm
            const roleVal = (nd.data as Record<string, string>).role || "";
            let l5YOff = 0;
            if (roleVal.startsWith("기타:") && roleVal.slice(3).trim()) {
              slide.addText(roleVal.slice(3).trim(), {
                x: box.x, y: box.y, w: L5_FIXED_W_ALL, h: ROLE_BAR_H_S,
                shape: pptx.ShapeType.rect,
                fill: { color: "DBEAFE" },
                line: { color: "93C5FD", width: 0.5 },
                fontSize: 7, bold: true, color: "1D4ED8",
                fontFace: FONT_FACE, valign: "middle", align: "center",
                objectName: `GRP_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: box.y, w: L5_FIXED_W_ALL, h: ROLE_BAR_H_S });
              l5YOff = ROLE_BAR_H_S;
            }
            slide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
              x: box.x, y: box.y + l5YOff, w: L5_FIXED_W_ALL, h: L5_UPPER_H_ALL,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFFFFF" },
              line: { color: "DEDEDE", width: 0.25 },
              fontSize: 9, bold: true, color: "000000",
              fontFace: FONT_FACE, valign: "middle", align: "center",
              objectName: `GRP_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y + l5YOff, w: L5_FIXED_W_ALL, h: L5_UPPER_H_ALL });
            const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
            const sysStr = (nd.data as Record<string, string>).system || "";
            let sysName = "시스템명";
            if (sysStr) {
              sysName = sysStr;
            } else if (sysMap) {
              const SYS_KEYS = [
                { key: "hr" }, { key: "groupware" }, { key: "office" }, { key: "manual" }, { key: "etc" },
              ];
              const active = SYS_KEYS.filter(k => sysMap[k.key]?.trim());
              if (active.length > 0) sysName = active.map(k => sysMap[k.key]!.trim()).join(", ");
            }
            // 아래쪽 박스: DEDEDE 채우기, 선 없음
            slide.addText(sysName, {
              x: box.x, y: box.y + l5YOff + L5_UPPER_H_ALL + L5_GAP_ALL, w: L5_FIXED_W_ALL, h: L5_LOWER_H_ALL,
              shape: pptx.ShapeType.rect,
              fill: { color: "DEDEDE" },
              line: { width: 0 },
              fontSize: 7, bold: false, color: "000000",
              fontFace: FONT_FACE, valign: "middle", align: "center",
              objectName: `GRP_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y + l5YOff + L5_UPPER_H_ALL + L5_GAP_ALL, w: L5_FIXED_W_ALL, h: L5_LOWER_H_ALL });
          } else {
            /* ── L2~L4: 기존 단일 박스 ── */
            slide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
              x: box.x, y: box.y, w: box.w, h: box.h,
              shape: pptx.ShapeType.rect,
              fill: { color: sv.bg },
              line: { color: sv.border, width: 0.25 },
              fontSize: NODE_FONT_SIZE_S, bold: true, color: sv.text,
              fontFace: FONT_FACE, valign: "middle", align: "center",
              objectName: `GRP_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y, w: box.w, h: box.h });
            const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
            if (sysMap) {
              const SYS_KEYS: { key: string }[] = [
                { key: "hr" }, { key: "groupware" }, { key: "office" }, { key: "manual" }, { key: "etc" },
              ];
              const activeSys = SYS_KEYS.filter(k => sysMap[k.key]?.trim());
              if (activeSys.length > 0) {
                slide.addText(activeSys.map(k => `🖥 ${sysMap[k.key]!.trim()}`).join("  "), {
                  x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2,
                  fontSize: Math.max(NODE_FONT_SIZE_S - 2, 6), color: sv.bg,
                  fontFace: FONT_FACE, align: "center", bold: true,
                  objectName: `GRP_${nd.id}_${shapeList.length}`,
                });
                shapeList.push({ x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2 });
              }
            }
          }

          // Custom role tag (기타:value) — L5는 위에서 이미 바로 처리
          if (level !== "L5") {
            const roleStr = (nd.data as Record<string, string>).role || "";
            if (roleStr.startsWith("기타:")) {
              const customName = roleStr.slice(3);
              if (customName) {
                const tagW = Math.max(box.w, L5_FIXED_W_ALL);
                const tagH = 0.142;
                slide.addText(customName, {
                  x: box.x, y: box.y - tagH,
                  w: tagW, h: tagH,
                  shape: pptx.ShapeType.rect,
                  fill: { color: "DBEAFE" },
                  line: { color: "93C5FD", width: 0.5 },
                  fontSize: 7, bold: true, color: "1D4ED8",
                  fontFace: FONT_FACE, valign: "middle", align: "center",
                  objectName: `GRP_${nd.id}_${shapeList.length}`,
                });
                shapeList.push({ x: box.x, y: box.y - tagH, w: tagW, h: tagH });
              }
            }
          }

          // Memo yellow box (노란색 네모 칸, 9pt)
          const memoStr = (nd.data as Record<string, string>).memo || "";
          if (memoStr) {
            const memoW = Math.max(box.w, 1.0);
            const memoH = 0.28;
            slide.addText(memoStr, {
              x: box.x, y: box.y + box.h + 0.04,
              w: memoW, h: memoH,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFF9C4" },
              line: { color: "FBC02D", width: 0.5 },
              fontSize: 9, color: "6D4C00",
              fontFace: FONT_FACE, valign: "middle", align: "left",
              margin: [0, 4, 0, 4],
              objectName: `GRP_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y + box.h + 0.04, w: memoW, h: memoH });
          }
          // 노드별 그룹 등록 (2개 이상 도형이 있을 때만)
          if (shapeList.length > 1) sheetGroupShapes[nd.id] = shapeList;
        }

        // ── Phase 4: 엣지 메타 수집 (JSZip 후처리에서 진짜 커넥터로) ─────
        {
          interface CxnMeta {
            srcNodeId: string; tgtNodeId: string;
            srcBox: { x: number; y: number; w: number; h: number };
            tgtBox: { x: number; y: number; w: number; h: number };
            srcIsL5: boolean; tgtIsL5: boolean;
            srcIsDec: boolean; tgtIsDec: boolean;
            isStraight: boolean; isHorizontal: boolean; bidi: boolean;
            label?: string;
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
              srcIsDec: srcNd ? getLevel(srcNd) === "DECISION" : false,
              tgtIsDec: tgtNd ? getLevel(tgtNd) === "DECISION" : false,
              isStraight, isHorizontal, bidi,
              label: e.label ? String(e.label) : undefined,
            });
          }
          allSlideConnectors.push({ slideIndex: slideIdx, connectors: sheetConnectors, nodeBoxes: { ...nodeBoxes }, nodeGroupShapes: { ...sheetGroupShapes } });
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
          const srcCxA = src.x + src.w / 2, srcCyA = src.y + src.h / 2;
          const tgtCxA = tgt.x + tgt.w / 2, tgtCyA = tgt.y + tgt.h / 2;
          const cdxA = tgtCxA - srcCxA, cdyA = tgtCyA - srcCyA;
          const srcConnY2 = c.srcIsL5 ? src.y + L5_UPPER_H_ALL / 2 : srcCyA;
          const tgtConnY2 = c.tgtIsL5 ? tgt.y + L5_UPPER_H_ALL / 2 : tgtCyA;

          let stIdx: number, x1: number, y1: number;
          let endIdx: number, x2: number, y2: number;

          if (c.srcIsDec) {
            if (Math.abs(cdxA) >= Math.abs(cdyA)) {
              if (cdxA >= 0) { stIdx = 1; x1 = src.x + src.w; y1 = srcCyA; }
              else           { stIdx = 3; x1 = src.x;          y1 = srcCyA; }
            } else {
              if (cdyA >= 0) { stIdx = 2; x1 = srcCxA; y1 = src.y + src.h; }
              else           { stIdx = 0; x1 = srcCxA; y1 = src.y;          }
            }
          } else {
            stIdx = 3; x1 = src.x + src.w; y1 = srcConnY2;
          }

          if (c.tgtIsDec) {
            if (Math.abs(cdxA) >= Math.abs(cdyA)) {
              if (cdxA >= 0) { endIdx = 3; x2 = tgt.x;         y2 = tgtCyA; }
              else           { endIdx = 1; x2 = tgt.x + tgt.w; y2 = tgtCyA; }
            } else {
              if (cdyA >= 0) { endIdx = 0; x2 = tgtCxA; y2 = tgt.y;          }
              else           { endIdx = 2; x2 = tgtCxA; y2 = tgt.y + tgt.h;  }
            }
          } else {
            endIdx = 1; x2 = tgt.x; y2 = tgtConnY2;
          }

          if (!c.srcIsDec && !c.tgtIsDec && Math.abs(y1 - y2) < 0.08) {
            const avgY = (y1 + y2) / 2; y1 = avgY; y2 = avgY;
          }
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

        // Yes/No label text boxes near connectors
        for (const c of sc.connectors) {
          if (!c.label) continue;
          const src = c.srcBox, tgt = c.tgtBox;
          const srcCY = c.srcIsL5 ? src.y + L5_UPPER_H_ALL / 2 : src.y + src.h / 2;
          const tgtCY = c.tgtIsL5 ? tgt.y + L5_UPPER_H_ALL / 2 : tgt.y + tgt.h / 2;
          const x1 = src.x + src.w, x2 = tgt.x;
          const midX = (x1 + x2) / 2;
          const midY = (srcCY + tgtCY) / 2;
          const lblW = 0.35, lblH = 0.18;
          const lx = Math.round((midX - lblW / 2) * EMU);
          const ly = Math.round((midY - lblH - 0.04) * EMU);
          const lcx = Math.round(lblW * EMU);
          const lcy = Math.round(lblH * EMU);
          cxnXml += `<p:sp><p:nvSpPr><p:cNvPr id="${nextId}" name="Label ${nextId}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
            + `<p:spPr><a:xfrm><a:off x="${lx}" y="${ly}"/><a:ext cx="${lcx}" cy="${lcy}"/></a:xfrm>`
            + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>`
            + `<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`
            + `<a:ln w="3175"><a:solidFill><a:srgbClr val="999999"/></a:solidFill></a:ln>`
            + `</p:spPr><p:txBody>`
            + `<a:bodyPr wrap="square" anchor="ctr" anchorCtr="1" lIns="0" tIns="0" rIns="0" bIns="0"/>`
            + `<a:p><a:pPr algn="ctr"/><a:r>`
            + `<a:rPr lang="en-US" sz="800" b="1" dirty="0"><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:rPr>`
            + `<a:t>${c.label}</a:t></a:r></a:p></p:txBody></p:sp>`;
          nextId++;
        }

        if (cxnXml) zip.file(slidePath, slideXml.replace("</p:spTree>", cxnXml + "</p:spTree>"));

        // ── 도형 그룹화: objectName 기반 매칭 ──────
        if (sc.nodeGroupShapes && Object.keys(sc.nodeGroupShapes).length > 0) {
          let grpSlideXml = await zip.file(slidePath)?.async("string") || "";
          if (grpSlideXml) {
            let grpMaxId = 0;
            for (const m of grpSlideXml.match(/id="(\d+)"/g) || []) {
              const n = parseInt(m.match(/\d+/)![0]);
              if (n > grpMaxId) grpMaxId = n;
            }
            let grpNextId = grpMaxId + 1;

            for (const [nodeId, shapes] of Object.entries(sc.nodeGroupShapes)) {
              if (shapes.length < 2) continue;
              const spBlocks = grpSlideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
              const matched: string[] = [];

              for (let i = 0; i < shapes.length; i++) {
                const targetName = `GRP_${nodeId}_${i}`;
                for (const blk of spBlocks) {
                  if (matched.includes(blk)) continue;
                  if (blk.includes(`name="${targetName}"`)) {
                    matched.push(blk); break;
                  }
                }
              }
              if (matched.length < 2) continue;

              let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
              for (const blk of matched) {
                const om = blk.match(/<a:off\s([^>]*)\/?>/);
                const em = blk.match(/<a:ext\s([^>]*)\/?>/);
                if (!om || !em) continue;
                const bx = parseInt(om[1].match(/x="(\d+)"/)![1]);
                const by = parseInt(om[1].match(/y="(\d+)"/)![1]);
                const bcx = parseInt(em[1].match(/cx="(\d+)"/)![1]);
                const bcy = parseInt(em[1].match(/cy="(\d+)"/)![1]);
                gMinX = Math.min(gMinX, bx); gMinY = Math.min(gMinY, by);
                gMaxX = Math.max(gMaxX, bx + bcx); gMaxY = Math.max(gMaxY, by + bcy);
              }

              for (const blk of matched) grpSlideXml = grpSlideXml.replace(blk, "");
              const grpSp = `<p:grpSp>`
                + `<p:nvGrpSpPr><p:cNvPr id="${grpNextId}" name="Group ${grpNextId}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
                + `<p:grpSpPr><a:xfrm>`
                + `<a:off x="${gMinX}" y="${gMinY}"/><a:ext cx="${gMaxX - gMinX}" cy="${gMaxY - gMinY}"/>`
                + `<a:chOff x="${gMinX}" y="${gMinY}"/><a:chExt cx="${gMaxX - gMinX}" cy="${gMaxY - gMinY}"/>`
                + `</a:xfrm></p:grpSpPr>`
                + matched.join("")
                + `</p:grpSp>`;
              grpNextId++;
              grpSlideXml = grpSlideXml.replace("</p:spTree>", grpSp + "</p:spTree>");
            }
            zip.file(slidePath, grpSlideXml);
          }
        }
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

  /* ═══ Batch PPT Export — L4별 1페이지 (CSV 데이터 기반) ═══ */
  const handleExportBatchPPT = useCallback(async (splitByL3: boolean) => {
    if (isExporting.current) return;
    if (!csvRows || csvRows.length === 0) {
      alert("CSV 데이터가 없습니다. 먼저 CSV 파일을 업로드하세요.");
      return;
    }
    isExporting.current = true;
    try {
      const FONT_FACE = "Noto Sans KR";
      const SLIDE_W = 13.33;
      const SLIDE_H = 7.5;
      const PAD_X = 0.35;
      const PAD_TOP = 0.9;
      const PAD_BOTTOM = 0.2;
      const L5_W = 1.240;       // 3.15cm
      const L5_UPPER_H = 0.685; // 1.74cm
      const L5_LOWER_H = 0.213; // 0.54cm
      const L5_GAP = 0.020;
      const L5_TOTAL_H = L5_UPPER_H + L5_GAP + L5_LOWER_H;
      const L5_COL_GAP = 0.15;
      const ROLE_BAR_H = 0.142;
      const L4_LABEL_H = 0.45;

      const SYS_KEYS: { key: string; label: string }[] = [
        { key: "hr", label: "HR시스템" }, { key: "groupware", label: "그룹웨어" },
        { key: "office", label: "오피스" }, { key: "manual", label: "수작업" }, { key: "etc", label: "기타툴" },
      ];

      // 계층 구조 추출
      const l2List = extractL2List(csvRows);

      // L3별로 그룹핑
      interface L3Group {
        l3Id: string; l3Name: string;
        l2Id: string; l2Name: string;
        l4s: { l4Id: string; l4Name: string; l4Desc: string; l5s: ReturnType<typeof extractL5ByL4> }[];
      }
      const l3Groups: L3Group[] = [];
      for (const l2 of l2List) {
        const l3s = extractL3ByL2(csvRows, l2.id);
        for (const l3 of l3s) {
          const l4s = extractL4ByL3(csvRows, l3.id);
          const l4WithL5 = l4s.map(l4 => ({
            l4Id: l4.id, l4Name: l4.name, l4Desc: l4.description,
            l5s: extractL5ByL4(csvRows, l4.id),
          }));
          l3Groups.push({ l3Id: l3.id, l3Name: l3.name, l2Id: l2.id, l2Name: l2.name, l4s: l4WithL5 });
        }
      }

      /** 단일 PPT에 슬라이드 추가하는 공통 함수 */
      const addSlidesToPptx = (pptx: PptxGenJS, groups: L3Group[]) => {
        let slideCount = 0;
        for (const g of groups) {
          for (const l4 of g.l4s) {
            slideCount++;
            const slide = pptx.addSlide();

            // ── 헤더: L2 > L3 > L4 breadcrumb ──
            slide.addText(
              [
                { text: `${g.l2Id} ${g.l2Name}`, options: { fontSize: 8, color: "A62121", bold: true } },
                { text: `  ▸  `, options: { fontSize: 8, color: "999999" } },
                { text: `${g.l3Id} ${g.l3Name}`, options: { fontSize: 8, color: "D95578", bold: true } },
                { text: `  ▸  `, options: { fontSize: 8, color: "999999" } },
                { text: `${l4.l4Id} ${l4.l4Name}`, options: { fontSize: 9, color: "000000", bold: true } },
              ],
              { x: PAD_X, y: 0.15, w: SLIDE_W - 2 * PAD_X, h: 0.35, fontFace: FONT_FACE, valign: "middle" }
            );

            // 페이지 번호
            slide.addText(`${slideCount}`, {
              x: SLIDE_W - 0.6, y: SLIDE_H - 0.35, w: 0.5, h: 0.25,
              fontSize: 7, color: "999999", fontFace: FONT_FACE, align: "right",
            });

            // ── L4 제목 바 ──
            const l4BarY = 0.55;
            slide.addText(`${l4.l4Id}  ${l4.l4Name}`, {
              x: PAD_X, y: l4BarY, w: SLIDE_W - 2 * PAD_X, h: L4_LABEL_H,
              shape: pptx.ShapeType.rect,
              fill: { color: "DEDEDE" },
              line: { color: "BFBFBF", width: 0.5 },
              fontSize: 11, bold: true, color: "000000",
              fontFace: FONT_FACE, valign: "middle", align: "left",
              margin: [0, 8, 0, 8],
            });
            if (l4.l4Desc) {
              slide.addText(l4.l4Desc, {
                x: PAD_X, y: l4BarY + L4_LABEL_H + 0.03, w: SLIDE_W - 2 * PAD_X, h: 0.22,
                fontSize: 7, italic: true, color: "666666",
                fontFace: FONT_FACE, valign: "top", align: "left",
              });
            }

            // ── L5 노드들 가로 배치 ──
            const l5s = l4.l5s;
            if (l5s.length === 0) {
              slide.addText("(하위 L5 업무 없음)", {
                x: PAD_X, y: PAD_TOP + 0.5, w: SLIDE_W - 2 * PAD_X, h: 0.3,
                fontSize: 9, italic: true, color: "999999",
                fontFace: FONT_FACE, align: "center",
              });
              continue;
            }

            // 가용 영역
            const areaW = SLIDE_W - 2 * PAD_X;
            const startY = PAD_TOP + (l4.l4Desc ? 0.3 : 0);

            // 가로 열 수 계산: 한 줄에 몇 개 들어가는지
            const maxPerRow = Math.max(1, Math.floor((areaW + L5_COL_GAP) / (L5_W + L5_COL_GAP)));
            const rows = Math.ceil(l5s.length / maxPerRow);

            // 세로 줄 간격
            const ROW_H = L5_TOTAL_H + ROLE_BAR_H + 0.15; // role bar + 메모 공간

            for (let i = 0; i < l5s.length; i++) {
              const l5 = l5s[i];
              const row = Math.floor(i / maxPerRow);
              const col = i % maxPerRow;

              // 해당 줄의 아이템 수
              const itemsInRow = Math.min(maxPerRow, l5s.length - row * maxPerRow);
              // 센터 정렬
              const totalRowW = itemsInRow * L5_W + (itemsInRow - 1) * L5_COL_GAP;
              const rowStartX = PAD_X + (areaW - totalRowW) / 2;

              const x = rowStartX + col * (L5_W + L5_COL_GAP);
              let y = startY + row * ROW_H;

              // ── 기타 역할 바 (위에 얹기) ──
              // 수행주체 결정
              let roleLabel = "";
              if (l5.actors) {
                const actorParts: string[] = [];
                if (l5.actors.exec) actorParts.push(l5.actors.exec);
                if (l5.actors.hr) actorParts.push(l5.actors.hr);
                if (l5.actors.teamlead) actorParts.push(l5.actors.teamlead);
                if (l5.actors.member) actorParts.push(l5.actors.member);
                if (actorParts.length > 0) roleLabel = actorParts.join(", ");
              }
              if (roleLabel) {
                slide.addText(roleLabel, {
                  x, y, w: L5_W, h: ROLE_BAR_H,
                  shape: pptx.ShapeType.rect,
                  fill: { color: "DBEAFE" },
                  line: { color: "93C5FD", width: 0.5 },
                  fontSize: 6, bold: true, color: "1D4ED8",
                  fontFace: FONT_FACE, valign: "middle", align: "center",
                });
                y += ROLE_BAR_H;
              }

              // ── L5 ID + 이름 (상단 박스) ──
              const dispId = l5.id.replace(/^[Ll]\d[-_.\s]*/g, "").trim() || l5.id;
              slide.addText(`${dispId}\n${l5.name}`, {
                x, y, w: L5_W, h: L5_UPPER_H,
                shape: pptx.ShapeType.rect,
                fill: { color: "FFFFFF" },
                line: { color: "DEDEDE", width: 0.25 },
                fontSize: 8, bold: true, color: "000000",
                fontFace: FONT_FACE, valign: "middle", align: "center",
              });

              // ── 시스템명 (하단 박스) ──
              let sysName = "시스템명";
              if (l5.systems) {
                const active = SYS_KEYS.filter(k => (l5.systems as Record<string, string>)[k.key]?.trim());
                if (active.length > 0) sysName = active.map(k => k.label).join(", ");
              }
              slide.addText(sysName, {
                x, y: y + L5_UPPER_H + L5_GAP, w: L5_W, h: L5_LOWER_H,
                shape: pptx.ShapeType.rect,
                fill: { color: "DEDEDE" },
                line: { width: 0 },
                fontSize: 6, color: "000000",
                fontFace: FONT_FACE, valign: "middle", align: "center",
              });

              // ── L5 간 연결선 (화살표) — 같은 줄 내 좌→우 ──
              if (col > 0) {
                const prevX = rowStartX + (col - 1) * (L5_W + L5_COL_GAP);
                const arrowY = y + L5_UPPER_H / 2;
                slide.addShape(pptx.ShapeType.line, {
                  x: prevX + L5_W + 0.02, y: arrowY,
                  w: L5_COL_GAP - 0.04, h: 0,
                  line: { color: "999999", width: 1 },
                });
                // 화살촉 (작은 삼각형)
                slide.addShape(pptx.ShapeType.triangle, {
                  x: x - 0.06, y: arrowY - 0.03,
                  w: 0.06, h: 0.06,
                  fill: { color: "999999" },
                  line: { width: 0 },
                  rotate: 90,
                });
              }
            }
          }
        }
        return slideCount;
      };

      if (splitByL3) {
        // ── L3별 분할: 각 L3마다 별도 PPT 파일 ──
        for (const g of l3Groups) {
          if (g.l4s.length === 0) continue;
          const pptx = new PptxGenJS();
          pptx.layout = "LAYOUT_WIDE";
          addSlidesToPptx(pptx, [g]);
          const filename = `PwC_HR_${g.l3Id}_${g.l3Name.replace(/[/\\?*:|"<>]/g, "_")}.pptx`;
          const arrBuf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
          saveAs(new Blob([arrBuf]), filename);
          // 약간의 딜레이로 브라우저 다운로드 안정화
          await new Promise(r => setTimeout(r, 300));
        }
        alert(`L3별 ${l3Groups.filter(g => g.l4s.length > 0).length}개 PPT 파일 생성 완료!`);
      } else {
        // ── 단일 PPT: 모든 L4를 하나의 PPT로 ──
        const pptx = new PptxGenJS();
        pptx.layout = "LAYOUT_WIDE";
        const count = addSlidesToPptx(pptx, l3Groups);
        const arrBuf = await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer;
        saveAs(new Blob([arrBuf]), `PwC_HR_일괄_L4x${count}.pptx`);
        alert(`총 ${count}페이지 PPT 생성 완료!`);
      }
    } catch (err) {
      console.error("Batch PPT export error:", err);
      alert("일괄 PPT 내보내기에 실패했습니다.");
    } finally {
      isExporting.current = false;
    }
  }, [csvRows]);

  /* ═══ Excel (CSV) Export ═══ */
  const handleExportExcel = useCallback(() => {
    /* 전체 시트 노드 수집 */
    type FlowNode = import("@xyflow/react").Node;
    const allNodes: FlowNode[] = [];
    if (sheets && getSheetData) {
      for (const s of sheets) {
        const sd = s.id === activeSheetId ? { nodes, edges } : getSheetData(s.id);
        allNodes.push(...sd.nodes);
      }
    } else {
      allNodes.push(...nodes);
    }

    if (csvRows && csvRows.length > 0) {
      /* CSV 있음: 머지 + 색상 강조 .xls */
      const rows = buildMergedRows(csvRows, allNodes);
      const blob = buildColoredXls(rows);
      saveAs(blob, `PwC_HR_Template_${Date.now()}.xls`);
    } else {
      /* CSV 없음: 캔버스 노드만 CSV */
      if (allNodes.length === 0) { alert("캔버스에 노드가 없습니다."); return; }
      const csv = buildTemplateCsvString(allNodes);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      saveAs(blob, `PwC_HR_Template_${Date.now()}.csv`);
    }
  }, [nodes, edges, csvRows, sheets, getSheetData, activeSheetId]);

  /* ═══ All-Sheets Excel (CSV) Export ═══ */
  const handleExportAllExcel = useCallback(() => {
    if (!sheets || !getSheetData) { alert("sheets 정보가 없습니다."); return; }
    type FlowNode = import("@xyflow/react").Node;
    const allNodes: FlowNode[] = [];
    for (const s of sheets) {
      const sd = s.id === activeSheetId ? { nodes, edges } : getSheetData(s.id);
      allNodes.push(...sd.nodes);
    }
    let csv: string;
    if (csvRows && csvRows.length > 0) {
      csv = buildMergedCsvString(csvRows, allNodes);
    } else {
      if (allNodes.length === 0) { alert("전체 시트에 노드가 없습니다."); return; }
      csv = buildTemplateCsvString(allNodes);
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `PwC_HR_AllSheets_${Date.now()}.csv`);
  }, [sheets, getSheetData, activeSheetId, nodes, edges, csvRows]);

  /* ═══ Canvas-Only Excel: 전체 시트에 올린 노드만 출력 (csvRows merge 없음) ═══ */
  const handleExportCanvasExcel = useCallback(() => {
    type FlowNode = import("@xyflow/react").Node;
    const allNodes: FlowNode[] = [];
    if (sheets && getSheetData) {
      for (const s of sheets) {
        const sd = s.id === activeSheetId ? { nodes, edges } : getSheetData(s.id);
        allNodes.push(...sd.nodes);
      }
    } else {
      allNodes.push(...nodes);
    }
    if (allNodes.length === 0) { alert("시트에 노드가 없습니다."); return; }
    const csv = buildTemplateCsvString(allNodes);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, `PwC_HR_Canvas_${Date.now()}.csv`);
  }, [sheets, getSheetData, activeSheetId, nodes, edges]);

  return (
    <>
    <div className="flex gap-1">
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
        onClick={handleExportExcel}
        className="text-[10px] font-medium bg-emerald-600 text-white rounded px-2 py-1.5 hover:bg-emerald-700 transition"
        title={csvRows && csvRows.length > 0 ? "원본 CSV + 전체 시트 수정/추가 내용 통합 (수정=노란색, 추가=초록색)" : "전체 시트 캔버스 노드 내보내기"}
      >
        📗 {csvRows && csvRows.length > 0 ? "통합 Excel" : "Excel"}
      </button>
      <button
        onClick={handleExportCanvasExcel}
        className="text-[10px] font-medium bg-lime-600 text-white rounded px-2 py-1.5 hover:bg-lime-700 transition"
        title="시트에 올린 노드만 내보내기 (원본 CSV 무관, 캔버스 기반)"
      >
        📋 시트만
      </button>
    </div>
</>
  );
}
