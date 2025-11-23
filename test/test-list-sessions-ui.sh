#!/bin/bash

# Test script for /list_sessions command in UI

echo "🧪 Testing /list_sessions command"
echo "=================================="
echo ""
echo "This will:"
echo "  1. Start grok in current directory"
echo "  2. Type '/list_sessions' and press Enter"
echo "  3. Display all sessions with rich metadata"
echo ""
echo "Press Ctrl+C to exit after testing"
echo ""
echo "Starting in 3 seconds..."
sleep 3

# Create a test input file with the command
echo "/list_sessions" > /tmp/grok-test-input.txt

# Start grok with the test command
cat /tmp/grok-test-input.txt | timeout 5 grok || echo ""
echo ""
echo "✅ Test completed"
