/* ─────────────────────────────────────────────
 * CSV → React Flow Nodes & Edges 변환 유틸리티
 * ───────────────────────────────────────────── */

import { MarkerType, type Node, type Edge } from "@xyflow/react";

export interface CsvRow {
  L2_ID: string;
  "두산 L2": string;
  L3_ID: string;
  L3_Name: string;
  L4_ID: string;
  L4_Name: string;
  L4_Description: string;
  L5_ID: string;
  L5_Name: string;
  L5_Description: string;
}

/* ═══════════════════════════════════════════════
 * 1) 계층 구조 추출 유틸리티
 * ═══════════════════════════════════════════════ */

export interface L2Item {
  id: string;
  name: string;
}
export interface L3Item {
  id: string;
  name: string;
  l2Id: string;
  l2Name: string;
}
export interface L4Item {
  id: string;
  name: string;
  description: string;
  l3Id: string;
}
export interface L5Item {
  id: string;
  name: string;
  description: string;
  l4Id: string;
}

/** L2 목록 추출 */
export function extractL2List(rows: CsvRow[]): L2Item[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (!map.has(r.L2_ID)) map.set(r.L2_ID, r["두산 L2"]);
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/** 특정 L2 아래 L3 목록 추출 */
export function extractL3ByL2(rows: CsvRow[], l2Id: string): L3Item[] {
  const map = new Map<string, L3Item>();
  for (const r of rows) {
    if (r.L2_ID === l2Id && !map.has(r.L3_ID)) {
      map.set(r.L3_ID, {
        id: r.L3_ID,
        name: r.L3_Name,
        l2Id: r.L2_ID,
        l2Name: r["두산 L2"],
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

/** 특정 L3 아래 L4 목록 추출 */
export function extractL4ByL3(rows: CsvRow[], l3Id: string): L4Item[] {
  const map = new Map<string, L4Item>();
  for (const r of rows) {
    if (r.L3_ID === l3Id && r.L4_ID && !map.has(r.L4_ID)) {
      map.set(r.L4_ID, {
        id: r.L4_ID,
        name: r.L4_Name,
        description: r.L4_Description,
        l3Id: r.L3_ID,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

/** 특정 L4 아래 L5 목록 추출 */
export function extractL5ByL4(rows: CsvRow[], l4Id: string): L5Item[] {
  const map = new Map<string, L5Item>();
  for (const r of rows) {
    if (r.L4_ID === l4Id && r.L5_ID && !map.has(r.L5_ID)) {
      map.set(r.L5_ID, {
        id: r.L5_ID,
        name: r.L5_Name,
        description: r.L5_Description,
        l4Id: r.L4_ID,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

/** CSV 전체에서 L3 목록을 추출 (하위호환) */
export function extractL3List(
  rows: CsvRow[]
): { id: string; name: string; l2Name: string }[] {
  const map = new Map<string, { name: string; l2Name: string }>();
  for (const r of rows) {
    if (!map.has(r.L3_ID)) {
      map.set(r.L3_ID, { name: r.L3_Name, l2Name: r["두산 L2"] });
    }
  }
  return Array.from(map.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/* ═══════════════════════════════════════════════
 * 2) 개별 노드를 캔버스에 추가하는 함수
 * ═══════════════════════════════════════════════ */

let dropCounter = 0;

/** 캔버스 중앙 부근에 노드 하나를 생성 */
export function createNodeFromItem(
  level: "l2" | "l3" | "l4" | "l5",
  item: { id: string; name: string; description?: string },
  position: { x: number; y: number }
): Node {
  dropCounter++;
  return {
    id: `${level}-${item.id}-${dropCounter}`,
    type: level,
    position,
    data: {
      label: item.name,
      level: level.toUpperCase(),
      id: item.id,
      description: item.description ?? "",
    },
  };
}

/* ═══════════════════════════════════════════════
 * 3) AI 자동 생성용 — L3 데이터를 요약 텍스트로
 * ═══════════════════════════════════════════════ */

/** 선택된 L3 프로세스의 L4→L5 구조를 텍스트로 요약 (AI 입력용) */
export function summarizeL3ForAI(rows: CsvRow[], l3Id: string): string {
  const l3Rows = rows.filter((r) => r.L3_ID === l3Id);
  if (l3Rows.length === 0) return "";

  const first = l3Rows[0];
  let text = `L2: ${first["두산 L2"]} (${first.L2_ID})\n`;
  text += `L3: ${first.L3_Name} (${first.L3_ID})\n\n`;

  const l4s = extractL4ByL3(rows, l3Id);
  for (const l4 of l4s) {
    text += `  L4: ${l4.name} (${l4.id})`;
    if (l4.description) text += ` — ${l4.description}`;
    text += "\n";

    const l5s = extractL5ByL4(rows, l4.id);
    for (const l5 of l5s) {
      text += `    L5: ${l5.name} (${l5.id})`;
      if (l5.description) text += ` — ${l5.description}`;
      text += "\n";
    }
  }
  return text;
}

/* ═══════════════════════════════════════════════
 * 4) 전체 트리 자동 배치 (기존 buildFlowFromL3)
 * ═══════════════════════════════════════════════ */

const COL_GAP = 320;
const ROW_GAP = 90;
const START_X = 60;
const START_Y = 60;

export function buildFlowFromL3(
  rows: CsvRow[],
  selectedL3Id: string
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const l3Rows = rows.filter((r) => r.L3_ID === selectedL3Id);
  if (l3Rows.length === 0) return { nodes, edges };

  const first = l3Rows[0];

  // ── L2 ──
  const l2NodeId = `l2-${first.L2_ID}`;
  nodes.push({
    id: l2NodeId,
    type: "l2",
    position: { x: START_X, y: START_Y },
    data: { label: first["두산 L2"], level: "L2", id: first.L2_ID },
  });

  // ── L3 ──
  const l3NodeId = `l3-${first.L3_ID}`;
  nodes.push({
    id: l3NodeId,
    type: "l3",
    position: { x: START_X + COL_GAP, y: START_Y },
    data: { label: first.L3_Name, level: "L3", id: first.L3_ID },
  });
  edges.push({
    id: `e-${l2NodeId}-${l3NodeId}`,
    source: l2NodeId,
    target: l3NodeId,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#a62121", strokeWidth: 2.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#a62121",
    },
  });

  // ── L4들 ──
  const l4Map = new Map<string, { name: string; desc: string }>();
  for (const r of l3Rows) {
    if (r.L4_ID && !l4Map.has(r.L4_ID)) {
      l4Map.set(r.L4_ID, { name: r.L4_Name, desc: r.L4_Description });
    }
  }

  let l4Y = START_Y;
  const l4Ids: string[] = [];
  for (const [l4Id, info] of Array.from(l4Map.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  )) {
    const nodeId = `l4-${l4Id}`;
    l4Ids.push(nodeId);
    nodes.push({
      id: nodeId,
      type: "l4",
      position: { x: START_X + COL_GAP * 2, y: l4Y },
      data: { label: info.name, level: "L4", id: l4Id, description: info.desc },
    });
    edges.push({
      id: `e-${l3NodeId}-${nodeId}`,
      source: l3NodeId,
      target: nodeId,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#d95578", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: "#d95578",
      },
    });
    l4Y += ROW_GAP;
  }

  // ── L5들 ──
  const l5ByL4 = new Map<string, CsvRow[]>();
  for (const r of l3Rows) {
    if (!r.L5_ID) continue;
    const arr = l5ByL4.get(r.L4_ID) ?? [];
    arr.push(r);
    l5ByL4.set(r.L4_ID, arr);
  }

  for (const [l4Id, l5Rows] of l5ByL4.entries()) {
    const parentNodeId = `l4-${l4Id}`;
    const parentNode = nodes.find((n) => n.id === parentNodeId);
    if (!parentNode) continue;

    const baseY = parentNode.position.y;
    const seen = new Set<string>();
    let l5Index = 0;
    for (const r of l5Rows) {
      if (seen.has(r.L5_ID)) continue;
      seen.add(r.L5_ID);

      const l5NodeId = `l5-${r.L5_ID}`;
      nodes.push({
        id: l5NodeId,
        type: "l5",
        position: { x: START_X + COL_GAP * 3, y: baseY + l5Index * 60 },
        data: {
          label: r.L5_Name,
          level: "L5",
          id: r.L5_ID,
          description: r.L5_Description,
        },
      });
      edges.push({
        id: `e-${parentNodeId}-${l5NodeId}`,
        source: parentNodeId,
        target: l5NodeId,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#f2a0af", strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: "#f2a0af",
        },
      });
      l5Index++;
    }
  }

  // Y 중앙 정렬
  if (l4Ids.length > 0) {
    const firstL4 = nodes.find((n) => n.id === l4Ids[0]);
    const lastL4 = nodes.find((n) => n.id === l4Ids[l4Ids.length - 1]);
    if (firstL4 && lastL4) {
      const midY = (firstL4.position.y + lastL4.position.y) / 2;
      const l3Node = nodes.find((n) => n.id === l3NodeId);
      if (l3Node) l3Node.position.y = midY;
      const l2Node = nodes.find((n) => n.id === l2NodeId);
      if (l2Node) l2Node.position.y = midY;
    }
  }

  return { nodes, edges };
}

/**
 * CSV 텍스트를 파싱하여 CsvRow[]로 변환
 */
export function parseCsv(text: string): CsvRow[] {
  // BOM 제거
  const clean = text.replace(/^\uFEFF/, "");
  const lines = clean.split("\n");
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: CsvRow[] = [];

  // Multi-line CSV 처리
  let i = 1;
  while (i < lines.length) {
    let line = lines[i];
    // 따옴표가 열려있으면 다음 줄과 합침
    while (countQuotes(line) % 2 !== 0 && i + 1 < lines.length) {
      i++;
      line += "\n" + lines[i];
    }
    i++;

    if (line.trim() === "") continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let h = 0; h < headers.length; h++) {
      row[headers[h]] = (values[h] ?? "").trim();
    }
    rows.push(row as unknown as CsvRow);
  }

  return rows;
}

function countQuotes(s: string): number {
  let count = 0;
  for (const c of s) if (c === '"') count++;
  return count;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}
