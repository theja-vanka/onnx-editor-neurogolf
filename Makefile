PYTHON ?= python3.12
VENV   := server/.venv
PIP    := $(VENV)/bin/pip
UVICORN := $(VENV)/bin/uvicorn

DATA_DIR ?= $(abspath data)

.PHONY: help install install-server install-client dev start server client clean

SHELL := /bin/bash

help:
	@echo "Targets:"
	@echo "  make install        - create venv, install python + node deps"
	@echo "  make dev            - run backend (uvicorn) and frontend (vite) together"
	@echo "  make start          - alias for 'make dev'"
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

dev start:
	@command -v npm >/dev/null 2>&1 || { echo "node/npm required for dev target"; exit 1; }
	@test -x $(UVICORN) || { echo "uvicorn not found at $(UVICORN). Run 'make install' first."; exit 1; }
	@echo "→ backend  http://localhost:8000"
	@echo "→ frontend http://localhost:5173"
	@trap 'kill 0' INT TERM EXIT; \
	  DATA_DIR=$(DATA_DIR) $(UVICORN) app.main:app --reload --port 8000 --app-dir server & \
	  ( cd client && npm run dev ) & \
	  wait

clean:
	rm -rf $(VENV) client/node_modules client/dist
