PYTHON ?= python3.12
VENV   := server/.venv
PIP    := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn

DATA_DIR ?= $(abspath data)

.PHONY: help install install-server install-client dev server client clean

help:
	@echo "Targets:"
	@echo "  make install        - create venv, install python + node deps"
	@echo "  make dev            - run backend (uvicorn) and frontend (vite) together"
	@echo "  make server         - run backend only"
	@echo "  make client         - run frontend only"
	@echo "  make clean          - remove venv and node_modules"

$(VENV):
	$(PYTHON) -m venv $(VENV)
	$(PIP) install --upgrade pip

install-server: $(VENV)
	$(PIP) install -e server

install-client:
	cd client && npm install

install: install-server install-client

server:
	DATA_DIR=$(DATA_DIR) $(UVICORN) app.main:app --reload --port 8000 --app-dir server

client:
	cd client && npm run dev

dev:
	@command -v npx >/dev/null 2>&1 || { echo "node/npm required for dev target"; exit 1; }
	@( DATA_DIR=$(DATA_DIR) $(UVICORN) app.main:app --reload --port 8000 --app-dir server & echo $$! > /tmp/onnx-editor-server.pid ) && \
	( cd client && npm run dev ) ; \
	kill `cat /tmp/onnx-editor-server.pid` 2>/dev/null ; rm -f /tmp/onnx-editor-server.pid

clean:
	rm -rf $(VENV) client/node_modules client/dist
