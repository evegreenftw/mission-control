/* ============================================
   Mission Control v3.0 — StatusBar
   Renders connection health indicators in the
   header. Listens to DataService status changes.
   ============================================ */

var STATUS_BAR_SOURCES = [
  { key: 'calendar', label: 'Calendar' },
  { key: 'tasks',    label: 'Tasks' },
  { key: 'spend',    label: 'Spend' },
  { key: 'agents',   label: 'Agents' },
  { key: 'brain',    label: 'Brain' }
];

/**
 * Initialize the status bar.
 * Call after DataService has initialized.
 */
function initStatusBar() {
  renderStatusBar(dataService.getSourceStatus());

  // Listen for changes
  dataService.onStatusChange(function(statuses) {
    renderStatusBar(statuses);
  });
}

/**
 * Render the status bar into the header.
 */
function renderStatusBar(statuses) {
  var container = $('#statusBar');
  if (!container) return;

  var html = STATUS_BAR_SOURCES.map(function(source) {
    var info = statuses[source.key] || { status: 'disconnected', lastUpdated: null, error: null };
    var statusClass = info.status || 'disconnected';
    var ariaLabel = source.label + ': ' + _statusLabel(statusClass);
    var tooltip = _buildTooltip(source.label, info);

    return '<div class="status-indicator" title="' + escapeHtml(tooltip) + '" ' +
           'aria-label="' + escapeHtml(ariaLabel) + '" ' +
           'data-source="' + source.key + '" ' +
           'style="cursor:pointer">' +
           '<span class="status-dot ' + statusClass + '"></span>' +
           '<span class="status-bar-label">' + escapeHtml(source.label) + '</span>' +
           '</div>';
  }).join('');

  container.innerHTML = html;

  // Bind click handlers for detail view
  $$('.status-indicator[data-source]', container).forEach(function(el) {
    el.addEventListener('click', function() {
      var key = el.getAttribute('data-source');
      _showStatusDetail(key, statuses[key]);
    });
  });
}

/**
 * Show a toast with status details when clicking a status dot.
 */
function _showStatusDetail(sourceName, info) {
  if (!info) return;
  var status = info.status || 'disconnected';
  var msg = sourceName.charAt(0).toUpperCase() + sourceName.slice(1) + ': ' + _statusLabel(status);

  if (info.lastUpdated) {
    msg += ' \u2014 Last updated: ' + formatRelativeTime(info.lastUpdated);
  }
  if (info.error) {
    msg += ' \u2014 Error: ' + info.error;
  }

  var toastType = status === 'connected' ? 'success' : (status === 'stale' ? 'warning' : 'error');
  showToast(msg, toastType);
}

function _statusLabel(status) {
  switch (status) {
    case 'connected':    return 'Connected';
    case 'stale':        return 'Stale';
    case 'disconnected': return 'Disconnected';
    case 'loading':      return 'Loading...';
    default:             return 'Unknown';
  }
}

function _buildTooltip(label, info) {
  var parts = [label + ': ' + _statusLabel(info.status || 'disconnected')];
  if (info.lastUpdated) {
    parts.push('Updated: ' + formatRelativeTime(info.lastUpdated));
  }
  if (info.error) {
    parts.push('Error: ' + info.error);
  }
  return parts.join(' | ');
}
