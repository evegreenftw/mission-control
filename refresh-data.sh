#!/bin/bash
# Mission Control Data Refresh Script
# Pulls real data from multiple sources and updates mc-data.json

# Don't exit on error - we want to handle failures gracefully
set +e

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
CALENDAR_OUTPUT=$(python3 ~/.openclaw/sandboxes/agent-main-0d71ad7a/google-calendar-integration/calendar_api.py upcoming --days 14 --json 2>&1)
if echo "$CALENDAR_OUTPUT" | jq . > /dev/null 2>&1; then
  CALENDAR_EVENTS="$CALENDAR_OUTPUT"
else
  echo "⚠️  Calendar error (token likely expired), using empty events"
  CALENDAR_EVENTS='[]'
fi
CALENDAR_DATA=$(echo "{\"events\": $CALENDAR_EVENTS}")

# 2. Get git activity from workspace
echo "📊 Fetching git activity..."
GIT_ACTIVITY="[]"
if [ -d "$HOME/.openclaw/workspace/.git" ]; then
  cd "$HOME/.openclaw/workspace"
  GIT_ACTIVITY=$(git log --since="7 days ago" --pretty=format:'{"hash":"%h","message":"%s","author":"%an","date":"%aI"}' 2>/dev/null | head -20 | jq -s '.' 2>/dev/null || echo '[]')
  cd - > /dev/null
fi

# 3. Update model usage history (incremental tracking)
echo "🤖 Updating model usage..."
"$MC_DIR/update-model-usage.sh"

# Read from persistent history file
HISTORY_FILE="$MC_DIR/model-usage-history.json"
if [ -f "$HISTORY_FILE" ]; then
  # Extract all-time totals
  TOTAL_COST=$(jq -r '.totalCost' "$HISTORY_FILE")
  
  # Build byModel array from allTime data
  BY_MODEL=$(jq -r '
    [.allTime | to_entries[] | 
      select(.value.count > 0) | 
      {model: .key, count: .value.count, cost: .value.cost}
    ]
  ' "$HISTORY_FILE")
  
  # Get recent daily counts (last 7 days)
  LOG_DIR="/tmp/openclaw"
  DAILY_COUNTS='[]'
  if [ -d "$LOG_DIR" ]; then
    DAILY_COUNTS=$(find "$LOG_DIR" -name "openclaw-*.log" -mtime -7 2>/dev/null | while read logfile; do
      date_str=$(basename "$logfile" | sed 's/openclaw-//g' | sed 's/.log//g')
      count=$(grep -c '"tool"' "$logfile" 2>/dev/null || echo 1)
      # Ensure count is an integer by stripping whitespace
      count=$(echo "$count" | tr -d '[:space:]')
      if [ "$count" -gt 0 ] 2>/dev/null; then
          sessions=$((count / 10))
          [ $sessions -lt 1 ] && sessions=1
      else
          sessions=1
      fi
      echo "{\"date\":\"$date_str\",\"sessions\":$sessions}"
    done | jq -s '.' 2>/dev/null || echo '[]')
  fi
  
  MODEL_USAGE=$(cat <<EOF
{
  "byModel": $BY_MODEL,
  "dailyCounts": $DAILY_COUNTS,
  "totalCost": $TOTAL_COST
}
EOF
)
else
  # Fallback if history file doesn't exist
  MODEL_USAGE='{"byModel":[],"dailyCounts":[],"totalCost":0}'
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
echo "💬 Extracting conversations..."
./extract-conversations.sh 2>/dev/null || echo "⚠️ Could not extract conversations"

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
