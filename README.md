# Mission Control v2.0 🚀

A personal project management dashboard for tracking Eve's work, model usage, calendar, and tasks.

![Version](https://img.shields.io/badge/version-2.0-blue)
![Status](https://img.shields.io/badge/status-active-success)

## Features

### 📊 Dashboard
- **Stats at a glance**: Active tasks, sessions today, upcoming events, git commits
- **Live calendar**: Week/day view with real Google Calendar data
- **Task overview**: See current work priorities
- **Activity feed**: Combined git commits and task updates
- **Session chart**: Chart.js visualization of model usage over time

### 📅 Calendar
- Full calendar view with all upcoming events
- Event times, locations, and descriptions
- Past events dimmed for clarity

### 📋 Tasks
- Create, edit, complete, and delete tasks
- Priority levels (high/medium/low)
- Categories (development, research, client, etc.)
- Due dates with relative display ("Today", "Tomorrow", "in 3 days")
- Filter by status (All/Active/Completed)

### 🤖 Model Usage
- Sessions by model (pie chart)
- Daily sessions trend (line chart)
- Model breakdown with progress bars
- Data parsed from OpenClaw logs

### ⚡ Activity
- Combined timeline of git commits and task updates
- Filterable by type

## Data Sources

| Source | Description | Refresh |
|--------|-------------|---------|
| Google Calendar | Events via `gog calendar events` | On sync |
| Git Activity | Commits from workspace repo | On sync |
| Model Usage | Parsed from `/tmp/openclaw/*.log` | On sync |
| Tasks | `tasks.json` + localStorage | Real-time |

## Usage

### Quick Start
1. Open `index.html` in your browser
2. Click "Sync" to refresh data

### Refresh Data Script
```bash
./refresh-data.sh
```

This script:
- Fetches calendar events for next 14 days
- Parses git log for recent commits
- Extracts session counts from OpenClaw logs
- Loads tasks from `tasks.json`
- Optionally fetches weather

### Tasks Management

#### Via Dashboard
- Click "+ New Task" to add tasks
- Click checkbox to complete
- Click ✎ to edit, × to delete

#### Via tasks.json
Edit `tasks.json` directly:
```json
{
  "tasks": [
    {
      "id": "unique-id",
      "title": "Task title",
      "description": "Optional description",
      "priority": "high|medium|low",
      "category": "development|research|client|...",
      "dueDate": "2026-02-10",
      "completed": false
    }
  ]
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Cmd/Ctrl + N` | New task |
| `Cmd/Ctrl + R` | Refresh/sync data |
| `Escape` | Close modal |

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JavaScript (no build required)
- **Charts**: Chart.js 4.x (CDN)
- **Fonts**: Inter, JetBrains Mono (Google Fonts)
- **Storage**: localStorage for tasks/activity

## Design

Inspired by:
- **Palantir**: Data-dense dark interfaces
- **Stripe**: Gradient accents, smooth animations
- **Anduril**: Bold dark theme, confidence

## Files

```
mission-control/
├── index.html      # Main HTML structure
├── app.js          # Application logic (37KB)
├── data.js         # Default data & utilities
├── styles.css      # All styles (28KB)
├── tasks.json      # Task data file
├── mc-data.json    # Generated data (by refresh script)
├── refresh-data.sh # Data refresh script
└── README.md       # This file
```

## Changelog

### v2.0 (2026-02-06)
- ✨ Added Chart.js for proper visualizations
- ✨ Real data from calendar, git, and OpenClaw logs
- ✨ Tasks system with tasks.json
- ✨ Quick actions sidebar
- ✨ Toast notifications
- ✨ Calendar full view
- ✨ Activity timeline view
- ✨ Model usage analytics
- 🎨 Improved mobile responsiveness
- 🎨 Better dark theme polish

### v1.0 (2026-02-05)
- Initial release with calendar integration
- Basic task/goal tracking with localStorage
- Palantir/Stripe-inspired design

---

Built with 💜 by Eve
