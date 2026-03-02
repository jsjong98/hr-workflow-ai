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
  /* ── 새 열 (index 10~43) ── */
  actor_exec: string;       // 수행주체_임원
  actor_hr: string;         // 수행주체_HR
  actor_teamlead: string;   // 수행주체_현업 팀장
  actor_member: string;     // 수행주체_현업 구성원
  mgr_body: string;         // 관리주체
  staff_count: string;      // 담당자 수
  main_person: string;      // 주 담당자
  avg_time: string;         // 평균 건당 소요시간
  freq_count: string;       // 발생 빈도_건수
  sys_hr: string;           // 사용 시스템_HR 전용시스템
  sys_groupware: string;    // 사용 시스템_그룹웨어_협업툴
  sys_office: string;       // 사용 시스템_오피스_문서도구
  sys_manual: string;       // 사용 시스템_수작업_오프라인
  sys_etc: string;          // 사용 시스템_기타 전문 Tool
  pp_speed: string;         // Pain Point_시간_속도
  pp_accuracy: string;      // Pain Point_정확성
  pp_repeat: string;        // Pain Point_반복/수작업
  pp_data: string;          // Pain Point_정보_데이터
  pp_system: string;        // Pain Point_시스템_도구
  pp_comm: string;          // Pain Point_의사소통_협업
  pp_etc: string;           // Pain Point_기타
  in_system: string;        // Input_시스템 데이터
  in_doc: string;           // Input_문서_서류
  in_external: string;      // Input_외부 정보
  in_request: string;       // Input_구두_메일 요청
  in_etc: string;           // Input_기타
  out_system: string;       // Output_시스템 반영
  out_doc: string;          // Output_문서_보고서
  out_comm: string;         // Output_커뮤니케이션
  out_decision: string;     // Output_의사결정
  out_etc: string;          // Output_기타
  logic_rule: string;       // 업무 판단 로직_Rule_based
  logic_human: string;      // 업무 판단 로직_사람 판단
  logic_mixed: string;      // 업무 판단 로직_혼합
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
  /* ── extended metadata ── */
  actors?: { exec: string; hr: string; teamlead: string; member: string };
  mgrBody?: string;
  staffCount?: string;
  mainPerson?: string;
  avgTime?: string;
  freqCount?: string;
  systems?: { hr: string; groupware: string; office: string; manual: string; etc: string };
  painPoints?: { speed: string; accuracy: string; repeat: string; data: string; system: string; comm: string; etc: string };
  inputs?: { system: string; doc: string; external: string; request: string; etc: string };
  outputs?: { system: string; doc: string; comm: string; decision: string; etc: string };
  logic?: { rule: string; human: string; mixed: string };
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
      map.set(r.L5_ID, buildL5Item(r));
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.id.localeCompare(b.id, undefined, { numeric: true })
  );
}

/** CsvRow → L5Item (모든 메타데이터 포함) */
function buildL5Item(r: CsvRow): L5Item {
  return {
    id: r.L5_ID,
    name: r.L5_Name,
    description: r.L5_Description,
    l4Id: r.L4_ID,
    actors: { exec: r.actor_exec || "", hr: r.actor_hr || "", teamlead: r.actor_teamlead || "", member: r.actor_member || "" },
    mgrBody: r.mgr_body || "",
    staffCount: r.staff_count || "",
    mainPerson: r.main_person || "",
    avgTime: r.avg_time || "",
    freqCount: r.freq_count || "",
    systems: { hr: r.sys_hr || "", groupware: r.sys_groupware || "", office: r.sys_office || "", manual: r.sys_manual || "", etc: r.sys_etc || "" },
    painPoints: { speed: r.pp_speed || "", accuracy: r.pp_accuracy || "", repeat: r.pp_repeat || "", data: r.pp_data || "", system: r.pp_system || "", comm: r.pp_comm || "", etc: r.pp_etc || "" },
    inputs: { system: r.in_system || "", doc: r.in_doc || "", external: r.in_external || "", request: r.in_request || "", etc: r.in_etc || "" },
    outputs: { system: r.out_system || "", doc: r.out_doc || "", comm: r.out_comm || "", decision: r.out_decision || "", etc: r.out_etc || "" },
    logic: { rule: r.logic_rule || "", human: r.logic_human || "", mixed: r.logic_mixed || "" },
  };
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
      // 수행주체 요약
      const actorParts: string[] = [];
      if (l5.actors?.exec) actorParts.push(`임원: ${l5.actors.exec}`);
      if (l5.actors?.hr) actorParts.push(`HR: ${l5.actors.hr}`);
      if (l5.actors?.teamlead) actorParts.push(`팀장: ${l5.actors.teamlead}`);
      if (l5.actors?.member) actorParts.push(`구성원: ${l5.actors.member}`);
      if (actorParts.length > 0) text += ` [수행주체: ${actorParts.join(", ")}]`;
      if (l5.mainPerson) text += ` [주담당: ${l5.mainPerson}]`;
      if (l5.avgTime) text += ` [소요시간: ${l5.avgTime}]`;
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
      const l5Item = buildL5Item(r);
      nodes.push({
        id: l5NodeId,
        type: "l5",
        position: { x: START_X + COL_GAP * 3, y: baseY + l5Index * 60 },
        data: {
          label: r.L5_Name,
          level: "L5",
          id: r.L5_ID,
          description: r.L5_Description,
          /* extended L5 metadata */
          actors: l5Item.actors,
          mgrBody: l5Item.mgrBody,
          staffCount: l5Item.staffCount,
          mainPerson: l5Item.mainPerson,
          avgTime: l5Item.avgTime,
          freqCount: l5Item.freqCount,
          systems: l5Item.systems,
          painPoints: l5Item.painPoints,
          inputs: l5Item.inputs,
          outputs: l5Item.outputs,
          logic: l5Item.logic,
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

/* ═══════════════════════════════════════════════
 * 4-b) SwimLane 자동 배치 — 수행주체 기반
 *
 * 레인 순서 (SwimLaneOverlay와 동일):
 *   0: 임원     (actor_exec)
 *   1: 팀장     (actor_teamlead)
 *   2: HR 담당자 (actor_hr)
 *   3: 구성원    (actor_member)
 *
 * 수행주체 열이 비어있지 않으면 해당 레인,
 * 여러 레인에 해당하면 가장 높은(우선순위 작은) 레인 사용,
 * 모두 비어있으면 HR 담당자 레인(2)에 기본 배치.
 * ═══════════════════════════════════════════════ */

const SWIM_LANE_HEIGHT = 4000;
const SWIM_LANE_COUNT = 4;
const SWIM_LANE_H = SWIM_LANE_HEIGHT / SWIM_LANE_COUNT; // 1000px per lane

/** 수행주체 열에서 레인 인덱스를 결정 */
function determineLane(r: CsvRow): number {
  // 우선순위: 임원(0) > 팀장(1) > HR(2) > 구성원(3)
  if (r.actor_exec && r.actor_exec.trim()) return 0;
  if (r.actor_teamlead && r.actor_teamlead.trim()) return 1;
  if (r.actor_hr && r.actor_hr.trim()) return 2;
  if (r.actor_member && r.actor_member.trim()) return 3;
  return 2; // 기본: HR 담당자
}

/** SwimLane에 맞춰 L5 노드를 배치하는 빌더 */
export function buildSwimLaneFlowFromL3(
  rows: CsvRow[],
  selectedL3Id: string
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const l3Rows = rows.filter((r) => r.L3_ID === selectedL3Id);
  if (l3Rows.length === 0) return { nodes, edges };
  const first = l3Rows[0];

  // 수집: L4→L5 데이터 + 레인 정보
  const l4Map = new Map<string, { name: string; desc: string }>();
  const l5ByL4 = new Map<string, CsvRow[]>();
  for (const r of l3Rows) {
    if (r.L4_ID && !l4Map.has(r.L4_ID)) {
      l4Map.set(r.L4_ID, { name: r.L4_Name, desc: r.L4_Description });
    }
    if (r.L5_ID) {
      const arr = l5ByL4.get(r.L4_ID) ?? [];
      arr.push(r);
      l5ByL4.set(r.L4_ID, arr);
    }
  }

  // L4별로 L5를 수평 배치, 각 L5는 자신의 레인(Y좌표)에 배치
  const L4_COL_WIDTH = 280;       // L4 그룹 간 X 간격
  const NODE_X_GAP = 240;         // 같은 레인 내 L5 간 X 간격
  const L4_START_X = 120;
  const LANE_PAD_TOP = 80;        // 레인 상단 여백

  // 레인별 다음 X 위치 추적
  const laneNextX: number[] = [L4_START_X, L4_START_X, L4_START_X, L4_START_X];

  const l4Entries = Array.from(l4Map.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  );

  let l4ColX = L4_START_X;

  for (const [l4Id, l4Info] of l4Entries) {
    // L4 노드 — HR 담당자 레인(2)에 기본 배치
    const l4NodeId = `l4-${l4Id}`;
    const l4Y = 2 * SWIM_LANE_H + LANE_PAD_TOP;
    nodes.push({
      id: l4NodeId,
      type: "l4",
      position: { x: l4ColX, y: l4Y },
      data: { label: l4Info.name, level: "L4", id: l4Id, description: l4Info.desc },
    });

    // L5 노드들
    const l5Rows = l5ByL4.get(l4Id) ?? [];
    const seen = new Set<string>();
    for (const r of l5Rows) {
      if (seen.has(r.L5_ID)) continue;
      seen.add(r.L5_ID);

      const lane = determineLane(r);
      const laneY = lane * SWIM_LANE_H + LANE_PAD_TOP + 160; // 레인 상단 + 여백
      const x = Math.max(laneNextX[lane], l4ColX);

      const l5NodeId = `l5-${r.L5_ID}`;
      const l5Item = buildL5Item(r);
      nodes.push({
        id: l5NodeId,
        type: "l5",
        position: { x, y: laneY },
        data: {
          label: r.L5_Name,
          level: "L5",
          id: r.L5_ID,
          description: r.L5_Description,
          actors: l5Item.actors,
          mgrBody: l5Item.mgrBody,
          staffCount: l5Item.staffCount,
          mainPerson: l5Item.mainPerson,
          avgTime: l5Item.avgTime,
          freqCount: l5Item.freqCount,
          systems: l5Item.systems,
          painPoints: l5Item.painPoints,
          inputs: l5Item.inputs,
          outputs: l5Item.outputs,
          logic: l5Item.logic,
        },
      });
      edges.push({
        id: `e-${l4NodeId}-${l5NodeId}`,
        source: l4NodeId,
        target: l5NodeId,
        type: "smoothstep",
        animated: false,
        style: { stroke: "#f2a0af", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#f2a0af" },
      });

      laneNextX[lane] = x + NODE_X_GAP;
    }
    l4ColX += L4_COL_WIDTH;
  }

  // L3 노드 (좌상단)
  const l3NodeId = `l3-${first.L3_ID}`;
  nodes.push({
    id: l3NodeId,
    type: "l3",
    position: { x: 20, y: 20 },
    data: { label: first.L3_Name, level: "L3", id: first.L3_ID },
  });

  // L3 → L4 연결
  for (const [l4Id] of l4Entries) {
    const l4NodeId = `l4-${l4Id}`;
    edges.push({
      id: `e-${l3NodeId}-${l4NodeId}`,
      source: l3NodeId,
      target: l4NodeId,
      type: "smoothstep",
      animated: false,
      style: { stroke: "#d95578", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#d95578" },
    });
  }

  return { nodes, edges };
}

/**
 * CSV 텍스트를 파싱하여 CsvRow[]로 변환
 * 
 * 헤더 순서 기반 매핑 (인덱스 0~9):
 *   0: L2_ID, 1: 두산 L2, 2: L3_ID, 3: L3_Name,
 *   4: L4_ID, 5: L4_Name, 6: L4_Description,
 *   7: L5_ID, 8: L5_Name, 9: L5_Description
 */
const FIELD_KEYS: (keyof CsvRow)[] = [
  "L2_ID", "두산 L2", "L3_ID", "L3_Name",
  "L4_ID", "L4_Name", "L4_Description",
  "L5_ID", "L5_Name", "L5_Description",
  /* index 10~43: 새 열 */
  "actor_exec", "actor_hr", "actor_teamlead", "actor_member",
  "mgr_body", "staff_count", "main_person", "avg_time", "freq_count",
  "sys_hr", "sys_groupware", "sys_office", "sys_manual", "sys_etc",
  "pp_speed", "pp_accuracy", "pp_repeat", "pp_data", "pp_system", "pp_comm", "pp_etc",
  "in_system", "in_doc", "in_external", "in_request", "in_etc",
  "out_system", "out_doc", "out_comm", "out_decision", "out_etc",
  "logic_rule", "logic_human", "logic_mixed",
];

export function parseCsv(text: string): CsvRow[] {
  // BOM 제거 + 줄바꿈 통일 (\r\n, \r → \n) + 보이지 않는 문자 제거
  const clean = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = clean.split("\n");
  if (lines.length < 2) return [];

  // 헤더 라인 파싱 (실제 헤더 이름은 무시하고, 인덱스 순서로 매핑)
  const headerCount = parseCSVLine(lines[0]).length;
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
    const len = Math.min(values.length, FIELD_KEYS.length);
    for (let h = 0; h < len; h++) {
      row[FIELD_KEYS[h]] = (values[h] ?? "").trim();
    }
    // 부족한 필드는 빈 문자열로 채움
    for (let h = len; h < FIELD_KEYS.length; h++) {
      row[FIELD_KEYS[h]] = "";
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
