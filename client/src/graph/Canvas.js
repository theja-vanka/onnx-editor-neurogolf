import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, useReactFlow, EdgeLabelRenderer, BaseEdge, getBezierPath, } from "reactflow";
import "reactflow/dist/style.css";
import { api } from "../api";
import { useEditor } from "../store";
import { IONode } from "./nodes/IONode";
import { OpNode } from "./nodes/OpNode";
import { useKeyboardShortcuts } from "./shortcuts";
import { ValidateDock } from "../validation/ValidatePanel";
const nodeTypes = { op: OpNode, io: IONode };
function ShapeEdge(props) {
    const edgeShapes = useEditor((s) => s.edgeShapes);
    const dims = edgeShapes[props.id];
    const [path, labelX, labelY] = getBezierPath({
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        sourcePosition: props.sourcePosition,
        targetX: props.targetX,
        targetY: props.targetY,
        targetPosition: props.targetPosition,
    });
    return (_jsxs(_Fragment, { children: [_jsx(BaseEdge, { path: path, markerEnd: props.markerEnd, style: props.style }), dims && dims.length > 0 && (_jsx(EdgeLabelRenderer, { children: _jsxs("div", { className: "edge-shape", style: {
                        position: "absolute",
                        transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
                    }, children: ["[", dims.map((d) => (d === "?" ? "?" : d)).join(","), "]"] }) }))] }));
}
const edgeTypes = { default: ShapeEdge };
export function Canvas({ ops }) {
    return (_jsx(ReactFlowProvider, { children: _jsx(Inner, { ops: ops }) }));
}
function Inner({ ops }) {
    const wrapperRef = useRef(null);
    const nodes = useEditor((s) => s.nodes);
    const edges = useEditor((s) => s.edges);
    const onNodesChange = useEditor((s) => s.onNodesChange);
    const onEdgesChange = useEditor((s) => s.onEdgesChange);
    const onConnect = useEditor((s) => s.onConnect);
    const addOpNode = useEditor((s) => s.addOpNode);
    const select = useEditor((s) => s.select);
    const setEdgeShapes = useEditor((s) => s.setEdgeShapes);
    const { screenToFlowPosition } = useReactFlow();
    useKeyboardShortcuts();
    const opNames = useMemo(() => new Set(ops.map((o) => o.name)), [ops]);
    const onDrop = useCallback((event) => {
        event.preventDefault();
        const op = event.dataTransfer.getData("application/onnx-op");
        if (!op || !opNames.has(op))
            return;
        const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        addOpNode(op, position);
    }, [opNames, addOpNode, screenToFlowPosition]);
    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
    }, []);
    // Debounced shape inference whenever nodes/edges change.
    useEffect(() => {
        const handle = window.setTimeout(() => {
            const spec = useEditor.getState().toSpec();
            if (spec.nodes.length === 0 && spec.edges.length === 0) {
                setEdgeShapes({});
                return;
            }
            api
                .inferShapes(spec)
                .then((r) => {
                if (r.ok)
                    setEdgeShapes(r.edges);
                else
                    setEdgeShapes({});
            })
                .catch(() => setEdgeShapes({}));
        }, 400);
        return () => window.clearTimeout(handle);
    }, [nodes, edges, setEdgeShapes]);
    return (_jsxs("div", { ref: wrapperRef, style: { width: "100%", height: "100%" }, children: [_jsxs(ReactFlow, { nodes: nodes, edges: edges, onNodesChange: onNodesChange, onEdgesChange: onEdgesChange, onConnect: onConnect, nodeTypes: nodeTypes, edgeTypes: edgeTypes, onDrop: onDrop, onDragOver: onDragOver, onSelectionChange: ({ nodes }) => select(nodes[0]?.id ?? null), fitView: true, proOptions: { hideAttribution: true }, children: [_jsx(Background, { gap: 20 }), _jsx(Controls, { position: "bottom-left" }), _jsx(MiniMap, { pannable: true, zoomable: true })] }), _jsx(ValidateDock, {})] }));
}
