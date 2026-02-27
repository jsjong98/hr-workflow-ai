"use client";

import { useCallback, useRef } from "react";
import { toPng, toSvg } from "html-to-image";
import { saveAs } from "file-saver";
import PptxGenJS from "pptxgenjs";
import type { Node, Edge } from "@xyflow/react";

interface ExportToolbarProps {
  nodes: Node[];
  edges: Edge[];
  reactFlowWrapper: React.RefObject<HTMLDivElement | null>;
}

export default function ExportToolbar({
  nodes,
  edges,
  reactFlowWrapper,
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

  /* ═══ JSON Save ═══ */
  const handleSaveJSON = useCallback(() => {
    const data = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    saveAs(blob, `hr-workflow-${Date.now()}.json`);
  }, [nodes, edges]);

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
      pptx.author = "PwC · 두산 HR AX";
      pptx.title = "HR Workflow";
      pptx.subject = "As-is 프로세스 워크플로우";
      pptx.layout = "LAYOUT_WIDE"; // 13.33" x 7.5"

      /* ── Level style config (L2:#A62121 → L3:#D95578 → L4:#F2A0AF → L5:#F2DCE0) ── */
      const LS: Record<string, { bg: string; border: string; text: string; badge: string; fontSize: number; pxW: number; pxH: number; pptW: number; pptH: number }> = {
        L2: { bg: "A62121", border: "D95578", text: "FFFFFF", badge: "F2A0AF", fontSize: 11, pxW: 300, pxH: 76, pptW: 2.3, pptH: 0.6 },
        L3: { bg: "D95578", border: "F2A0AF", text: "FFFFFF", badge: "F2DCE0", fontSize: 10.5, pxW: 260, pxH: 68, pptW: 2.1, pptH: 0.55 },
        L4: { bg: "F2A0AF", border: "D95578", text: "3B0716", badge: "A62121", fontSize: 10, pxW: 235, pxH: 60, pptW: 1.9, pptH: 0.5 },
        L5: { bg: "F2DCE0", border: "F2A0AF", text: "3B0716", badge: "D95578", fontSize: 9, pxW: 200, pxH: 50, pptW: 1.6, pptH: 0.45 },
      };
      const DEF = LS.L4;
      const getLevel = (n: Node) => (n.data as Record<string, string>).level || "L4";
      const getLabel = (n: Node) => (n.data as Record<string, string>).label || "";
      const getId = (n: Node) => (n.data as Record<string, string>).id || n.id;
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
        x: 1, y: 1.8, w: 11.33, h: 1.2,
        fontSize: 44, fontFace: "Arial", color: "FFFFFF", bold: true, align: "center",
      });
      s1.addText("PwC · 두산 HR AX", {
        x: 1, y: 3.2, w: 11.33, h: 0.6,
        fontSize: 18, fontFace: "Arial", color: "94A3B8", align: "center",
      });
      s1.addText(
        `노드 ${nodes.length}개  ·  연결 ${edges.length}개  ·  ${new Date().toLocaleDateString("ko-KR")}`,
        { x: 1, y: 4.0, w: 11.33, h: 0.5, fontSize: 13, fontFace: "Arial", color: "64748B", align: "center" },
      );
      // Level legend on title
      let lx = 3.2;
      for (const [lvl, cfg] of Object.entries(LS)) {
        s1.addShape("roundRect", { x: lx, y: 5.2, w: 1.3, h: 0.38, fill: { color: cfg.bg }, line: { color: cfg.border, width: 1 }, rectRadius: 0.06 });
        s1.addText(lvl, { x: lx, y: 5.2, w: 1.3, h: 0.38, fontSize: 11, fontFace: "Arial", color: cfg.text, bold: true, align: "center", valign: "middle" });
        lx += 1.7;
      }

      /* ═══════════════════════════════════════════
       * SLIDE 2 — Workflow Diagram (Native Shapes)
       * ═══════════════════════════════════════════ */
      const s2 = pptx.addSlide();
      s2.background = { color: "F8FAFC" };
      s2.addText("워크플로우 다이어그램", {
        x: 0.3, y: 0.15, w: 12.7, h: 0.45,
        fontSize: 16, fontFace: "Arial", bold: true, color: "1E293B",
      });

      // ── Coordinate mapping: RF center → PPT center ──
      const rfCenters = nodes.map((nd) => {
        const s = LS[getLevel(nd)] || DEF;
        return { id: nd.id, cx: nd.position.x + s.pxW / 2, cy: nd.position.y + s.pxH / 2 };
      });
      let cMinX = Infinity, cMinY = Infinity, cMaxX = -Infinity, cMaxY = -Infinity;
      for (const c of rfCenters) {
        cMinX = Math.min(cMinX, c.cx); cMinY = Math.min(cMinY, c.cy);
        cMaxX = Math.max(cMaxX, c.cx); cMaxY = Math.max(cMaxY, c.cy);
      }
      const cRangeX = (cMaxX - cMinX) || 1;
      const cRangeY = (cMaxY - cMinY) || 1;
      const PAD_X = 0.5, PAD_TOP = 0.75, maxNW = 2.3, maxNH = 0.6;
      const pptAreaW = 13.33 - 2 * PAD_X - maxNW;
      const pptAreaH = 7.5 - PAD_TOP - 0.9 - maxNH;
      const sc = Math.min(pptAreaW / cRangeX, pptAreaH / cRangeY);
      const toPptCenter = (rfCx: number, rfCy: number) => ({
        cx: PAD_X + maxNW / 2 + (rfCx - cMinX) * sc,
        cy: PAD_TOP + maxNH / 2 + (rfCy - cMinY) * sc,
      });

      // Draw nodes
      const nodeBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
      for (const nd of nodes) {
        const level = getLevel(nd);
        const s = LS[level] || DEF;
        const rfCx = nd.position.x + s.pxW / 2;
        const rfCy = nd.position.y + s.pxH / 2;
        const { cx, cy } = toPptCenter(rfCx, rfCy);
        const box = { x: cx - s.pptW / 2, y: cy - s.pptH / 2, w: s.pptW, h: s.pptH };
        nodeBoxes[nd.id] = box;

        s2.addShape("roundRect", {
          x: box.x, y: box.y, w: box.w, h: box.h,
          fill: { color: s.bg }, line: { color: s.border, width: 1.5 }, rectRadius: 0.08,
          shadow: { type: "outer", blur: 3, offset: 1, color: "000000", opacity: 0.12 },
        });
        s2.addText([
          { text: `${level} · ${getId(nd)}  `, options: { fontSize: 7, bold: true, color: s.badge, fontFace: "Arial" } },
          { text: getLabel(nd), options: { fontSize: s.fontSize, bold: true, color: s.text, fontFace: "Arial" } },
        ], { x: box.x + 0.08, y: box.y + 0.02, w: box.w - 0.16, h: box.h - 0.04, valign: "middle", align: "center" });
      }

      // Draw edges (arrows) — supports bidirectional + connection points
      const colorMap: Record<string, string> = {
        "#a62121": "A62121", "#d95578": "D95578", "#f2a0af": "F2A0AF",
        "#f2dce0": "F2DCE0", "#dedede": "DEDEDE",
        "#6366f1": "D95578", "#3b82f6": "D95578", "#10b981": "D95578",
        "#f97316": "F2A0AF", "#d1d5db": "DEDEDE",
      };

      /* Helper: find the best anchor point pair (edge of source/target box) */
      const getAnchorPoints = (src: typeof nodeBoxes[string], tgt: typeof nodeBoxes[string]) => {
        const srcCx = src.x + src.w / 2, srcCy = src.y + src.h / 2;
        const tgtCx = tgt.x + tgt.w / 2, tgtCy = tgt.y + tgt.h / 2;
        const dx = tgtCx - srcCx, dy = tgtCy - srcCy;

        // 4 cardinal directions: top, bottom, left, right
        const srcPorts = [
          { x: srcCx, y: src.y, dir: "top" },
          { x: srcCx, y: src.y + src.h, dir: "bottom" },
          { x: src.x, y: srcCy, dir: "left" },
          { x: src.x + src.w, y: srcCy, dir: "right" },
        ];
        const tgtPorts = [
          { x: tgtCx, y: tgt.y, dir: "top" },
          { x: tgtCx, y: tgt.y + tgt.h, dir: "bottom" },
          { x: tgt.x, y: tgtCy, dir: "left" },
          { x: tgt.x + tgt.w, y: tgtCy, dir: "right" },
        ];

        // Choose the pair with minimum distance
        let bestDist = Infinity;
        let bestSrc = srcPorts[0], bestTgt = tgtPorts[0];
        for (const sp of srcPorts) {
          for (const tp of tgtPorts) {
            // Skip if going back into the same direction
            if (sp.dir === tp.dir) continue;
            const d = Math.hypot(tp.x - sp.x, tp.y - sp.y);
            if (d < bestDist) { bestDist = d; bestSrc = sp; bestTgt = tp; }
          }
        }

        // Fallback: use dominant axis
        if (bestDist === Infinity || bestDist === 0) {
          if (Math.abs(dy) >= Math.abs(dx)) {
            if (dy > 0) return { sx: srcCx, sy: src.y + src.h, ex: tgtCx, ey: tgt.y };
            else return { sx: srcCx, sy: src.y, ex: tgtCx, ey: tgt.y + tgt.h };
          } else {
            if (dx > 0) return { sx: src.x + src.w, sy: srcCy, ex: tgt.x, ey: tgtCy };
            else return { sx: src.x, sy: srcCy, ex: tgt.x + tgt.w, ey: tgtCy };
          }
        }

        return { sx: bestSrc.x, sy: bestSrc.y, ex: bestTgt.x, ey: bestTgt.y };
      };

      for (const edge of edges) {
        const src = nodeBoxes[edge.source];
        const tgt = nodeBoxes[edge.target];
        if (!src || !tgt) continue;

        const { sx: startX, sy: startY, ex: endX, ey: endY } = getAnchorPoints(src, tgt);

        const rawColor = ((edge.style as Record<string, unknown>)?.stroke as string) || "#d95578";
        const lineColor = colorMap[rawColor] || rawColor.replace("#", "").toUpperCase() || "D95578";
        const isBidi = !!(edge.markerStart || ((edge.data as Record<string, unknown>)?.bidirectional));

        s2.addShape("line", {
          x: Math.min(startX, endX), y: Math.min(startY, endY),
          w: Math.max(Math.abs(endX - startX), 0.01), h: Math.max(Math.abs(endY - startY), 0.01),
          flipH: endX < startX, flipV: endY < startY,
          line: {
            color: lineColor,
            width: 1.5,
            endArrowType: "triangle",
            beginArrowType: isBidi ? "triangle" : undefined,
            dashType: edge.animated ? "dash" : "solid",
          },
        });

        if (edge.label) {
          const midX = (startX + endX) / 2, midY = (startY + endY) / 2;
          s2.addText(String(edge.label), {
            x: midX - 0.5, y: midY - 0.15, w: 1.0, h: 0.3,
            fontSize: 7, color: lineColor, fontFace: "Arial", align: "center", valign: "middle",
            fill: { color: "F8FAFC" },
          });
        }
      }

      // Slide 2 legend bar
      let lg2x = 0.4;
      for (const [lvl, cfg] of Object.entries(LS)) {
        s2.addShape("roundRect", { x: lg2x, y: 7.05, w: 0.22, h: 0.22, fill: { color: cfg.bg }, line: { color: cfg.border, width: 0.5 }, rectRadius: 0.03 });
        s2.addText(lvl, { x: lg2x + 0.28, y: 7.05, w: 0.5, h: 0.22, fontSize: 8, color: "64748B", fontFace: "Arial", valign: "middle" });
        lg2x += 0.9;
      }
      s2.addText("── 실선: 고정 흐름  - - - 점선: 동적 흐름  ▶ 화살표: 진행 방향", {
        x: 4.5, y: 7.05, w: 6, h: 0.22, fontSize: 7, color: "94A3B8", fontFace: "Arial", valign: "middle",
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
        x: 0.3, y: 0.15, w: 12.7, h: 0.45,
        fontSize: 16, fontFace: "Arial", bold: true, color: "1E293B",
      });
      s3.addText("토폴로지 정렬 기반 실행 순서 · 번호는 선후행 관계를 반영합니다", {
        x: 0.3, y: 0.55, w: 12.7, h: 0.3, fontSize: 9, fontFace: "Arial", color: "94A3B8",
      });

      // Serpentine flow layout
      const COLS = 4, BW = 2.8, BH = 0.5, GX = 0.3, GY = 0.38, SX = 0.4, SY = 1.05;
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

        // Step box
        s3.addShape("roundRect", {
          x: bx, y: by, w: BW, h: BH,
          fill: { color: s.bg }, line: { color: s.border, width: 1.2 }, rectRadius: 0.06,
        });
        // Step number circle
        s3.addShape("ellipse", { x: bx + 0.06, y: by + 0.07, w: 0.36, h: 0.36, fill: { color: s.border } });
        s3.addText(String(i + 1), {
          x: bx + 0.06, y: by + 0.07, w: 0.36, h: 0.36,
          fontSize: 9, fontFace: "Arial", bold: true, color: "FFFFFF", align: "center", valign: "middle",
        });
        // Label
        s3.addText([
          { text: `[${level}] `, options: { fontSize: 8, bold: true, color: s.badge, fontFace: "Arial" } },
          { text: getLabel(nd), options: { fontSize: 9.5, bold: true, color: s.text, fontFace: "Arial" } },
        ], { x: bx + 0.46, y: by, w: BW - 0.56, h: BH, valign: "middle", align: "left" });

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
                line: { color: "94A3B8", width: 1.5, endArrowType: "triangle" },
              });
            } else {
              const nBx = SX + nCol * (BW + GX);
              s3.addShape("line", {
                x: nBx + BW, y: by + BH / 2, w: GX, h: 0.01, flipH: true,
                line: { color: "94A3B8", width: 1.5, endArrowType: "triangle" },
              });
            }
          } else {
            // Row transition: vertical down arrow
            s3.addShape("line", {
              x: bx + BW / 2, y: by + BH, w: 0.01, h: GY,
              line: { color: "94A3B8", width: 1.5, endArrowType: "triangle" },
            });
          }
        }
      }
      if (sorted.length > maxSteps) {
        const lastRow = Math.ceil(maxSteps / COLS);
        s3.addText(`... 외 ${sorted.length - maxSteps}개 단계`, {
          x: SX, y: SY + lastRow * (BH + GY), w: 5, h: 0.35,
          fontSize: 10, color: "94A3B8", fontFace: "Arial",
        });
      }

      /* ═══════════════════════════════════════════
       * SLIDE 4 — Connection Map (Edges Table)
       * ═══════════════════════════════════════════ */
      const s4 = pptx.addSlide();
      s4.background = { color: "FFFFFF" };
      s4.addText("연결 관계 (화살표) 목록", {
        x: 0.3, y: 0.15, w: 12.7, h: 0.45,
        fontSize: 16, fontFace: "Arial", bold: true, color: "1E293B",
      });
      s4.addText(`총 ${edges.length}개의 연결 화살표`, {
        x: 0.3, y: 0.55, w: 12.7, h: 0.3, fontSize: 9, fontFace: "Arial", color: "94A3B8",
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
          { text: sl, options: { fontSize: 8, align: "center" as const, color: "FFFFFF", fill: { color: ss.bg } } },
          { text: isBidi ? "⇄" : "→", options: { fontSize: 10, align: "center" as const, bold: true as const, color: isBidi ? "A62121" : "D95578" } },
          { text: tn ? getLabel(tn) : edge.target, options: { fontSize: 8, bold: true as const } },
          { text: tl, options: { fontSize: 8, align: "center" as const, color: "FFFFFF", fill: { color: ts.bg } } },
          { text: edge.label ? String(edge.label) : "", options: { fontSize: 8, color: "64748B", italic: true as const } },
        ]);
      });
      s4.addTable(connRows, {
        x: 0.3, y: 0.95, w: 12.7,
        colW: [0.5, 3.0, 0.7, 0.5, 3.0, 0.7, 2.5],
        border: { pt: 0.5, color: "E2E8F0" }, rowH: 0.35,
        autoPage: true, autoPageRepeatHeader: true,
      });

      /* ═══════════════════════════════════════════
       * SLIDE 5 — Node Details Table
       * ═══════════════════════════════════════════ */
      const s5 = pptx.addSlide();
      s5.background = { color: "FFFFFF" };
      s5.addText("노드 상세 목록", {
        x: 0.3, y: 0.15, w: 12.7, h: 0.45,
        fontSize: 16, fontFace: "Arial", bold: true, color: "1E293B",
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
          { text: level, options: { fontSize: 9, color: "FFFFFF", fill: { color: s.bg }, align: "center" as const, bold: true as const } },
          { text: getId(nd), options: { fontSize: 8, color: "374151" } },
          { text: getLabel(nd), options: { fontSize: 9, bold: true as const } },
          { text: getDesc(nd), options: { fontSize: 8, color: "6B7280" } },
          { text: `↓${inE}  ↑${outE}`, options: { fontSize: 8, color: "64748B", align: "center" as const } },
        ]);
      }
      s5.addTable(nodeRows, {
        x: 0.3, y: 0.75, w: 12.7,
        colW: [0.8, 1.5, 2.8, 5.5, 1.0],
        border: { pt: 0.5, color: "E2E8F0" }, rowH: 0.35,
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
        s6.addText("노드 메타 정보 (메모 · 수행주체 · Input/Output · 시스템)", {
          x: 0.3, y: 0.15, w: 12.7, h: 0.45,
          fontSize: 16, fontFace: "Arial", bold: true, color: "1E293B",
        });
        s6.addText(`메타데이터가 입력된 ${nodesWithMeta.length}개 노드`, {
          x: 0.3, y: 0.55, w: 12.7, h: 0.3, fontSize: 9, fontFace: "Arial", color: "94A3B8",
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
            { text: level, options: { fontSize: 8, color: "FFFFFF", fill: { color: s.bg }, align: "center" as const, bold: true as const } },
            { text: getLabel(nd), options: { fontSize: 8, bold: true as const } },
            { text: m.role, options: { fontSize: 8, color: "374151", align: "center" as const } },
            { text: m.inputData, options: { fontSize: 7.5, color: "059669" } },
            { text: m.outputData, options: { fontSize: 7.5, color: "DC2626" } },
            { text: m.system, options: { fontSize: 7.5, color: "7C3AED" } },
            { text: m.memo, options: { fontSize: 7.5, color: "6B7280", italic: true as const } },
          ]);
        }
        s6.addTable(metaRows, {
          x: 0.3, y: 0.95, w: 12.7,
          colW: [0.6, 2.0, 1.2, 2.0, 2.0, 1.8, 3.1],
          border: { pt: 0.5, color: "E2E8F0" }, rowH: 0.38,
          autoPage: true, autoPageRepeatHeader: true,
        });
      }

      await pptx.writeFile({ fileName: `hr-workflow-${Date.now()}.pptx` });
    } catch (err) {
      console.error("PPT export error:", err);
      alert("PPT 내보내기에 실패했습니다.");
    } finally {
      isExporting.current = false;
    }
  }, [nodes, edges]);

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
        title="PowerPoint 저장"
      >
        📊 PPT
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
