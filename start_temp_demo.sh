#!/bin/sh
# Serves the demo site plus the /api/chat endpoint (reads BRINE_* from env or .env).
exec python3 "$(dirname "$0")/temp_demo/server.py" "${1:-8767}"
