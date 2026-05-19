import { useMemo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import type { OpNodeData } from "../../store";
import { getOpSchemaCache } from "../../store";

export function OpNode({ data, selected }: NodeProps<OpNodeData>) {
  const schemas = getOpSchemaCache();
  const schema = useMemo(() => schemas.find((s) => s.name === data.op), [schemas, data.op]);
  const inputs = schema?.inputs ?? [];
  const outputs = schema?.outputs ?? [{ name: "Y", description: "", typeStr: "T", option: "single" as const }];

  return (
    <div className={`op-node${selected ? " selected" : ""}`}>
      <header>{data.op}</header>
      <div className="ports">
        <div className="col left">
          {inputs.length === 0 && <div className="port-row">(no inputs)</div>}
          {inputs.map((p, i) => (
            <div key={p.name + i} className="port-row" title={p.description}>
              <Handle
                type="target"
                position={Position.Left}
                id={`in-${p.name}`}
                style={{ top: 30 + i * 16 }}
              />
              <span>{p.name}{p.option === "optional" ? "?" : ""}</span>
            </div>
          ))}
        </div>
        <div className="col right">
          {outputs.map((p, i) => (
            <div key={p.name + i} className="port-row" title={p.description}>
              <span>{p.name}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`out-${i}`}
                style={{ top: 30 + i * 16 }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
