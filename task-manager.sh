#!/bin/bash
# Task Manager - Add/update/complete tasks
# Usage: ./task-manager.sh add|complete|list [args]

set -e

MC_DIR="$(dirname "$0")"
TASKS_FILE="$MC_DIR/tasks.json"

# Initialize tasks file if it doesn't exist
if [ ! -f "$TASKS_FILE" ]; then
  cat > "$TASKS_FILE" << 'EOF'
{
  "tasks": [],
  "lastUpdated": "1970-01-01T00:00:00Z"
}
EOF
fi

# Helper: Generate unique ID
generate_id() {
  jq -r '[.tasks[].id | tonumber] | max + 1' "$TASKS_FILE" 2>/dev/null || echo "1"
}

# Helper: Parse assignee from title (ME) = Tyler, otherwise Eve
parse_assignee() {
  local title="$1"
  if echo "$title" | grep -q "(ME)"; then
    echo "Tyler"
  else
    echo "Eve"
  fi
}

# Helper: Clean title (remove (ME) marker)
clean_title() {
  local title="$1"
  echo "$title" | sed 's/ *(ME) *//g'
}

# Command: Add task
add_task() {
  local raw_title="$1"
  local description="${2:-}"
  local priority="${3:-medium}"
  local due_date="${4:-}"
  
  local assignee=$(parse_assignee "$raw_title")
  local clean_title=$(clean_title "$raw_title")
  local task_id=$(generate_id)
  local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  # Determine category from title keywords
  local category="general"
  if echo "$clean_title" | grep -qi "blog\|write\|content"; then
    category="content"
  elif echo "$clean_title" | grep -qi "code\|build\|develop\|website"; then
    category="development"
  elif echo "$clean_title" | grep -qi "exercise\|workout\|morning"; then
    category="health"
  elif echo "$clean_title" | grep -qi "study\|assignment\|course"; then
    category="education"
  elif echo "$clean_title" | grep -qi "client\|meeting\|call"; then
    category="business"
  fi
  
  # Build new task
  local new_task=$(cat <<EOF
{
  "id": "$task_id",
  "title": "$clean_title",
  "description": "$description",
  "assignedTo": "$assignee",
  "priority": "$priority",
  "category": "$category",
  "status": "todo",
  "dueDate": "$due_date",
  "createdAt": "$now",
  "completed": false
}
EOF
)
  
  # Add to tasks array
  jq --argjson task "$new_task" --arg now "$now" \
    '.tasks += [$task] | .lastUpdated = $now' \
    "$TASKS_FILE" > "$TASKS_FILE.tmp" && mv "$TASKS_FILE.tmp" "$TASKS_FILE"
  
  echo "✅ Added task #$task_id: $clean_title (assigned to $assignee)"
}

# Command: Complete task
complete_task() {
  local task_id="$1"
  local now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  
  jq --arg id "$task_id" --arg now "$now" \
    '(.tasks[] | select(.id == $id)) |= (.completed = true | .completedAt = $now | .status = "completed") | .lastUpdated = $now' \
    "$TASKS_FILE" > "$TASKS_FILE.tmp" && mv "$TASKS_FILE.tmp" "$TASKS_FILE"
  
  local title=$(jq -r ".tasks[] | select(.id == \"$task_id\") | .title" "$TASKS_FILE")
  echo "✅ Completed task #$task_id: $title"
}

# Command: List tasks
list_tasks() {
  local filter="${1:-all}"
  
  case "$filter" in
    tyler|me)
      jq -r '.tasks[] | select(.assignedTo == "Tyler" and .completed == false) | "[\(.id)] \(.title) (priority: \(.priority))"' "$TASKS_FILE"
      ;;
    eve)
      jq -r '.tasks[] | select(.assignedTo == "Eve" and .completed == false) | "[\(.id)] \(.title) (priority: \(.priority))"' "$TASKS_FILE"
      ;;
    completed)
      jq -r '.tasks[] | select(.completed == true) | "[\(.id)] \(.title) (completed: \(.completedAt))"' "$TASKS_FILE"
      ;;
    *)
      jq -r '.tasks[] | select(.completed == false) | "[\(.id)] \(.title) (→ \(.assignedTo), priority: \(.priority))"' "$TASKS_FILE"
      ;;
  esac
}

# Main command dispatcher
case "${1:-}" in
  add)
    add_task "$2" "${3:-}" "${4:-medium}" "${5:-}"
    ;;
  complete|done)
    complete_task "$2"
    ;;
  list)
    list_tasks "${2:-all}"
    ;;
  *)
    echo "Usage: $0 {add|complete|list} [args]"
    echo ""
    echo "Examples:"
    echo "  $0 add 'Exercise 20 minutes (ME)' '' high"
    echo "  $0 add 'Research competitor pricing'"
    echo "  $0 complete 3"
    echo "  $0 list tyler"
    echo "  $0 list eve"
    exit 1
    ;;
esac
