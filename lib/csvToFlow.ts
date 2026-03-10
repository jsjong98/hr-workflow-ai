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
  sys_external: string;     // 사용 시스템_외부_연동시스템
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
  isManual?: boolean;
}
export interface L5Item {
  id: string;
  name: string;
  description: string;
  l4Id: string;
  l3Id?: string;
  l2Id?: string;
  l3Name?: string;
  l2Name?: string;
  isManual?: boolean;
  /* ── extended metadata ── */
  actors?: { exec: string; hr: string; teamlead: string; member: string };
  mgrBody?: string;
  staffCount?: string;
  mainPerson?: string;
  avgTime?: string;
  freqCount?: string;
  systems?: { hr: string; groupware: string; office: string; external: string; manual: string; etc: string };
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
    l3Id: r.L3_ID,
    l2Id: r.L2_ID,
    l3Name: r.L3_Name,
    l2Name: r["두산 L2"],
    actors: { exec: r.actor_exec || "", hr: r.actor_hr || "", teamlead: r.actor_teamlead || "", member: r.actor_member || "" },
    mgrBody: r.mgr_body || "",
    staffCount: r.staff_count || "",
    mainPerson: r.main_person || "",
    avgTime: r.avg_time || "",
    freqCount: r.freq_count || "",
    systems: { hr: r.sys_hr || "", groupware: r.sys_groupware || "", office: r.sys_office || "", external: r.sys_external || "", manual: r.sys_manual || "", etc: r.sys_etc || "" },
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

/** 캔버스 중앙 부근에 노드 하나를 생성 (모든 메타데이터 포함) */
export function createNodeFromItem(
  level: "l2" | "l3" | "l4" | "l5",
  item: { id: string; name: string; description?: string; [key: string]: unknown },
  position: { x: number; y: number }
): Node {
  dropCounter++;
  // item에서 id, name, description 외의 모든 키를 메타데이터로 spread
  const { id, name, description, ...rest } = item;
  return {
    id: `${level}-${id}-${dropCounter}`,
    type: level,
    position,
    data: {
      label: name,
      level: level.toUpperCase(),
      id,
      description: description ?? "",
      ...rest,
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

const COL_GAP = 650;
const ROW_GAP = 200;
const START_X = 100;
const START_Y = 100;

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
    type: "ortho",
    animated: false,
    style: { stroke: "#333333", strokeWidth: 2.5 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 20,
      height: 20,
      color: "#333333",
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
      type: "ortho",
      animated: false,
      style: { stroke: "#333333", strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: "#333333",
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
        position: { x: START_X + COL_GAP * 3, y: baseY + l5Index * 170 },
        data: {
          label: r.L5_Name,
          level: "L5",
          id: r.L5_ID,
          description: r.L5_Description,
          /* parent info for hierarchy export */
          l4Id: r.L4_ID,
          l4Name: l4Map.get(r.L4_ID)?.name || "",
          l3Id: first.L3_ID,
          l3Name: first.L3_Name,
          l2Id: first.L2_ID,
          l2Name: first["두산 L2"],
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
        type: "ortho",
        animated: false,
        style: { stroke: "#333333", strokeWidth: 1.5 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: "#333333",
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

const SWIM_LANE_HEIGHT = 2400;

/** 수행주체 열에서 레인 인덱스를 결정 (4레인) */
function determineLane4(r: CsvRow): number {
  if (r.actor_exec && r.actor_exec.trim()) return 0;
  if (r.actor_teamlead && r.actor_teamlead.trim()) return 1;
  if (r.actor_hr && r.actor_hr.trim()) return 2;
  if (r.actor_member && r.actor_member.trim()) return 3;
  return 2; // 기본: HR 담당자
}

/** 수행주체 열에서 레인 인덱스를 결정 (6레인) */
function determineLane6(r: CsvRow): number {
  // 임원(0), 현업 팀장(1), HR 임원(2), HR 담당자(3), 현업 구성원(4), 그 외(5)
  if (r.actor_exec && r.actor_exec.trim()) return 0;
  if (r.actor_teamlead && r.actor_teamlead.trim()) return 1;
  if (r.actor_hr && r.actor_hr.trim()) return 3;
  if (r.actor_member && r.actor_member.trim()) return 4;
  return 5; // 기본: 그 외
}

/** SwimLane에 맞춰 L5 노드를 배치하는 빌더 */
export function buildSwimLaneFlowFromL3(
  rows: CsvRow[],
  selectedL3Id: string,
  lanes?: string[],
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const laneCount = lanes?.length ?? 4;
  const SWIM_LANE_H = SWIM_LANE_HEIGHT / laneCount;
  const determineLane = laneCount <= 4 ? determineLane4 : determineLane6;
  const defaultL4Lane = laneCount <= 4 ? 2 : 3; // HR 담당자 레인

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
  // ※ PPT 슬라이드(13.33"×7.5") 콘텐츠 영역에 맞춘 간격
  // PPT 콘텐츠 영역 너비 = 10.83" × 390.9 px/in ≈ 4233 canvas px
  const L4_COL_WIDTH = 560;       // L4 그룹 간 X 간격
  const NODE_X_GAP = 520;         // 같은 레인 내 L5 간 X 간격
  const L4_START_X = 490;         // PPT PAD_X(1.25") × 390.9 ≈ 489
  const LANE_PAD_TOP = 60;        // 레인 상단 여백
  const L4_NODE_HEIGHT = 220;     // L4 노드 실제 렌더 높이 근사값
  const L5_LANE_OFFSET = 80;      // L5의 레인 내 추가 오프셋 (비-L4 레인)

  // 레인별 다음 X 위치 추적
  const laneNextX: number[] = Array(laneCount).fill(L4_START_X);

  const l4Entries = Array.from(l4Map.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], undefined, { numeric: true })
  );

  let l4ColX = L4_START_X;

  for (const [l4Id, l4Info] of l4Entries) {
    // L4 노드 — HR 담당자 레인에 기본 배치
    const l4NodeId = `l4-${l4Id}`;
    const l4Y = defaultL4Lane * SWIM_LANE_H + LANE_PAD_TOP;
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
      // HR 담당자 레인은 L4 아래에 배치, 나머지는 레인 상단 기준
      const laneY = lane === defaultL4Lane
        ? defaultL4Lane * SWIM_LANE_H + LANE_PAD_TOP + L4_NODE_HEIGHT + 40
        : lane * SWIM_LANE_H + LANE_PAD_TOP + L5_LANE_OFFSET;
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
          l4Id: r.L4_ID,
          l4Name: l4Map.get(r.L4_ID)?.name || "",
          l3Id: first.L3_ID,
          l3Name: first.L3_Name,
          l2Id: first.L2_ID,
          l2Name: first["두산 L2"],
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
        type: "ortho",
        animated: false,
        style: { stroke: "#333333", strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#333333" },
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
      type: "ortho",
      animated: false,
      style: { stroke: "#333333", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: "#333333" },
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
  "sys_hr", "sys_groupware", "sys_office", "sys_external", "sys_manual", "sys_etc",
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

/* ═══════════════════════════════════════════════
 * 캔버스 노드 → 원본 PwC 템플릿 44-컬럼 CSV 문자열 생성
 * ═══════════════════════════════════════════════ */

const TEMPLATE_HEADER = [
  "ID", "두산 L2", "ID", "Name", "ID", "Name", "Description",
  "ID", "Name", "Description",
  "수행주체_임원", "수행주체_HR", "수행주체_현업 팀장", "수행주체_현업 구성원",
  "관리주체", "담당자 수", "주 담당자", "평균 건당 소요시간", "발생 빈도_건수",
  "사용 시스템_HR 전용시스템", "사용 시스템_그룹웨어_협업툴", "사용 시스템_오피스_문서도구",
  "사용 시스템_외부_연동시스템", "사용 시스템_수작업_오프라인", "사용 시스템_기타 전문 Tool",
  "Pain Point_시간_속도", "Pain Point_정확성", "Pain Point_반복/수작업",
  "Pain Point_정보_데이터", "Pain Point_시스템_도구", "Pain Point_의사소통_협업", "Pain Point_기타",
  "Input_시스템 데이터", "Input_문서_서류", "Input_외부 정보", "Input_구두_메일 요청", "Input_기타",
  "Output_시스템 반영", "Output_문서_보고서", "Output_커뮤니케이션", "Output_의사결정", "Output_기타",
  "업무 판단 로직_Rule_based", "업무 판단 로직_사람 판단", "업무 판단 로직_혼합",
];

function nd(n: Node): Record<string, unknown> {
  return (n.data || {}) as Record<string, unknown>;
}

/**
 * 캔버스 노드 배열을 원본 PwC 템플릿(44-컬럼) CSV 문자열로 변환.
 * 계층 관계는 (1) 노드에 저장된 명시적 부모 참조(l4Id, l3Id, l2Id)와
 * (2) ID 접두어(예: "1.1.1" → 부모 "1.1")를 함께 활용하여 복원합니다.
 */
export function buildTemplateCsvString(nodes: Node[], csvRows?: CsvRow[]): string {
  /* ── CSV rows lookup (L4_ID → CsvRow) for parent hierarchy fallback ── */
  const csvByL4 = new Map<string, CsvRow>();
  if (csvRows) {
    for (const r of csvRows) {
      if (r.L4_ID && !csvByL4.has(r.L4_ID)) csvByL4.set(r.L4_ID, r);
    }
  }

  /* ── 레벨별 displayId → Node 맵 ── */
  const byLevel: Record<string, Map<string, Node>> = {
    L2: new Map(), L3: new Map(), L4: new Map(), L5: new Map(),
  };
  for (const n of nodes) {
    const d = nd(n);
    const level = ((d.level as string) || "").toUpperCase();
    const displayId = (d.id as string) || "";
    if (level && displayId && byLevel[level]) {
      byLevel[level].set(displayId, n);
    }
  }

  /* ── 부모 노드 탐색 (명시적 참조 → ID 접두어 폴백) ── */
  const findParent = (
    childDisplayId: string,
    parentLevel: string,
    explicitParentId?: string
  ): Node | undefined => {
    const map = byLevel[parentLevel];
    if (!map) return undefined;
    // 1) 명시적 참조
    if (explicitParentId) {
      const found = map.get(explicitParentId);
      if (found) return found;
    }
    // 2) ID 접두어 (마지막 세그먼트 제거)
    const parts = childDisplayId.split(".");
    parts.pop();
    const prefixId = parts.join(".");
    if (prefixId) return map.get(prefixId);
    return undefined;
  };

  /* ── CSV 이스케이프 ── */
  const esc = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  /* ── L5 → 부모 체인을 통한 행 생성 ── */
  const dataRows: string[][] = [];
  const coveredL4 = new Set<string>();
  const coveredL3 = new Set<string>();
  const coveredL2 = new Set<string>();

  const l5Sorted = Array.from(byLevel.L5.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));

  for (const [l5Id, l5Node] of l5Sorted) {
    const d5 = nd(l5Node);

    /* ── L4 parent ── */
    const l4Node = findParent(l5Id, "L4", d5.l4Id as string);
    let l4Id = l4Node ? (nd(l4Node).id as string) || "" : (d5.l4Id as string) || "";
    let l4Label = l4Node ? (nd(l4Node).label as string) || "" : (d5.l4Name as string) || "";
    let l4Desc = l4Node ? (nd(l4Node).description as string) || "" : "";

    /* ── L3 parent ── */
    const l3Node = l4Id ? findParent(l4Id, "L3", (d5.l3Id as string)) : undefined;
    let l3Id = l3Node ? (nd(l3Node).id as string) || "" : (d5.l3Id as string) || "";
    let l3Label = l3Node ? (nd(l3Node).label as string) || "" : (d5.l3Name as string) || "";

    /* ── L2 parent ── */
    const l2Node = l3Id ? findParent(l3Id, "L2", (d5.l2Id as string)) : undefined;
    let l2Id = l2Node ? (nd(l2Node).id as string) || "" : (d5.l2Id as string) || "";
    let l2Label = l2Node ? (nd(l2Node).label as string) || "" : (d5.l2Name as string) || "";

    /* ── CSV fallback (l4Id 기반 부모 계층 복원) ── */
    if (l4Id && (!l3Id || !l2Id)) {
      const csvFallback = csvByL4.get(l4Id);
      if (csvFallback) {
        if (!l3Id) { l3Id = csvFallback.L3_ID; l3Label = l3Label || csvFallback.L3_Name; }
        if (!l2Id) { l2Id = csvFallback.L2_ID; l2Label = l2Label || csvFallback["두산 L2"]; }
        if (!l4Label) { l4Label = csvFallback.L4_Name; }
        if (!l4Desc) l4Desc = csvFallback.L4_Description;
      }
    }

    if (l4Id) coveredL4.add(l4Id);
    if (l3Id) coveredL3.add(l3Id);
    if (l2Id) coveredL2.add(l2Id);

    const actors = d5.actors as Record<string, string> | undefined;
    const systems = d5.systems as Record<string, string> | undefined;
    const pp = d5.painPoints as Record<string, string> | undefined;
    const inp = d5.inputs as Record<string, string> | undefined;
    const out = d5.outputs as Record<string, string> | undefined;
    const logic = d5.logic as Record<string, string> | undefined;

    const d4 = l4Node ? nd(l4Node) : {};
    const d3 = l3Node ? nd(l3Node) : {};
    const d2 = l2Node ? nd(l2Node) : {};

    dataRows.push([
      /* 0-1  L2 */ l2Id, l2Label || (d2.label as string) || "",
      /* 2-3  L3 */ l3Id, l3Label || (d3.label as string) || "",
      /* 4-6  L4 */ l4Id, l4Label || (d4.label as string) || "", l4Desc || (d4.description as string) || "",
      /* 7-9  L5 */ l5Id, (d5.label as string) || "", (d5.description as string) || "",
      /* 10-13 수행주체 */ actors?.exec || "", actors?.hr || "", actors?.teamlead || "", actors?.member || "",
      /* 14    관리주체 */ (d5.mgrBody as string) || "",
      /* 15    담당자수 */ (d5.staffCount as string) || "",
      /* 16    주담당자 */ (d5.mainPerson as string) || "",
      /* 17    소요시간 */ (d5.avgTime as string) || "",
      /* 18    빈도    */ (d5.freqCount as string) || "",
      /* 19-24 시스템  */ systems?.hr || "", systems?.groupware || "", systems?.office || "", systems?.external || "", systems?.manual || "", systems?.etc || "",
      /* 24-30 PP     */ pp?.speed || "", pp?.accuracy || "", pp?.repeat || "", pp?.data || "", pp?.system || "", pp?.comm || "", pp?.etc || "",
      /* 31-35 Input  */ inp?.system || "", inp?.doc || "", inp?.external || "", inp?.request || "", inp?.etc || "",
      /* 36-40 Output */ out?.system || "", out?.doc || "", out?.comm || "", out?.decision || "", out?.etc || "",
      /* 41-43 Logic  */ logic?.rule || "", logic?.human || "", logic?.mixed || "",
    ]);
  }

  /* ── L4 without L5 children ── */
  for (const [l4Id, l4Node] of Array.from(byLevel.L4.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (coveredL4.has(l4Id)) continue;
    const d4 = nd(l4Node);
    const l3Node = findParent(l4Id, "L3", d4.l3Id as string);
    const d3 = l3Node ? nd(l3Node) : {};
    const l3Id = l3Node ? (nd(l3Node).id as string) || "" : "";
    const l2Node = l3Id ? findParent(l3Id, "L2", d3.l2Id as string) : undefined;
    const d2 = l2Node ? nd(l2Node) : {};
    const l2Id = l2Node ? (nd(l2Node).id as string) || "" : "";
    if (l3Id) coveredL3.add(l3Id);
    if (l2Id) coveredL2.add(l2Id);
    const row: string[] = new Array(45).fill("");
    row[0] = l2Id; row[1] = (d2.label as string) || "";
    row[2] = l3Id; row[3] = (d3.label as string) || "";
    row[4] = l4Id; row[5] = (d4.label as string) || ""; row[6] = (d4.description as string) || "";
    dataRows.push(row);
  }

  /* ── L3 without L4 children ── */
  for (const [l3Id, l3Node] of Array.from(byLevel.L3.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (coveredL3.has(l3Id)) continue;
    const d3 = nd(l3Node);
    const l2Node = findParent(l3Id, "L2", d3.l2Id as string);
    const d2 = l2Node ? nd(l2Node) : {};
    const l2Id = l2Node ? (nd(l2Node).id as string) || "" : "";
    if (l2Id) coveredL2.add(l2Id);
    const row: string[] = new Array(45).fill("");
    row[0] = l2Id; row[1] = (d2.label as string) || "";
    row[2] = l3Id; row[3] = (d3.label as string) || "";
    dataRows.push(row);
  }

  /* ── L2 without any children ── */
  for (const [l2Id, l2Node] of Array.from(byLevel.L2.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    if (coveredL2.has(l2Id)) continue;
    const d2 = nd(l2Node);
    const row: string[] = new Array(45).fill("");
    row[0] = l2Id; row[1] = (d2.label as string) || "";
    dataRows.push(row);
  }

  /* ── 행 정렬: L2 → L3 → L4 → L5 ID 순 ── */
  dataRows.sort((a, b) => {
    for (const i of [0, 2, 4, 7]) {
      const va = a[i] || "";
      const vb = b[i] || "";
      if (va !== vb) return va.localeCompare(vb, undefined, { numeric: true });
    }
    return 0;
  });

  /* ── BOM + 헤더 + 행 → CSV 문자열 ── */
  const bom = "\uFEFF";
  const lines = [
    TEMPLATE_HEADER.map(esc).join(","),
    ...dataRows.map((row) => row.map(esc).join(",")),
  ];
  return bom + lines.join("\n");
}

/* ═══════════════════════════════════════════════
 * buildMergedRows: CSV + 캔버스 머지 결과를 행 단위로 반환
 * - unchanged: 원본 CSV 그대로
 * - modified: 캔버스에서 수정된 행 (노란색)
 * - new: 캔버스에서 새로 추가된 L5 노드 (초록색)
 * ═══════════════════════════════════════════════ */
export type RowStatus = "unchanged" | "modified" | "new";
export interface MergedRow { cols: string[]; status: RowStatus; }

export function buildMergedRows(csvRows: CsvRow[], nodes: Node[]): MergedRow[] {
  const nodeByL5Id = new Map<string, Node>();
  const byLevel: Record<string, Map<string, Node>> = {
    L2: new Map(), L3: new Map(), L4: new Map(), L5: new Map(),
  };
  for (const n of nodes) {
    const d = nd(n);
    const level = ((d.level as string) || "").toUpperCase();
    const displayId = (d.id as string) || "";
    const isManual = !!(d.isManual);
    /* isManual 노드는 CSV 행과 매칭하지 않음 — 항상 신규 행으로 처리 */
    if (level === "L5" && displayId && !isManual) nodeByL5Id.set(displayId, n);
    if (level && displayId && byLevel[level]) byLevel[level].set(displayId, n);
  }

  const findParent = (childId: string, parentLevel: string, explicitId?: string): Node | undefined => {
    const map = byLevel[parentLevel];
    if (!map) return undefined;
    if (explicitId) { const f = map.get(explicitId); if (f) return f; }
    const parts = childId.split(".");
    parts.pop();
    const prefix = parts.join(".");
    return prefix ? map.get(prefix) : undefined;
  };

  const colsFromCsvRow = (r: CsvRow): string[] => [
    r.L2_ID, r["두산 L2"], r.L3_ID, r.L3_Name, r.L4_ID, r.L4_Name, r.L4_Description,
    r.L5_ID, r.L5_Name, r.L5_Description,
    r.actor_exec, r.actor_hr, r.actor_teamlead, r.actor_member,
    r.mgr_body, r.staff_count, r.main_person, r.avg_time, r.freq_count,
    r.sys_hr, r.sys_groupware, r.sys_office, r.sys_external, r.sys_manual, r.sys_etc,
    r.pp_speed, r.pp_accuracy, r.pp_repeat, r.pp_data, r.pp_system, r.pp_comm, r.pp_etc,
    r.in_system, r.in_doc, r.in_external, r.in_request, r.in_etc,
    r.out_system, r.out_doc, r.out_comm, r.out_decision, r.out_etc,
    r.logic_rule, r.logic_human, r.logic_mixed,
  ];

  const colsFromNode = (r: CsvRow, n: Node): string[] => {
    const d = nd(n);
    const actors = d.actors as Record<string, string> | undefined;
    const systems = d.systems as Record<string, string> | undefined;
    const pp = d.painPoints as Record<string, string> | undefined;
    const inp = d.inputs as Record<string, string> | undefined;
    const out = d.outputs as Record<string, string> | undefined;
    const logic = d.logic as Record<string, string> | undefined;
    return [
      r.L2_ID, r["두산 L2"], r.L3_ID, r.L3_Name, r.L4_ID, r.L4_Name, r.L4_Description,
      r.L5_ID, (d.label as string) || r.L5_Name, (d.description as string) || r.L5_Description,
      actors?.exec || r.actor_exec, actors?.hr || r.actor_hr,
      actors?.teamlead || r.actor_teamlead, actors?.member || r.actor_member,
      (d.mgrBody as string) || r.mgr_body, (d.staffCount as string) || r.staff_count,
      (d.mainPerson as string) || r.main_person, (d.avgTime as string) || r.avg_time,
      (d.freqCount as string) || r.freq_count,
      systems?.hr || r.sys_hr, systems?.groupware || r.sys_groupware,
      systems?.office || r.sys_office, systems?.external || r.sys_external, systems?.manual || r.sys_manual, systems?.etc || r.sys_etc,
      pp?.speed || r.pp_speed, pp?.accuracy || r.pp_accuracy, pp?.repeat || r.pp_repeat,
      pp?.data || r.pp_data, pp?.system || r.pp_system, pp?.comm || r.pp_comm, pp?.etc || r.pp_etc,
      inp?.system || r.in_system, inp?.doc || r.in_doc, inp?.external || r.in_external,
      inp?.request || r.in_request, inp?.etc || r.in_etc,
      out?.system || r.out_system, out?.doc || r.out_doc, out?.comm || r.out_comm,
      out?.decision || r.out_decision, out?.etc || r.out_etc,
      logic?.rule || r.logic_rule, logic?.human || r.logic_human, logic?.mixed || r.logic_mixed,
    ];
  };

  const results: MergedRow[] = [];
  const matchedL5Ids = new Set<string>();

  for (const r of csvRows) {
    if (!r.L2_ID && !r.L3_ID && !r.L4_ID && !r.L5_ID) continue;
    const node = r.L5_ID ? nodeByL5Id.get(r.L5_ID) : undefined;
    if (!node) {
      results.push({ cols: colsFromCsvRow(r), status: "unchanged" });
    } else {
      matchedL5Ids.add(r.L5_ID);
      const original = colsFromCsvRow(r);
      const merged = colsFromNode(r, node);
      results.push({ cols: merged, status: merged.some((v, i) => v !== original[i]) ? "modified" : "unchanged" });
    }
  }

  /* CSV L4_ID → CsvRow 매핑 (부모 계층 fallback) */
  const csvByL4 = new Map<string, CsvRow>();
  for (const r of csvRows) {
    if (r.L4_ID && !csvByL4.has(r.L4_ID)) csvByL4.set(r.L4_ID, r);
  }

  /* 캔버스에만 있는 새 L5 노드 */
  const l5Sorted = Array.from(byLevel.L5.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
  for (const [l5Id, l5Node] of l5Sorted) {
    if (matchedL5Ids.has(l5Id)) continue;
    const d5 = nd(l5Node);
    const l4Node = findParent(l5Id, "L4", d5.l4Id as string);
    let l4Id = l4Node ? (nd(l4Node).id as string) || "" : (d5.l4Id as string) || "";
    let l4Label = l4Node ? (nd(l4Node).label as string) || "" : (d5.l4Name as string) || "";
    let l4Desc = l4Node ? (nd(l4Node).description as string) || "" : "";
    const l3Node = l4Id ? findParent(l4Id, "L3", d5.l3Id as string) : undefined;
    let l3Id = l3Node ? (nd(l3Node).id as string) || "" : (d5.l3Id as string) || "";
    let l3Label = l3Node ? (nd(l3Node).label as string) || "" : (d5.l3Name as string) || "";
    const l2Node = l3Id ? findParent(l3Id, "L2", d5.l2Id as string) : undefined;
    let l2Id = l2Node ? (nd(l2Node).id as string) || "" : (d5.l2Id as string) || "";
    let l2Label = l2Node ? (nd(l2Node).label as string) || "" : (d5.l2Name as string) || "";

    /* CSV fallback: L4_ID로 CSV 행에서 부모 계층(L2/L3) 복원 */
    if (l4Id && (!l3Id || !l2Id)) {
      const csvFallback = csvByL4.get(l4Id);
      if (csvFallback) {
        if (!l3Id) { l3Id = csvFallback.L3_ID; l3Label = l3Label || csvFallback.L3_Name; }
        if (!l2Id) { l2Id = csvFallback.L2_ID; l2Label = l2Label || csvFallback["두산 L2"]; }
        if (!l4Label) l4Label = csvFallback.L4_Name;
        if (!l4Desc) l4Desc = csvFallback.L4_Description;
      }
    }
    const actors = d5.actors as Record<string, string> | undefined;
    const systems = d5.systems as Record<string, string> | undefined;
    const pp = d5.painPoints as Record<string, string> | undefined;
    const inp = d5.inputs as Record<string, string> | undefined;
    const out = d5.outputs as Record<string, string> | undefined;
    const logic = d5.logic as Record<string, string> | undefined;
    results.push({
      cols: [
        l2Id, l2Label, l3Id, l3Label, l4Id, l4Label, l4Desc,
        l5Id, (d5.label as string) || "", (d5.description as string) || "",
        actors?.exec || "", actors?.hr || "", actors?.teamlead || "", actors?.member || "",
        (d5.mgrBody as string) || "", (d5.staffCount as string) || "",
        (d5.mainPerson as string) || "", (d5.avgTime as string) || "", (d5.freqCount as string) || "",
        systems?.hr || "", systems?.groupware || "", systems?.office || "",
        systems?.external || "", systems?.manual || "", systems?.etc || "",
        pp?.speed || "", pp?.accuracy || "", pp?.repeat || "",
        pp?.data || "", pp?.system || "", pp?.comm || "", pp?.etc || "",
        inp?.system || "", inp?.doc || "", inp?.external || "", inp?.request || "", inp?.etc || "",
        out?.system || "", out?.doc || "", out?.comm || "", out?.decision || "", out?.etc || "",
        logic?.rule || "", logic?.human || "", logic?.mixed || "",
      ],
      status: "new",
    });
  }

  /* ── 전체 행을 L2→L3→L4→L5 ID 기준으로 정렬 ── */
  results.sort((a, b) => {
    // cols 인덱스: 0=L2_ID, 2=L3_ID, 4=L4_ID, 7=L5_ID
    const keyOf = (cols: string[]) =>
      [cols[0] || "", cols[2] || "", cols[4] || "", cols[7] || ""]
        .join("\t");
    return keyOf(a.cols).localeCompare(keyOf(b.cols), undefined, { numeric: true });
  });

  return results;
}

/* ═══════════════════════════════════════════════
 * 원본 CSV 전체 행 기반 + 캔버스 수정 merge → CSV 문자열
 * 캔버스에 없는 L5도 원본 CSV 그대로 포함
 * ═══════════════════════════════════════════════ */
export function buildMergedCsvString(csvRows: CsvRow[], nodes: Node[]): string {
  /* L5_ID → canvas node map (isManual 노드는 제외 — CSV 행과 충돌 방지) */
  const nodeByL5Id = new Map<string, Node>();
  for (const n of nodes) {
    const d = nd(n);
    const level = ((d.level as string) || "").toUpperCase();
    const nodeId = (d.id as string) || "";
    const isManual = !!(d.isManual);
    if (level === "L5" && nodeId && !isManual) nodeByL5Id.set(nodeId, n);
  }

  const esc = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const dataRows: string[][] = [];
  for (const r of csvRows) {
    if (!r.L2_ID && !r.L3_ID && !r.L4_ID && !r.L5_ID) continue;

    const node = r.L5_ID ? nodeByL5Id.get(r.L5_ID) : undefined;
    if (!node) {
      /* 캔버스에 없는 행: 원본 CSV 그대로 */
      dataRows.push([
        r.L2_ID, r["두산 L2"],
        r.L3_ID, r.L3_Name,
        r.L4_ID, r.L4_Name, r.L4_Description,
        r.L5_ID, r.L5_Name, r.L5_Description,
        r.actor_exec, r.actor_hr, r.actor_teamlead, r.actor_member,
        r.mgr_body, r.staff_count, r.main_person, r.avg_time, r.freq_count,
        r.sys_hr, r.sys_groupware, r.sys_office, r.sys_external, r.sys_manual, r.sys_etc,
        r.pp_speed, r.pp_accuracy, r.pp_repeat, r.pp_data, r.pp_system, r.pp_comm, r.pp_etc,
        r.in_system, r.in_doc, r.in_external, r.in_request, r.in_etc,
        r.out_system, r.out_doc, r.out_comm, r.out_decision, r.out_etc,
        r.logic_rule, r.logic_human, r.logic_mixed,
      ]);
    } else {
      /* 캔버스 노드가 있는 행: 캔버스 값 우선, 없으면 원본 CSV 폴백 */
      const d = nd(node);
      const actors = d.actors as Record<string, string> | undefined;
      const systems = d.systems as Record<string, string> | undefined;
      const pp = d.painPoints as Record<string, string> | undefined;
      const inp = d.inputs as Record<string, string> | undefined;
      const out = d.outputs as Record<string, string> | undefined;
      const logic = d.logic as Record<string, string> | undefined;

      dataRows.push([
        r.L2_ID, r["두산 L2"],
        r.L3_ID, r.L3_Name,
        r.L4_ID, r.L4_Name, r.L4_Description,
        r.L5_ID,
        (d.label as string) || r.L5_Name,
        (d.description as string) || r.L5_Description,
        actors?.exec || r.actor_exec, actors?.hr || r.actor_hr,
        actors?.teamlead || r.actor_teamlead, actors?.member || r.actor_member,
        (d.mgrBody as string) || r.mgr_body,
        (d.staffCount as string) || r.staff_count,
        (d.mainPerson as string) || r.main_person,
        (d.avgTime as string) || r.avg_time,
        (d.freqCount as string) || r.freq_count,
        systems?.hr || r.sys_hr, systems?.groupware || r.sys_groupware,
        systems?.office || r.sys_office, systems?.external || r.sys_external, systems?.manual || r.sys_manual, systems?.etc || r.sys_etc,
        pp?.speed || r.pp_speed, pp?.accuracy || r.pp_accuracy, pp?.repeat || r.pp_repeat,
        pp?.data || r.pp_data, pp?.system || r.pp_system, pp?.comm || r.pp_comm, pp?.etc || r.pp_etc,
        inp?.system || r.in_system, inp?.doc || r.in_doc, inp?.external || r.in_external,
        inp?.request || r.in_request, inp?.etc || r.in_etc,
        out?.system || r.out_system, out?.doc || r.out_doc, out?.comm || r.out_comm,
        out?.decision || r.out_decision, out?.etc || r.out_etc,
        logic?.rule || r.logic_rule, logic?.human || r.logic_human, logic?.mixed || r.logic_mixed,
      ]);
    }
  }

  const bom = "\uFEFF";
  const lines = [
    TEMPLATE_HEADER.map(esc).join(","),
    ...dataRows.map((row) => row.map(esc).join(",")),
  ];
  return bom + lines.join("\n");
}
