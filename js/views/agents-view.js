/* ============================================
   Mission Control v3.0 — Agents View
   Agent cards grid, expandable details,
   add subagent modal.
   ============================================ */

var agentsState = {
  expandedId: null  // ID of expanded agent card, or null
};

/**
 * Render the Agents view. Called by app.switchView().
 */
function renderAgentsView() {
  var container = $('#agentsView');
  if (!container) return;

  var html = '';

  // Controls
  html += _renderAgentsControls();

  // Loading state
  if (!agentStore.loaded) {
    html += _agentsLoadingState();
    container.innerHTML = html;
    return;
  }

  var agents = agentStore.getAgents();
  if (agents.length === 0) {
    html += '<div class="empty-state">';
    html += '  <div class="empty-state-icon">\u2B23</div>';
    html += '  <div class="empty-state-title">No Agents Configured</div>';
    html += '  <div class="empty-state-message">Add your first subagent to get started.</div>';
    html += '  <button class="btn btn-primary" onclick="openAddAgentModal()">Add Subagent</button>';
    html += '</div>';
    container.innerHTML = html;
    return;
  }

  html += '<div class="agents-grid">';

  // Primary agent card (featured)
  var primary = agentStore.getPrimary();
  if (primary) {
    html += _renderPrimaryAgentCard(primary);
  }

  // Subagent cards
  var subagents = agentStore.getSubagents();
  subagents.forEach(function(agent) {
    html += _renderAgentCard(agent);
  });

  html += '</div>';

  container.innerHTML = html;
}

/* ---- Controls ---- */

function _renderAgentsControls() {
  var agents = agentStore.loaded ? agentStore.getAgents() : [];
  var activeCount = agentStore.loaded ? agentStore.getActiveCount() : 0;

  var html = '<div class="agents-controls">';
  html += '<div class="agents-controls-left">';
  if (agentStore.loaded) {
    html += '<span class="agents-count">' + activeCount + ' of ' + agents.length + ' active</span>';
  }
  html += '</div>';
  html += '<button class="btn btn-primary btn-sm" onclick="openAddAgentModal()">+ Add Subagent</button>';
  html += '</div>';

  return html;
}

/* ---- Primary Agent Card ---- */

function _renderPrimaryAgentCard(agent) {
  var tasks = agentStore.getAgentTasks(agent.name);
  var isExpanded = agentsState.expandedId === agent.id;

  var html = '<div class="agent-card-primary" onclick="toggleAgentExpand(\'' + escapeHtml(agent.id) + '\')">';

  // Avatar
  html += '<div class="agent-avatar">' + escapeHtml(agent.name.charAt(0)) + '</div>';

  html += '<div class="agent-info">';
  // Name + type badge
  html += '<div>';
  html += '<span class="agent-name">' + escapeHtml(agent.name) + '</span>';
  html += '<span class="agent-type-badge">Primary</span>';
  html += '</div>';

  // Status
  html += '<div style="margin-top:var(--sp-2)">';
  html += _agentStatusBadge(agent.status);
  html += '</div>';

  // Meta
  if (agent.lastActive) {
    html += '<div class="agent-meta">Last active: ' + escapeHtml(formatRelativeTime(new Date(agent.lastActive))) + '</div>';
  }

  // Capabilities
  if (agent.capabilities && agent.capabilities.length > 0) {
    html += '<div class="agent-capabilities">';
    agent.capabilities.forEach(function(cap) {
      html += '<span class="agent-capability-tag">' + escapeHtml(cap) + '</span>';
    });
    html += '</div>';
  }

  // Tasks section
  html += _renderAgentTasks(tasks);

  // Expanded detail
  if (isExpanded) {
    html += _renderAgentExpandedDetail(agent);
  }

  html += '</div>'; // agent-info
  html += '</div>'; // agent-card-primary

  return html;
}

/* ---- Subagent Card ---- */

function _renderAgentCard(agent) {
  var tasks = agentStore.getAgentTasks(agent.name);
  var isExpanded = agentsState.expandedId === agent.id;

  var html = '<div class="agent-card" onclick="toggleAgentExpand(\'' + escapeHtml(agent.id) + '\')">';

  // Header
  html += '<div class="agent-card-header">';
  html += '<div class="agent-avatar">' + escapeHtml(agent.name.charAt(0)) + '</div>';
  html += '<div>';
  html += '<div class="agent-name">' + escapeHtml(agent.name) + '</div>';
  if (agent.lastActive) {
    html += '<div class="agent-meta">' + escapeHtml(formatRelativeTime(new Date(agent.lastActive))) + '</div>';
  }
  html += '</div>';
  html += '</div>';

  // Status
  html += _agentStatusBadge(agent.status);

  // Capabilities
  if (agent.capabilities && agent.capabilities.length > 0) {
    html += '<div class="agent-capabilities">';
    agent.capabilities.forEach(function(cap) {
      html += '<span class="agent-capability-tag">' + escapeHtml(cap) + '</span>';
    });
    html += '</div>';
  }

  // Tasks
  html += _renderAgentTasks(tasks);

  // Expanded detail
  if (isExpanded) {
    html += _renderAgentExpandedDetail(agent);
  }

  html += '</div>'; // agent-card

  return html;
}

/* ---- Agent Tasks ---- */

function _renderAgentTasks(tasks) {
  var html = '<div class="agent-tasks">';
  html += '<div class="agent-tasks-label">Assigned Tasks (' + tasks.length + ')</div>';

  if (tasks.length === 0) {
    html += '<div class="agent-no-tasks">No tasks assigned</div>';
  } else {
    // Show up to 5 tasks
    var shown = tasks.slice(0, 5);
    shown.forEach(function(task) {
      var priorityColor = {
        critical: 'var(--priority-critical)',
        high: 'var(--priority-high)',
        medium: 'var(--priority-medium)',
        low: 'var(--priority-low)'
      }[task.priority] || 'var(--text-disabled)';

      html += '<div class="agent-task-item">';
      html += '<span class="task-priority-dot" style="background:' + priorityColor + '"></span>';
      html += escapeHtml(task.title);
      html += '</div>';
    });

    if (tasks.length > 5) {
      html += '<div class="agent-task-item" style="color:var(--text-tertiary)">+' + (tasks.length - 5) + ' more</div>';
    }
  }

  html += '</div>';
  return html;
}

/* ---- Expanded Detail ---- */

function _renderAgentExpandedDetail(agent) {
  var html = '<div class="agent-detail-section" style="margin-top:var(--sp-3);padding-top:var(--sp-3);border-top:1px solid var(--border-subtle)">';

  html += '<div class="agent-detail-label">Agent ID</div>';
  html += '<div style="font-size:var(--text-xs);font-family:var(--font-mono);color:var(--text-tertiary);margin-bottom:var(--sp-2)">' + escapeHtml(agent.id) + '</div>';

  html += '<div class="agent-detail-label">Type</div>';
  html += '<div style="font-size:var(--text-xs);color:var(--text-secondary);margin-bottom:var(--sp-2)">' + escapeHtml(agent.type) + '</div>';

  if (agent.type !== 'primary') {
    html += '<div style="margin-top:var(--sp-3)">';
    html += '<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); editAgentStatus(\'' + escapeHtml(agent.id) + '\')">Change Status</button>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/* ---- Status Badge ---- */

function _agentStatusBadge(status) {
  var statusClass = status || 'idle';
  var label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';

  var html = '<span class="agent-status">';
  html += '<span class="agent-status-dot ' + escapeHtml(statusClass) + '"></span>';
  html += '<span class="agent-status-label ' + escapeHtml(statusClass) + '">' + escapeHtml(label) + '</span>';
  html += '</span>';
  return html;
}

/* ---- Loading State ---- */

function _agentsLoadingState() {
  var html = '<div class="agents-grid">';
  html += '<div class="agent-card-primary" style="opacity:0.5">';
  html += '<div class="loading-skeleton" style="width:64px;height:64px;border-radius:var(--radius-lg)"></div>';
  html += '<div style="flex:1">';
  html += '<div class="loading-skeleton skeleton-text medium"></div>';
  html += '<div class="loading-skeleton skeleton-text short" style="margin-top:var(--sp-2)"></div>';
  html += '</div>';
  html += '</div>';
  for (var i = 0; i < 3; i++) {
    html += '<div class="agent-card" style="opacity:0.5">';
    html += '<div class="loading-skeleton skeleton-text medium"></div>';
    html += '<div class="loading-skeleton skeleton-text short" style="margin-top:var(--sp-2)"></div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/* ---- Actions ---- */

function toggleAgentExpand(agentId) {
  if (agentsState.expandedId === agentId) {
    agentsState.expandedId = null;
  } else {
    agentsState.expandedId = agentId;
  }
  renderAgentsView();
}

function editAgentStatus(agentId) {
  var agent = agentStore.getAgent(agentId);
  if (!agent) return;

  var statuses = ['active', 'idle', 'error'];
  var currentIdx = statuses.indexOf(agent.status);
  var nextIdx = (currentIdx + 1) % statuses.length;
  var newStatus = statuses[nextIdx];

  agentStore.updateAgent(agentId, { status: newStatus });
  showToast(agent.name + ' status changed to ' + newStatus, 'success');
  renderAgentsView();
}

function openAddAgentModal() {
  var bodyHtml = '<form id="addAgentForm" onsubmit="saveNewAgent(event)">';
  bodyHtml += '<div class="form-group" style="margin-bottom:var(--sp-4)">';
  bodyHtml += '  <label class="form-label">Name *</label>';
  bodyHtml += '  <input class="form-input" id="agentNameInput" type="text" placeholder="e.g. ResearchBot" required>';
  bodyHtml += '</div>';
  bodyHtml += '<div class="form-group" style="margin-bottom:var(--sp-4)">';
  bodyHtml += '  <label class="form-label">Capabilities</label>';
  bodyHtml += '  <input class="form-input" id="agentCapsInput" type="text" placeholder="e.g. research, analysis, writing (comma-separated)">';
  bodyHtml += '</div>';
  bodyHtml += '<div class="form-group" style="margin-bottom:var(--sp-4)">';
  bodyHtml += '  <label class="form-label">Initial Status</label>';
  bodyHtml += '  <select class="form-select" id="agentStatusInput">';
  bodyHtml += '    <option value="idle">Idle</option>';
  bodyHtml += '    <option value="active">Active</option>';
  bodyHtml += '  </select>';
  bodyHtml += '</div>';
  bodyHtml += '<div style="display:flex;gap:var(--sp-3);justify-content:flex-end">';
  bodyHtml += '  <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>';
  bodyHtml += '  <button type="submit" class="btn btn-primary">Add Subagent</button>';
  bodyHtml += '</div>';
  bodyHtml += '</form>';

  app.openModal('Add Subagent', bodyHtml);
}

function saveNewAgent(e) {
  e.preventDefault();

  var name = ($('#agentNameInput') || {}).value || '';
  var capsStr = ($('#agentCapsInput') || {}).value || '';
  var status = ($('#agentStatusInput') || {}).value || 'idle';

  if (!name.trim()) {
    showToast('Agent name is required', 'error');
    return;
  }

  var capabilities = capsStr.split(',').map(function(c) { return c.trim(); }).filter(Boolean);

  var agent = agentStore.addAgent({
    name: name.trim(),
    capabilities: capabilities,
    status: status
  });

  if (agent) {
    app.closeModal();
    showToast('Added subagent: ' + agent.name, 'success');
    renderAgentsView();
  } else {
    showToast('Failed to add agent — check console', 'error');
  }
}
