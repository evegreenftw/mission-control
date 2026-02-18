/* ============================================
   Mission Control v3.0 — Kanban View
   Board rendering, drag-drop, filters, task modal.
   ============================================ */

var KANBAN_COLUMNS_DEF = [
  { id: 'backlog',     label: 'Backlog' },
  { id: 'assigned',    label: 'Assigned' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'review',      label: 'Review' },
  { id: 'done',        label: 'Done' }
];

var kanbanFilters = {
  assignees: [],   // active assignee filters
  priorities: [],  // active priority filters
  category: ''     // active category filter
};

/**
 * Render the Kanban view. Called by app.switchView().
 */
function renderKanbanView() {
  var container = $('#kanbanView');
  if (!container) return;

  // Check if taskStore is loaded
  if (!taskStore.loaded) {
    container.innerHTML = _kanbanLoadingState();
    return;
  }

  var allTasks = taskStore.getTasks();

  // Fully empty — no tasks at all
  if (allTasks.length === 0) {
    container.innerHTML = _kanbanEmptyState();
    return;
  }

  // Apply filters
  var filtered = _applyKanbanFilters(allTasks);

  // Build the view
  var html = '';

  // Header
  html += '<div class="kanban-header">';
  html += '  <div class="kanban-header-left">';
  html += '    <span class="kanban-task-count">' + filtered.length + ' of ' + allTasks.length + ' tasks</span>';
  html += '  </div>';
  html += '  <button class="btn btn-primary btn-sm" onclick="openTaskModal()">';
  html += '    + Add Task';
  html += '  </button>';
  html += '</div>';

  // Filters
  html += _renderKanbanFilters(allTasks);

  // Board
  html += '<div class="kanban-board">';
  KANBAN_COLUMNS_DEF.forEach(function(col) {
    var colTasks = filtered.filter(function(t) { return t.status === col.id; });
    html += _renderKanbanColumn(col, colTasks);
  });
  html += '</div>';

  container.innerHTML = html;

  // Bind drag-and-drop after render
  _bindKanbanDragDrop();
}

/* ---- Column Rendering ---- */

function _renderKanbanColumn(col, tasks) {
  var html = '<div class="kanban-column" data-column="' + col.id + '">';
  html += '  <div class="kanban-column-header">';
  html += '    <span class="kanban-column-title">' + escapeHtml(col.label) + '</span>';
  html += '    <span class="kanban-column-count">' + tasks.length + '</span>';
  html += '  </div>';
  html += '  <div class="kanban-column-body" data-column="' + col.id + '">';

  if (tasks.length === 0) {
    html += '<div class="kanban-column-empty">No tasks</div>';
  } else {
    tasks.forEach(function(task) {
      html += _renderKanbanCard(task);
    });
  }

  html += '  </div>';
  html += '</div>';
  return html;
}

function _renderKanbanCard(task) {
  var assigneeClass = 'other';
  var assigneeLabel = escapeHtml(task.assignee || '');
  if (task.assignee === 'eve') { assigneeClass = 'eve'; assigneeLabel = 'Eve'; }
  else if (task.assignee === 'openclaw') { assigneeClass = 'openclaw'; assigneeLabel = 'OpenClaw'; }
  else if (assigneeLabel) { assigneeLabel = assigneeLabel.charAt(0).toUpperCase() + assigneeLabel.slice(1); }

  var dueDateHtml = '';
  if (task.dueDate) {
    var dueStr = formatDueDate(task.dueDate);
    var isOverdue = dueStr.indexOf('overdue') !== -1;
    dueDateHtml = '<span class="kanban-card-due' + (isOverdue ? ' overdue' : '') + '">' + escapeHtml(dueStr) + '</span>';
  }

  var html = '<div class="kanban-card" draggable="true" data-task-id="' + escapeHtml(task.id) + '" onclick="openTaskModal(\'' + escapeHtml(task.id) + '\')">';
  html += '  <div class="kanban-card-title">' + escapeHtml(task.title) + '</div>';
  html += '  <div class="kanban-card-meta">';
  html += '    <span class="kanban-card-priority ' + (task.priority || 'medium') + '" title="' + escapeHtml(task.priority || 'medium') + '"></span>';
  if (assigneeLabel) {
    html += '    <span class="kanban-card-assignee ' + assigneeClass + '">' + assigneeLabel + '</span>';
  }
  html += dueDateHtml;
  html += '  </div>';
  html += '</div>';
  return html;
}

/* ---- Filters ---- */

function _renderKanbanFilters(allTasks) {
  // Collect unique assignees and priorities
  var assignees = {};
  var priorities = {};
  var categories = {};
  allTasks.forEach(function(t) {
    if (t.assignee) assignees[t.assignee] = true;
    if (t.priority) priorities[t.priority] = true;
    if (t.category) categories[t.category] = true;
  });

  var html = '<div class="kanban-filters">';

  // Assignee chips
  html += '<div class="kanban-filter-group">';
  html += '<span class="kanban-filter-label">Assignee</span>';
  Object.keys(assignees).sort().forEach(function(a) {
    var label = a === 'eve' ? 'Eve' : (a === 'openclaw' ? 'OpenClaw' : a);
    var isActive = kanbanFilters.assignees.indexOf(a) !== -1;
    html += '<span class="filter-chip' + (isActive ? ' active' : '') + '" onclick="toggleKanbanFilter(\'assignee\', \'' + escapeHtml(a) + '\')">';
    html += escapeHtml(label);
    if (isActive) html += ' <span class="chip-remove">\u00d7</span>';
    html += '</span>';
  });
  html += '</div>';

  // Priority chips
  html += '<div class="kanban-filter-group">';
  html += '<span class="kanban-filter-label">Priority</span>';
  ['critical', 'high', 'medium', 'low'].forEach(function(p) {
    if (!priorities[p]) return;
    var isActive = kanbanFilters.priorities.indexOf(p) !== -1;
    html += '<span class="filter-chip' + (isActive ? ' active' : '') + '" onclick="toggleKanbanFilter(\'priority\', \'' + p + '\')">';
    html += escapeHtml(p.charAt(0).toUpperCase() + p.slice(1));
    if (isActive) html += ' <span class="chip-remove">\u00d7</span>';
    html += '</span>';
  });
  html += '</div>';

  // Category dropdown
  var catKeys = Object.keys(categories).sort();
  if (catKeys.length > 0) {
    html += '<div class="kanban-filter-group">';
    html += '<span class="kanban-filter-label">Category</span>';
    html += '<select class="form-select" style="width:auto;padding:2px 28px 2px 8px;font-size:var(--text-xs);" onchange="setKanbanCategoryFilter(this.value)">';
    html += '<option value="">All</option>';
    catKeys.forEach(function(c) {
      var selected = kanbanFilters.category === c ? ' selected' : '';
      html += '<option value="' + escapeHtml(c) + '"' + selected + '>' + escapeHtml(c) + '</option>';
    });
    html += '</select>';
    html += '</div>';
  }

  // Clear filters
  var hasFilters = kanbanFilters.assignees.length > 0 || kanbanFilters.priorities.length > 0 || kanbanFilters.category;
  if (hasFilters) {
    html += '<button class="btn btn-ghost btn-sm" onclick="clearKanbanFilters()">Clear filters</button>';
  }

  html += '</div>';
  return html;
}

function toggleKanbanFilter(type, value) {
  if (type === 'assignee') {
    var idx = kanbanFilters.assignees.indexOf(value);
    if (idx === -1) kanbanFilters.assignees.push(value);
    else kanbanFilters.assignees.splice(idx, 1);
  } else if (type === 'priority') {
    var idx2 = kanbanFilters.priorities.indexOf(value);
    if (idx2 === -1) kanbanFilters.priorities.push(value);
    else kanbanFilters.priorities.splice(idx2, 1);
  }
  renderKanbanView();
}

function setKanbanCategoryFilter(value) {
  kanbanFilters.category = value;
  renderKanbanView();
}

function clearKanbanFilters() {
  kanbanFilters.assignees = [];
  kanbanFilters.priorities = [];
  kanbanFilters.category = '';
  renderKanbanView();
}

function _applyKanbanFilters(tasks) {
  return tasks.filter(function(t) {
    if (kanbanFilters.assignees.length > 0 && kanbanFilters.assignees.indexOf(t.assignee) === -1) return false;
    if (kanbanFilters.priorities.length > 0 && kanbanFilters.priorities.indexOf(t.priority) === -1) return false;
    if (kanbanFilters.category && t.category !== kanbanFilters.category) return false;
    return true;
  });
}

/* ---- Drag and Drop ---- */

function _bindKanbanDragDrop() {
  var cards = $$('.kanban-card[draggable]');
  var dropZones = $$('.kanban-column-body');

  cards.forEach(function(card) {
    card.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('text/plain', card.getAttribute('data-task-id'));
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
      // Store source column
      var sourceCol = card.closest('.kanban-column-body');
      if (sourceCol) card.setAttribute('data-source-column', sourceCol.getAttribute('data-column'));
    });

    card.addEventListener('dragend', function() {
      card.classList.remove('dragging');
      // Clean up all drag-over highlights
      dropZones.forEach(function(z) { z.classList.remove('drag-over'); });
    });
  });

  dropZones.forEach(function(zone) {
    zone.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', function(e) {
      // Only remove if leaving the zone itself (not entering a child)
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('drag-over');
      }
    });

    zone.addEventListener('drop', function(e) {
      e.preventDefault();
      zone.classList.remove('drag-over');

      var taskId = e.dataTransfer.getData('text/plain');
      var newStatus = zone.getAttribute('data-column');

      // Find the dragged card's source column
      var draggedCard = $('.kanban-card[data-task-id="' + taskId + '"]');
      var sourceColumn = draggedCard ? draggedCard.getAttribute('data-source-column') : null;

      // No-op if same column
      if (sourceColumn === newStatus) return;

      // Update task status
      var updated = taskStore.updateTask(taskId, { status: newStatus });
      if (updated) {
        renderKanbanView();
        showToast('Task moved to ' + newStatus.replace('-', ' '), 'success');
      }
    });
  });
}

/* ---- Task Modal ---- */

function openTaskModal(taskId) {
  var task = null;
  var isEdit = false;

  if (taskId) {
    task = taskStore.getTask(taskId);
    if (!task) return;
    isEdit = true;
  }

  var assigneeOptions = agentStore.getAssigneeOptions();
  var categories = taskStore.getCategories();

  var bodyHtml = '<form id="taskForm" onsubmit="saveTaskFromModal(event)">';

  // Title
  bodyHtml += '<div class="form-group">';
  bodyHtml += '  <label class="form-label">Title *</label>';
  bodyHtml += '  <input class="form-input" id="taskTitle" type="text" value="' + escapeHtml(task ? task.title : '') + '" placeholder="Task title" required>';
  bodyHtml += '  <div class="form-error" id="taskTitleError"></div>';
  bodyHtml += '</div>';

  // Description
  bodyHtml += '<div class="form-group">';
  bodyHtml += '  <label class="form-label">Description</label>';
  bodyHtml += '  <textarea class="form-textarea" id="taskDesc" placeholder="Optional description">' + escapeHtml(task ? task.description : '') + '</textarea>';
  bodyHtml += '</div>';

  // Status + Priority row
  bodyHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4)">';

  bodyHtml += '<div class="form-group">';
  bodyHtml += '  <label class="form-label">Status</label>';
  bodyHtml += '  <select class="form-select" id="taskStatus">';
  KANBAN_COLUMNS_DEF.forEach(function(col) {
    var selected = (task && task.status === col.id) ? ' selected' : (!task && col.id === 'backlog' ? ' selected' : '');
    bodyHtml += '    <option value="' + col.id + '"' + selected + '>' + escapeHtml(col.label) + '</option>';
  });
  bodyHtml += '  </select>';
  bodyHtml += '</div>';

  bodyHtml += '<div class="form-group">';
  bodyHtml += '  <label class="form-label">Priority</label>';
  bodyHtml += '  <select class="form-select" id="taskPriority">';
  ['critical', 'high', 'medium', 'low'].forEach(function(p) {
    var selected = (task && task.priority === p) ? ' selected' : (!task && p === 'medium' ? ' selected' : '');
    bodyHtml += '    <option value="' + p + '"' + selected + '>' + p.charAt(0).toUpperCase() + p.slice(1) + '</option>';
  });
  bodyHtml += '  </select>';
  bodyHtml += '</div>';

  bodyHtml += '</div>';

  // Assignee + Category row
  bodyHtml += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4)">';

  bodyHtml += '<div class="form-group">';
  bodyHtml += '  <label class="form-label">Assignee</label>';
  bodyHtml += '  <select class="form-select" id="taskAssignee">';
  assigneeOptions.forEach(function(opt) {
    var selected = (task && task.assignee === opt.value) ? ' selected' : '';
    bodyHtml += '    <option value="' + escapeHtml(opt.value) + '"' + selected + '>' + escapeHtml(opt.label) + '</option>';
  });
  bodyHtml += '  </select>';
  bodyHtml += '</div>';

  bodyHtml += '<div class="form-group">';
  bodyHtml += '  <label class="form-label">Category</label>';
  bodyHtml += '  <input class="form-input" id="taskCategory" list="categoryList" value="' + escapeHtml(task ? task.category : '') + '" placeholder="e.g. development">';
  bodyHtml += '  <datalist id="categoryList">';
  categories.forEach(function(c) {
    bodyHtml += '    <option value="' + escapeHtml(c) + '">';
  });
  bodyHtml += '  </datalist>';
  bodyHtml += '</div>';

  bodyHtml += '</div>';

  // Due Date
  bodyHtml += '<div class="form-group">';
  bodyHtml += '  <label class="form-label">Due Date</label>';
  bodyHtml += '  <input class="form-input" id="taskDueDate" type="date" value="' + escapeHtml(task && task.dueDate ? task.dueDate.substring(0, 10) : '') + '">';
  bodyHtml += '</div>';

  // Hidden task ID for edits
  if (isEdit) {
    bodyHtml += '<input type="hidden" id="taskEditId" value="' + escapeHtml(task.id) + '">';
  }

  bodyHtml += '</form>';

  // Footer with buttons
  var footerHtml = '';
  if (isEdit) {
    footerHtml += '<button class="btn btn-danger btn-sm" onclick="deleteTaskFromModal(\'' + escapeHtml(task.id) + '\')">Delete</button>';
    footerHtml += '<div style="flex:1"></div>';
  }
  footerHtml += '<button class="btn btn-secondary btn-sm" onclick="app.closeModal()">Cancel</button>';
  footerHtml += '<button class="btn btn-primary btn-sm" onclick="saveTaskFromModal(event)">Save</button>';

  app.openModal(isEdit ? 'Edit Task' : 'New Task', bodyHtml, footerHtml);

  // Focus title input
  setTimeout(function() {
    var titleInput = $('#taskTitle');
    if (titleInput) titleInput.focus();
  }, 100);
}

function saveTaskFromModal(e) {
  if (e) e.preventDefault();

  var title = ($('#taskTitle') || {}).value || '';
  if (!title.trim()) {
    var err = $('#taskTitleError');
    if (err) err.textContent = 'Title is required';
    var input = $('#taskTitle');
    if (input) input.classList.add('error');
    return;
  }

  var data = {
    title: title.trim(),
    description: ($('#taskDesc') || {}).value || '',
    status: ($('#taskStatus') || {}).value || 'backlog',
    priority: ($('#taskPriority') || {}).value || 'medium',
    assignee: ($('#taskAssignee') || {}).value || 'eve',
    category: ($('#taskCategory') || {}).value || '',
    dueDate: ($('#taskDueDate') || {}).value || null
  };

  var editId = $('#taskEditId');
  if (editId && editId.value) {
    taskStore.updateTask(editId.value, data);
    showToast('Task updated', 'success');
  } else {
    taskStore.addTask(data);
    showToast('Task created', 'success');
  }

  app.closeModal();
  renderKanbanView();

  // Also re-render dashboard if it has been rendered
  if (typeof renderDashboardView === 'function' && app.currentView === 'dashboard') {
    renderDashboardView();
  }
}

function deleteTaskFromModal(taskId) {
  if (!confirm('Delete this task? This cannot be undone.')) return;

  taskStore.deleteTask(taskId);
  showToast('Task deleted', 'success');
  app.closeModal();
  renderKanbanView();
}

/* ---- States ---- */

function _kanbanLoadingState() {
  var html = '<div class="kanban-header"><div class="kanban-header-left"><span class="kanban-task-count">Loading...</span></div></div>';
  html += '<div class="kanban-board">';
  KANBAN_COLUMNS_DEF.forEach(function(col) {
    html += '<div class="kanban-column">';
    html += '  <div class="kanban-column-header">';
    html += '    <span class="kanban-column-title">' + escapeHtml(col.label) + '</span>';
    html += '    <span class="kanban-column-count">\u2014</span>';
    html += '  </div>';
    html += '  <div class="kanban-column-body">';
    for (var i = 0; i < 3; i++) {
      html += '    <div class="loading-skeleton kanban-skeleton-card"></div>';
    }
    html += '  </div>';
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function _kanbanEmptyState() {
  return '<div class="empty-state">' +
    '<div class="empty-state-icon">&#9783;</div>' +
    '<div class="empty-state-title">No tasks yet</div>' +
    '<div class="empty-state-message">Create your first task to get started.</div>' +
    '<button class="btn btn-primary" onclick="openTaskModal()" style="margin-top:var(--sp-4)">+ Add Task</button>' +
    '</div>';
}
