/* ============================================
   Mission Control v3.0 — Dashboard View
   Summary cards, upcoming events, recent tasks,
   quick actions. Never fabricates data.
   ============================================ */

/**
 * Render the Dashboard view. Called by app.switchView().
 */
function renderDashboardView() {
  var container = $('#dashboardView');
  if (!container) return;

  var html = '';

  // ---- Summary Cards ----
  html += '<div class="dashboard-cards">';
  html += _renderDashboardCard_ActiveTasks();
  html += _renderDashboardCard_TodayEvents();
  html += _renderDashboardCard_WeekSpend();
  html += _renderDashboardCard_AgentsOnline();
  html += '</div>';

  // ---- Panels ----
  html += '<div class="dashboard-panels">';
  html += _renderDashboardPanel_UpcomingEvents();
  html += _renderDashboardPanel_RecentTasks();
  html += _renderDashboardPanel_QuickActions();
  html += '</div>';

  container.innerHTML = html;
}

/* ---- Summary Cards ---- */

function _renderDashboardCard_ActiveTasks() {
  var status = dataService.getStatus('tasks');
  var value, subtitle;

  if (status === 'connected' || status === 'stale') {
    var count = taskStore.getActiveCount();
    value = String(count);
    var critical = taskStore.getCriticalCount();
    subtitle = critical > 0
      ? '<span class="critical-count">' + critical + ' critical</span>'
      : 'across all columns';
  } else {
    value = '\u2014';
    subtitle = '<span class="status-badge">Data unavailable</span>';
  }

  return _dashboardCard('Active Tasks', value, subtitle, 'kanban', status !== 'connected' && status !== 'stale');
}

function _renderDashboardCard_TodayEvents() {
  var status = dataService.getStatus('calendar');
  var value, subtitle;

  if (status === 'connected' || status === 'stale') {
    var events = calendarStore.getTodayEvents();
    value = String(events.length);
    subtitle = events.length === 0 ? 'Free day' : 'on the calendar';
  } else {
    value = '\u2014';
    subtitle = '<span class="status-badge">Calendar offline</span>';
  }

  return _dashboardCard("Today's Events", value, subtitle, 'calendar', status !== 'connected' && status !== 'stale');
}

function _renderDashboardCard_WeekSpend() {
  var status = dataService.getStatus('spend');
  var value, subtitle;

  if ((status === 'connected' || status === 'stale') && spendStore.hasData()) {
    var weekTotal = spendStore.totalForPeriod('week');
    if (weekTotal !== null) {
      value = formatCurrency(weekTotal);
      var topModel = spendStore.mostExpensiveModel('week');
      subtitle = topModel ? 'Top: ' + (topModel.displayName || topModel.model) : 'this week';
    } else {
      value = '$0.00';
      subtitle = 'this week';
    }
  } else {
    value = '\u2014';
    subtitle = '<span class="status-badge">Data unavailable</span>';
  }

  return _dashboardCard("This Week's Spend", value, subtitle, 'spend', status !== 'connected' && status !== 'stale');
}

function _renderDashboardCard_AgentsOnline() {
  var status = dataService.getStatus('agents');
  var value, subtitle;

  // Agents always have at least OpenClaw
  if (agentStore.loaded) {
    var activeCount = agentStore.getActiveCount();
    var total = agentStore.getAgents().length;
    value = String(activeCount);
    subtitle = activeCount + ' of ' + total + ' active';
  } else {
    value = '\u2014';
    subtitle = '<span class="status-badge">Data unavailable</span>';
  }

  return _dashboardCard('Agents Online', value, subtitle, 'agents', !agentStore.loaded);
}

function _dashboardCard(label, value, subtitle, viewId, unavailable) {
  return '<div class="dashboard-card" onclick="app.switchView(\'' + viewId + '\')">' +
    '<div class="dashboard-card-label">' + escapeHtml(label) + '</div>' +
    '<div class="dashboard-card-value' + (unavailable ? ' unavailable' : '') + '">' + value + '</div>' +
    '<div class="dashboard-card-sub">' + subtitle + '</div>' +
    '</div>';
}

/* ---- Panels ---- */

function _renderDashboardPanel_UpcomingEvents() {
  var html = '<div class="dashboard-panel">';
  html += '<div class="dashboard-panel-header">';
  html += '  <span class="dashboard-panel-title">Upcoming Events</span>';

  var freshness = calendarStore.getFreshness();
  html += '  <span class="calendar-freshness">Synced ' + escapeHtml(freshness.label) + '</span>';

  html += '</div>';
  html += '<div class="dashboard-panel-body">';

  var status = dataService.getStatus('calendar');
  if (status !== 'connected' && status !== 'stale') {
    html += '<div class="panel-empty">Calendar offline</div>';
  } else {
    var events = calendarStore.getUpcoming(5);
    if (events.length === 0) {
      html += '<div class="panel-empty">No upcoming events</div>';
    } else {
      events.forEach(function(evt) {
        html += '<div class="dashboard-event-item">';
        html += '  <span class="dashboard-event-time">' + escapeHtml(formatTime(evt.start)) + '</span>';
        html += '  <div>';
        html += '    <div class="dashboard-event-title">' + escapeHtml(evt.title) + '</div>';
        if (evt.location) {
          html += '    <div style="font-size:var(--text-xs);color:var(--text-tertiary)">' + escapeHtml(evt.location) + '</div>';
        }
        html += '  </div>';
        html += '</div>';
      });
    }
  }

  html += '</div></div>';
  return html;
}

function _renderDashboardPanel_RecentTasks() {
  var html = '<div class="dashboard-panel">';
  html += '<div class="dashboard-panel-header">';
  html += '  <span class="dashboard-panel-title">Recent Tasks</span>';
  html += '  <button class="btn btn-ghost btn-sm" onclick="app.switchView(\'kanban\')">View all</button>';
  html += '</div>';
  html += '<div class="dashboard-panel-body">';

  if (!taskStore.loaded) {
    html += '<div class="panel-empty">Loading tasks...</div>';
  } else {
    var recent = taskStore.getRecent(5);
    if (recent.length === 0) {
      html += '<div class="panel-empty">No tasks yet</div>';
    } else {
      recent.forEach(function(task) {
        var priorityColor = {
          critical: 'var(--priority-critical)',
          high: 'var(--priority-high)',
          medium: 'var(--priority-medium)',
          low: 'var(--priority-low)'
        }[task.priority] || 'var(--text-disabled)';

        var statusLabel = task.status.replace('-', ' ');

        html += '<div class="dashboard-task-item">';
        html += '  <span class="dashboard-task-priority" style="background:' + priorityColor + '"></span>';
        html += '  <span class="dashboard-task-title">' + escapeHtml(task.title) + '</span>';
        html += '  <span class="dashboard-task-status">' + escapeHtml(statusLabel) + '</span>';
        html += '</div>';
      });
    }
  }

  html += '</div></div>';
  return html;
}

function _renderDashboardPanel_QuickActions() {
  var html = '<div class="dashboard-panel">';
  html += '<div class="dashboard-panel-header">';
  html += '  <span class="dashboard-panel-title">Quick Actions</span>';
  html += '</div>';
  html += '<div class="dashboard-panel-body">';
  html += '<div class="quick-actions">';

  html += '<button class="quick-action-btn" onclick="openTaskModal()">';
  html += '  <span class="quick-action-icon">+</span>';
  html += '  <span>Add Task</span>';
  html += '</button>';

  html += '<button class="quick-action-btn" onclick="app.refreshData()">';
  html += '  <span class="quick-action-icon">\u21BB</span>';
  html += '  <span>Refresh All Data</span>';
  html += '</button>';

  html += '<button class="quick-action-btn" onclick="app.switchView(\'brain\')">';
  html += '  <span class="quick-action-icon">\u2315</span>';
  html += '  <span>Search Second Brain</span>';
  html += '</button>';

  html += '</div>';
  html += '</div></div>';
  return html;
}
