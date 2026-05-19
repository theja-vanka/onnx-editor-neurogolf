"""Runtime configuration: data dir, fixed I/O shape, banned ops, etc."""
from __future__ import annotations

import os
import pathlib

BATCH_SIZE, CHANNELS, HEIGHT, WIDTH = 1, 10, 30, 30
GRID_SHAPE = [BATCH_SIZE, CHANNELS, HEIGHT, WIDTH]
IR_VERSION = 10
OPSET_VERSION = 10
EXCLUDED_OP_TYPES = {"LOOP", "SCAN", "NONZERO", "UNIQUE", "SCRIPT", "FUNCTION", "COMPRESS"}
FILESIZE_LIMIT_IN_BYTES = int(1.44 * 1024 * 1024)

COLORS = [
    (0, 0, 0),
    (30, 147, 255),
    (250, 61, 49),
    (78, 204, 48),
    (255, 221, 0),
    (153, 153, 153),
    (229, 59, 163),
    (255, 133, 28),
    (136, 216, 241),
    (147, 17, 49),
    (240, 240, 240),
    (146, 117, 86),
]

_default_data_dir = pathlib.Path(__file__).resolve().parents[2] / "data"
DATA_DIR = pathlib.Path(os.environ.get("DATA_DIR", _default_data_dir))

_default_work_dir = pathlib.Path(__file__).resolve().parents[1] / ".workdir"
WORK_DIR = pathlib.Path(os.environ.get("WORK_DIR", _default_work_dir))
WORK_DIR.mkdir(parents=True, exist_ok=True)
