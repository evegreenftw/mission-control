#!/bin/bash

# Extract recent conversations from OpenClaw session logs
# Outputs to conversations.json

SESSION_DIR="/Users/evegreen/.openclaw/agents/main/sessions"
OUTPUT_FILE="./conversations.json"

# Find the most recent session files (last 7 days)
RECENT_SESSIONS=$(find "$SESSION_DIR" -name "*.jsonl" -type f -mtime -7 2>/dev/null | sort -r | head -5)

if [ -z "$RECENT_SESSIONS" ]; then
    echo '{"conversations": [], "lastUpdated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' > "$OUTPUT_FILE"
    exit 0
fi

# Start building JSON
echo '{
  "conversations": [' > "$OUTPUT_FILE"

FIRST=true
for SESSION_FILE in $RECENT_SESSIONS; do
    # Get file timestamp
    TIMESTAMP=$(stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%SZ" "$SESSION_FILE" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ")
    
    # Extract messages from JSONL (basic parsing)
    MESSAGES=$(tail -20 "$SESSION_FILE" 2>/dev/null | grep -v "^$" | jq -c 'select(.role == "user" or .role == "assistant") | {role, content: .content[:300]}' 2>/dev/null | head -10)
    
    if [ ! -z "$MESSAGES" ]; then
        if [ "$FIRST" = false ]; then
            echo ',' >> "$OUTPUT_FILE"
        fi
        FIRST=false
        
        echo '    {
      "timestamp": "'$TIMESTAMP'",
      "channel": "telegram",
      "messages": [' >> "$OUTPUT_FILE"
        
        MSG_FIRST=true
        while IFS= read -r MSG; do
            if [ "$MSG_FIRST" = false ]; then
                echo ',' >> "$OUTPUT_FILE"
            fi
            MSG_FIRST=false
            echo "        $MSG" >> "$OUTPUT_FILE"
        done <<< "$MESSAGES"
        
        echo '
      ]
    }' >> "$OUTPUT_FILE"
    fi
done

echo '
  ],
  "lastUpdated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
}' >> "$OUTPUT_FILE"

echo "✅ Extracted conversations to $OUTPUT_FILE"
