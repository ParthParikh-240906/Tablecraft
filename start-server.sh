#!/bin/bash
npm run dev > /tmp/next-dev.log 2>&1 &
sleep 5
echo "Server started, testing..."
curl -s http://localhost:3000/console/menu | head -3
