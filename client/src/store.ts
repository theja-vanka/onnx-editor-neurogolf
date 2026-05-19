import { create } from "zustand";
import type {
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  Connection,
} from "reactflow";
import { addEdge, applyEdgeChanges, applyNodeChanges } from "reactflow";
import type { GraphEdgeSpec, GraphNodeSpec, GraphSpec, InitializerSpec, OpSchema } from "./types";

export interface OpNodeData {
  kind: "op";
  op: string;
  attrs: Record<string, unknown>;
  initializers: InitializerSpec[];
}

export interface IONodeData {
  kind: "io";
  io: "input" | "output";
}

export type EditorNodeData = OpNodeData | IONodeData;

type AnyNode = Node<EditorNodeData>;
type AnyEdge = Edge;

const STORAGE_PREFIX = "onnx-editor:graph:";

function defaultIO(): AnyNode[] {
  return [
    {
      id: "input",
      type: "io",
      position: { x: 100, y: 200 },
      data: { kind: "io", io: "input" },
      deletable: false,
    },
    {
      id: "output",
      type: "io",
      position: { x: 700, y: 200 },
      data: { kind: "io", io: "output" },
      deletable: false,
    },
  ];
}

export interface EditorStore {
  currentTask: number;
  setCurrentTask: (n: number) => void;

  nodes: AnyNode[];
  edges: AnyEdge[];
  selectedNodeId: string | null;

  setNodes: (nodes: AnyNode[]) => void;
  setEdges: (edges: AnyEdge[]) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  select: (id: string | null) => void;
  addOpNode: (op: string, position: { x: number; y: number }) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  updateNodeData: (id: string, patch: Partial<OpNodeData>) => void;

  loadForTask: (n: number, ops: OpSchema[]) => void;
  resetGraph: () => void;

  toSpec: () => GraphSpec;
  fromSpec: (spec: GraphSpec) => void;

  edgeShapes: Record<string, (number | string)[]>;
  setEdgeShapes: (m: Record<string, (number | string)[]>) => void;

  theme: "light" | "dark";
  toggleTheme: () => void;
}

function storageKey(n: number): string {
  return `${STORAGE_PREFIX}${n}`;
}

function persist(n: number, nodes: AnyNode[], edges: AnyEdge[]) {
  try {
    localStorage.setItem(storageKey(n), JSON.stringify({ nodes, edges }));
  } catch {
    // quota or disabled — ignore
  }
}

function restore(n: number): { nodes: AnyNode[]; edges: AnyEdge[] } | null {
  try {
    const raw = localStorage.getItem(storageKey(n));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) return parsed;
  } catch {
    // ignore
  }
  return null;
}

let opSchemaCache: OpSchema[] = [];

export const useEditor = create<EditorStore>((set, get) => ({
  currentTask: 0,
  setCurrentTask: (n) => {
    const restored = restore(n);
    if (restored) {
      set({ currentTask: n, nodes: restored.nodes, edges: restored.edges, selectedNodeId: null, edgeShapes: {} });
    } else {
      set({ currentTask: n, nodes: defaultIO(), edges: [], selectedNodeId: null, edgeShapes: {} });
    }
  },

  nodes: defaultIO(),
  edges: [],
  selectedNodeId: null,

  setNodes: (nodes) => {
    set({ nodes });
    persist(get().currentTask, nodes, get().edges);
  },
  setEdges: (edges) => {
    set({ edges });
    persist(get().currentTask, get().nodes, edges);
  },
  onNodesChange: (changes) => {
    const next = applyNodeChanges(changes, get().nodes) as AnyNode[];
    set({ nodes: next });
    persist(get().currentTask, next, get().edges);
  },
  onEdgesChange: (changes) => {
    const next = applyEdgeChanges(changes, get().edges);
    set({ edges: next });
    persist(get().currentTask, get().nodes, next);
  },
  onConnect: (c) => {
    const id = `e_${Math.random().toString(36).slice(2, 10)}`;
    const next = addEdge({ ...c, id, animated: false }, get().edges);
    set({ edges: next });
    persist(get().currentTask, get().nodes, next);
  },
  select: (id) => set({ selectedNodeId: id }),

  addOpNode: (op, position) => {
    const id = `n_${Math.random().toString(36).slice(2, 8)}`;
    const node: AnyNode = {
      id,
      type: "op",
      position,
      data: { kind: "op", op, attrs: {}, initializers: [] },
    };
    const next = [...get().nodes, node];
    set({ nodes: next, selectedNodeId: id });
    persist(get().currentTask, next, get().edges);
  },

  duplicateSelected: () => {
    const sel = get().selectedNodeId;
    if (!sel) return;
    const src = get().nodes.find((n) => n.id === sel);
    if (!src || src.data.kind !== "op") return;
    const id = `n_${Math.random().toString(36).slice(2, 8)}`;
    const node: AnyNode = {
      ...src,
      id,
      position: { x: src.position.x + 40, y: src.position.y + 40 },
      data: { ...src.data, initializers: src.data.initializers.map((i) => ({ ...i })), attrs: { ...src.data.attrs } },
      selected: false,
    };
    const next = [...get().nodes, node];
    set({ nodes: next, selectedNodeId: id });
    persist(get().currentTask, next, get().edges);
  },

  deleteSelected: () => {
    const sel = get().selectedNodeId;
    if (!sel || sel === "input" || sel === "output") return;
    const nodes = get().nodes.filter((n) => n.id !== sel);
    const edges = get().edges.filter((e) => e.source !== sel && e.target !== sel);
    set({ nodes, edges, selectedNodeId: null });
    persist(get().currentTask, nodes, edges);
  },

  updateNodeData: (id, patch) => {
    const next = get().nodes.map((n) => {
      if (n.id !== id || n.data.kind !== "op") return n;
      return { ...n, data: { ...n.data, ...patch } };
    });
    set({ nodes: next });
    persist(get().currentTask, next, get().edges);
  },

  loadForTask: (n, ops) => {
    opSchemaCache = ops;
    get().setCurrentTask(n);
  },

  resetGraph: () => {
    const n = get().currentTask;
    const nodes = defaultIO();
    set({ nodes, edges: [], selectedNodeId: null, edgeShapes: {} });
    persist(n, nodes, []);
  },

  toSpec: () => {
    const nodes = get().nodes;
    const edges = get().edges;
    const specNodes: GraphNodeSpec[] = nodes
      .filter((n) => n.id !== "input" && n.id !== "output")
      .map((n) => {
        const d = n.data as OpNodeData;
        return {
          id: n.id,
          op: d.op,
          attrs: d.attrs,
          initializers: d.initializers,
          position: n.position,
        };
      });
    const specEdges: GraphEdgeSpec[] = edges.map((e, i) => {
      const fromPort = e.sourceHandle ? portToIndex(e.sourceHandle, "out") : 0;
      const toPort: number | string = e.targetHandle
        ? lookupTargetPort(e.targetHandle, e.target, nodes)
        : 0;
      return {
        id: e.id ?? `e${i}`,
        fromNode: e.source,
        fromPort,
        toNode: e.target,
        toPort,
      };
    });
    return {
      nodes: specNodes,
      edges: specEdges,
      io: { inputName: "input", outputName: "output" },
    };
  },

  fromSpec: (spec) => {
    const nodes: AnyNode[] = defaultIO();
    for (const n of spec.nodes) {
      nodes.push({
        id: n.id,
        type: "op",
        position: n.position ?? { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 },
        data: { kind: "op", op: n.op, attrs: n.attrs ?? {}, initializers: n.initializers ?? [] },
      });
    }
    const edges: AnyEdge[] = spec.edges.map((e) => ({
      id: e.id,
      source: e.fromNode,
      sourceHandle: `out-${e.fromPort}`,
      target: e.toNode,
      targetHandle: typeof e.toPort === "string" ? `in-${e.toPort}` : `in-${e.toPort}`,
    }));
    set({ nodes, edges, selectedNodeId: null, edgeShapes: {} });
    persist(get().currentTask, nodes, edges);
  },

  edgeShapes: {},
  setEdgeShapes: (m) => set({ edgeShapes: m }),

  theme: (typeof window !== "undefined" && localStorage.getItem("onnx-editor:theme") === "light"
    ? "light"
    : "dark") as "light" | "dark",
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    set({ theme: next });
    try {
      localStorage.setItem("onnx-editor:theme", next);
    } catch {
      // ignore
    }
  },
}));

function portToIndex(handle: string, _dir: "in" | "out"): number {
  const m = handle.match(/-(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function lookupTargetPort(handle: string, _target: string, _nodes: AnyNode[]): number | string {
  // handle format: in-<name-or-index>
  const m = handle.match(/^in-(.+)$/);
  if (!m) return 0;
  const v = m[1];
  const asNum = Number(v);
  return Number.isFinite(asNum) && /^\d+$/.test(v) ? asNum : v;
}

export function getOpSchemaCache(): OpSchema[] {
  return opSchemaCache;
}
