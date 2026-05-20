"""Compile the editor's JSON graph spec into an onnx.ModelProto.

Graph spec wire format:

    {
        "nodes": [
            {
                "id": "n1",
                "op": "Conv",
                "attrs": {"kernel_shape": [3,3], "pads": [1,1,1,1]},
                "initializers": [ { ...InitializerSpec... } ],
                "outputs": ["n1_out"]              # optional override
            },
            ...
        ],
        "edges": [
            {"id":"e1", "fromNode":"input", "fromPort":0,
             "toNode":"n1", "toPort":"X" | 1}
        ],
        "io": {"inputName": "input", "outputName": "output"}
    }

Special nodes:
    - id == "input"  -> graph input ValueInfo (1,10,30,30 float)
    - id == "output" -> graph output ValueInfo (1,10,30,30 float)

The `toPort` field is either an integer index into the op's formal inputs, or the
formal input name.
"""
from __future__ import annotations

from typing import Any

import onnx

from .config import EXCLUDED_OP_TYPES, GRID_SHAPE, IR_VERSION, OPSET_VERSION
from .initializers import build_initializer
from .ops import ops_by_name


_DTYPE_FLOAT = onnx.TensorProto.FLOAT


class BuildError(ValueError):
    pass


def _attr_to_proto(op_name: str, attr_name: str, value: Any, attrs_schema: dict[str, Any]) -> onnx.AttributeProto:
    sch = attrs_schema.get(attr_name)
    if sch is None:
        raise BuildError(f"{op_name}: unknown attribute {attr_name!r}")
    t = sch["type"]
    try:
        if t == "int":
            return onnx.helper.make_attribute(attr_name, int(value))
        if t == "float":
            return onnx.helper.make_attribute(attr_name, float(value))
        if t == "string":
            return onnx.helper.make_attribute(attr_name, str(value))
        if t == "ints":
            return onnx.helper.make_attribute(attr_name, [int(x) for x in value])
        if t == "floats":
            return onnx.helper.make_attribute(attr_name, [float(x) for x in value])
        if t == "strings":
            return onnx.helper.make_attribute(attr_name, [str(x) for x in value])
        if t == "tensor":
            if not isinstance(value, dict):
                raise BuildError(f"{op_name}.{attr_name}: tensor attr must be initializer spec")
            tp = build_initializer({**value, "name": value.get("name", f"{op_name}_{attr_name}")})
            return onnx.helper.make_attribute(attr_name, tp)
    except BuildError:
        raise
    except Exception as e:
        raise BuildError(f"{op_name}.{attr_name}: bad value {value!r}: {e}") from e
    raise BuildError(f"{op_name}.{attr_name}: unsupported attribute type {t}")


def _init_slot(init_spec: dict[str, Any], formal_inputs: list[dict[str, Any]]) -> int | None:
    """Which formal input index an initializer binds to.

    Prefers an explicit ``input`` field (formal name or index — set by the .onnx
    importer so weights can keep their original unique names). Falls back to
    matching the initializer's own name against a formal input name, which is how
    hand-built and exported graphs attach weights.
    """
    inp = init_spec.get("input")
    if inp is None:
        name = init_spec.get("name")
        for i, fp in enumerate(formal_inputs):
            if fp["name"] == name:
                return i
        return None
    if isinstance(inp, bool):  # bool is an int subclass; never a valid slot
        return None
    if isinstance(inp, int):
        return inp
    for i, fp in enumerate(formal_inputs):
        if fp["name"] == inp:
            return i
    return None


def _resolve_port(op_name: str, formal_inputs: list[dict[str, Any]], port: Any) -> int:
    if isinstance(port, int):
        if port < 0 or port >= max(len(formal_inputs), port + 1):
            return port
        return port
    if isinstance(port, str):
        for i, fp in enumerate(formal_inputs):
            if fp["name"] == port:
                return i
    raise BuildError(f"{op_name}: cannot resolve input port {port!r}")


def build_model(spec: dict[str, Any]) -> onnx.ModelProto:
    nodes_spec = spec.get("nodes", [])
    edges_spec = spec.get("edges", [])
    io_spec = spec.get("io", {})

    input_name = io_spec.get("inputName", "input")
    output_name = io_spec.get("outputName", "output")

    schemas = ops_by_name()

    nodes_by_id: dict[str, dict[str, Any]] = {}
    for n in nodes_spec:
        nid = n.get("id")
        if not nid:
            raise BuildError("node missing 'id'")
        if nid in nodes_by_id:
            raise BuildError(f"duplicate node id {nid!r}")
        nodes_by_id[nid] = n

    if "input" not in nodes_by_id:
        nodes_by_id["input"] = {"id": "input", "op": "__input__", "outputs": [input_name]}
    if "output" not in nodes_by_id:
        nodes_by_id["output"] = {"id": "output", "op": "__output__"}

    # Pre-compute each node's output tensor names.
    node_outputs: dict[str, list[str]] = {}
    for nid, n in nodes_by_id.items():
        if nid == "input":
            node_outputs[nid] = [input_name]
            continue
        if nid == "output":
            node_outputs[nid] = []
            continue
        op = n["op"]
        if op.upper() in EXCLUDED_OP_TYPES:
            raise BuildError(f"op {op!r} is banned")
        sch = schemas.get(op)
        if sch is None:
            raise BuildError(f"unknown op {op!r}")
        explicit = n.get("outputs")
        if explicit:
            outs = list(explicit)
        else:
            num = max(1, len(sch["outputs"]))
            outs = [f"{nid}__out{i}" for i in range(num)]
        node_outputs[nid] = outs

    # Build edge map: (toNode -> dict[port_idx -> tensor_name])
    incoming: dict[str, dict[int, str]] = {nid: {} for nid in nodes_by_id}
    output_source: tuple[str, int] | None = None
    for e in edges_spec:
        src = e["fromNode"]
        src_port = int(e.get("fromPort", 0))
        dst = e["toNode"]
        if src not in node_outputs:
            raise BuildError(f"edge source {src!r} not found")
        if dst not in nodes_by_id:
            raise BuildError(f"edge target {dst!r} not found")
        outs = node_outputs[src]
        if src_port < 0 or src_port >= len(outs):
            raise BuildError(f"edge {src}:{src_port}: source has {len(outs)} outputs")
        if dst == "output":
            output_source = (src, src_port)
            continue
        sch = schemas[nodes_by_id[dst]["op"]]
        port_idx = _resolve_port(dst, sch["inputs"], e.get("toPort", 0))
        incoming[dst][port_idx] = outs[src_port]

    if output_source is None:
        raise BuildError("graph has no edge feeding the Output node")

    # Build the node list in spec order (skip special I/O nodes).
    onnx_nodes: list[onnx.NodeProto] = []
    initializers: list[onnx.TensorProto] = []
    init_names: set[str] = set()
    init_blobs: dict[str, bytes] = {}  # name -> serialized tensor, to detect real clashes

    for n in nodes_spec:
        nid = n["id"]
        if nid in ("input", "output"):
            continue
        op = n["op"]
        sch = schemas[op]
        attrs_schema = {a["name"]: a for a in sch["attributes"]}
        formal_inputs = sch["inputs"]

        # Materialize this node's initializers and remember which input slot each
        # binds to. Names are global tensor names; identical tensors reused under
        # the same name (a shared weight) are added once, but a name reused for
        # *different* data is a genuine clash.
        node_init_by_slot: dict[int, str] = {}
        for init_spec in n.get("initializers", []) or []:
            tp = build_initializer(init_spec)
            blob = tp.SerializeToString()
            if tp.name in init_names:
                if init_blobs.get(tp.name) != blob:
                    raise BuildError(f"duplicate initializer name {tp.name!r} with differing data")
            else:
                initializers.append(tp)
                init_names.add(tp.name)
                init_blobs[tp.name] = blob
            slot = _init_slot(init_spec, formal_inputs)
            if slot is not None:
                node_init_by_slot[slot] = tp.name

        # Resolve inputs: edges first, then initializers bound to a slot.
        edge_inputs = incoming[nid]
        inputs_resolved: list[str] = []
        max_idx = len(formal_inputs) - 1
        if edge_inputs:
            max_idx = max(max_idx, max(edge_inputs))
        if node_init_by_slot:
            max_idx = max(max_idx, max(node_init_by_slot))
        for i in range(max_idx + 1):
            if i in edge_inputs:
                inputs_resolved.append(edge_inputs[i])
            elif i in node_init_by_slot:
                inputs_resolved.append(node_init_by_slot[i])
            elif i < len(formal_inputs):
                fp_name = formal_inputs[i]["name"]
                option = formal_inputs[i].get("option", "single")
                if option == "optional":
                    inputs_resolved.append("")
                else:
                    raise BuildError(
                        f"node {nid} ({op}): required input #{i} ({fp_name!r}) is not connected"
                    )
            else:
                inputs_resolved.append("")

        # Strip trailing empty optional inputs for cleanliness.
        while inputs_resolved and inputs_resolved[-1] == "":
            inputs_resolved.pop()

        outputs = node_outputs[nid]
        attrs_protos: list[onnx.AttributeProto] = []
        for k, v in (n.get("attrs") or {}).items():
            attrs_protos.append(_attr_to_proto(op, k, v, attrs_schema))

        node_proto = onnx.helper.make_node(
            op,
            inputs=inputs_resolved,
            outputs=outputs,
            name=nid,
        )
        node_proto.attribute.extend(attrs_protos)
        onnx_nodes.append(node_proto)

    # The graph's Output tensor name must equal `output_name`. If the last edge's
    # source uses a different tensor name, rename that node's output port.
    src_id, src_port = output_source
    src_outputs = node_outputs[src_id]
    src_tensor = src_outputs[src_port]
    if src_tensor != output_name:
        for np_ in onnx_nodes:
            if np_.name == src_id:
                np_.output[src_port] = output_name
                break

    x = onnx.helper.make_tensor_value_info(input_name, _DTYPE_FLOAT, GRID_SHAPE)
    y = onnx.helper.make_tensor_value_info(output_name, _DTYPE_FLOAT, GRID_SHAPE)
    graph = onnx.helper.make_graph(
        onnx_nodes,
        "neurogolf_graph",
        inputs=[x],
        outputs=[y],
        initializer=initializers,
    )
    model = onnx.helper.make_model(
        graph,
        ir_version=IR_VERSION,
        opset_imports=[onnx.helper.make_opsetid("", OPSET_VERSION)],
    )
    return model
