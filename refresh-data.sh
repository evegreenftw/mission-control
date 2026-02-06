#!/bin/bash
# Mission Control Data Refresh Script
# Pulls real data from multiple sources and updates mc-data.json

set -e

MC_DIR="$(dirname "$0")"
DATA_FILE="$MC_DIR/mc-data.json"
TEMP_FILE="$MC_DIR/.mc-data-temp.json"

echo "🔄 Refreshing Mission Control data..."

# Get current date/time
REFRESH_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TODAY=$(date +%Y-%m-%d)
SEVEN_DAYS_AGO=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "7 days ago" +%Y-%m-%d)

# 1. Get calendar events for next 14 days
echo "📅 Fetching calendar events..."
CALENDAR_DATA=$(gog calendar events tylerdial1818@gmail.com --from today --to "$(date -v+14d +%Y-%m-%d 2>/dev/null || date -d '14 days' +%Y-%m-%d)" --json 2>/dev/null || echo '{"events":[]}')

# 2. Get git activity from workspace
echo "📊 Fetching git activity..."
GIT_ACTIVITY="[]"
if [ -d "$HOME/.openclaw/workspace/.git" ]; then
  cd "$HOME/.openclaw/workspace"
  GIT_ACTIVITY=$(git log --since="7 days ago" --pretty=format:'{"hash":"%h","message":"%s","author":"%an","date":"%aI"}' 2>/dev/null | head -20 | jq -s '.' 2>/dev/null || echo '[]')
  cd - > /dev/null
fi

# 3. Parse OpenClaw logs for model usage and cost (last 7 days)
echo "🤖 Parsing model usage from logs..."
MODEL_USAGE='{"byModel":[],"dailyCounts":[],"totalCost":0}'
LOG_DIR="/tmp/openclaw"
if [ -d "$LOG_DIR" ]; then
  # Count model usage by grepping for model names
  OPUS_COUNT=$(grep -oh 'claude-opus' "$LOG_DIR"/openclaw-*.log 2>/dev/null | wc -l | tr -d ' ')
  SONNET_COUNT=$(grep -oh 'claude-sonnet' "$LOG_DIR"/openclaw-*.log 2>/dev/null | wc -l | tr -d ' ')
  HAIKU_COUNT=$(grep -oh 'claude-haiku' "$LOG_DIR"/openclaw-*.log 2>/dev/null | wc -l | tr -d ' ')
  MINIMAX_COUNT=$(grep -oh 'minimax' "$LOG_DIR"/openclaw-*.log 2>/dev/null | wc -l | tr -d ' ')
  DEEPSEEK_COUNT=$(grep -oh 'deepseek' "$LOG_DIR"/openclaw-*.log 2>/dev/null | wc -l | tr -d ' ')
  KIMI_COUNT=$(grep -oh 'kimi' "$LOG_DIR"/openclaw-*.log 2>/dev/null | wc -l | tr -d ' ')
  GEMINI_COUNT=$(grep -oh 'gemini' "$LOG_DIR"/openclaw-*.log 2>/dev/null | wc -l | tr -d ' ')
  
  # Estimate tokens per API call (conservative averages based on typical usage)
  # Input/Output split roughly 60/40
  AVG_INPUT_TOKENS=5000
  AVG_OUTPUT_TOKENS=1500
  
  # Calculate costs (price per million tokens)
  # Anthropic: Opus $15/$75, Sonnet $3/$15, Haiku $0.80/$4
  # Minimax M2.1: $0.30/$0.30 (128k context)
  # DeepSeek v3: $0.27/$1.10
  # Kimi K2.5: $0.30/$0.30
  # Gemini Flash 2.5: Free (no cost)
  
  OPUS_COST=$(echo "scale=2; ($OPUS_COUNT * $AVG_INPUT_TOKENS * 15 / 1000000) + ($OPUS_COUNT * $AVG_OUTPUT_TOKENS * 75 / 1000000)" | bc)
  SONNET_COST=$(echo "scale=2; ($SONNET_COUNT * $AVG_INPUT_TOKENS * 3 / 1000000) + ($SONNET_COUNT * $AVG_OUTPUT_TOKENS * 15 / 1000000)" | bc)
  HAIKU_COST=$(echo "scale=2; ($HAIKU_COUNT * $AVG_INPUT_TOKENS * 0.80 / 1000000) + ($HAIKU_COUNT * $AVG_OUTPUT_TOKENS * 4 / 1000000)" | bc)
  MINIMAX_COST=$(echo "scale=2; ($MINIMAX_COUNT * $AVG_INPUT_TOKENS * 0.30 / 1000000) + ($MINIMAX_COUNT * $AVG_OUTPUT_TOKENS * 0.30 / 1000000)" | bc)
  DEEPSEEK_COST=$(echo "scale=2; ($DEEPSEEK_COUNT * $AVG_INPUT_TOKENS * 0.27 / 1000000) + ($DEEPSEEK_COUNT * $AVG_OUTPUT_TOKENS * 1.10 / 1000000)" | bc)
  KIMI_COST=$(echo "scale=2; ($KIMI_COUNT * $AVG_INPUT_TOKENS * 0.30 / 1000000) + ($KIMI_COUNT * $AVG_OUTPUT_TOKENS * 0.30 / 1000000)" | bc)
  GEMINI_COST="0.00"
  
  TOTAL_COST=$(echo "scale=2; $OPUS_COST + $SONNET_COST + $HAIKU_COST + $MINIMAX_COST + $DEEPSEEK_COST + $KIMI_COST" | bc)
  
  BY_MODEL='['
  [ "$OPUS_COUNT" -gt 0 ] && BY_MODEL="${BY_MODEL}{\"model\":\"opus\",\"count\":$OPUS_COUNT,\"cost\":$OPUS_COST},"
  [ "$SONNET_COUNT" -gt 0 ] && BY_MODEL="${BY_MODEL}{\"model\":\"sonnet\",\"count\":$SONNET_COUNT,\"cost\":$SONNET_COST},"
  [ "$HAIKU_COUNT" -gt 0 ] && BY_MODEL="${BY_MODEL}{\"model\":\"haiku\",\"count\":$HAIKU_COUNT,\"cost\":$HAIKU_COST},"
  [ "$MINIMAX_COUNT" -gt 0 ] && BY_MODEL="${BY_MODEL}{\"model\":\"minimax\",\"count\":$MINIMAX_COUNT,\"cost\":$MINIMAX_COST},"
  [ "$DEEPSEEK_COUNT" -gt 0 ] && BY_MODEL="${BY_MODEL}{\"model\":\"deepseek\",\"count\":$DEEPSEEK_COUNT,\"cost\":$DEEPSEEK_COST},"
  [ "$KIMI_COUNT" -gt 0 ] && BY_MODEL="${BY_MODEL}{\"model\":\"kimi\",\"count\":$KIMI_COUNT,\"cost\":$KIMI_COST},"
  [ "$GEMINI_COUNT" -gt 0 ] && BY_MODEL="${BY_MODEL}{\"model\":\"gemini\",\"count\":$GEMINI_COUNT,\"cost\":$GEMINI_COST},"
  BY_MODEL=$(echo "$BY_MODEL" | sed 's/,$//')
  BY_MODEL="${BY_MODEL}]"
  
  # Get daily session counts (approximate - count unique timestamps per day)
  DAILY_COUNTS=$(find "$LOG_DIR" -name "openclaw-*.log" -mtime -7 2>/dev/null | while read logfile; do
    date_str=$(basename "$logfile" | sed 's/openclaw-//g' | sed 's/.log//g')
    # Count lines with "tool" field as proxy for activity
    count=$(grep -c '"tool"' "$logfile" 2>/dev/null || echo "1")
    if [ "$count" -gt 0 ]; then
        sessions=$((count / 10))  # Rough estimate: divide by avg tools per session
        [ $sessions -lt 1 ] && sessions=1
    else
        sessions=1
    fi
    echo "{\"date\":\"$date_str\",\"sessions\":$sessions}"
  done | jq -s '.' 2>/dev/null || echo '[]')
  
  MODEL_USAGE=$(cat <<EOF
{
  "byModel": $BY_MODEL,
  "dailyCounts": $DAILY_COUNTS,
  "totalCost": $TOTAL_COST
}
EOF
)
fi

# 4. Read tasks from tasks.json
echo "📝 Loading tasks..."
TASKS_DATA='{}'
if [ -f "$MC_DIR/tasks.json" ]; then
  TASKS_DATA=$(cat "$MC_DIR/tasks.json")
fi

# 5. Get weather (optional, for dashboard widget)
echo "🌤️ Fetching weather..."
WEATHER_DATA='null'
WEATHER_OUTPUT=$(weather -c 2>/dev/null || echo '')
if [ -n "$WEATHER_OUTPUT" ]; then
  # Parse the condensed weather format
  TEMP=$(echo "$WEATHER_OUTPUT" | grep -oE '[0-9]+°F' | head -1 || echo '')
  CONDITION=$(echo "$WEATHER_OUTPUT" | head -1 | sed 's/[0-9]*°F//g' | tr -d '[:digit:]' | xargs || echo '')
  if [ -n "$TEMP" ]; then
    WEATHER_DATA=$(cat <<EOF
{"temp":"$TEMP","condition":"$CONDITION","raw":"$WEATHER_OUTPUT"}
EOF
)
  fi
fi

# 6. Build the JSON data file
echo "💬 Extracting conversations...
./extract-conversations.sh 2>/dev/null || echo "⚠️ Could not extract conversations"

📦 Building data file..."
cat > "$TEMP_FILE" << EOF
{
  "refreshedAt": "$REFRESH_TIME",
  "today": "$TODAY",
  "calendar": $CALENDAR_DATA,
  "gitActivity": $GIT_ACTIVITY,
  "modelUsage": $MODEL_USAGE,
  "tasks": $TASKS_DATA,
  "weather": $WEATHER_DATA
}
EOF

# Validate JSON and move to final location
if jq . "$TEMP_FILE" > /dev/null 2>&1; then
  mv "$TEMP_FILE" "$DATA_FILE"
  echo "✅ Data refreshed at $REFRESH_TIME"
  echo "📁 Saved to $DATA_FILE"
else
  echo "❌ JSON validation failed, keeping old data"
  rm -f "$TEMP_FILE"
  exit 1
fi
