/* ============================================
   Mission Control v3.0 — DOM Utilities
   Helpers for DOM queries, rendering, formatting.
   ============================================ */

/**
 * Query a single element.
 */
function $(selector, parent) {
  return (parent || document).querySelector(selector);
}

/**
 * Query all matching elements (returns real Array).
 */
function $$(selector, parent) {
  return Array.from((parent || document).querySelectorAll(selector));
}

/**
 * Escape HTML to prevent XSS. Uses the DOM as a sanitizer.
 */
function escapeHtml(str) {
  if (str == null) return '';
  var div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

/**
 * Set innerHTML on a container, identified by selector or element.
 */
function renderTemplate(container, html) {
  var el = typeof container === 'string' ? $(container) : container;
  if (el) el.innerHTML = html;
}

/**
 * Show an element (remove .hidden, add .active if it's a view).
 */
function showElement(el) {
  if (!el) return;
  el.classList.remove('hidden');
}

/**
 * Hide an element (add .hidden).
 */
function hideElement(el) {
  if (!el) return;
  el.classList.add('hidden');
}

/**
 * Format a date string or Date into a readable date.
 * e.g. "Feb 18, 2026"
 */
function formatDate(date) {
  if (!date) return '—';
  var d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format a date as relative time.
 * "just now", "5m ago", "2h ago", "Yesterday", "3 days ago", or the date.
 */
function formatRelativeTime(date) {
  if (!date) return '—';
  var d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '—';

  var now = new Date();
  var diffMs = now - d;
  var diffSec = Math.floor(diffMs / 1000);
  var diffMin = Math.floor(diffSec / 60);
  var diffHr = Math.floor(diffMin / 60);
  var diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  if (diffHr < 24) return diffHr + 'h ago';
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7) return diffDay + ' days ago';
  return formatDate(d);
}

/**
 * Format a date to a relative "due date" string.
 * "Today", "Tomorrow", "in 3 days", "2 days overdue", or the date.
 */
function formatDueDate(date) {
  if (!date) return '';
  var d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';

  var now = new Date();
  var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return '1 day overdue';
  if (diffDays < -1) return Math.abs(diffDays) + ' days overdue';
  if (diffDays <= 7) return 'in ' + diffDays + ' days';
  return formatDate(d);
}

/**
 * Format a number as currency (dollars).
 * formatCurrency(4250) → "$42.50"     (if input is cents)
 * formatCurrency(42.5) → "$42.50"     (if input is dollars)
 * Pass `isCents = true` if the value is in cents.
 */
function formatCurrency(value, isCents) {
  if (value == null || isNaN(value)) return '—';
  var dollars = isCents ? value / 100 : value;
  return '$' + dollars.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Format a time from a date string.
 * e.g. "9:30 AM"
 */
function formatTime(date) {
  if (!date) return '';
  var d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Generate a simple UUID v4.
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Debounce a function.
 */
function debounce(fn, ms) {
  var timer;
  return function() {
    var args = arguments;
    var ctx = this;
    clearTimeout(timer);
    timer = setTimeout(function() {
      fn.apply(ctx, args);
    }, ms);
  };
}

/**
 * Show a toast notification.
 * type: 'success' | 'warning' | 'error'
 */
function showToast(message, type) {
  type = type || 'success';
  var container = $('.toast-container');
  if (!container) return;

  var toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease';
    setTimeout(function() {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, 3000);
}
