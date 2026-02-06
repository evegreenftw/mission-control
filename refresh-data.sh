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

# 3. Parse OpenClaw logs for model usage (last 7 days)
echo "🤖 Parsing model usage from logs..."
MODEL_USAGE='{"sessions":[],"byModel":{},"dailyTotals":[]}'
LOG_DIR="/tmp/openclaw"
if [ -d "$LOG_DIR" ]; then
  # Count sessions by looking for "embedded run start" entries with model info
  SESSIONS=$(find "$LOG_DIR" -name "openclaw-*.log" -mtime -7 2>/dev/null | while read logfile; do
    grep -o '"model":"[^"]*"' "$logfile" 2>/dev/null
  done | sort | uniq -c | sort -rn | head -10 | while read count model; do
    model_name=$(echo "$model" | sed 's/"model":"//g' | sed 's/"//g')
    echo "{\"model\":\"$model_name\",\"count\":$count}"
  done | jq -s '.' 2>/dev/null || echo '[]')
  
  # Get session counts per day
  DAILY_COUNTS=$(find "$LOG_DIR" -name "openclaw-*.log" -mtime -7 2>/dev/null | while read logfile; do
    date_str=$(basename "$logfile" | sed 's/openclaw-//g' | sed 's/.log//g')
    count=$(grep -c "embedded run start" "$logfile" 2>/dev/null || echo 0)
    echo "{\"date\":\"$date_str\",\"sessions\":$count}"
  done | jq -s '.' 2>/dev/null || echo '[]')
  
  MODEL_USAGE=$(cat <<EOF
{
  "byModel": $SESSIONS,
  "dailyCounts": $DAILY_COUNTS
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
echo "📦 Building data file..."
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
