/* ============================================
   Mission Control v3.0 — Validators
   Schema validation for all data types.
   Every validator returns { valid: boolean, errors: string[] }
   ============================================ */

var TASK_STATUSES = ['backlog', 'assigned', 'in-progress', 'review', 'done', 'todo', 'inProgress', 'completed'];
var TASK_PRIORITIES = ['critical', 'high', 'medium', 'low'];

/**
 * Validate a task object.
 * Accepts both v2 format (todo/inProgress/completed) and v3 format (backlog/assigned/in-progress/review/done).
 */
function validateTask(obj) {
  var errors = [];
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Not an object'] };

  if (!obj.id && obj.id !== 0) errors.push('Missing id');
  if (!obj.title || typeof obj.title !== 'string' || obj.title.trim() === '') errors.push('Missing or empty title');
  if (obj.priority && TASK_PRIORITIES.indexOf(obj.priority) === -1) errors.push('Invalid priority: ' + obj.priority);
  if (obj.status && TASK_STATUSES.indexOf(obj.status) === -1) errors.push('Invalid status: ' + obj.status);
  if (obj.dueDate && obj.dueDate !== '' && isNaN(new Date(obj.dueDate).getTime())) errors.push('Invalid dueDate: ' + obj.dueDate);
  if (obj.createdAt && isNaN(new Date(obj.createdAt).getTime())) errors.push('Invalid createdAt: ' + obj.createdAt);

  return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate a calendar event object.
 * Matches the actual mc-data.json calendar event shape.
 */
function validateCalendarEvent(obj) {
  var errors = [];
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Not an object'] };

  // Accept both 'summary' (actual) and 'title' (plan) field names
  var title = obj.summary || obj.title;
  if (!title || typeof title !== 'string') errors.push('Missing summary/title');
  if (!obj.start) errors.push('Missing start');
  else if (isNaN(new Date(obj.start).getTime())) errors.push('Invalid start: ' + obj.start);
  if (!obj.end) errors.push('Missing end');
  else if (isNaN(new Date(obj.end).getTime())) errors.push('Invalid end: ' + obj.end);

  return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate a spend day entry from model-usage-history.json.
 * Shape: { "model-name": { count: number, cost: number }, ... }
 * Each model entry must have numeric count and cost.
 */
function validateSpendDayEntry(dateKey, dayData) {
  var errors = [];
  if (!dayData || typeof dayData !== 'object') return { valid: false, errors: ['Not an object for ' + dateKey] };
  if (!dateKey || isNaN(new Date(dateKey).getTime())) errors.push('Invalid date key: ' + dateKey);

  var models = Object.keys(dayData);
  if (models.length === 0) errors.push('No model data for ' + dateKey);

  models.forEach(function(model) {
    var entry = dayData[model];
    if (!entry || typeof entry !== 'object') {
      errors.push(dateKey + '.' + model + ': not an object');
      return;
    }
    if (typeof entry.count !== 'number' || isNaN(entry.count)) {
      errors.push(dateKey + '.' + model + ': invalid count');
    }
    if (typeof entry.cost !== 'number' || isNaN(entry.cost)) {
      errors.push(dateKey + '.' + model + ': invalid cost');
    }
  });

  return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate the top-level model-usage-history.json structure.
 */
function validateSpendData(obj) {
  var errors = [];
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Not an object'] };
  if (!obj.allTime || typeof obj.allTime !== 'object') errors.push('Missing allTime');
  if (!obj.byDay || typeof obj.byDay !== 'object') errors.push('Missing byDay');
  if (typeof obj.totalCost !== 'number' || isNaN(obj.totalCost)) errors.push('Missing or invalid totalCost');

  return { valid: errors.length === 0, errors: errors };
}

/**
 * Validate an agent object.
 */
function validateAgent(obj) {
  var errors = [];
  if (!obj || typeof obj !== 'object') return { valid: false, errors: ['Not an object'] };

  if (!obj.id && obj.id !== 0) errors.push('Missing id');
  if (!obj.name || typeof obj.name !== 'string' || obj.name.trim() === '') errors.push('Missing or empty name');
  if (obj.type && ['primary', 'subagent'].indexOf(obj.type) === -1) errors.push('Invalid type: ' + obj.type);
  if (obj.status && ['active', 'idle', 'error'].indexOf(obj.status) === -1) errors.push('Invalid status: ' + obj.status);

  return { valid: errors.length === 0, errors: errors };
}
