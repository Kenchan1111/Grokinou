#!/bin/bash

# Test script for auto-stats and auto-naming

echo "🧪 Testing Auto-Stats & Auto-Naming"
echo "===================================="
echo ""
echo "📝 How to test:"
echo "  1. Run 'grok' in a NEW directory (to create fresh session)"
echo "  2. Send a first message (this will auto-name the session)"
echo "  3. Send a few more messages"
echo "  4. Run '/list_sessions' to see updated stats"
echo ""
echo "✅ What to verify:"
echo "  - Session name is auto-generated from first message"
echo "  - message_count increases with each message"
echo "  - total_tokens is calculated (if available)"
echo "  - first_message_preview shows your first message"
echo "  - last_message_preview shows your last message"
echo ""
echo "📊 Direct DB check:"
echo "  sqlite3 ~/.grok/conversations.db \"SELECT id, session_name, message_count, total_tokens, first_message_preview FROM sessions;\""
echo ""
echo "Press Enter to run DB check now..."
read

sqlite3 ~/.grok/conversations.db "SELECT 
  id as 'ID', 
  session_name as 'Name', 
  message_count as 'Msgs', 
  total_tokens as 'Tokens',
  substr(first_message_preview, 1, 40) || '...' as 'First Msg'
FROM sessions 
ORDER BY last_activity DESC 
LIMIT 5;"
