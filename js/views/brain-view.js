/* ============================================
   Mission Control v3.0 — Second Brain View
   Search interface with debounce, grouped results,
   connection status banner.
   ============================================ */

var brainState = {
  query: '',
  results: null,    // null = no search yet, [] = search returned empty
  error: null,
  searching: false
};

var _brainSearchTimeout = null;

/**
 * Render the Brain view. Called by app.switchView().
 */
function renderBrainView() {
  var container = $('#brainView');
  if (!container) return;

  var html = '';

  // Connection status banner
  html += _renderBrainStatusBanner();

  // Search input
  html += _renderBrainSearchBar();

  // Results area
  html += _renderBrainResults();

  container.innerHTML = html;

  // Restore query value in search input
  var input = $('#brainSearchInput');
  if (input && brainState.query) {
    input.value = brainState.query;
  }
}

/* ---- Status Banner ---- */

function _renderBrainStatusBanner() {
  var status = brainStore.getStatus();

  if (status === 'connected') {
    return '<div class="brain-status-banner brain-status-online">' +
      '<span class="brain-status-dot online"></span>' +
      '<span>Second Brain Online</span>' +
      '</div>';
  }

  if (status === 'loading') {
    return '<div class="brain-status-banner brain-status-checking">' +
      '<span>Checking connection to Second Brain API...</span>' +
      '</div>';
  }

  // Disconnected
  return '<div class="brain-status-banner brain-status-offline">' +
    '<div class="brain-status-offline-text">' +
    '<span class="brain-status-dot offline"></span>' +
    '<span>Second Brain Offline \u2014 semantic search unavailable. Check if the API is running on port 3001.</span>' +
    '</div>' +
    '<button class="btn btn-danger btn-sm" onclick="retryBrainConnection()">Retry Connection</button>' +
    '</div>';
}

/* ---- Search Bar ---- */

function _renderBrainSearchBar() {
  var isOffline = brainStore.getStatus() === 'disconnected';

  var html = '<div class="brain-search-bar">';
  html += '<div class="brain-search-input-wrap">';
  html += '<input class="brain-search-input" id="brainSearchInput" type="text"';
  html += ' placeholder="Search your Second Brain..."';
  html += ' oninput="onBrainSearchInput(this.value)"';
  html += ' onkeydown="if(event.key===\'Enter\'){event.preventDefault();executeBrainSearch();}"';
  if (isOffline) {
    html += ' disabled';
  }
  html += '>';
  html += '<button class="brain-search-btn" onclick="executeBrainSearch()"';
  if (isOffline) html += ' disabled';
  html += '>Search</button>';
  html += '</div>';

  if (!isOffline && !brainState.query && brainState.results === null) {
    html += '<div class="brain-search-hint">Search your tasks, insights, articles, and conversations</div>';
  }

  html += '</div>';
  return html;
}

/* ---- Results ---- */

function _renderBrainResults() {
  // Searching state
  if (brainState.searching) {
    return '<div class="brain-searching">' +
      '<div class="brain-searching-spinner"></div>' +
      '<span>Searching...</span>' +
      '</div>';
  }

  // Error state
  if (brainState.error) {
    return '<div class="brain-error">' + escapeHtml(brainState.error) + '</div>';
  }

  // No search performed yet
  if (brainState.results === null) {
    return '';
  }

  // No results
  if (brainState.results.length === 0) {
    return '<div class="brain-no-results">' +
      'No results found for \u201C' + escapeHtml(brainState.query) + '\u201D. Try a different search term.' +
      '</div>';
  }

  // Group results by type
  var groups = {};
  brainState.results.forEach(function(r) {
    var type = r.type || 'Other';
    if (!groups[type]) groups[type] = [];
    groups[type].push(r);
  });

  var html = '<div class="brain-results-header">Showing ' + brainState.results.length + ' results for \u201C' + escapeHtml(brainState.query) + '\u201D</div>';
  html += '<div class="brain-results">';

  Object.keys(groups).forEach(function(type) {
    html += '<div class="brain-results-group">';
    html += '<div class="brain-group-title">' + escapeHtml(_formatBrainType(type)) + ' (' + groups[type].length + ')</div>';

    groups[type].forEach(function(result) {
      html += _renderBrainResultCard(result);
    });

    html += '</div>';
  });

  html += '</div>';
  return html;
}

function _renderBrainResultCard(result) {
  var content = result.content || '';
  var preview = content.length > 150 ? content.substring(0, 150) + '...' : content;
  var similarity = result.similarity;

  var html = '<div class="brain-result-card" onclick="toggleBrainResultExpand(this)">';

  // Header
  html += '<div class="brain-result-header">';
  html += '<span class="brain-result-type-badge">' + escapeHtml(result.type || 'Other') + '</span>';
  html += '<span class="brain-result-title">' + escapeHtml(result.title || 'Untitled') + '</span>';
  html += '</div>';

  // Preview
  html += '<div class="brain-result-preview">' + escapeHtml(preview) + '</div>';

  // Relevance bar
  if (typeof similarity === 'number') {
    var pct = Math.round(similarity * 100);
    html += '<div class="brain-result-relevance">';
    html += '<div class="brain-relevance-bar"><div class="brain-relevance-fill" style="width:' + pct + '%"></div></div>';
    html += '<span class="brain-relevance-label">' + pct + '% relevant</span>';
    html += '</div>';
  }

  // Full content (hidden by default)
  if (content.length > 150) {
    html += '<div class="brain-result-full" style="display:none">' + escapeHtml(content) + '</div>';
  }

  // Metadata
  if (result.metadata) {
    var meta = result.metadata;
    var metaParts = [];
    if (meta.source) metaParts.push(meta.source);
    if (meta.date) metaParts.push(meta.date);
    if (metaParts.length > 0) {
      html += '<div class="brain-result-meta">' + escapeHtml(metaParts.join(' \u2022 ')) + '</div>';
    }
  }

  html += '</div>';
  return html;
}

/* ---- Actions ---- */

function onBrainSearchInput(value) {
  brainState.query = value;

  // Debounce 300ms
  if (_brainSearchTimeout) clearTimeout(_brainSearchTimeout);
  if (value.trim().length > 0) {
    _brainSearchTimeout = setTimeout(function() {
      executeBrainSearch();
    }, 300);
  }
}

async function executeBrainSearch() {
  var query = brainState.query.trim();
  if (!query) return;

  brainState.searching = true;
  brainState.error = null;
  renderBrainView();

  var result = await brainStore.search(query);

  brainState.searching = false;
  brainState.results = result.results;
  brainState.error = result.error;
  renderBrainView();
}

async function retryBrainConnection() {
  showToast('Retrying Second Brain connection...', 'success');
  var online = await brainStore.retryConnection();
  if (online) {
    showToast('Second Brain is online!', 'success');
  } else {
    showToast('Second Brain is still offline', 'error');
  }
  renderBrainView();
}

function toggleBrainResultExpand(cardEl) {
  var fullEl = cardEl.querySelector('.brain-result-full');
  var previewEl = cardEl.querySelector('.brain-result-preview');
  if (!fullEl) return;

  var isExpanded = fullEl.style.display !== 'none';
  fullEl.style.display = isExpanded ? 'none' : 'block';
  if (previewEl) previewEl.style.display = isExpanded ? 'block' : 'none';
}

/* ---- Helpers ---- */

function _formatBrainType(type) {
  var typeMap = {
    task: 'Tasks',
    insight: 'Insights',
    article: 'News Articles',
    idea: 'Ideas',
    conversation: 'Conversations',
    note: 'Notes'
  };
  return typeMap[type.toLowerCase()] || type;
}
