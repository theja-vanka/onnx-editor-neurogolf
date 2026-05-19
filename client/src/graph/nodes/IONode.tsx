import { Handle, Position, type NodeProps } from "reactflow";
import type { IONodeData } from "../../store";

export function IONode({ data, selected }: NodeProps<IONodeData>) {
  const isInput = data.io === "input";
  return (
    <div className={`io-node${selected ? " selected" : ""}`}>
      <header>{isInput ? "Input" : "Output"}</header>
      <div className="body">[1, 10, 30, 30] float</div>
      {isInput ? (
        <Handle type="source" position={Position.Right} id="out-0" />
      ) : (
        <Handle type="target" position={Position.Left} id="in-0" />
      )}
    </div>
  );
}
