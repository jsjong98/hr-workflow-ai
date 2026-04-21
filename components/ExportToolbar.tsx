"use client";

import { useCallback, useRef } from "react";
import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";
import JSZip from "jszip";
import type { Node, Edge } from "@xyflow/react";
import type { Sheet } from "./SheetTabBar";
import { buildTemplateCsvString, buildMergedCsvString, buildMergedRows, type MergedRow, type CsvRow, extractL2List, extractL3ByL2, extractL4ByL3, extractL5ByL4 } from "@/lib/csvToFlow";
import { extractCustomRole, displayRole } from "@/lib/roleDisplay";

/** CSV 머지 결과를 색상 강조 Excel(.xlsx) Blob으로 변환
 *  - unchanged: 흰색 / modified: 노란색 / new: 초록색 */
async function buildColoredXlsx(rows: MergedRow[]): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("HR Workflow");

  const HEADER = [
    "ID","두산 L2","ID","Name","ID","Name","Description",
    "ID","Name","Description",
    "수행주체_현업 임원","수행주체_HR","수행주체_현업 팀장","수행주체_현업 구성원",
    "관리주체","담당자 수","주 담당자","평균 건당 소요시간","발생 빈도_건수",
    "사용 시스템_HR 전용시스템","사용 시스템_그룹웨어_협업툴","사용 시스템_오피스_문서도구",
    "사용 시스템_외부_연동시스템","사용 시스템_수작업_오프라인","사용 시스템_기타 전문 Tool",
    "Pain Point_시간_속도","Pain Point_정확성","Pain Point_반복/수작업",
    "Pain Point_정보_데이터","Pain Point_시스템_도구","Pain Point_의사소통_협업","Pain Point_기타",
    "Input_시스템 데이터","Input_문서_서류","Input_외부 정보","Input_구두_메일 요청","Input_기타",
    "Output_시스템 반영","Output_문서_보고서","Output_커뮤니케이션","Output_의사결정","Output_기타",
    "업무 판단 로직_Rule_based","업무 판단 로직_사람 판단","업무 판단 로직_혼합",
  ];

  /* ── 헤더 행 추가 ── */
  const headerRow = sheet.addRow(HEADER);
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } };
    cell.font = { bold: true, name: "Malgun Gothic", size: 10 };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
    cell.alignment = { wrapText: false, vertical: "middle" };
  });
  headerRow.height = 18;

  /* ── 배경색 맵 (ARGB) ── */
  const BG_ARGB: Record<string, string> = {
    new:       "FFC8E6C9",  // 초록
    modified:  "FFFFF9C4",  // 노란
    unchanged: "FFFFFFFF",  // 흰색
  };

  /* ── 데이터 행 추가 ── */
  for (const row of rows) {
    const dataRow = sheet.addRow(row.cols);
    const argb = BG_ARGB[row.status] ?? "FFFFFFFF";
    dataRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      cell.font = { name: "Malgun Gothic", size: 10 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCCCCCC" } },
        left: { style: "thin", color: { argb: "FFCCCCCC" } },
        bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
        right: { style: "thin", color: { argb: "FFCCCCCC" } },
      };
      cell.alignment = { wrapText: false, vertical: "middle" };
    });
    dataRow.height = 16;
  }

  /* ── 열 너비 자동 설정 ── */
  sheet.columns.forEach((col, i) => {
    col.width = i < 2 ? 12 : i < 10 ? 20 : 14;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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
        return { id: s.id, name: s.name, type: s.type, lanes: s.lanes, laneHeights: s.laneHeights, nodes: sd.nodes, edges: sd.edges };
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
      const MAX_COLS_PER_SLIDE = 6;

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
      const L5_ROLE_BAR_H = 0.142;  // 0.36cm — 커넥터 post-processing에서 role bar 보정에 사용
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
      /* ── SwimLane background bands (if active sheet is swimlane) ── */
      const isSwimLane = currentSheet?.type === "swimlane";
      const swimLanes = currentSheet?.lanes || ["현업 임원", "팀장", "HR 담당자", "구성원"];
      const PAD_X = isSwimLane ? 1.25 : 0.4; // 레이블 박스(1.05") 뒤로 밀기
      const PAD_TOP = 1.575; // 4cm 상단 여백
      const PAD_BOTTOM = 0.35;
      // 수영레인 밴드 상수 (Phase 2.6에서도 재사용)
      const SL_BAND_BOTTOM = SLIDE_H - PAD_BOTTOM + 0.05; // 7.2"
      const SWIM_BAND_H = Math.min(1.535, (SL_BAND_BOTTOM - 0.65) / swimLanes.length); // dynamic per lane count
      const SL_BAND_TOP = SL_BAND_BOTTOM - SWIM_BAND_H * swimLanes.length;
      const TOTAL_SWIM_H = SWIM_BAND_H * swimLanes.length;

      // ── 캔버스 레인 경계 (laneHeights 반영) ──
      const canvasLaneH = (currentSheet?.laneHeights && currentSheet.laneHeights.length === swimLanes.length)
        ? currentSheet.laneHeights
        : Array(swimLanes.length).fill(2400 / swimLanes.length);
      const canvasCumY: number[] = [];
      { let ct = 0; for (const h of canvasLaneH) { canvasCumY.push(ct); ct += h; } canvasCumY.push(ct); }
      const getCanvasLaneIdx = (rfY: number) => {
        for (let li = 0; li < swimLanes.length - 1; li++) { if (rfY < canvasCumY[li + 1]) return li; }
        return swimLanes.length - 1;
      };

      // ── 동적 레인 높이: 실제 행(row) 수 기반 — 빈 레인 최소화, 많은 행 = 더 큰 높이 ──
      const dynamicLaneH: number[] = swimLanes.map(() => SWIM_BAND_H);
      const dynamicLaneTops: number[] = [];
      if (isSwimLane) {
        // 레인별 실제 세로 행 수 계산 (Y 50px 이내 = 동일 행)
        const laneRowCounts: number[] = Array(swimLanes.length).fill(0);
        for (let li = 0; li < swimLanes.length; li++) {
          const ys = nodes
            .filter(nd => getCanvasLaneIdx(nd.position.y) === li)
            .map(nd => nd.position.y)
            .sort((a, b) => a - b);
          let rows = 0, lastY = -Infinity;
          for (const y of ys) { if (y - lastY > 50) { rows++; lastY = y; } }
          laneRowCounts[li] = rows; // 0 = 빈 레인
        }
        const MIN_EMPTY  = 0.25; // 빈 레인 고정 높이 (")
        const emptyCount = laneRowCounts.filter(c => c === 0).length;
        const totalRows  = laneRowCounts.reduce((s, c) => s + c, 0);
        const remainH    = Math.max(0, TOTAL_SWIM_H - emptyCount * MIN_EMPTY);
        for (let i = 0; i < swimLanes.length; i++) {
          dynamicLaneH[i] = laneRowCounts[i] === 0
            ? MIN_EMPTY
            : totalRows > 0 ? remainH * (laneRowCounts[i] / totalRows) : remainH / (swimLanes.length - emptyCount);
        }
        // 정규화: 합 = TOTAL_SWIM_H
        const hSum = dynamicLaneH.reduce((s, h) => s + h, 0);
        for (let i = 0; i < dynamicLaneH.length; i++) dynamicLaneH[i] *= TOTAL_SWIM_H / hSum;
      }
      // 레인 상단 좌표 계산
      { let ct = SL_BAND_TOP; for (let i = 0; i < swimLanes.length; i++) { dynamicLaneTops.push(ct); ct += dynamicLaneH[i]; } }

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

      // ── 사전 컬럼 그룹 계산: 60px 이내를 같은 X 컬럼으로 간주 (Phase 2 pColGrps와 동일 규칙) ──
      const prelimColVis = new Set<string>();
      const prelimColGrps: string[][] = [];
      const prelimSortedIds = [...nodes]
        .sort((a, b) => a.position.x - b.position.x)
        .map((nd) => nd.id);
      for (const id of prelimSortedIds) {
        if (prelimColVis.has(id)) continue;
        const baseNode = nodeMap.get(id);
        if (!baseNode) continue;
        const grp: string[] = [id];
        prelimColVis.add(id);
        for (const id2 of prelimSortedIds) {
          const cmpNode = nodeMap.get(id2);
          if (!cmpNode || prelimColVis.has(id2)) continue;
          if (Math.abs(cmpNode.position.x - baseNode.position.x) <= 60) {
            grp.push(id2);
            prelimColVis.add(id2);
          }
        }
        prelimColGrps.push(grp);
      }
      const willPaginate = prelimColGrps.length > MAX_COLS_PER_SLIDE;

      // 페이지 청크: 1쪽은 6컬럼 / 2쪽 이후는 5신규 + 1고스트 = 6컬럼 유지
      const STRIDE_LATER = MAX_COLS_PER_SLIDE - 1;
      const makeChunks = (grps: string[][]): string[][][] => {
        const chunks: string[][][] = [];
        if (grps.length === 0) return chunks;
        if (grps.length <= MAX_COLS_PER_SLIDE) {
          chunks.push(grps.slice());
          return chunks;
        }
        chunks.push(grps.slice(0, MAX_COLS_PER_SLIDE));
        let cursor = MAX_COLS_PER_SLIDE;
        while (cursor < grps.length) {
          chunks.push(grps.slice(cursor, cursor + STRIDE_LATER));
          cursor += STRIDE_LATER;
        }
        return chunks;
      };

      // 각 페이지(고스트 포함)의 RF 픽셀 X-폭 중 최대값 — sc 계산용
      const prelimChunks = makeChunks(prelimColGrps);
      let maxChunkRfExtent = 0;
      for (let k = 0; k < prelimChunks.length; k++) {
        const base = prelimChunks[k];
        const ghost = k > 0 ? prelimChunks[k - 1][prelimChunks[k - 1].length - 1] : null;
        const effective = ghost ? [ghost, ...base] : base;
        let minX = Infinity;
        let maxXEnd = -Infinity;
        for (const grp of effective) {
          for (const id of grp) {
            const nd = nodeMap.get(id);
            if (!nd) continue;
            const lv = getLevel(nd);
            const style = LS[lv] || DEF;
            const rfX = nd.position.x;
            minX = Math.min(minX, rfX);
            maxXEnd = Math.max(maxXEnd, rfX + style.pxW);
          }
        }
        if (isFinite(minX)) maxChunkRfExtent = Math.max(maxChunkRfExtent, maxXEnd - minX);
      }

      // 가로/세로 비율 중 작은 쪽으로 단일 스케일 결정
      // 페이지네이션 시: Y 전체 범위 + 페이지당 X 폭으로 제약 (X 전체를 한 페이지에 구겨 넣지 않지만 각 페이지는 슬라이드 폭 안)
      const scFit = willPaginate
        ? Math.min(areaH / bRangeY, areaW / Math.max(maxChunkRfExtent, 1))
        : Math.min(areaW / bRangeX, areaH / bRangeY);
      // 기준 스케일: L4 노드 세로 2cm(0.787") 기준 (노드 규격 통일)
      const scRef = 0.787 / DEF.pxH;
      const sc = Math.min(scFit, scRef);

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
      const globalNodeBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const grp of pColGrps) {
        grp.sort((a, b) => rawPos[a].rfY - rawPos[b].rfY);
        const snapX = PAD_X + (Math.min(...grp.map(id => rawPos[id].rfX)) - bMinX) * sc;
        const y0 = PAD_TOP + (rawPos[grp[0]].rfY - bMinY) * sc;
        if (grp.length === 1) {
          globalNodeBoxes[grp[0]] = { x: snapX, y: y0, w: rawPos[grp[0]].w, h: rawPos[grp[0]].h };
        } else {
          const lastId = grp[grp.length - 1];
          const yLast = PAD_TOP + (rawPos[lastId].rfY - bMinY) * sc;
          const span = yLast + rawPos[lastId].h - y0;
          const sumH = grp.reduce((acc, id) => acc + rawPos[id].h, 0);
          const gap = Math.max((span - sumH) / (grp.length - 1), 0.06);
          let curY = y0;
          for (const id of grp) {
            globalNodeBoxes[id] = { x: snapX, y: curY, w: rawPos[id].w, h: rawPos[id].h };
            curY += rawPos[id].h + gap;
          }
        }
      }

      // ── Phase 2.5: Cross-column Y 정렬 (수영레인 모드에서는 스킵) ──
      if (!isSwimLane) {
        for (const grp of pColGrps) {
          if (grp.length !== 1) continue;
          const nid = grp[0];
          const box = globalNodeBoxes[nid];
          if (!box) continue;
          const connCenterYs: number[] = [];
          for (const e of edges) {
            const cid = e.target === nid ? e.source : e.source === nid ? e.target : null;
            if (!cid) continue;
            const cb = globalNodeBoxes[cid];
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
        const laneMap: Record<number, string[]> = {};
        for (const nd of nodes) {
          const box = globalNodeBoxes[nd.id];
          if (!box) continue;
          const laneIdx = getCanvasLaneIdx(nd.position.y);
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
            return { id, rfY: nd.position.y, h: globalNodeBoxes[id].h };
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
              globalNodeBoxes[id].y = laneTop + (laneH - h) / 2;
            }
            // 비-L5 노드: L5 커넥터Y에 맞춰서 정렬 (connY = y + h/2 == l5ConnY)
            if (l5Items.length > 0 && otherItems.length > 0) {
              const l5Y0 = globalNodeBoxes[l5Items[0].id].y;
              const l5ConnY = l5Y0 + L5_UPPER_H / 2;
              for (const { id, h } of otherItems) {
                globalNodeBoxes[id].y = l5ConnY - h / 2;
              }
            } else {
              for (const { id, h } of otherItems) {
                globalNodeBoxes[id].y = laneTop + (laneH - h) / 2;
              }
            }
          } else {
            // 비례 매핑: 캔버스 상대위치 → PPT 레인 내 위치 (두 행 그대로 유지)
            const maxH = Math.max(...items.map(c => c.h));
            const availSpan = laneH - 2 * pad - maxH;
            for (const { id, rfY, h } of items) {
              const ratio = (rfY - rfYMin) / rfSpan;
              globalNodeBoxes[id].y = laneTop + pad + ratio * Math.max(availSpan, 0);
            }
          }
        }
      }

      // 페이지 청크 — 1쪽: 6컬럼 / 2쪽+: 5신규 + 1고스트 = 항상 최대 6컬럼/슬라이드
      const pColChunks = makeChunks(pColGrps);

      interface NodeShapeMeta { x: number; y: number; w: number; h: number }
      interface ConnectorMeta {
        srcNodeId: string; tgtNodeId: string;
        srcBox: { x: number; y: number; w: number; h: number };
        tgtBox: { x: number; y: number; w: number; h: number };
        srcIsL5: boolean; tgtIsL5: boolean;
        srcIsDec: boolean; tgtIsDec: boolean;
        isStraight: boolean;
        isHorizontal: boolean;
        bidi: boolean;
        label?: string;
        // React Flow 원본 핸들 id — 사용자가 웹에서 지정한 연결점 유지용
        // 값 예: "top"/"right"/"bottom"/"left" (source) 또는 "t-top"/"t-right"/"t-bottom"/"t-left" (target)
        srcHandle?: string;
        tgtHandle?: string;
      }
      interface L5AnchorSet {
        rolebarCnv?: number;
        upperCnv?: number;
        lowerCnv?: number;
        hasRoleBar: boolean;
      }
      interface DiagramPageMeta {
        slideIdx: number;
        pageNodeBoxes: Record<string, { x: number; y: number; w: number; h: number }>;
        connectors: ConnectorMeta[];
        nodeGroupShapes: Record<string, NodeShapeMeta[]>;
        nodeShapeCnvIds: Record<string, number[]>;
        l5Anchors: Record<string, L5AnchorSet>;
      }

      const nodeLevelMap: Record<string, string> = {};
      for (const nd of nodes) nodeLevelMap[nd.id] = getLevel(nd);

      const yOverlap = (a: { y: number; h: number }, b: { y: number; h: number }) =>
        a.y < b.y + b.h && b.y < a.y + a.h;
      const xOverlap = (a: { x: number; w: number }, b: { x: number; w: number }) =>
        a.x < b.x + b.w && b.x < a.x + a.w;
      const withGhostLine = (line: Record<string, unknown>, isGhost: boolean, keepNoBorder = false) =>
        (isGhost && !keepNoBorder ? { ...line, dashType: "dash" } : line);

      const addDiagramChrome = (slide: PptxGenJS.Slide, titleText: string) => {
        slide.background = { color: "F8FAFC" };
        slide.addText(titleText, {
          x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
          fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
        });
        if (!isSwimLane) return;
        let ly = SL_BAND_TOP;
        for (let i = 0; i <= swimLanes.length; i++) {
          slide.addShape("line", {
            x: 0, y: ly, w: SLIDE_W, h: 0,
            line: { color: "B0B0B0", width: 0.75, dashType: "dash" },
          });
          if (i < swimLanes.length) ly += dynamicLaneH[i];
        }
        const LBL_BOX_W = 1.05;
        const LBL_BOX_H = 0.26;
        for (let i = 0; i < swimLanes.length; i++) {
          const labelY = dynamicLaneTops[i] + 0.06;
          slide.addText(swimLanes[i], {
            x: 0.04, y: labelY, w: LBL_BOX_W, h: LBL_BOX_H,
            shape: pptx.ShapeType.rect,
            fill: { color: "FFFFFF" },
            line: { color: "B0B0B0", width: 0.5 },
            fontSize: 9, fontFace: FONT_FACE, color: "333333",
            align: "center", valign: "middle",
          });
        }
      };

      const addDiagramLegend = (slide: PptxGenJS.Slide) => {
        let legendX = 0.4;
        for (const [lvl, cfg] of Object.entries(LS)) {
          slide.addText("", {
            x: legendX, y: SLIDE_H - 0.28, w: 0.22, h: 0.22,
            shape: pptx.ShapeType.rect,
            fill: { color: cfg.bg }, line: { color: cfg.border, width: 0.5 },
          });
          slide.addText(lvl, {
            x: legendX + 0.28, y: SLIDE_H - 0.28, w: 0.5, h: 0.22,
            fontSize: 8, color: "64748B", fontFace: FONT_FACE, valign: "middle",
          });
          legendX += 0.9;
        }
        slide.addText("── 실선  ▶ 화살표: 진행 방향", {
          x: 4.0, y: SLIDE_H - 0.28, w: 4.0, h: 0.22,
          fontSize: 7, color: "94A3B8", fontFace: FONT_FACE, valign: "middle",
        });
      };

      const diagramPages: DiagramPageMeta[] = [];
      const totalPages = Math.max(pColChunks.length, 1);

      for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
        const pageNo = pageIdx + 1;
        const baseColGrps = pColChunks[pageIdx] || [];
        const ghostColGrp = pageIdx > 0 ? (pColChunks[pageIdx - 1]?.[pColChunks[pageIdx - 1].length - 1] || []) : [];
        const pageColGrps = pageIdx > 0 && ghostColGrp.length > 0 ? [ghostColGrp, ...baseColGrps] : baseColGrps;
        if (pageColGrps.length === 0) continue;

        const firstColAnyNode = pageColGrps[0].find((nodeId) => !!globalNodeBoxes[nodeId]) || pageColGrps[0][0];
        if (!firstColAnyNode || !globalNodeBoxes[firstColAnyNode]) continue;

        const pageDX = PAD_X - globalNodeBoxes[firstColAnyNode].x;
        const pageNodeSet = new Set<string>();
        const ghostNodeSet = new Set<string>(ghostColGrp);
        const pageNodeBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};

        for (const grp of pageColGrps) {
          for (const nodeId of grp) {
            if (pageNodeSet.has(nodeId)) continue;
            const gBox = globalNodeBoxes[nodeId];
            if (!gBox) continue;
            pageNodeSet.add(nodeId);
            pageNodeBoxes[nodeId] = { x: gBox.x + pageDX, y: gBox.y, w: gBox.w, h: gBox.h };
          }
        }

        const pageSlide = pptx.addSlide();
        addDiagramChrome(
          pageSlide,
          totalPages > 1 ? `${slideTitle} (${pageNo}/${totalPages})` : slideTitle,
        );

        const nodeGroupShapes: Record<string, NodeShapeMeta[]> = {};
        // L5 사용자 정의 역할 바 유무 — 커넥터 post-processing에서 서브도형 바인딩 및 <a:off> Y 계산에 필요
        const pageNodeHasRoleBar: Record<string, boolean> = {};
        for (const nd of nodes) {
          if (!pageNodeSet.has(nd.id)) continue;

          const level = getLevel(nd);
          const s = LS[level] || DEF;
          const box = pageNodeBoxes[nd.id];
          if (!box) continue;
          const dispLabel = getLabel(nd);
          const dispId = getDisplayId(nd);
          const isGhost = ghostNodeSet.has(nd.id);
          const shapeList: NodeShapeMeta[] = [];
          let l5YOffset = 0;

          if (level === "DECISION") {
            pageSlide.addText(dispLabel || "판정 조건", {
              x: box.x, y: box.y, w: DECISION_W, h: DECISION_H,
              shape: pptx.ShapeType.diamond,
              fill: { color: "F2A0AF" },
              line: withGhostLine({ color: "D95578", width: 1.5 }, isGhost),
              fontSize: 7, bold: true, color: "3B0716",
              fontFace: "Noto Sans KR", valign: "middle", align: "center",
              objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y, w: DECISION_W, h: DECISION_H });
          } else if (level === "MEMO") {
            const memoText = (nd.data as Record<string, string>).text || dispLabel || "";
            pageSlide.addText(memoText || "", {
              x: box.x, y: box.y, w: MEMO_W, h: MEMO_H,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFF9C4" },
              line: withGhostLine({ color: "FBC02D", width: 0.75 }, isGhost),
              fontSize: 9, color: "6D4C00",
              fontFace: FONT_FACE, valign: "top", align: "left",
              margin: [4, 4, 4, 4],
              objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y, w: MEMO_W, h: MEMO_H });
          } else if (level === "L5") {
            const ROLE_BAR_H = 0.142;
            const roleVal = (nd.data as Record<string, string>).role || "";
            const roleDisplay = extractCustomRole(roleVal);
            const hasRB = !!roleDisplay;
            pageNodeHasRoleBar[nd.id] = hasRB;
            if (roleDisplay) {
              pageSlide.addText(roleDisplay, {
                x: box.x, y: box.y, w: L5_FIXED_W, h: ROLE_BAR_H,
                shape: pptx.ShapeType.rect,
                fill: { color: "DBEAFE" },
                line: withGhostLine({ color: "93C5FD", width: 0.5 }, isGhost),
                fontSize: 7, bold: true, color: "1D4ED8",
                fontFace: FONT_FACE, valign: "middle", align: "center",
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}_rolebar`,
              });
              shapeList.push({ x: box.x, y: box.y, w: L5_FIXED_W, h: ROLE_BAR_H });
              l5YOffset = ROLE_BAR_H;
            }

            pageSlide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
              x: box.x, y: box.y + l5YOffset, w: L5_FIXED_W, h: L5_UPPER_H,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFFFFF" },
              line: withGhostLine({ color: "DEDEDE", width: 0.25 }, isGhost),
              fontSize: 9, bold: true, color: "000000",
              fontFace: FONT_FACE, valign: "middle", align: "center",
              objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}_upper`,
            });
            shapeList.push({ x: box.x, y: box.y + l5YOffset, w: L5_FIXED_W, h: L5_UPPER_H });

            const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
            const sysStr = (nd.data as Record<string, string>).system || "";
            let sysName = "";
            if (sysStr) {
              sysName = sysStr;
            } else if (sysMap) {
              const parts: string[] = [];
              if (sysMap.hr?.trim()) parts.push(sysMap.hr.trim());
              if (sysMap.groupware?.trim()) parts.push(sysMap.groupware.trim());
              if (sysMap.office?.trim()) parts.push(sysMap.office.trim());
              if (sysMap.external?.trim()) parts.push(sysMap.external.trim());
              if (sysMap.manual?.trim()) parts.push(sysMap.manual.trim());
              if (sysMap.etc?.trim()) parts.push(sysMap.etc.trim());
              if (parts.length > 0) sysName = parts.join(" / ");
            }

            pageSlide.addText(sysName, {
              x: box.x, y: box.y + l5YOffset + L5_UPPER_H + L5_GAP, w: L5_FIXED_W, h: L5_LOWER_H,
              shape: pptx.ShapeType.rect,
              fill: { color: "DEDEDE" },
              line: withGhostLine({ width: 0 }, isGhost, true),
              fontSize: 7, bold: false, color: "000000",
              fontFace: FONT_FACE, valign: "middle", align: "center",
              objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}_lower`,
            });
            shapeList.push({ x: box.x, y: box.y + l5YOffset + L5_UPPER_H + L5_GAP, w: L5_FIXED_W, h: L5_LOWER_H });
          } else {
            pageSlide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
              x: box.x, y: box.y, w: box.w, h: box.h,
              shape: pptx.ShapeType.rect,
              fill: { color: s.bg },
              line: withGhostLine({ color: s.border, width: 0.25 }, isGhost),
              fontSize: NODE_FONT_SIZE, bold: true, color: s.text,
              fontFace: FONT_FACE, valign: "middle", align: "center",
              objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: box.y, w: box.w, h: box.h });

            const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
            if (sysMap) {
              const SYS_KEYS: { key: string }[] = [
                { key: "hr" }, { key: "groupware" }, { key: "office" }, { key: "external" }, { key: "manual" }, { key: "etc" },
              ];
              const activeSys = SYS_KEYS.filter((k) => sysMap[k.key]?.trim());
              if (activeSys.length > 0) {
                pageSlide.addText(activeSys.map((k) => `🖥 ${sysMap[k.key]!.trim()}`).join("  "), {
                  x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2,
                  fontSize: Math.max(NODE_FONT_SIZE - 2, 6), color: s.bg,
                  fontFace: FONT_FACE, align: "center", bold: true,
                  objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
                });
                shapeList.push({ x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2 });
              }
            }
          }

          if (level !== "L5") {
            const roleStr = (nd.data as Record<string, string>).role || "";
            const customName = extractCustomRole(roleStr);
            if (customName) {
              const tagW = Math.max(box.w, L5_FIXED_W);
              const tagH = 0.142;
              pageSlide.addText(customName, {
                x: box.x, y: box.y - tagH,
                w: tagW, h: tagH,
                shape: pptx.ShapeType.rect,
                fill: { color: "DBEAFE" },
                line: withGhostLine({ color: "93C5FD", width: 0.5 }, isGhost),
                fontSize: 7, bold: true, color: "1D4ED8",
                fontFace: FONT_FACE, valign: "middle", align: "center",
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: box.y - tagH, w: tagW, h: tagH });
            }
          }

          const memoStr = (nd.data as Record<string, string>).memo || "";
          if (memoStr) {
            const memoW = Math.max(box.w, 1.0);
            const memoH = 0.28;
            const memoY = box.y + l5YOffset + box.h + 0.04;
            pageSlide.addText(memoStr, {
              x: box.x, y: memoY,
              w: memoW, h: memoH,
              shape: pptx.ShapeType.rect,
              fill: { color: "FFF9C4" },
              line: withGhostLine({ color: "FBC02D", width: 0.5 }, isGhost),
              fontSize: 7, color: "6D4C00",
              fontFace: FONT_FACE, valign: "middle", align: "left",
              margin: [0, 4, 0, 4],
              objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
            });
            shapeList.push({ x: box.x, y: memoY, w: memoW, h: memoH });
          }

          if (shapeList.length > 1) nodeGroupShapes[nd.id] = shapeList;
        }

        const pageNodeShapeCnvIds: Record<string, number[]> = {};
        const pageL5Anchors: Record<string, L5AnchorSet> = {};
        const pageSlideObjs = (pageSlide as unknown as { _slideObjects: Array<{ options?: { objectName?: string } }> })._slideObjects;
        for (const [nodeId] of Object.entries(nodeGroupShapes)) {
          const prefix = `GRP_p${pageNo}_${nodeId}_`;
          const ids: number[] = [];
          const anchors: L5AnchorSet = { hasRoleBar: pageNodeHasRoleBar[nodeId] === true };
          for (let idx = 0; idx < pageSlideObjs.length; idx++) {
            const objName = pageSlideObjs[idx]?.options?.objectName;
            if (!objName || !objName.startsWith(prefix)) continue;
            const cnvId = idx + 2;
            ids.push(cnvId);
            if (objName.endsWith("_rolebar")) anchors.rolebarCnv = cnvId;
            else if (objName.endsWith("_upper")) anchors.upperCnv = cnvId;
            else if (objName.endsWith("_lower")) anchors.lowerCnv = cnvId;
          }
          if (ids.length >= 2) pageNodeShapeCnvIds[nodeId] = ids;
          if (anchors.upperCnv && anchors.lowerCnv) pageL5Anchors[nodeId] = anchors;
        }

        const pageConnectors: ConnectorMeta[] = [];
        for (const e of edges) {
          if (!pageNodeSet.has(e.source) || !pageNodeSet.has(e.target)) continue;
          const src = pageNodeBoxes[e.source];
          const tgt = pageNodeBoxes[e.target];
          if (!src || !tgt) continue;
          const bidi = !!(e.markerStart || (e.data as Record<string, unknown>)?.bidirectional);
          const srcCx = src.x + src.w / 2;
          const tgtCx = tgt.x + tgt.w / 2;
          const dx = tgtCx - srcCx;
          const dy = (tgt.y + tgt.h / 2) - (src.y + src.h / 2);
          const sameRow = yOverlap(src, tgt);
          const sameCol = xOverlap(src, tgt);
          const isStraight = (sameRow && !sameCol) || (sameCol && !sameRow);
          const isHorizontal = sameRow ? true : sameCol ? false : Math.abs(dx) >= Math.abs(dy);
          pageConnectors.push({
            srcNodeId: e.source,
            tgtNodeId: e.target,
            srcBox: src,
            tgtBox: tgt,
            srcIsL5: nodeLevelMap[e.source] === "L5",
            tgtIsL5: nodeLevelMap[e.target] === "L5",
            srcIsDec: nodeLevelMap[e.source] === "DECISION",
            tgtIsDec: nodeLevelMap[e.target] === "DECISION",
            isStraight,
            isHorizontal,
            bidi,
            label: e.label ? String(e.label) : undefined,
            srcHandle: e.sourceHandle || undefined,
            tgtHandle: e.targetHandle || undefined,
          });
        }

        // 크로스 페이지 엣지는 고스트 컬럼이 커버 (페이지 경계 1단계). 2페이지 이상 건너뛰는 엣지는
        // 시각적으로 드물고, 참조 스텁이 DECISION Yes/No 라벨 공간을 침범해서 혼잡해지므로 표시하지 않음.
        addDiagramLegend(pageSlide);
        diagramPages.push({
          slideIdx: 2 + pageIdx,
          pageNodeBoxes,
          connectors: pageConnectors,
          nodeGroupShapes,
          nodeShapeCnvIds: pageNodeShapeCnvIds,
          l5Anchors: pageL5Anchors,
        });
      }

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
            { text: displayRole(m.role), options: { fontSize: 8, color: "374151", align: "center" as const } },
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

      for (const pageMeta of diagramPages) {
        const hasConnectors = pageMeta.connectors.length > 0;
        const hasGroups = Object.keys(pageMeta.nodeShapeCnvIds).length > 0;
        if (!hasConnectors && !hasGroups) continue;

        const slidePath = `ppt/slides/slide${pageMeta.slideIdx}.xml`;
        let slideXml = await zip.file(slidePath)?.async("string") || "";
        if (!slideXml) continue;

        // ── STEP 1: 도형 그룹화 — 그룹 bbox는 모든 자식 도형의 union (시각적 이동 시 일관성) ──
        // 커넥터는 그룹이 아닌 개별 서브도형의 cNvPr에 바인딩됨 (PowerPoint가 그룹 stCxn은 신뢰 못해서 끊김 유발).
        if (hasGroups) {
          let grpSlideXml = slideXml;
          let grpMaxId = 0;
          for (const m of grpSlideXml.match(/id="(\d+)"/g) || []) {
            const n = parseInt(m.match(/\d+/)![0], 10);
            if (n > grpMaxId) grpMaxId = n;
          }
          let grpNextId = grpMaxId + 1;

          const allSpBlocks = grpSlideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
          const idToBlock: Record<number, string> = {};
          for (const blk of allSpBlocks) {
            const im = blk.match(/<p:cNvPr\s[^>]*?id="(\d+)"/);
            if (im) idToBlock[parseInt(im[1], 10)] = blk;
          }

          interface GrpPending {
            matchedBlocks: string[];
            gMinX: number; gMinY: number; gMaxX: number; gMaxY: number;
            id: number;
          }
          const pendingGroups: GrpPending[] = [];
          const claimedIds = new Set<number>();

          for (const [nodeId, cnvIds] of Object.entries(pageMeta.nodeShapeCnvIds)) {
            const shapes = pageMeta.nodeGroupShapes[nodeId];
            if (!shapes) continue;
            const matchedBlocks: string[] = [];
            const matchedShapeIdxs: number[] = [];
            for (let i = 0; i < cnvIds.length; i++) {
              const cid = cnvIds[i];
              if (claimedIds.has(cid)) continue;
              const blk = idToBlock[cid];
              if (!blk) continue;
              matchedBlocks.push(blk);
              matchedShapeIdxs.push(i);
              claimedIds.add(cid);
            }
            if (matchedBlocks.length < 2) continue;

            // Union bbox: 모든 자식(memo/role tag/sys icons 포함) 영역
            let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
            for (const si of matchedShapeIdxs) {
              const sh = shapes[si];
              if (!sh) continue;
              const bx = Math.round(sh.x * EMU), by = Math.round(sh.y * EMU);
              const bcx = Math.round(sh.w * EMU), bcy = Math.round(sh.h * EMU);
              gMinX = Math.min(gMinX, bx); gMinY = Math.min(gMinY, by);
              gMaxX = Math.max(gMaxX, bx + bcx); gMaxY = Math.max(gMaxY, by + bcy);
            }
            if (!isFinite(gMinX)) continue;
            pendingGroups.push({ matchedBlocks, gMinX, gMinY, gMaxX, gMaxY, id: grpNextId++ });
          }

          for (const pg of pendingGroups) {
            for (const blk of pg.matchedBlocks) grpSlideXml = grpSlideXml.replace(blk, "");
            const grpSp = `<p:grpSp>`
              + `<p:nvGrpSpPr><p:cNvPr id="${pg.id}" name="Group ${pg.id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
              + `<p:grpSpPr><a:xfrm><a:off x="${pg.gMinX}" y="${pg.gMinY}"/><a:ext cx="${pg.gMaxX - pg.gMinX}" cy="${pg.gMaxY - pg.gMinY}"/>`
              + `<a:chOff x="${pg.gMinX}" y="${pg.gMinY}"/><a:chExt cx="${pg.gMaxX - pg.gMinX}" cy="${pg.gMaxY - pg.gMinY}"/></a:xfrm></p:grpSpPr>`
              + pg.matchedBlocks.join("")
              + `</p:grpSp>`;
            grpSlideXml = grpSlideXml.replace("</p:spTree>", grpSp + "</p:spTree>");
          }
          slideXml = grpSlideXml;
        }

        if (hasConnectors) {
          // 모든 노드에 대해 위치 기반 shape 매칭 — 그룹 안이든 밖이든 <p:sp> 위치가 (box.x, box.y)인 것을 찾음
          // (그룹 cnvId를 stCxn 타겟으로 쓰면 PowerPoint가 재경로를 놓쳐 연결 끊김 유발)
          const shapeIdMap: Record<string, string> = {};
          let maxShapeId = 0;
          for (const m of slideXml.match(/id="(\d+)"/g) || []) {
            const n = parseInt(m.match(/\d+/)![0], 10);
            if (n > maxShapeId) maxShapeId = n;
          }
          const spBlocks = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
          for (const block of spBlocks) {
            const idMatch = block.match(/<p:cNvPr\s[^>]*?id="(\d+)"/);
            if (!idMatch) continue;
            const offBlock = block.match(/<a:off\s([^>]*)\/?>/);
            if (!offBlock) continue;
            const xm = offBlock[1].match(/x="(\d+)"/);
            const ym = offBlock[1].match(/y="(\d+)"/);
            if (!xm || !ym) continue;
            const xEmu = parseInt(xm[1], 10);
            const yEmu = parseInt(ym[1], 10);
            const tol = Math.round(EMU * 0.02);

            for (const [nid, box] of Object.entries(pageMeta.pageNodeBoxes)) {
              if (shapeIdMap[nid]) continue;
              const ex = Math.round(box.x * EMU);
              const ey = Math.round(box.y * EMU);
              if (Math.abs(xEmu - ex) < tol && Math.abs(yEmu - ey) < tol) {
                shapeIdMap[nid] = idMatch[1];
                break;
              }
            }
          }

          let cxnXml = "";
          let nextId = maxShapeId + 1;
          for (const c of pageMeta.connectors) {
            let srcSid = shapeIdMap[c.srcNodeId];
            let tgtSid = shapeIdMap[c.tgtNodeId];
            if (!srcSid || !tgtSid) continue;

            const src = c.srcBox;
            const tgt = c.tgtBox;
            const srcCx = src.x + src.w / 2;
            const srcCy = src.y + src.h / 2;
            const tgtCx = tgt.x + tgt.w / 2;
            const tgtCy = tgt.y + tgt.h / 2;
            const cdx = tgtCx - srcCx;
            const cdy = tgtCy - srcCy;

            // L5 앵커: 서브도형별 cNvPr + role bar 여부 (개별 서브도형에 직접 바인딩)
            const srcAnchors = c.srcIsL5 ? pageMeta.l5Anchors[c.srcNodeId] : undefined;
            const tgtAnchors = c.tgtIsL5 ? pageMeta.l5Anchors[c.tgtNodeId] : undefined;
            const srcRB = srcAnchors?.hasRoleBar ? L5_ROLE_BAR_H : 0;
            const tgtRB = tgtAnchors?.hasRoleBar ? L5_ROLE_BAR_H : 0;
            // L5 수평 커넥터 Y: upper 박스 중앙 (label 영역 한가운데 — 시각적으로 가장 자연스러움)
            const srcConnY = c.srcIsL5 ? src.y + srcRB + L5_UPPER_H / 2 : srcCy;
            const tgtConnY = c.tgtIsL5 ? tgt.y + tgtRB + L5_UPPER_H / 2 : tgtCy;
            // L5 전체 높이 (role bar 포함) — top/bottom 핸들 Y 계산용
            const srcFullH = c.srcIsL5 ? srcRB + L5_FIXED_H : src.h;
            const tgtFullH = c.tgtIsL5 ? tgtRB + L5_FIXED_H : tgt.h;

            // React Flow 핸들 id (top/right/bottom/left, target은 t- 접두사) → OOXML idx/좌표로 해석
            // 사용자가 웹에서 명시적으로 붙여둔 지점을 PPT에서도 동일하게 유지해서
            // 도형 이동 시 PowerPoint 재경로가 원 의도대로 동작하도록 보장
            const resolveHandle = (
              handle: string | undefined,
              bx: { x: number; y: number; w: number; h: number },
              isL5: boolean,
              fullH: number,
              connY: number,
            ): { idx: number; x: number; y: number } | null => {
              if (!handle) return null;
              const key = handle.startsWith("t-") ? handle.slice(2) : handle;
              switch (key) {
                case "top":    return { idx: 0, x: bx.x + bx.w / 2, y: bx.y };
                case "right":  return { idx: 1, x: bx.x + bx.w,     y: isL5 ? connY : bx.y + bx.h / 2 };
                case "bottom": return { idx: 2, x: bx.x + bx.w / 2, y: bx.y + fullH };
                case "left":   return { idx: 3, x: bx.x,            y: isL5 ? connY : bx.y + bx.h / 2 };
              }
              return null;
            };
            const srcExplicit = resolveHandle(c.srcHandle, src, c.srcIsL5, srcFullH, srcConnY);
            const tgtExplicit = resolveHandle(c.tgtHandle, tgt, c.tgtIsL5, tgtFullH, tgtConnY);

            // 세로 라우팅 fallback (명시적 핸들 없을 때): X 범위 겹침 + Y 범위 안 겹침 → top/bottom
            const sameColX = src.x < tgt.x + tgt.w && tgt.x < src.x + src.w;
            const sameRowY = src.y < tgt.y + tgtFullH && tgt.y < src.y + srcFullH;
            const useVertical = !c.srcIsDec && !c.tgtIsDec && sameColX && !sameRowY;

            let stIdx: number;
            let x1: number;
            let y1: number;
            let endIdx: number;
            let x2: number;
            let y2: number;

            if (srcExplicit) {
              stIdx = srcExplicit.idx; x1 = srcExplicit.x; y1 = srcExplicit.y;
            } else if (c.srcIsDec) {
              if (Math.abs(cdx) >= Math.abs(cdy)) {
                if (cdx >= 0) { stIdx = 1; x1 = src.x + src.w; y1 = srcCy; }
                else { stIdx = 3; x1 = src.x; y1 = srcCy; }
              } else if (cdy >= 0) {
                stIdx = 2; x1 = srcCx; y1 = src.y + src.h;
              } else {
                stIdx = 0; x1 = srcCx; y1 = src.y;
              }
            } else if (useVertical) {
              if (cdy >= 0) { stIdx = 2; x1 = srcCx; y1 = src.y + srcFullH; }
              else { stIdx = 0; x1 = srcCx; y1 = src.y; }
            } else {
              stIdx = 1; x1 = src.x + src.w; y1 = srcConnY;
            }

            if (tgtExplicit) {
              endIdx = tgtExplicit.idx; x2 = tgtExplicit.x; y2 = tgtExplicit.y;
            } else if (c.tgtIsDec) {
              if (Math.abs(cdx) >= Math.abs(cdy)) {
                if (cdx >= 0) { endIdx = 3; x2 = tgt.x; y2 = tgtCy; }
                else { endIdx = 1; x2 = tgt.x + tgt.w; y2 = tgtCy; }
              } else if (cdy >= 0) {
                endIdx = 0; x2 = tgtCx; y2 = tgt.y;
              } else {
                endIdx = 2; x2 = tgtCx; y2 = tgt.y + tgt.h;
              }
            } else if (useVertical) {
              if (cdy >= 0) { endIdx = 0; x2 = tgtCx; y2 = tgt.y; }
              else { endIdx = 2; x2 = tgtCx; y2 = tgt.y + tgtFullH; }
            } else {
              endIdx = 3; x2 = tgt.x; y2 = tgtConnY;
            }

            // L5 서브도형에 직접 바인딩 — PowerPoint가 sub-shape stCxn을 더 안정적으로 해결하므로
            //   idx=0 (top)   → role bar (있으면) 또는 upper box: 본체 상단
            //   idx=1/3 (L/R) → upper box: label 영역 중앙 (src.y + RB + L5_UPPER_H/2)
            //   idx=2 (bottom)→ lower box: 본체 하단
            if (srcAnchors) {
              if (stIdx === 0) srcSid = String(srcAnchors.rolebarCnv ?? srcAnchors.upperCnv ?? srcSid);
              else if (stIdx === 2) srcSid = String(srcAnchors.lowerCnv ?? srcSid);
              else srcSid = String(srcAnchors.upperCnv ?? srcSid);
            }
            if (tgtAnchors) {
              if (endIdx === 0) tgtSid = String(tgtAnchors.rolebarCnv ?? tgtAnchors.upperCnv ?? tgtSid);
              else if (endIdx === 2) tgtSid = String(tgtAnchors.lowerCnv ?? tgtSid);
              else tgtSid = String(tgtAnchors.upperCnv ?? tgtSid);
            }

            // 실제 선택된 핸들 축 기준으로 직선 정렬 스냅
            const srcAxisVertical = stIdx === 0 || stIdx === 2;
            const tgtAxisVertical = endIdx === 0 || endIdx === 2;
            // 양쪽 수평 핸들 + Y 근접 → Y 스냅
            if (!srcAxisVertical && !tgtAxisVertical && Math.abs(y1 - y2) < 0.08) {
              const avgY = (y1 + y2) / 2;
              y1 = avgY;
              y2 = avgY;
            }
            // 양쪽 수직 핸들 + X 근접 → X 스냅
            if (srcAxisVertical && tgtAxisVertical && Math.abs(x1 - x2) < 0.08) {
              const avgX = (x1 + x2) / 2;
              x1 = avgX;
              x2 = avgX;
            }

            // 실제 핸들 방향 기준으로 직선/꺾임 결정 — 방향이 섞이면 반드시 꺾임
            //   stIdx/endIdx: 0=top, 1=right, 2=bottom, 3=left
            //   양쪽 수직(0/2) AND x1≈x2 → 수직 직선
            //   양쪽 수평(1/3) AND y1≈y2 → 수평 직선
            //   그 외(방향 혼합/오프셋) → bentConnector3
            const isRealStraight =
              (srcAxisVertical && tgtAxisVertical && Math.abs(x1 - x2) < 0.08) ||
              (!srcAxisVertical && !tgtAxisVertical && Math.abs(y1 - y2) < 0.08);
            const prst = isRealStraight ? "straightConnector1" : "bentConnector3";
            const offX = Math.round(Math.min(x1, x2) * EMU);
            const offY = Math.round(Math.min(y1, y2) * EMU);
            const extCx = Math.max(Math.round(Math.abs(x2 - x1) * EMU), 1);
            const extCy = Math.max(Math.round(Math.abs(y2 - y1) * EMU), 1);
            // flipH/flipV 제거: PowerPoint가 stCxn/endCxn 기반으로 자동 계산하도록 위임
            //   (flipH/flipV가 고정되면 도형 이동 시 bbox와 어긋나 선이 반대 방향으로 튀는 현상 유발)
            const headArrow = c.bidi ? '<a:headEnd type="triangle" w="med" len="med"/>' : "";
            const lineClr = c.srcIsL5 && c.tgtIsL5 ? "666666" : "333333";

            const avLst = prst === "bentConnector3"
              ? '<a:avLst><a:gd name="adj1" fmla="val 50000"/></a:avLst>'
              : '<a:avLst/>';
            // <p:style> 블록: Microsoft 표준 커넥터 XML 템플릿 — 이게 있어야 PowerPoint가
            // 커넥터를 static geometry가 아닌 "shape-bound connector"로 취급해서 이동 시 재경로가 동작
            const connStyle = `<p:style>`
              + `<a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef>`
              + `<a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef>`
              + `<a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>`
              + `<a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef>`
              + `</p:style>`;
            cxnXml += `<p:cxnSp><p:nvCxnSpPr>`
              + `<p:cNvPr id="${nextId}" name="Connector ${nextId}"/>`
              + `<p:cNvCxnSpPr><a:stCxn id="${srcSid}" idx="${stIdx}"/><a:endCxn id="${tgtSid}" idx="${endIdx}"/></p:cNvCxnSpPr>`
              + `<p:nvPr/></p:nvCxnSpPr><p:spPr>`
              + `<a:xfrm><a:off x="${offX}" y="${offY}"/><a:ext cx="${extCx}" cy="${extCy}"/></a:xfrm>`
              + `<a:prstGeom prst="${prst}">${avLst}</a:prstGeom>`
              + `<a:ln w="6350"><a:solidFill><a:srgbClr val="${lineClr}"/></a:solidFill>${headArrow}<a:tailEnd type="triangle" w="med" len="med"/></a:ln>`
              + `</p:spPr>${connStyle}</p:cxnSp>`;
            nextId++;
          }

          for (const c of pageMeta.connectors) {
            if (!c.label) continue;
            const src = c.srcBox;
            const tgt = c.tgtBox;
            const srcRB = pageMeta.l5Anchors[c.srcNodeId]?.hasRoleBar ? L5_ROLE_BAR_H : 0;
            const tgtRB = pageMeta.l5Anchors[c.tgtNodeId]?.hasRoleBar ? L5_ROLE_BAR_H : 0;
            // L5 upper box 중앙 (label 영역) — connector Y와 일치시켜 라벨이 선 위에 정확히 올라감
            const srcCY = c.srcIsL5 ? src.y + srcRB + L5_UPPER_H / 2 : src.y + src.h / 2;
            const tgtCY = c.tgtIsL5 ? tgt.y + tgtRB + L5_UPPER_H / 2 : tgt.y + tgt.h / 2;
            const midX = (src.x + src.w + tgt.x) / 2;
            const midY = (srcCY + tgtCY) / 2;
            const lblW = 0.35;
            const lblH = 0.18;
            const lx = Math.round((midX - lblW / 2) * EMU);
            const ly = Math.round((midY - lblH - 0.04) * EMU);
            const lcx = Math.round(lblW * EMU);
            const lcy = Math.round(lblH * EMU);
            cxnXml += `<p:sp><p:nvSpPr><p:cNvPr id="${nextId}" name="Label ${nextId}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`
              + `<p:spPr><a:xfrm><a:off x="${lx}" y="${ly}"/><a:ext cx="${lcx}" cy="${lcy}"/></a:xfrm>`
              + `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>`
              + `<a:ln w="3175"><a:solidFill><a:srgbClr val="999999"/></a:solidFill></a:ln></p:spPr>`
              + `<p:txBody><a:bodyPr wrap="square" anchor="ctr" anchorCtr="1" lIns="0" tIns="0" rIns="0" bIns="0"/>`
              + `<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="800" b="1" dirty="0"><a:solidFill><a:srgbClr val="333333"/></a:solidFill></a:rPr>`
              + `<a:t>${c.label}</a:t></a:r></a:p></p:txBody></p:sp>`;
            nextId++;
          }

          if (cxnXml) slideXml = slideXml.replace("</p:spTree>", cxnXml + "</p:spTree>");
        }

        zip.file(slidePath, slideXml);
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
      const MAX_COLS_PER_SLIDE = 6;

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
      const L5_ROLE_BAR_H_ALL = 0.142;  // 0.36cm — 커넥터 post-processing에서 role bar 보정에 사용
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

      // 슬라이드별 커넥터 메타 수집
      const allSlideConnectors: {
        slideIndex: number;
        connectors: { srcNodeId: string; tgtNodeId: string; srcBox: { x: number; y: number; w: number; h: number }; tgtBox: { x: number; y: number; w: number; h: number }; srcIsL5: boolean; tgtIsL5: boolean; srcIsDec: boolean; tgtIsDec: boolean; isStraight: boolean; isHorizontal: boolean; bidi: boolean; label?: string; srcHandle?: string; tgtHandle?: string }[];
        nodeBoxes: Record<string, { x: number; y: number; w: number; h: number }>;
        nodeGroupShapes: Record<string, { x: number; y: number; w: number; h: number }[]>;
        nodeShapeCnvIds: Record<string, number[]>;
        l5Anchors: Record<string, { rolebarCnv?: number; upperCnv?: number; lowerCnv?: number; hasRoleBar: boolean }>;
      }[] = [];
      let slideIdx = 2; // slide1=타이틀, slide2부터 시트

      for (const { sheet, nodes: sNodes, edges: sEdges } of validSheets) {
        const isSwimLane = sheet.type === "swimlane";
        const swimLanes = sheet.lanes || ["현업 임원", "팀장", "HR 담당자", "구성원"];

        // bbox 기반 좌표 변환
        let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
        for (const nd of sNodes) {
          if (!nd.position) continue;
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

        // ── 캔버스 레인 경계 (sheet.laneHeights 반영) ──
        const sCanvasLaneH = (sheet.laneHeights && sheet.laneHeights.length === swimLanes.length)
          ? sheet.laneHeights
          : Array(swimLanes.length).fill(2400 / swimLanes.length);
        const sCanvasCumY: number[] = [];
        { let ct = 0; for (const h of sCanvasLaneH) { sCanvasCumY.push(ct); ct += h; } sCanvasCumY.push(ct); }
        const getSLaneIdx = (rfY: number) => {
          for (let li = 0; li < swimLanes.length - 1; li++) { if (rfY < sCanvasCumY[li + 1]) return li; }
          return swimLanes.length - 1;
        };

        // ── 동적 레인 높이: 빈 레인 최소화, 내용 있는 레인에 비례 배분 ──
        const dynLH_S: number[] = swimLanes.map(() => SWIM_BAND_H_S);
        const dynLT_S: number[] = [];
        if (isSwimLane) {
          const lrc: number[] = Array(swimLanes.length).fill(0);
          for (let li = 0; li < swimLanes.length; li++) {
            const ys = sNodes.filter(nd => getSLaneIdx(nd.position.y) === li)
              .map(nd => nd.position.y).sort((a, b) => a - b);
            let rows = 0, lastY = -Infinity;
            for (const y of ys) { if (y - lastY > 50) { rows++; lastY = y; } }
            lrc[li] = rows;
          }
          const MN_EMPTY = 0.25;
          const emptyCount = lrc.filter(c => c === 0).length;
          const totalRows = lrc.reduce((s, c) => s + c, 0);
          const remainH = Math.max(0, TOTAL_SWIM_H_S - emptyCount * MN_EMPTY);
          for (let i = 0; i < swimLanes.length; i++) {
            dynLH_S[i] = lrc[i] === 0 ? MN_EMPTY
              : totalRows > 0 ? remainH * (lrc[i] / totalRows)
              : remainH / (swimLanes.length - emptyCount);
          }
        }
        { let ct = SL_TOP_S; for (let i = 0; i < swimLanes.length; i++) { dynLT_S.push(ct); ct += dynLH_S[i]; } }

        const sAreaW = SLIDE_W - 2 * sPadX;
        const sAreaH = SLIDE_H - sPadTop - sPadBottom;
        const prelimColVis = new Set<string>();
        const prelimColGrps: string[][] = [];
        const prelimSortedIds = [...sNodes]
          .sort((a, b) => a.position.x - b.position.x)
          .map((nd) => nd.id);
        const sheetNodeMap = new Map<string, Node>();
        for (const nd of sNodes) sheetNodeMap.set(nd.id, nd);
        for (const id of prelimSortedIds) {
          if (prelimColVis.has(id)) continue;
          const baseNode = sheetNodeMap.get(id);
          if (!baseNode) continue;
          const grp: string[] = [id];
          prelimColVis.add(id);
          for (const id2 of prelimSortedIds) {
            const cmpNode = sheetNodeMap.get(id2);
            if (!cmpNode || prelimColVis.has(id2)) continue;
            if (Math.abs(cmpNode.position.x - baseNode.position.x) <= 60) {
              grp.push(id2);
              prelimColVis.add(id2);
            }
          }
          prelimColGrps.push(grp);
        }
        const willPaginate = prelimColGrps.length > MAX_COLS_PER_SLIDE;

        // 페이지 청크: 1쪽 6컬럼 / 2쪽+ 5신규+1고스트 = 항상 최대 6컬럼/슬라이드
        const STRIDE_LATER = MAX_COLS_PER_SLIDE - 1;
        const makeChunks = (grps: string[][]): string[][][] => {
          const chunks: string[][][] = [];
          if (grps.length === 0) return chunks;
          if (grps.length <= MAX_COLS_PER_SLIDE) {
            chunks.push(grps.slice());
            return chunks;
          }
          chunks.push(grps.slice(0, MAX_COLS_PER_SLIDE));
          let cursor = MAX_COLS_PER_SLIDE;
          while (cursor < grps.length) {
            chunks.push(grps.slice(cursor, cursor + STRIDE_LATER));
            cursor += STRIDE_LATER;
          }
          return chunks;
        };

        // 각 페이지(고스트 포함)의 RF 픽셀 X-폭 중 최대값 — scRatio 계산용
        const prelimChunks = makeChunks(prelimColGrps);
        let maxChunkRfExtent = 0;
        for (let k = 0; k < prelimChunks.length; k++) {
          const base = prelimChunks[k];
          const ghost = k > 0 ? prelimChunks[k - 1][prelimChunks[k - 1].length - 1] : null;
          const effective = ghost ? [ghost, ...base] : base;
          let minX = Infinity;
          let maxXEnd = -Infinity;
          for (const grp of effective) {
            for (const id of grp) {
              const nd = sheetNodeMap.get(id);
              if (!nd) continue;
              const lv = getLevel(nd);
              const style = LS[lv] || DEF;
              const rfX = nd.position.x;
              minX = Math.min(minX, rfX);
              maxXEnd = Math.max(maxXEnd, rfX + style.pxW);
            }
          }
          if (isFinite(minX)) maxChunkRfExtent = Math.max(maxChunkRfExtent, maxXEnd - minX);
        }

        // 페이지네이션 시: Y 전체 범위 + 페이지당 X 폭으로 제약
        const scFit = willPaginate
          ? Math.min(sAreaH / bRangeY, sAreaW / Math.max(maxChunkRfExtent, 1))
          : Math.min(sAreaW / bRangeX, sAreaH / bRangeY);
        // 기준 스케일: L4 노드 세로 2cm(0.787") 기준
        const scRef = 0.787 / DEF.pxH;
        const scRatio = Math.min(scFit, scRef);

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

        // ── Phase 1: raw PPT 위치 ──────────────────────────────────────────────
        const sRawPos: Record<string, { rfX: number; rfY: number; w: number; h: number }> = {};
        for (const nd of sNodes) {
          if (!nd.position) continue;
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
        const globalNodeBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
        for (const grp of sColGrps) {
          grp.sort((a, b) => sRawPos[a].rfY - sRawPos[b].rfY);
          const sSnapX = sPadX + (Math.min(...grp.map(id => sRawPos[id].rfX)) - bMinX) * scRatio;
          const sY0 = sPadTop + (sRawPos[grp[0]].rfY - bMinY) * scRatio;
          if (grp.length === 1) {
            globalNodeBoxes[grp[0]] = { x: sSnapX, y: sY0, w: sRawPos[grp[0]].w, h: sRawPos[grp[0]].h };
          } else {
            const lastId = grp[grp.length - 1];
            const yLast = sPadTop + (sRawPos[lastId].rfY - bMinY) * scRatio;
            const span = yLast + sRawPos[lastId].h - sY0;
            const sumH = grp.reduce((acc, id) => acc + sRawPos[id].h, 0);
            const gap = Math.max((span - sumH) / (grp.length - 1), 0.06);
            let curY = sY0;
            for (const id of grp) {
              globalNodeBoxes[id] = { x: sSnapX, y: curY, w: sRawPos[id].w, h: sRawPos[id].h };
              curY += sRawPos[id].h + gap;
            }
          }
        }

        // ── Phase 2.5: Cross-column Y 정렬 (수영레인 모드에서는 스킵) ──
        if (!isSwimLane) {
          for (const grp of sColGrps) {
            if (grp.length !== 1) continue;
            const nid = grp[0];
            const box = globalNodeBoxes[nid];
            if (!box) continue;
            const connCenterYs: number[] = [];
            for (const e of sEdges) {
              const cid = e.target === nid ? e.source : e.source === nid ? e.target : null;
              if (!cid) continue;
              const cb = globalNodeBoxes[cid];
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
          const laneMap2: Record<number, string[]> = {};
          for (const nd of sNodes) {
            const box = globalNodeBoxes[nd.id];
            if (!box) continue;
            const laneIdx = getSLaneIdx(nd.position.y);
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
              return { id, rfY: nd.position.y, h: globalNodeBoxes[id].h };
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
                globalNodeBoxes[id].y = laneTop + (laneH - h) / 2;
              }
              if (l5Items.length > 0 && otherItems.length > 0) {
                const l5Y0 = globalNodeBoxes[l5Items[0].id].y;
                const l5ConnY = l5Y0 + L5_UPPER_H_ALL / 2;
                for (const { id, h } of otherItems) {
                  globalNodeBoxes[id].y = l5ConnY - h / 2;
                }
              } else {
                for (const { id, h } of otherItems) {
                  globalNodeBoxes[id].y = laneTop + (laneH - h) / 2;
                }
              }
            } else {
              const maxH = Math.max(...items.map(c => c.h));
              const availSpan = laneH - 2 * pad - maxH;
              for (const { id, rfY, h } of items) {
                const ratio = (rfY - rfYMin) / rfSpan;
                globalNodeBoxes[id].y = laneTop + pad + ratio * Math.max(availSpan, 0);
              }
            }
          }
        }

        // 페이지 청크 — 1쪽: 6컬럼 / 2쪽+: 5신규 + 1고스트 = 항상 최대 6컬럼/슬라이드
        const sColChunks = makeChunks(sColGrps);

        interface GrpShapeMeta { x: number; y: number; w: number; h: number }
        interface CxnMeta {
          srcNodeId: string; tgtNodeId: string;
          srcBox: { x: number; y: number; w: number; h: number };
          tgtBox: { x: number; y: number; w: number; h: number };
          srcIsL5: boolean; tgtIsL5: boolean;
          srcIsDec: boolean; tgtIsDec: boolean;
          isStraight: boolean; isHorizontal: boolean; bidi: boolean;
          label?: string;
          srcHandle?: string;
          tgtHandle?: string;
        }

        const sheetNodeLevelMap: Record<string, string> = {};
        for (const nd of sNodes) sheetNodeLevelMap[nd.id] = getLevel(nd);

        const yOverlap = (a: { y: number; h: number }, b: { y: number; h: number }) =>
          a.y < b.y + b.h && b.y < a.y + a.h;
        const xOverlap = (a: { x: number; w: number }, b: { x: number; w: number }) =>
          a.x < b.x + b.w && b.x < a.x + a.w;
        const withGhostLine = (line: Record<string, unknown>, isGhost: boolean, keepNoBorder = false) =>
          (isGhost && !keepNoBorder ? { ...line, dashType: "dash" } : line);

        const addSheetChrome = (slide: PptxGenJS.Slide, titleText: string) => {
          slide.background = { color: "F8FAFC" };
          slide.addText(titleText, {
            x: 0.3, y: 0.12, w: SLIDE_W - 0.6, h: 0.4,
            fontSize: 14, fontFace: FONT_FACE, bold: true, color: "1E293B",
          });
          if (!isSwimLane) return;
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
        };

        const addSheetLegend = (slide: PptxGenJS.Slide) => {
          let lgx = 0.4;
          for (const [lvl, cfg] of Object.entries(LS)) {
            slide.addText("", {
              x: lgx, y: SLIDE_H - 0.28, w: 0.22, h: 0.22,
              shape: pptx.ShapeType.rect,
              fill: { color: cfg.bg }, line: { color: cfg.border, width: 0.5 },
            });
            slide.addText(lvl, {
              x: lgx + 0.28, y: SLIDE_H - 0.28, w: 0.5, h: 0.22,
              fontSize: 8, color: "64748B", fontFace: FONT_FACE, valign: "middle",
            });
            lgx += 0.9;
          }
        };

        const totalPages = Math.max(sColChunks.length, 1);
        for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
          const pageNo = pageIdx + 1;
          const baseColGrps = sColChunks[pageIdx] || [];
          const ghostColGrp = pageIdx > 0 ? (sColChunks[pageIdx - 1]?.[sColChunks[pageIdx - 1].length - 1] || []) : [];
          const pageColGrps = pageIdx > 0 && ghostColGrp.length > 0 ? [ghostColGrp, ...baseColGrps] : baseColGrps;
          if (pageColGrps.length === 0) continue;

          const firstColAnyNode = pageColGrps[0].find((nodeId) => !!globalNodeBoxes[nodeId]) || pageColGrps[0][0];
          if (!firstColAnyNode || !globalNodeBoxes[firstColAnyNode]) continue;

          const pageDX = sPadX - globalNodeBoxes[firstColAnyNode].x;
          const pageNodeSet = new Set<string>();
          const ghostNodeSet = new Set<string>(ghostColGrp);
          const pageNodeBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};

          for (const grp of pageColGrps) {
            for (const nodeId of grp) {
              if (pageNodeSet.has(nodeId)) continue;
              const gBox = globalNodeBoxes[nodeId];
              if (!gBox) continue;
              pageNodeSet.add(nodeId);
              pageNodeBoxes[nodeId] = { x: gBox.x + pageDX, y: gBox.y, w: gBox.w, h: gBox.h };
            }
          }

          const slide = pptx.addSlide();
          addSheetChrome(
            slide,
            totalPages > 1 ? `${sheetSlideTitle} (${pageNo}/${totalPages})` : sheetSlideTitle,
          );

          const sheetGroupShapes: Record<string, GrpShapeMeta[]> = {};
          const pageNodeHasRoleBar: Record<string, boolean> = {};
          for (const nd of sNodes) {
            if (!pageNodeSet.has(nd.id)) continue;

            const level = getLevel(nd);
            const sv = LS[level] || DEF;
            const box = pageNodeBoxes[nd.id];
            if (!box) continue;
            const dispLabel = getLabel(nd);
            const dispId = getDisplayId(nd);
            const isGhost = ghostNodeSet.has(nd.id);
            const shapeList: GrpShapeMeta[] = [];
            let l5YOff = 0;

            if (level === "DECISION") {
              slide.addText(dispLabel || "판정 조건", {
                x: box.x, y: box.y, w: DECISION_W_ALL, h: DECISION_H_ALL,
                shape: pptx.ShapeType.diamond,
                fill: { color: "F2A0AF" },
                line: withGhostLine({ color: "D95578", width: 1.5 }, isGhost),
                fontSize: 7, bold: true, color: "3B0716",
                fontFace: "Noto Sans KR", valign: "middle", align: "center",
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: box.y, w: DECISION_W_ALL, h: DECISION_H_ALL });
            } else if (level === "MEMO") {
              const memoText = (nd.data as Record<string, string>).text || dispLabel || "";
              slide.addText(memoText || "", {
                x: box.x, y: box.y, w: MEMO_W_ALL, h: MEMO_H_ALL,
                shape: pptx.ShapeType.rect,
                fill: { color: "FFF9C4" },
                line: withGhostLine({ color: "FBC02D", width: 0.75 }, isGhost),
                fontSize: 9, color: "6D4C00",
                fontFace: FONT_FACE, valign: "top", align: "left",
                margin: [4, 4, 4, 4],
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: box.y, w: MEMO_W_ALL, h: MEMO_H_ALL });
            } else if (level === "L5") {
              const ROLE_BAR_H_S = 0.142;
              const roleVal = (nd.data as Record<string, string>).role || "";
              const roleBatchDisplay = extractCustomRole(roleVal);
              const hasRB = !!roleBatchDisplay;
              pageNodeHasRoleBar[nd.id] = hasRB;
              if (roleBatchDisplay) {
                slide.addText(roleBatchDisplay, {
                  x: box.x, y: box.y, w: L5_FIXED_W_ALL, h: ROLE_BAR_H_S,
                  shape: pptx.ShapeType.rect,
                  fill: { color: "DBEAFE" },
                  line: withGhostLine({ color: "93C5FD", width: 0.5 }, isGhost),
                  fontSize: 7, bold: true, color: "1D4ED8",
                  fontFace: FONT_FACE, valign: "middle", align: "center",
                  objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}_rolebar`,
                });
                shapeList.push({ x: box.x, y: box.y, w: L5_FIXED_W_ALL, h: ROLE_BAR_H_S });
                l5YOff = ROLE_BAR_H_S;
              }
              slide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
                x: box.x, y: box.y + l5YOff, w: L5_FIXED_W_ALL, h: L5_UPPER_H_ALL,
                shape: pptx.ShapeType.rect,
                fill: { color: "FFFFFF" },
                line: withGhostLine({ color: "DEDEDE", width: 0.25 }, isGhost),
                fontSize: 9, bold: true, color: "000000",
                fontFace: FONT_FACE, valign: "middle", align: "center",
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}_upper`,
              });
              shapeList.push({ x: box.x, y: box.y + l5YOff, w: L5_FIXED_W_ALL, h: L5_UPPER_H_ALL });

              const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
              const sysStr = (nd.data as Record<string, string>).system || "";
              let sysName = "";
              if (sysStr) {
                sysName = sysStr;
              } else if (sysMap) {
                const SYS_KEYS = [
                  { key: "hr" }, { key: "groupware" }, { key: "office" }, { key: "external" }, { key: "manual" }, { key: "etc" },
                ];
                const active = SYS_KEYS.filter((k) => sysMap[k.key]?.trim());
                if (active.length > 0) sysName = active.map((k) => sysMap[k.key]!.trim()).join(", ");
              }
              slide.addText(sysName, {
                x: box.x, y: box.y + l5YOff + L5_UPPER_H_ALL + L5_GAP_ALL, w: L5_FIXED_W_ALL, h: L5_LOWER_H_ALL,
                shape: pptx.ShapeType.rect,
                fill: { color: "DEDEDE" },
                line: withGhostLine({ width: 0 }, isGhost, true),
                fontSize: 7, bold: false, color: "000000",
                fontFace: FONT_FACE, valign: "middle", align: "center",
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}_lower`,
              });
              shapeList.push({ x: box.x, y: box.y + l5YOff + L5_UPPER_H_ALL + L5_GAP_ALL, w: L5_FIXED_W_ALL, h: L5_LOWER_H_ALL });
            } else {
              slide.addText(dispLabel ? `${dispId}\n${dispLabel}` : dispId, {
                x: box.x, y: box.y, w: box.w, h: box.h,
                shape: pptx.ShapeType.rect,
                fill: { color: sv.bg },
                line: withGhostLine({ color: sv.border, width: 0.25 }, isGhost),
                fontSize: NODE_FONT_SIZE_S, bold: true, color: sv.text,
                fontFace: FONT_FACE, valign: "middle", align: "center",
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: box.y, w: box.w, h: box.h });
              const sysMap = (nd.data as Record<string, unknown>).systems as Record<string, string> | undefined;
              if (sysMap) {
                const SYS_KEYS: { key: string }[] = [
                  { key: "hr" }, { key: "groupware" }, { key: "office" }, { key: "external" }, { key: "manual" }, { key: "etc" },
                ];
                const activeSys = SYS_KEYS.filter((k) => sysMap[k.key]?.trim());
                if (activeSys.length > 0) {
                  slide.addText(activeSys.map((k) => `🖥 ${sysMap[k.key]!.trim()}`).join("  "), {
                    x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2,
                    fontSize: Math.max(NODE_FONT_SIZE_S - 2, 6), color: sv.bg,
                    fontFace: FONT_FACE, align: "center", bold: true,
                    objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
                  });
                  shapeList.push({ x: box.x, y: box.y + box.h + 0.03, w: box.w, h: 0.2 });
                }
              }
            }

            if (level !== "L5") {
              const roleStr = (nd.data as Record<string, string>).role || "";
              const customName = extractCustomRole(roleStr);
              if (customName) {
                const tagW = Math.max(box.w, L5_FIXED_W_ALL);
                const tagH = 0.142;
                slide.addText(customName, {
                  x: box.x, y: box.y - tagH,
                  w: tagW, h: tagH,
                  shape: pptx.ShapeType.rect,
                  fill: { color: "DBEAFE" },
                  line: withGhostLine({ color: "93C5FD", width: 0.5 }, isGhost),
                  fontSize: 7, bold: true, color: "1D4ED8",
                  fontFace: FONT_FACE, valign: "middle", align: "center",
                  objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
                });
                shapeList.push({ x: box.x, y: box.y - tagH, w: tagW, h: tagH });
              }
            }

            const memoStr = (nd.data as Record<string, string>).memo || "";
            if (memoStr) {
              const memoW = Math.max(box.w, 1.0);
              const memoH = 0.28;
              const memoY = box.y + l5YOff + box.h + 0.04;
              slide.addText(memoStr, {
                x: box.x, y: memoY,
                w: memoW, h: memoH,
                shape: pptx.ShapeType.rect,
                fill: { color: "FFF9C4" },
                line: withGhostLine({ color: "FBC02D", width: 0.5 }, isGhost),
                fontSize: 7, color: "6D4C00",
                fontFace: FONT_FACE, valign: "middle", align: "left",
                margin: [0, 4, 0, 4],
                objectName: `GRP_p${pageNo}_${nd.id}_${shapeList.length}`,
              });
              shapeList.push({ x: box.x, y: memoY, w: memoW, h: memoH });
            }

            if (shapeList.length > 1) sheetGroupShapes[nd.id] = shapeList;
          }

          const pageConnectors: CxnMeta[] = [];
          for (const e of sEdges) {
            if (!pageNodeSet.has(e.source) || !pageNodeSet.has(e.target)) continue;
            const src = pageNodeBoxes[e.source];
            const tgt = pageNodeBoxes[e.target];
            if (!src || !tgt) continue;
            const bidi = !!(e.markerStart || (e.data as Record<string, unknown>)?.bidirectional);
            const srcCx = src.x + src.w / 2;
            const tgtCx = tgt.x + tgt.w / 2;
            const dx = tgtCx - srcCx;
            const dy = (tgt.y + tgt.h / 2) - (src.y + src.h / 2);
            const sameRow = yOverlap(src, tgt);
            const sameCol = xOverlap(src, tgt);
            const isStraight = (sameRow && !sameCol) || (sameCol && !sameRow);
            const isHorizontal = sameRow ? true : sameCol ? false : Math.abs(dx) >= Math.abs(dy);
            pageConnectors.push({
              srcNodeId: e.source,
              tgtNodeId: e.target,
              srcBox: src,
              tgtBox: tgt,
              srcIsL5: sheetNodeLevelMap[e.source] === "L5",
              tgtIsL5: sheetNodeLevelMap[e.target] === "L5",
              srcIsDec: sheetNodeLevelMap[e.source] === "DECISION",
              tgtIsDec: sheetNodeLevelMap[e.target] === "DECISION",
              isStraight,
              isHorizontal,
              bidi,
              label: e.label ? String(e.label) : undefined,
              srcHandle: e.sourceHandle || undefined,
              tgtHandle: e.targetHandle || undefined,
            });
          }

          // 크로스 페이지 엣지는 고스트 컬럼으로 커버. 2페이지 이상 건너뛰는 엣지는 매우 드물고
          // 스텁이 DECISION Yes/No 라벨 공간을 침범해 혼잡해지므로 표시하지 않음.

          const slideShapeCnvIds: Record<string, number[]> = {};
          const slideL5Anchors: Record<string, { rolebarCnv?: number; upperCnv?: number; lowerCnv?: number; hasRoleBar: boolean }> = {};
          const slideObjs = (slide as unknown as { _slideObjects: Array<{ options?: { objectName?: string } }> })._slideObjects;
          for (const [nodeId] of Object.entries(sheetGroupShapes)) {
            const prefix = `GRP_p${pageNo}_${nodeId}_`;
            const ids: number[] = [];
            const anchors: { rolebarCnv?: number; upperCnv?: number; lowerCnv?: number; hasRoleBar: boolean } = {
              hasRoleBar: pageNodeHasRoleBar[nodeId] === true,
            };
            for (let idx = 0; idx < slideObjs.length; idx++) {
              const on = slideObjs[idx]?.options?.objectName;
              if (!on || !on.startsWith(prefix)) continue;
              const cnvId = idx + 2;
              ids.push(cnvId);
              if (on.endsWith("_rolebar")) anchors.rolebarCnv = cnvId;
              else if (on.endsWith("_upper")) anchors.upperCnv = cnvId;
              else if (on.endsWith("_lower")) anchors.lowerCnv = cnvId;
            }
            if (ids.length >= 2) slideShapeCnvIds[nodeId] = ids;
            if (anchors.upperCnv && anchors.lowerCnv) slideL5Anchors[nodeId] = anchors;
          }

          addSheetLegend(slide);
          allSlideConnectors.push({
            slideIndex: slideIdx,
            connectors: pageConnectors,
            nodeBoxes: { ...pageNodeBoxes },
            nodeGroupShapes: { ...sheetGroupShapes },
            nodeShapeCnvIds: slideShapeCnvIds,
            l5Anchors: slideL5Anchors,
          });
          slideIdx++;
        }
      }

      // ── JSZip 후처리: 각 시트 슬라이드에 진짜 <p:cxnSp> 커넥터 주입 ──────
      const EMU = 914400;
      const pptxBlob = await pptx.write({ outputType: "blob" }) as Blob;
      const zip = await JSZip.loadAsync(pptxBlob);

      for (const sc of allSlideConnectors) {
        const hasConnectors = sc.connectors.length > 0;
        const hasGroups = sc.nodeShapeCnvIds && Object.keys(sc.nodeShapeCnvIds).length > 0;
        if (!hasConnectors && !hasGroups) continue;
        const slidePath = `ppt/slides/slide${sc.slideIndex}.xml`;
        let slideXml = await zip.file(slidePath)?.async("string") || "";
        if (!slideXml) continue;

        // ── STEP 1: 그룹화 먼저 — 그룹 bbox는 모든 자식 도형의 union ──
        // 커넥터는 그룹이 아닌 개별 서브도형에 바인딩됨 (그룹 stCxn은 PPT가 재경로 못해 연결 끊김 유발)
        if (hasGroups) {
          let grpSlideXml = slideXml;
          let grpMaxId = 0;
          for (const m of grpSlideXml.match(/id="(\d+)"/g) || []) {
            const n = parseInt(m.match(/\d+/)![0], 10);
            if (n > grpMaxId) grpMaxId = n;
          }
          let grpNextId = grpMaxId + 1;

          const allSpBlocksA = grpSlideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
          const idToBlockA: Record<number, string> = {};
          for (const blk of allSpBlocksA) {
            const im = blk.match(/<p:cNvPr\s[^>]*?id="(\d+)"/);
            if (im) idToBlockA[parseInt(im[1], 10)] = blk;
          }

          interface GrpPendingA {
            matchedBlocks: string[];
            gMinX: number; gMinY: number; gMaxX: number; gMaxY: number;
            id: number;
          }
          const pendingGroupsA: GrpPendingA[] = [];
          const claimedIdsA = new Set<number>();

          for (const [nodeId, cnvIds] of Object.entries(sc.nodeShapeCnvIds)) {
            const shapes = sc.nodeGroupShapes[nodeId];
            if (!shapes) continue;
            const matchedBlocks: string[] = [];
            const matchedShapeIdxs: number[] = [];
            for (let i = 0; i < cnvIds.length; i++) {
              const cid = cnvIds[i];
              if (claimedIdsA.has(cid)) continue;
              const blk = idToBlockA[cid];
              if (!blk) continue;
              matchedBlocks.push(blk);
              matchedShapeIdxs.push(i);
              claimedIdsA.add(cid);
            }
            if (matchedBlocks.length < 2) continue;

            let gMinX = Infinity, gMinY = Infinity, gMaxX = -Infinity, gMaxY = -Infinity;
            for (const si of matchedShapeIdxs) {
              const sh = shapes[si];
              if (!sh) continue;
              const bx = Math.round(sh.x * EMU), by = Math.round(sh.y * EMU);
              const bcx = Math.round(sh.w * EMU), bcy = Math.round(sh.h * EMU);
              gMinX = Math.min(gMinX, bx); gMinY = Math.min(gMinY, by);
              gMaxX = Math.max(gMaxX, bx + bcx); gMaxY = Math.max(gMaxY, by + bcy);
            }
            if (!isFinite(gMinX)) continue;
            pendingGroupsA.push({ matchedBlocks, gMinX, gMinY, gMaxX, gMaxY, id: grpNextId++ });
          }

          for (const pg of pendingGroupsA) {
            for (const blk of pg.matchedBlocks) grpSlideXml = grpSlideXml.replace(blk, "");
            const grpSp = `<p:grpSp>`
              + `<p:nvGrpSpPr><p:cNvPr id="${pg.id}" name="Group ${pg.id}"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>`
              + `<p:grpSpPr><a:xfrm><a:off x="${pg.gMinX}" y="${pg.gMinY}"/><a:ext cx="${pg.gMaxX - pg.gMinX}" cy="${pg.gMaxY - pg.gMinY}"/>`
              + `<a:chOff x="${pg.gMinX}" y="${pg.gMinY}"/><a:chExt cx="${pg.gMaxX - pg.gMinX}" cy="${pg.gMaxY - pg.gMinY}"/></a:xfrm></p:grpSpPr>`
              + pg.matchedBlocks.join("")
              + `</p:grpSp>`;
            grpSlideXml = grpSlideXml.replace("</p:spTree>", grpSp + "</p:spTree>");
          }
          slideXml = grpSlideXml;
        }

        if (hasConnectors) {
        // 위치 기반 shape 매칭 — 그룹 안팎 <p:sp>를 box.x/box.y 위치로 찾음
        const shapeIdMap: Record<string, string> = {};
        let maxShapeId = 0;
        for (const m of slideXml.match(/id="(\d+)"/g) || []) {
          const n = parseInt(m.match(/\d+/)![0], 10);
          if (n > maxShapeId) maxShapeId = n;
        }
        const spBlocks = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) || [];
        for (const block of spBlocks) {
          const idMatch = block.match(/<p:cNvPr\s[^>]*?id="(\d+)"/);
          if (!idMatch) continue;
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
          let srcSid = shapeIdMap[c.srcNodeId], tgtSid = shapeIdMap[c.tgtNodeId];
          if (!srcSid || !tgtSid) continue;
          const src = c.srcBox, tgt = c.tgtBox;
          const srcCxA = src.x + src.w / 2, srcCyA = src.y + src.h / 2;
          const tgtCxA = tgt.x + tgt.w / 2, tgtCyA = tgt.y + tgt.h / 2;
          const cdxA = tgtCxA - srcCxA, cdyA = tgtCyA - srcCyA;

          // L5 앵커: 서브도형별 cNvPr + role bar 여부 (개별 서브도형에 직접 바인딩)
          const srcAnchors = c.srcIsL5 ? sc.l5Anchors[c.srcNodeId] : undefined;
          const tgtAnchors = c.tgtIsL5 ? sc.l5Anchors[c.tgtNodeId] : undefined;
          const srcRB = srcAnchors?.hasRoleBar ? L5_ROLE_BAR_H_ALL : 0;
          const tgtRB = tgtAnchors?.hasRoleBar ? L5_ROLE_BAR_H_ALL : 0;
          // L5 수평 커넥터 Y: upper 박스 중앙 (label 영역)
          const srcConnY2 = c.srcIsL5 ? src.y + srcRB + L5_UPPER_H_ALL / 2 : srcCyA;
          const tgtConnY2 = c.tgtIsL5 ? tgt.y + tgtRB + L5_UPPER_H_ALL / 2 : tgtCyA;
          const srcFullH = c.srcIsL5 ? srcRB + L5_FIXED_H_ALL : src.h;
          const tgtFullH = c.tgtIsL5 ? tgtRB + L5_FIXED_H_ALL : tgt.h;

          // React Flow 원본 핸들 id 우선 — 사용자가 웹에서 지정한 연결점 유지
          const resolveHandleA = (
            handle: string | undefined,
            bx: { x: number; y: number; w: number; h: number },
            isL5: boolean,
            fullH: number,
            connY: number,
          ): { idx: number; x: number; y: number } | null => {
            if (!handle) return null;
            const key = handle.startsWith("t-") ? handle.slice(2) : handle;
            switch (key) {
              case "top":    return { idx: 0, x: bx.x + bx.w / 2, y: bx.y };
              case "right":  return { idx: 1, x: bx.x + bx.w,     y: isL5 ? connY : bx.y + bx.h / 2 };
              case "bottom": return { idx: 2, x: bx.x + bx.w / 2, y: bx.y + fullH };
              case "left":   return { idx: 3, x: bx.x,            y: isL5 ? connY : bx.y + bx.h / 2 };
            }
            return null;
          };
          const srcExplicit = resolveHandleA(c.srcHandle, src, c.srcIsL5, srcFullH, srcConnY2);
          const tgtExplicit = resolveHandleA(c.tgtHandle, tgt, c.tgtIsL5, tgtFullH, tgtConnY2);

          // 세로 라우팅 fallback: 같은 X 컬럼에 상하 배치 → top/bottom 핸들
          const sameColX = src.x < tgt.x + tgt.w && tgt.x < src.x + src.w;
          const sameRowY = src.y < tgt.y + tgtFullH && tgt.y < src.y + srcFullH;
          const useVertical = !c.srcIsDec && !c.tgtIsDec && sameColX && !sameRowY;

          let stIdx: number, x1: number, y1: number;
          let endIdx: number, x2: number, y2: number;

          if (srcExplicit) {
            stIdx = srcExplicit.idx; x1 = srcExplicit.x; y1 = srcExplicit.y;
          } else if (c.srcIsDec) {
            if (Math.abs(cdxA) >= Math.abs(cdyA)) {
              if (cdxA >= 0) { stIdx = 1; x1 = src.x + src.w; y1 = srcCyA; }
              else           { stIdx = 3; x1 = src.x;          y1 = srcCyA; }
            } else {
              if (cdyA >= 0) { stIdx = 2; x1 = srcCxA; y1 = src.y + src.h; }
              else           { stIdx = 0; x1 = srcCxA; y1 = src.y;          }
            }
          } else if (useVertical) {
            if (cdyA >= 0) { stIdx = 2; x1 = srcCxA; y1 = src.y + srcFullH; }
            else           { stIdx = 0; x1 = srcCxA; y1 = src.y;             }
          } else {
            stIdx = 1; x1 = src.x + src.w; y1 = srcConnY2;
          }

          if (tgtExplicit) {
            endIdx = tgtExplicit.idx; x2 = tgtExplicit.x; y2 = tgtExplicit.y;
          } else if (c.tgtIsDec) {
            if (Math.abs(cdxA) >= Math.abs(cdyA)) {
              if (cdxA >= 0) { endIdx = 3; x2 = tgt.x;         y2 = tgtCyA; }
              else           { endIdx = 1; x2 = tgt.x + tgt.w; y2 = tgtCyA; }
            } else {
              if (cdyA >= 0) { endIdx = 0; x2 = tgtCxA; y2 = tgt.y;          }
              else           { endIdx = 2; x2 = tgtCxA; y2 = tgt.y + tgt.h;  }
            }
          } else if (useVertical) {
            if (cdyA >= 0) { endIdx = 0; x2 = tgtCxA; y2 = tgt.y;            }
            else           { endIdx = 2; x2 = tgtCxA; y2 = tgt.y + tgtFullH; }
          } else {
            endIdx = 3; x2 = tgt.x; y2 = tgtConnY2;
          }

          // L5 서브도형에 직접 바인딩 — PowerPoint가 sub-shape stCxn을 더 안정적으로 해결
          if (srcAnchors) {
            if (stIdx === 0) srcSid = String(srcAnchors.rolebarCnv ?? srcAnchors.upperCnv ?? srcSid);
            else if (stIdx === 2) srcSid = String(srcAnchors.lowerCnv ?? srcSid);
            else srcSid = String(srcAnchors.upperCnv ?? srcSid);
          }
          if (tgtAnchors) {
            if (endIdx === 0) tgtSid = String(tgtAnchors.rolebarCnv ?? tgtAnchors.upperCnv ?? tgtSid);
            else if (endIdx === 2) tgtSid = String(tgtAnchors.lowerCnv ?? tgtSid);
            else tgtSid = String(tgtAnchors.upperCnv ?? tgtSid);
          }

          const srcAxisVertical = stIdx === 0 || stIdx === 2;
          const tgtAxisVertical = endIdx === 0 || endIdx === 2;
          if (!srcAxisVertical && !tgtAxisVertical && Math.abs(y1 - y2) < 0.08) {
            const avgY = (y1 + y2) / 2; y1 = avgY; y2 = avgY;
          }
          if (srcAxisVertical && tgtAxisVertical && Math.abs(x1 - x2) < 0.08) {
            const avgX = (x1 + x2) / 2; x1 = avgX; x2 = avgX;
          }
          const isRealStraight =
            (srcAxisVertical && tgtAxisVertical && Math.abs(x1 - x2) < 0.08) ||
            (!srcAxisVertical && !tgtAxisVertical && Math.abs(y1 - y2) < 0.08);
          const prst = isRealStraight ? "straightConnector1" : "bentConnector3";
          const offX = Math.round(Math.min(x1, x2) * EMU), offY = Math.round(Math.min(y1, y2) * EMU);
          const extCx2 = Math.max(Math.round(Math.abs(x2 - x1) * EMU), 1);
          const extCy2 = Math.max(Math.round(Math.abs(y2 - y1) * EMU), 1);
          // flipH/flipV 제거 — PowerPoint가 stCxn/endCxn 기반으로 자동 계산 위임
          const headArr2 = c.bidi ? '<a:headEnd type="triangle" w="med" len="med"/>' : "";
          const isL5Edge2 = c.srcIsL5 && c.tgtIsL5;
          const lineClr2 = isL5Edge2 ? "666666" : "333333";
          const avLst2 = prst === "bentConnector3"
            ? '<a:avLst><a:gd name="adj1" fmla="val 50000"/></a:avLst>'
            : '<a:avLst/>';
          const connStyle2 = `<p:style><a:lnRef idx="1"><a:schemeClr val="accent1"/></a:lnRef><a:fillRef idx="0"><a:schemeClr val="accent1"/></a:fillRef><a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></p:style>`;
          cxnXml += `<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${nextId}" name="Connector ${nextId}"/><p:cNvCxnSpPr><a:stCxn id="${srcSid}" idx="${stIdx}"/><a:endCxn id="${tgtSid}" idx="${endIdx}"/></p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr><a:xfrm><a:off x="${offX}" y="${offY}"/><a:ext cx="${extCx2}" cy="${extCy2}"/></a:xfrm><a:prstGeom prst="${prst}">${avLst2}</a:prstGeom><a:ln w="6350"><a:solidFill><a:srgbClr val="${lineClr2}"/></a:solidFill>${headArr2}<a:tailEnd type="triangle" w="med" len="med"/></a:ln></p:spPr>${connStyle2}</p:cxnSp>`;
          nextId++;
        }

        // Yes/No label text boxes near connectors
        for (const c of sc.connectors) {
          if (!c.label) continue;
          const src = c.srcBox, tgt = c.tgtBox;
          const srcRB = sc.l5Anchors[c.srcNodeId]?.hasRoleBar ? L5_ROLE_BAR_H_ALL : 0;
          const tgtRB = sc.l5Anchors[c.tgtNodeId]?.hasRoleBar ? L5_ROLE_BAR_H_ALL : 0;
          // L5 upper 박스 중앙 — connector Y와 일치
          const srcCY = c.srcIsL5 ? src.y + srcRB + L5_UPPER_H_ALL / 2 : src.y + src.h / 2;
          const tgtCY = c.tgtIsL5 ? tgt.y + tgtRB + L5_UPPER_H_ALL / 2 : tgt.y + tgt.h / 2;
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

        if (cxnXml) slideXml = slideXml.replace("</p:spTree>", cxnXml + "</p:spTree>");
        } // end if (hasConnectors)

        zip.file(slidePath, slideXml);
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
              let sysName = "";
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
  const handleExportExcel = useCallback(async () => {
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
      /* CSV 있음: 머지 + 색상 강조 .xlsx */
      const rows = buildMergedRows(csvRows, allNodes);
      const blob = await buildColoredXlsx(rows);
      saveAs(blob, `PwC_HR_Template_${Date.now()}.xlsx`);
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

  /* ═══ Canvas-Only Excel: 전체 시트 각각을 별도 워크시트로 출력 ═══ */
  const handleExportCanvasExcel = useCallback(async () => {
    if (!sheets || !getSheetData) { alert("sheets 정보가 없습니다."); return; }

    /* 멀티라인 quoted 필드를 올바르게 처리하는 전체 CSV 파서 */
    function parseCsvFull(csv: string): string[][] {
      const records: string[][] = [];
      let i = 0;
      const n = csv.length;
      while (i < n) {
        const record: string[] = [];
        while (i < n) {
          let field = "";
          if (csv[i] === '"') {
            i++; // opening quote
            while (i < n) {
              if (csv[i] === '"') {
                if (csv[i + 1] === '"') { field += '"'; i += 2; }
                else { i++; break; }
              } else { field += csv[i++]; }
            }
          } else {
            while (i < n && csv[i] !== ',' && csv[i] !== '\n' && csv[i] !== '\r') {
              field += csv[i++];
            }
          }
          record.push(field);
          if (i < n && csv[i] === ',') { i++; }
          else break;
        }
        if (i < n && csv[i] === '\r') i++;
        if (i < n && csv[i] === '\n') i++;
        if (record.length > 1 || (record.length === 1 && record[0] !== '')) {
          records.push(record);
        }
      }
      return records;
    }

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    let hasAnyNode = false;

    for (const s of sheets) {
      const sd = s.id === activeSheetId ? { nodes, edges } : getSheetData(s.id);
      const sheetNodes = sd.nodes;
      if (sheetNodes.length === 0) continue;
      hasAnyNode = true;

      const csvStr = buildTemplateCsvString(sheetNodes, csvRows || undefined);
      const allRows = parseCsvFull(csvStr.replace(/^\uFEFF/, "")).filter(r => r.length > 0);

      /* Excel 시트명: 특수문자 제거, 최대 31자 */
      const wsName = s.name.replace(/[\\\/\*\?\:\[\]]/g, "").slice(0, 31) || `Sheet`;
      const ws = workbook.addWorksheet(wsName);

      allRows.forEach((cells, i) => {
        const row = ws.addRow(cells);
        if (i === 0) {
          row.eachCell(cell => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD3D3D3" } };
            cell.font = { bold: true, name: "Malgun Gothic", size: 10 };
            cell.border = { top: { style: "thin", color: { argb: "FFCCCCCC" } }, left: { style: "thin", color: { argb: "FFCCCCCC" } }, bottom: { style: "thin", color: { argb: "FFCCCCCC" } }, right: { style: "thin", color: { argb: "FFCCCCCC" } } };
            cell.alignment = { wrapText: false, vertical: "middle" };
          });
          row.height = 18;
        } else {
          const hasLineBreak = cells.some(c => c.includes("\n"));
          row.eachCell({ includeEmpty: true }, cell => {
            cell.font = { name: "Malgun Gothic", size: 10 };
            cell.border = { top: { style: "thin", color: { argb: "FFCCCCCC" } }, left: { style: "thin", color: { argb: "FFCCCCCC" } }, bottom: { style: "thin", color: { argb: "FFCCCCCC" } }, right: { style: "thin", color: { argb: "FFCCCCCC" } } };
            cell.alignment = { wrapText: hasLineBreak, vertical: "middle" };
          });
          if (!hasLineBreak) row.height = 16;
        }
      });
      ws.columns.forEach((col, i) => { col.width = i < 2 ? 12 : i < 10 ? 20 : 14; });
    }

    if (!hasAnyNode) { alert("모든 시트에 노드가 없습니다."); return; }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `PwC_HR_AllSheets_${Date.now()}.xlsx`);
  }, [sheets, getSheetData, activeSheetId, nodes, edges, csvRows]);

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
        title="전체 시트를 각각 별도 워크시트로 내보내기 (원본 CSV 무관, 캔버스 기반)"
      >
        📋 전체 시트
      </button>
    </div>
</>
  );
}
