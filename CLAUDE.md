# CLAUDE.md - Mission Control v3.0

## Project Overview

Mission Control is Eve's personal project management dashboard — a single-page vanilla web app that consolidates task management, calendar events, AI model usage analytics, agent infrastructure monitoring, and semantic search (Second Brain) into one dark-themed interface. No build tools, no frameworks, no npm — just HTML/CSS/JS served directly in a browser.

**Repository**: https://github.com/evegreenftw/mission-control.git
**Location**: All source lives in `mission-control/` (the git root is there, not the parent directory).

## Architecture (v3.0)

### Core Principle: Trust Through Transparency
Every piece of data in the UI must show: where it came from, when it was last updated, and whether the source is currently healthy. If data is unavailable, show an explicit empty state — never a placeholder or default that could be mistaken for real data.

### Stack
- Vanilla HTML/CSS/JS — no frameworks, no npm, no build tools
- Chart.js 4.4.1 via jsDelivr CDN
- Inter + JetBrains Mono from Google Fonts
- Single-user, password-protected (SHA-256 client-side verification)

### Module Architecture
Modular JS files with clear boundaries loaded via `<script>` tags (order matters):
1. **Utils** (`dom.js`, `validators.js`) — DOM helpers, formatting, schema validation
2. **Data layer** (`data-service.js`, `*-store.js`) — Fetch, validate, aggregate, health track
3. **Components** (`status-bar.js`, `chart-manager.js`) — Reusable UI components
4. **Views** (`*-view.js`) — Each view defines a global `render{Name}View()` function
5. **App shell** (`app.js`) — Routing, auth, keyboard shortcuts, auto-refresh

### Data Flow
```
External Sources → Shell scripts → JSON files → DataService.init() → Stores (validate) → Views (3-state render)
```

Every view handles 3 states: **Loading** (skeletons), **Populated** (real data), **Empty/Error** (explicit message).

## File Structure

```
mission-control/
├── index.html              # App shell (password gate, sidebar, views, modals)
├── test-suite.html            # Standalone test page
├── styles/
│   ├── design-tokens.css      # CSS variables only (colors, fonts, spacing)
│   ├── layout.css             # App shell grid, sidebar, header, responsive
│   ├── components.css         # Cards, buttons, badges, modals, forms, toasts
│   └── views/
│       ├── dashboard.css      # Summary cards, panels, quick actions
│       ├── kanban.css         # 5-column board, task cards, drag-drop
│       ├── calendar.css       # Week/day grid, event blocks, offline banner
│       ├── spend.css          # Charts, summary cards, breakdown table
│       ├── agents.css         # Agent cards grid, status indicators
│       └── second-brain.css   # Search interface, result cards
├── js/
│   ├── app.js                 # MissionControl class: auth, routing, shortcuts
│   ├── utils/
│   │   ├── dom.js             # $, $$, escapeHtml, formatDate/Time/Currency, debounce
│   │   └── validators.js      # validateTask, validateCalendarEvent, validateSpendData, validateAgent
│   ├── data/
│   │   ├── data-service.js    # Central fetch + health tracking (connected/stale/disconnected/loading)
│   │   ├── task-store.js      # Task CRUD, v2→v3 status mapping, localStorage persistence
│   │   ├── calendar-store.js  # Calendar events, freshness tracking
│   │   ├── spend-store.js     # Model usage aggregation (byDay/Week/Month/Model)
│   │   ├── agent-store.js     # Agent registry, OpenClaw always primary
│   │   └── brain-store.js     # Second Brain API health check + search with retry
│   ├── components/
│   │   ├── status-bar.js      # Header status dots (colored per source health)
│   │   └── chart-manager.js   # Chart.js lifecycle singleton (destroy-before-create)
│   └── views/
│       ├── dashboard-view.js  # 4 summary cards + 3 panels
│       ├── kanban-view.js     # 5-column drag-drop board + task modal + filters
│       ├── calendar-view.js   # Week/day views + event detail modal
│       ├── spend-view.js      # Period toggles, pie/line charts, sortable table
│       ├── agents-view.js     # Agent cards grid + add subagent modal
│       └── brain-view.js      # Search with debounce + grouped results
├── tasks.json                 # Task data (v2 format, normalized on load)
├── mc-data.json               # Generated aggregate data (calendar, weather, git)
├── model-usage-history.json   # Model usage tracking (aggregated by model per day)
├── agents.json                # Agent registry
├── conversations.json         # Extracted conversation history
└── scripts/
    ├── refresh-data.sh        # Master data refresh
    ├── update-model-usage.sh  # Model usage tracker
    └── extract-conversations.sh
```

## Code Conventions

### Naming
- **Files**: kebab-case (`calendar-view.js`, `data-service.js`)
- **CSS classes**: kebab-case, view-prefixed (`.calendar-day-cell`, `.spend-summary-card`)
- **JS variables/functions**: camelCase (`renderSpendView`, `calendarState`)
- **JS classes**: PascalCase (`MissionControl`, `SpendStore`, `DataService`)
- **JS constants**: UPPER_SNAKE_CASE (`MODEL_COLORS`, `STATUS_MAP_V2_TO_V3`)
- **HTML IDs**: camelCase, views use `{name}View` pattern (`spendView`, `brainSearchInput`)
- **Data attributes**: `data-view`, `data-task-id`, `data-source-column`

### Patterns
- **Rendering**: String concatenation into `.innerHTML` — no template literals (ES5-safe)
- **Event handling**: `onclick="globalFunction()"` in HTML for view-specific actions
- **State**: Module-level objects (`calendarState`, `spendState`, `kanbanFilters`)
- **Persistence**: `localStorage` as write layer for tasks/agents (static file app can't write to disk)
- **Async data**: `fetch()` + `Promise.allSettled` in DataService, health status per source
- **Charts**: Managed via `chartManager` singleton — always destroy before creating
- **XSS prevention**: `escapeHtml()` on all user/data-derived text in HTML
- **Validation**: Every data store validates via `validators.js` before rendering
- **Anti-hallucination**: Show `\u2014` for unavailable data, never fabricated numbers/names

### CSS Design System
```
Backgrounds:  #0a0a0f → #12121a → #1a1a24 → #22222e
Accents:      purple #635bff | cyan #00d4ff | green #00d68f | amber #ffb800 | red #ff6b6b
Fonts:        Inter (UI) | JetBrains Mono (code/data)
Layout:       260px sidebar | 64px header | fluid main content
Spacing:      4px base (--sp-1 through --sp-8)
Border radius: --radius-xs(4px), --radius-sm(6px), --radius-md(8px), --radius-lg(12px)
```

## Development Workflow

### Running the app
Open `mission-control/index.html` directly in a browser. No server required. Password: `EVE2026`.

### Running tests
Open `mission-control/test-suite.html` in a browser. Tests run automatically and display pass/fail results.

### Refreshing data
```bash
cd mission-control && ./refresh-data.sh
```
The browser auto-refreshes every 5 minutes. Manual refresh via the Sync button in the header.

### External dependencies (system tools, not npm)
- `python3` — Google Calendar API calls
- `jq` — JSON processing in shell scripts
- `git` — activity log extraction
- `gog` — Google Calendar CLI wrapper
- Chart.js 4.4.1 loaded from jsDelivr CDN

### Data sources and health tracking
| Source | File / API | Health Status | Store |
|--------|-----------|---------------|-------|
| Tasks | `tasks.json` | connected/disconnected | `taskStore` |
| Calendar | `mc-data.json` calendar section | connected/stale/disconnected | `calendarStore` |
| Model usage | `model-usage-history.json` | connected/disconnected | `spendStore` |
| Agents | `agents.json` | connected/disconnected | `agentStore` |
| Second Brain | `localhost:3001` API | connected/disconnected | `brainStore` |

Health status is shown in the header status bar as colored dots. 10-minute freshness threshold.

## Views

6 views, switched via `app.switchView(name)` or keyboard shortcuts 1-6:

| # | View | Key File | Description |
|---|------|----------|-------------|
| 1 | Dashboard | `dashboard-view.js` | 4 summary cards (tasks, events, spend, agents) + 3 panels (upcoming, recent, quick actions) |
| 2 | Kanban | `kanban-view.js` | 5 columns (backlog→done), HTML5 drag-drop, task modal, filter bar |
| 3 | Calendar | `calendar-view.js` | Week/day toggle, event detail modal, freshness indicator, offline banner |
| 4 | Spend | `spend-view.js` | Period toggles (day/week/month/all), doughnut + line charts, sortable table |
| 5 | Agents | `agents-view.js` | OpenClaw featured card, subagent grid, add subagent modal |
| 6 | Second Brain | `brain-view.js` | Search with 300ms debounce, results grouped by type, relevance bars |

### Keyboard Shortcuts
- `1-6` — Switch views (when not in an input)
- `Escape` — Close modal / sidebar
- `N` — Open new task modal
- `/` — Focus search in Second Brain view

## Task Status Mapping (v2 → v3)

The `tasks.json` file uses v2 statuses. The `taskStore` normalizes them on load:
- `todo` → `backlog`
- `inProgress` → `in-progress`
- `completed` → `done`
- v3 also supports: `assigned`, `review`

## Common Modification Tasks

**Adding a new view**: Add HTML container in `index.html` (`<div id="{name}View" class="view-container">`), add nav item in sidebar, add entry in `VIEWS` and `VIEW_TITLES` in `app.js`, create `js/views/{name}-view.js` with `render{Name}View()` global function, create `styles/views/{name}.css`.

**Adding a new data source**: Add fetch logic in `data-service.js`, create a new store in `js/data/`, add validator in `validators.js`, add status indicator in `status-bar.js`.

**Modifying task schema**: Update `validateTask()` in `validators.js`, `_normalizeTask()` in `task-store.js`, the task modal form in `kanban-view.js`.

## Important Notes

- No build system, no package.json, no node_modules — keep it that way
- All JS files are browser globals loaded via script tags — no ES modules
- `mc-data.json` is generated — modify `refresh-data.sh`, not the file directly
- `model-usage-history.json` is incremental — `update-model-usage.sh` appends to it
- Chart.js instances MUST go through `chartManager` to prevent memory leaks
- The entry point is `index.html` (not `index.html`, which is the v2 app)
- NEVER render fabricated data — show explicit empty states when data is unavailable
- All data must pass validation before rendering — invalid entries are logged and excluded
