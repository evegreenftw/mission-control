#!/bin/bash
# Incremental Model Usage Tracker
# Updates model-usage-history.json with new usage since last check

set -e

MC_DIR="$(dirname "$0")"
HISTORY_FILE="$MC_DIR/model-usage-history.json"
TEMP_FILE="$MC_DIR/.usage-temp.json"
LOG_DIR="/tmp/openclaw"

# Initialize history file if it doesn't exist
if [ ! -f "$HISTORY_FILE" ]; then
  cat > "$HISTORY_FILE" << 'EOF'
{
  "allTime": {},
  "byMonth": {},
  "byDay": {},
  "lastCheck": "1970-01-01T00:00:00Z",
  "totalCost": 0
}
EOF
fi

# Get current time and date
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
TODAY=$(date +%Y-%m-%d)
THIS_MONTH=$(date +%Y-%m)

# Read last check time
LAST_CHECK=$(jq -r '.lastCheck' "$HISTORY_FILE")
echo "📊 Checking usage since $LAST_CHECK..."

# Find log files modified since last check
if [ ! -d "$LOG_DIR" ]; then
  echo "⚠️ No OpenClaw logs found at $LOG_DIR"
  exit 0
fi

# Count NEW model usage since last check
# We'll search logs for model invocations with timestamps after lastCheck
OPUS_NEW=0
SONNET_NEW=0
HAIKU_NEW=0
MINIMAX_NEW=0
DEEPSEEK_NEW=0
KIMI_NEW=0
GEMINI_NEW=0

# Get recent log files (modified in last hour to catch new usage)
for logfile in $(find "$LOG_DIR" -name "openclaw-*.log" -mmin -60 2>/dev/null); do
  # Count occurrences of each model in this log
  OPUS_NEW=$((OPUS_NEW + $(grep -c 'claude-opus' "$logfile" 2>/dev/null || echo 0)))
  SONNET_NEW=$((SONNET_NEW + $(grep -c 'claude-sonnet' "$logfile" 2>/dev/null || echo 0)))
  HAIKU_NEW=$((HAIKU_NEW + $(grep -c 'claude-haiku' "$logfile" 2>/dev/null || echo 0)))
  MINIMAX_NEW=$((MINIMAX_NEW + $(grep -c 'minimax' "$logfile" 2>/dev/null || echo 0)))
  DEEPSEEK_NEW=$((DEEPSEEK_NEW + $(grep -c 'deepseek' "$logfile" 2>/dev/null || echo 0)))
  KIMI_NEW=$((KIMI_NEW + $(grep -c 'kimi' "$logfile" 2>/dev/null || echo 0)))
  GEMINI_NEW=$((GEMINI_NEW + $(grep -c 'gemini' "$logfile" 2>/dev/null || echo 0)))
done

# Calculate costs for new usage
# Average tokens: 5000 input, 1500 output (conservative estimates)
AVG_INPUT=5000
AVG_OUTPUT=1500

# Calculate cost per call
calc_cost() {
  local count=$1
  local input_price=$2
  local output_price=$3
  echo "scale=4; ($count * $AVG_INPUT * $input_price / 1000000) + ($count * $AVG_OUTPUT * $output_price / 1000000)" | bc
}

OPUS_COST_NEW=$(calc_cost $OPUS_NEW 15 75)
SONNET_COST_NEW=$(calc_cost $SONNET_NEW 3 15)
HAIKU_COST_NEW=$(calc_cost $HAIKU_NEW 0.80 4)
MINIMAX_COST_NEW=$(calc_cost $MINIMAX_NEW 0.30 0.30)
DEEPSEEK_COST_NEW=$(calc_cost $DEEPSEEK_NEW 0.27 1.10)
KIMI_COST_NEW=$(calc_cost $KIMI_NEW 0.30 0.30)
GEMINI_COST_NEW="0.0000"

# Update history using jq
jq --arg now "$NOW" \
   --arg today "$TODAY" \
   --arg month "$THIS_MONTH" \
   --argjson opus_count "$OPUS_NEW" \
   --argjson opus_cost "$OPUS_COST_NEW" \
   --argjson sonnet_count "$SONNET_NEW" \
   --argjson sonnet_cost "$SONNET_COST_NEW" \
   --argjson haiku_count "$HAIKU_NEW" \
   --argjson haiku_cost "$HAIKU_COST_NEW" \
   --argjson minimax_count "$MINIMAX_NEW" \
   --argjson minimax_cost "$MINIMAX_COST_NEW" \
   --argjson deepseek_count "$DEEPSEEK_NEW" \
   --argjson deepseek_cost "$DEEPSEEK_COST_NEW" \
   --argjson kimi_count "$KIMI_NEW" \
   --argjson kimi_cost "$KIMI_COST_NEW" \
   --argjson gemini_count "$GEMINI_NEW" \
   --argjson gemini_cost "$GEMINI_COST_NEW" \
   '
   # Update allTime totals
   .allTime.opus.count = (.allTime.opus.count // 0) + $opus_count |
   .allTime.opus.cost = ((.allTime.opus.cost // 0) + $opus_cost) |
   .allTime.sonnet.count = (.allTime.sonnet.count // 0) + $sonnet_count |
   .allTime.sonnet.cost = ((.allTime.sonnet.cost // 0) + $sonnet_cost) |
   .allTime.haiku.count = (.allTime.haiku.count // 0) + $haiku_count |
   .allTime.haiku.cost = ((.allTime.haiku.cost // 0) + $haiku_cost) |
   .allTime.minimax.count = (.allTime.minimax.count // 0) + $minimax_count |
   .allTime.minimax.cost = ((.allTime.minimax.cost // 0) + $minimax_cost) |
   .allTime.deepseek.count = (.allTime.deepseek.count // 0) + $deepseek_count |
   .allTime.deepseek.cost = ((.allTime.deepseek.cost // 0) + $deepseek_cost) |
   .allTime.kimi.count = (.allTime.kimi.count // 0) + $kimi_count |
   .allTime.kimi.cost = ((.allTime.kimi.cost // 0) + $kimi_cost) |
   .allTime.gemini.count = (.allTime.gemini.count // 0) + $gemini_count |
   .allTime.gemini.cost = ((.allTime.gemini.cost // 0) + $gemini_cost) |
   
   # Update monthly totals
   .byMonth[$month].opus.count = ((.byMonth[$month].opus.count // 0) + $opus_count) |
   .byMonth[$month].opus.cost = ((.byMonth[$month].opus.cost // 0) + $opus_cost) |
   .byMonth[$month].sonnet.count = ((.byMonth[$month].sonnet.count // 0) + $sonnet_count) |
   .byMonth[$month].sonnet.cost = ((.byMonth[$month].sonnet.cost // 0) + $sonnet_cost) |
   .byMonth[$month].haiku.count = ((.byMonth[$month].haiku.count // 0) + $haiku_count) |
   .byMonth[$month].haiku.cost = ((.byMonth[$month].haiku.cost // 0) + $haiku_cost) |
   .byMonth[$month].minimax.count = ((.byMonth[$month].minimax.count // 0) + $minimax_count) |
   .byMonth[$month].minimax.cost = ((.byMonth[$month].minimax.cost // 0) + $minimax_cost) |
   .byMonth[$month].deepseek.count = ((.byMonth[$month].deepseek.count // 0) + $deepseek_count) |
   .byMonth[$month].deepseek.cost = ((.byMonth[$month].deepseek.cost // 0) + $deepseek_cost) |
   .byMonth[$month].kimi.count = ((.byMonth[$month].kimi.count // 0) + $kimi_count) |
   .byMonth[$month].kimi.cost = ((.byMonth[$month].kimi.cost // 0) + $kimi_cost) |
   .byMonth[$month].gemini.count = ((.byMonth[$month].gemini.count // 0) + $gemini_count) |
   .byMonth[$month].gemini.cost = ((.byMonth[$month].gemini.cost // 0) + $gemini_cost) |
   
   # Update daily totals
   .byDay[$today].opus.count = ((.byDay[$today].opus.count // 0) + $opus_count) |
   .byDay[$today].opus.cost = ((.byDay[$today].opus.cost // 0) + $opus_cost) |
   .byDay[$today].sonnet.count = ((.byDay[$today].sonnet.count // 0) + $sonnet_count) |
   .byDay[$today].sonnet.cost = ((.byDay[$today].sonnet.cost // 0) + $sonnet_cost) |
   .byDay[$today].haiku.count = ((.byDay[$today].haiku.count // 0) + $haiku_count) |
   .byDay[$today].haiku.cost = ((.byDay[$today].haiku.cost // 0) + $haiku_cost) |
   .byDay[$today].minimax.count = ((.byDay[$today].minimax.count // 0) + $minimax_count) |
   .byDay[$today].minimax.cost = ((.byDay[$today].minimax.cost // 0) + $minimax_cost) |
   .byDay[$today].deepseek.count = ((.byDay[$today].deepseek.count // 0) + $deepseek_count) |
   .byDay[$today].deepseek.cost = ((.byDay[$today].deepseek.cost // 0) + $deepseek_cost) |
   .byDay[$today].kimi.count = ((.byDay[$today].kimi.count // 0) + $kimi_count) |
   .byDay[$today].kimi.cost = ((.byDay[$today].kimi.cost // 0) + $kimi_cost) |
   .byDay[$today].gemini.count = ((.byDay[$today].gemini.count // 0) + $gemini_count) |
   .byDay[$today].gemini.cost = ((.byDay[$today].gemini.cost // 0) + $gemini_cost) |
   
   # Update metadata
   .lastCheck = $now |
   .totalCost = (
     (.allTime.opus.cost // 0) +
     (.allTime.sonnet.cost // 0) +
     (.allTime.haiku.cost // 0) +
     (.allTime.minimax.cost // 0) +
     (.allTime.deepseek.cost // 0) +
     (.allTime.kimi.cost // 0) +
     (.allTime.gemini.cost // 0)
   )
   ' "$HISTORY_FILE" > "$TEMP_FILE"

# Validate and save
if jq . "$TEMP_FILE" > /dev/null 2>&1; then
  mv "$TEMP_FILE" "$HISTORY_FILE"
  
  NEW_TOTAL=$(jq -r '.totalCost' "$HISTORY_FILE")
  
  if [ "$OPUS_NEW" -gt 0 ] || [ "$SONNET_NEW" -gt 0 ] || [ "$HAIKU_NEW" -gt 0 ]; then
    echo "✅ Updated usage:"
    [ "$OPUS_NEW" -gt 0 ] && echo "  Opus: +$OPUS_NEW calls (+\$$OPUS_COST_NEW)"
    [ "$SONNET_NEW" -gt 0 ] && echo "  Sonnet: +$SONNET_NEW calls (+\$$SONNET_COST_NEW)"
    [ "$HAIKU_NEW" -gt 0 ] && echo "  Haiku: +$HAIKU_NEW calls (+\$$HAIKU_COST_NEW)"
    [ "$MINIMAX_NEW" -gt 0 ] && echo "  Minimax: +$MINIMAX_NEW calls (+\$$MINIMAX_COST_NEW)"
    [ "$DEEPSEEK_NEW" -gt 0 ] && echo "  DeepSeek: +$DEEPSEEK_NEW calls (+\$$DEEPSEEK_COST_NEW)"
    [ "$KIMI_NEW" -gt 0 ] && echo "  Kimi: +$KIMI_NEW calls (+\$$KIMI_COST_NEW)"
    echo "💰 Total all-time: \$$NEW_TOTAL"
  else
    echo "✓ No new usage since last check"
  fi
else
  echo "❌ JSON validation failed"
  rm -f "$TEMP_FILE"
  exit 1
fi
