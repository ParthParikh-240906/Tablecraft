#!/bin/bash
set -e
npm run build
npm start &
SERVER_PID=$!
sleep 5
curl -sf http://localhost:3000/api/health
kill $SERVER_PID 2>/dev/null || true
