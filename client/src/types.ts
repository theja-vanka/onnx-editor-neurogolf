export type ArcCell = number;
export type ArcGrid = ArcCell[][];

export interface ArcExample {
  input: ArcGrid;
  output: ArcGrid;
}

export interface ArcTask {
  train: ArcExample[];
  test: ArcExample[];
  "arc-gen"?: ArcExample[];
}

export interface TaskSummary {
  num: number;
  filename: string;
  trainCount: number;
  testCount: number;
  arcGenCount: number;
}

export type AttributeType =
  | "int"
  | "float"
  | "string"
  | "ints"
  | "floats"
  | "strings"
  | "tensor"
  | "graph"
  | "graphs"
  | "tensors"
  | "undefined";

export interface OpAttribute {
  name: string;
  type: AttributeType;
  default: unknown;
  required: boolean;
  description: string;
}

export interface OpFormalParam {
  name: string;
  description: string;
  typeStr: string;
  option: "single" | "optional" | "variadic";
}

export interface OpSchema {
  name: string;
  sinceVersion: number;
  doc: string;
  inputs: OpFormalParam[];
  outputs: OpFormalParam[];
  attributes: OpAttribute[];
}

export type InitializerMode = "literal" | "preset" | "formula" | "upload";

export interface InitializerSpec {
  name: string;
  dtype: string;
  shape: number[];
  mode: InitializerMode;
  values?: number[];
  preset?: "zeros" | "ones" | "identity";
  expr?: string;
  vars?: string[];
  data_b64?: string;
  // Which formal input slot this weight binds to (formal name or index). Set by
  // the .onnx importer so weights keep their original unique names instead of
  // being renamed to the formal input (which collides across nodes). Hand-built
  // initializers omit it and bind by name == formal input name.
  input?: string | number;
}

export interface GraphNodeSpec {
  id: string;
  op: string;
  attrs?: Record<string, unknown>;
  initializers?: InitializerSpec[];
  outputs?: string[];
  position?: { x: number; y: number };
}

export interface GraphEdgeSpec {
  id: string;
  fromNode: string;
  fromPort: number;
  toNode: string;
  toPort: number | string;
}

export interface GraphSpec {
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
  io: { inputName: string; outputName: string };
}

export interface ValidatePerExample {
  set: "train" | "test" | "arc-gen";
  idx: number;
  pass: boolean;
  expected: ArcGrid | null;
  input: ArcGrid | null;
  actual: ArcGrid | null;
  error: string | null;
}

export interface ValidateSummaryCounts {
  pass: number;
  fail: number;
}

export interface ValidateResult {
  ok: boolean;
  error: string | null;
  perExample: ValidatePerExample[];
  summary?: Record<string, ValidateSummaryCounts>;
  memory: number | null;
  params: number | null;
  points: number | null;
  fileSize: number;
}
