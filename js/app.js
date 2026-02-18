/* ============================================
   Mission Control v3.0 — App Shell
   Routing, navigation, initialization.
   ============================================ */

// SHA-256 hash of the password, pre-computed.
// "EVE2026" → this hash. Verified client-side.
var PASSWORD_HASH = 'e648cca9be32b9e2d8c43e4f185f8cc97a4a2ee102fd1f1ed390cec03f39d621';

var VIEWS = [
  { id: 'dashboard',  label: 'Dashboard',     icon: '\u25A3' },
  { id: 'kanban',     label: 'Kanban',         icon: '\u2637' },
  { id: 'calendar',   label: 'Calendar',       icon: '\u25CB' },
  { id: 'spend',      label: 'Spend',          icon: '\u25B3' },
  { id: 'agents',     label: 'Agents',         icon: '\u2B23' },
  { id: 'brain',      label: 'Second Brain',   icon: '\u29BE' }
];

var VIEW_TITLES = {
  dashboard: 'Dashboard',
  kanban:    'Kanban Board',
  calendar:  'Calendar',
  spend:     'Spend Analytics',
  agents:    'Agent Infrastructure',
  brain:     'Second Brain'
};

class MissionControl {
  constructor() {
    this.currentView = 'dashboard';
    this.refreshInterval = null;
    this.authenticated = false;
  }

  /* ---- Initialization ---- */

  init() {
    this.bindPasswordGate();
    this.checkStoredAuth();
  }

  checkStoredAuth() {
    // If previously authenticated in this session, skip password
    if (sessionStorage.getItem('mc_auth') === 'true') {
      this.onAuthenticated();
    }
  }

  bindPasswordGate() {
    var self = this;
    var overlay = $('.password-overlay');
    var input = $('#passwordInput');
    var errorEl = $('.password-error');

    if (!input || !overlay) return;

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        self.verifyPassword(input.value, errorEl, overlay);
      }
      // Clear error on typing
      if (errorEl) errorEl.textContent = '';
      input.classList.remove('error');
    });

    // Auto-focus password input
    input.focus();
  }

  async verifyPassword(value, errorEl, overlay) {
    var hash = await this.hashString(value);

    if (hash === PASSWORD_HASH) {
      sessionStorage.setItem('mc_auth', 'true');
      overlay.classList.add('hidden');
      this.onAuthenticated();
    } else {
      if (errorEl) errorEl.textContent = 'Incorrect password';
      var input = $('#passwordInput');
      if (input) {
        input.classList.add('error');
        input.value = '';
        input.focus();
      }
    }
  }

  async hashString(str) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    var buffer = await crypto.subtle.digest('SHA-256', data);
    var array = Array.from(new Uint8Array(buffer));
    return array.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  onAuthenticated() {
    this.authenticated = true;
    var shell = $('.app-shell');
    if (shell) shell.classList.add('authenticated');

    this.bindNavigation();
    this.bindKeyboardShortcuts();
    this.bindModalClose();
    this.bindHamburger();
    this.switchView('dashboard');
    this.updateTimestamp();
    this.startAutoRefresh();
    this.loadData();

    console.log('[' + this.timestamp() + '] MissionControl: initialized');
  }

  /**
   * Load all data via DataService, then populate stores and status bar.
   */
  async loadData() {
    try {
      await dataService.init();
      taskStore.load();
      calendarStore.load();
      spendStore.load();
      agentStore.load();
      brainStore.load();
      initStatusBar();

      // Re-render current view now that data is loaded
      var renderFn = 'render' + this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1) + 'View';
      if (typeof window[renderFn] === 'function') {
        window[renderFn]();
      }
    } catch (e) {
      console.error('[' + this.timestamp() + '] MissionControl: data load error:', e);
      showToast('Failed to load data — check console', 'error');
      // Still init status bar to show disconnected states
      initStatusBar();
    }
  }

  /* ---- Navigation ---- */

  bindNavigation() {
    var self = this;
    $$('.sidebar-nav-item[data-view]').forEach(function(item) {
      item.addEventListener('click', function() {
        var view = item.getAttribute('data-view');
        self.switchView(view);
        self.closeSidebar();
      });
    });
  }

  switchView(viewId) {
    if (!VIEW_TITLES[viewId]) return;

    // Destroy charts when leaving spend view to prevent memory leaks
    if (typeof chartManager !== 'undefined') {
      chartManager.destroyAll();
    }

    this.currentView = viewId;

    // Update nav active state
    $$('.sidebar-nav-item').forEach(function(item) {
      item.classList.toggle('active', item.getAttribute('data-view') === viewId);
    });

    // Show/hide view containers
    $$('.view-container').forEach(function(view) {
      var isActive = view.id === viewId + 'View';
      view.classList.toggle('active', isActive);
    });

    // Update header title
    this.setPageTitle(VIEW_TITLES[viewId]);

    // Call the view's render function if it exists
    var renderFn = 'render' + viewId.charAt(0).toUpperCase() + viewId.slice(1) + 'View';
    if (typeof window[renderFn] === 'function') {
      window[renderFn]();
    }

    console.log('[' + this.timestamp() + '] MissionControl: switched to ' + viewId);
  }

  setPageTitle(title) {
    var el = $('#headerTitle');
    if (el) el.textContent = title;
  }

  /* ---- Keyboard Shortcuts ---- */

  bindKeyboardShortcuts() {
    var self = this;
    document.addEventListener('keydown', function(e) {
      // Don't capture when typing in inputs
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      // Number keys 1-6 switch views
      var viewIndex = parseInt(e.key) - 1;
      if (viewIndex >= 0 && viewIndex < VIEWS.length) {
        e.preventDefault();
        self.switchView(VIEWS[viewIndex].id);
        return;
      }

      // Escape closes modals
      if (e.key === 'Escape') {
        self.closeModal();
        self.closeSidebar();
        return;
      }

      // N opens new task modal
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        self.openNewTaskModal();
        return;
      }

      // / focuses search in Second Brain
      if (e.key === '/') {
        if (self.currentView === 'brain') {
          e.preventDefault();
          var searchInput = $('#brainSearchInput');
          if (searchInput) searchInput.focus();
        }
      }
    });
  }

  /* ---- Modal ---- */

  openModal(title, bodyHtml, footerHtml) {
    var overlay = $('#modalOverlay');
    if (!overlay) return;

    renderTemplate('#modalTitle', escapeHtml(title));
    renderTemplate('#modalBody', bodyHtml);
    if (footerHtml) {
      renderTemplate('#modalFooter', footerHtml);
      showElement($('#modalFooter'));
    } else {
      hideElement($('#modalFooter'));
    }
    overlay.classList.add('active');
  }

  closeModal() {
    var overlay = $('#modalOverlay');
    if (overlay) overlay.classList.remove('active');
  }

  bindModalClose() {
    var self = this;
    var overlay = $('#modalOverlay');
    if (!overlay) return;

    // Close on backdrop click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) self.closeModal();
    });

    // Close button
    var closeBtn = $('.modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        self.closeModal();
      });
    }
  }

  openNewTaskModal() {
    // Placeholder — will be implemented in Prompt 3
    if (typeof openTaskModal === 'function') {
      openTaskModal();
    } else {
      this.openModal('New Task', '<div class="empty-state"><div class="empty-state-message">Task creation will be available in the next build.</div></div>');
    }
  }

  /* ---- Mobile Sidebar ---- */

  bindHamburger() {
    var self = this;
    var btn = $('.hamburger-btn');
    var backdrop = $('.sidebar-backdrop');

    if (btn) {
      btn.addEventListener('click', function() {
        self.toggleSidebar();
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', function() {
        self.closeSidebar();
      });
    }
  }

  toggleSidebar() {
    var sidebar = $('.sidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  closeSidebar() {
    var sidebar = $('.sidebar');
    if (sidebar) sidebar.classList.remove('open');
  }

  /* ---- Auto Refresh ---- */

  startAutoRefresh() {
    var self = this;
    // Refresh every 5 minutes
    this.refreshInterval = setInterval(function() {
      self.refreshData();
    }, 5 * 60 * 1000);
  }

  async refreshData() {
    console.log('[' + this.timestamp() + '] MissionControl: refreshing data...');

    try {
      await dataService.refreshAll();

      // Reload all stores with fresh data
      taskStore.load();
      calendarStore.load();
      spendStore.load();
      agentStore.load();
      brainStore.load();

      showToast('Data synced successfully', 'success');
    } catch (e) {
      console.error('[' + this.timestamp() + '] MissionControl: refresh failed:', e);
      showToast('Sync failed — check console', 'error');
    }

    this.updateTimestamp();

    // Re-render current view
    var renderFn = 'render' + this.currentView.charAt(0).toUpperCase() + this.currentView.slice(1) + 'View';
    if (typeof window[renderFn] === 'function') {
      window[renderFn]();
    }
  }

  /* ---- Utility ---- */

  updateTimestamp() {
    var el = $('#headerTimestamp');
    if (el) {
      el.textContent = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    }
  }

  timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false });
  }
}

/* ---- Bootstrap ---- */
var app;
document.addEventListener('DOMContentLoaded', function() {
  app = new MissionControl();
  app.init();
});
