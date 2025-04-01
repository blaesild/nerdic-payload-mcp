#!/bin/bash
# Simple test for SSE endpoint

echo "Testing SSE connection to http://localhost:8090/sse"
curl -N -H "Accept: text/event-stream" http://localhost:8090/sse 