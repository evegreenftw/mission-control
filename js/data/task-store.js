/* ============================================
   Mission Control v3.0 — TaskStore
   Task CRUD with validation. Single source of
   truth is tasks.json; localStorage as write layer.
   ============================================ */

// Map v2 status values to v3 kanban columns
var STATUS_MAP_V2_TO_V3 = {
  'todo':        'backlog',
  'inProgress':  'in-progress',
  'completed':   'done'
};

// Map v3 kanban columns back to v2 for storage compatibility
var STATUS_MAP_V3_TO_V2 = {
  'backlog':     'todo',
  'assigned':    'todo',
  'in-progress': 'inProgress',
  'review':      'inProgress',
  'done':        'completed'
};

var KANBAN_COLUMNS = ['backlog', 'assigned', 'in-progress', 'review', 'done'];
var LS_KEY_TASKS = 'mc_v3_tasks';

class TaskStore {
  constructor() {
    this.tasks = [];
    this.loaded = false;
    this.skippedCount = 0;
  }

  /**
   * Load tasks from DataService and/or localStorage.
   * Priority: localStorage (write layer) > tasks.json (source of truth)
   */
  load() {
    this.tasks = [];
    this.skippedCount = 0;

    // Try localStorage first (user's local edits)
    var stored = this._loadFromLocalStorage();
    if (stored && stored.length > 0) {
      this.tasks = stored;
      this.loaded = true;
      this._log('loaded ' + this.tasks.length + ' tasks from localStorage (' + this.skippedCount + ' invalid skipped)');
      return;
    }

    // Fall back to dataService
    var raw = dataService.getData('tasks');
    if (raw && raw.tasks && Array.isArray(raw.tasks)) {
      this._ingestTasks(raw.tasks);
      this.loaded = true;
      this._log('loaded ' + this.tasks.length + ' tasks from tasks.json (' + this.skippedCount + ' invalid skipped)');
    } else {
      this.loaded = true;
      this._log('no task data available — empty state');
    }
  }

  /**
   * Get all tasks (as v3 format).
   */
  getTasks() {
    return this.tasks.slice();
  }

  /**
   * Get tasks filtered by kanban column status.
   */
  getTasksByStatus(status) {
    return this.tasks.filter(function(t) { return t.status === status; });
  }

  /**
   * Get tasks due on a specific date (YYYY-MM-DD string).
   */
  getTasksDueOn(dateStr) {
    return this.tasks.filter(function(t) {
      if (!t.dueDate) return false;
      return t.dueDate.substring(0, 10) === dateStr;
    });
  }

  /**
   * Get a single task by ID.
   */
  getTask(id) {
    return this.tasks.find(function(t) { return t.id === id; }) || null;
  }

  /**
   * Add a new task.
   */
  addTask(taskData) {
    var now = new Date().toISOString();
    var task = {
      id: generateId(),
      title: (taskData.title || '').trim(),
      description: taskData.description || '',
      status: taskData.status || 'backlog',
      priority: taskData.priority || 'medium',
      assignee: taskData.assignee || 'eve',
      category: taskData.category || '',
      dueDate: taskData.dueDate || null,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };

    var result = validateTask(task);
    if (!result.valid) {
      this._log('addTask rejected: ' + result.errors.join(', '));
      return null;
    }

    this.tasks.push(task);
    this._persist();
    this._log('added task: ' + task.title);
    return task;
  }

  /**
   * Update an existing task.
   */
  updateTask(id, updates) {
    var idx = this.tasks.findIndex(function(t) { return t.id === id; });
    if (idx === -1) {
      this._log('updateTask: task not found: ' + id);
      return null;
    }

    var task = Object.assign({}, this.tasks[idx], updates);
    task.updatedAt = new Date().toISOString();

    // If moved to 'done', set completedAt
    if (updates.status === 'done' && !task.completedAt) {
      task.completedAt = task.updatedAt;
    }
    // If moved away from 'done', clear completedAt
    if (updates.status && updates.status !== 'done') {
      task.completedAt = null;
    }

    var result = validateTask(task);
    if (!result.valid) {
      this._log('updateTask rejected: ' + result.errors.join(', '));
      return null;
    }

    this.tasks[idx] = task;
    this._persist();
    this._log('updated task: ' + task.title + ' → status:' + task.status);
    return task;
  }

  /**
   * Delete a task by ID.
   */
  deleteTask(id) {
    var idx = this.tasks.findIndex(function(t) { return t.id === id; });
    if (idx === -1) return false;

    var removed = this.tasks.splice(idx, 1)[0];
    this._persist();
    this._log('deleted task: ' + removed.title);
    return true;
  }

  /**
   * Get all unique categories from current tasks.
   */
  getCategories() {
    var cats = {};
    this.tasks.forEach(function(t) {
      if (t.category) cats[t.category] = true;
    });
    return Object.keys(cats).sort();
  }

  /**
   * Get count of active (non-done) tasks.
   */
  getActiveCount() {
    return this.tasks.filter(function(t) { return t.status !== 'done'; }).length;
  }

  /**
   * Get count of critical priority tasks that are active.
   */
  getCriticalCount() {
    return this.tasks.filter(function(t) {
      return t.status !== 'done' && t.priority === 'critical';
    }).length;
  }

  /**
   * Get the N most recently updated tasks.
   */
  getRecent(n) {
    return this.tasks.slice().sort(function(a, b) {
      return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
    }).slice(0, n || 5);
  }

  /* ---- Internal ---- */

  /**
   * Ingest raw tasks (from tasks.json), normalize to v3 format, validate.
   */
  _ingestTasks(rawTasks) {
    var self = this;
    rawTasks.forEach(function(raw) {
      var task = self._normalizeTask(raw);
      var result = validateTask(task);
      if (result.valid) {
        self.tasks.push(task);
      } else {
        self.skippedCount++;
        self._log('skipped invalid task id=' + raw.id + ': ' + result.errors.join(', '));
      }
    });
  }

  /**
   * Normalize a task from v2 format to v3 format.
   */
  _normalizeTask(raw) {
    // Map status
    var status = raw.status;
    if (STATUS_MAP_V2_TO_V3[status]) {
      status = STATUS_MAP_V2_TO_V3[status];
    }
    // If completed boolean is true but status wasn't mapped
    if (raw.completed === true && status !== 'done') {
      status = 'done';
    }

    return {
      id: String(raw.id),
      title: raw.title || '',
      description: raw.description || '',
      status: status || 'backlog',
      priority: raw.priority || 'medium',
      assignee: (raw.assignee || raw.assignedTo || '').toLowerCase() || 'eve',
      category: raw.category || '',
      dueDate: raw.dueDate || null,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      completedAt: raw.completedAt || null
    };
  }

  /**
   * Load from localStorage, validate each task.
   */
  _loadFromLocalStorage() {
    try {
      var json = localStorage.getItem(LS_KEY_TASKS);
      if (!json) return null;
      var arr = JSON.parse(json);
      if (!Array.isArray(arr) || arr.length === 0) return null;

      var valid = [];
      var self = this;
      arr.forEach(function(task) {
        var result = validateTask(task);
        if (result.valid) {
          valid.push(task);
        } else {
          self.skippedCount++;
          self._log('localStorage: skipped invalid task id=' + task.id);
        }
      });

      return valid.length > 0 ? valid : null;
    } catch (e) {
      this._log('localStorage parse error, discarding: ' + e.message);
      localStorage.removeItem(LS_KEY_TASKS);
      return null;
    }
  }

  /**
   * Persist current tasks to localStorage.
   */
  _persist() {
    try {
      localStorage.setItem(LS_KEY_TASKS, JSON.stringify(this.tasks));
    } catch (e) {
      this._log('persist failed: ' + e.message);
    }
  }

  _log(msg) {
    var ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log('[' + ts + '] TaskStore: ' + msg);
  }
}

// Global instance
var taskStore = new TaskStore();
