#!/bin/bash

# Extract recent conversations from OpenClaw session logs
# Outputs to conversations.json

SESSION_DIR="/Users/evegreen/.openclaw/agents/main/sessions"
OUTPUT_FILE="./conversations.json"

# Find the most recent session files (last 7 days)
RECENT_SESSIONS=$(find "$SESSION_DIR" -name "*.jsonl" -type f -mtime -7 2>/dev/null | sort -r | head -10)

if [ -z "$RECENT_SESSIONS" ]; then
    echo '{"conversations": [], "lastUpdated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"}' > "$OUTPUT_FILE"
    exit 0
fi

# Build JSON array of conversations
{
    echo '{'
    echo '  "conversations": ['
    
    FIRST_SESSION=true
    for SESSION_FILE in $RECENT_SESSIONS; do
        SESSION_ID=$(basename "$SESSION_FILE" .jsonl)
        
        # Get first and last message timestamps
        FIRST_TS=$(head -1 "$SESSION_FILE" 2>/dev/null | jq -r '.timestamp // empty')
        LAST_TS=$(tail -1 "$SESSION_FILE" 2>/dev/null | jq -r '.timestamp // empty')
        
        # Count messages (user + assistant only)
        MSG_COUNT=$(grep -c '"role":"user"\|"role":"assistant"' "$SESSION_FILE" 2>/dev/null || echo 0)
        
        if [ "$MSG_COUNT" -gt 0 ] && [ ! -z "$FIRST_TS" ]; then
            if [ "$FIRST_SESSION" = false ]; then
                echo ','
            fi
            FIRST_SESSION=false
            
            # Extract message snippets (jq processes each line separately in JSONL)
            MESSAGES=$(cat "$SESSION_FILE" | jq -c '
                select(.type == "message" and (.message.role == "user" or .message.role == "assistant")) |
                {
                    role: .message.role,
                    timestamp: .timestamp,
                    content: (
                        if .message.content | type == "array" then
                            [.message.content[] | select(.type == "text") | .text] | join(" ")
                        else
                            .message.content
                        end
                    ) | .[0:500]
                }
            ' 2>/dev/null | jq -s '.' 2>/dev/null)
            
            cat <<EOF
    {
      "sessionId": "$SESSION_ID",
      "startTime": "$FIRST_TS",
      "lastTime": "$LAST_TS",
      "messageCount": $MSG_COUNT,
      "messages": $MESSAGES
    }
EOF
        fi
    done
    
    echo ''
    echo '  ],'
    echo '  "lastUpdated": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"'
    echo '}'
} > "$OUTPUT_FILE"

# Validate JSON
if ! jq . "$OUTPUT_FILE" > /dev/null 2>&1; then
    echo "❌ Invalid JSON generated" >&2
    exit 1
fi

CONV_COUNT=$(jq '.conversations | length' "$OUTPUT_FILE")
echo "✅ Extracted $CONV_COUNT conversations to $OUTPUT_FILE"
