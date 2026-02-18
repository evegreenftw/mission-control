/* ============================================
   Mission Control v3.0 — DataService
   Central data orchestrator with health checks
   and freshness tracking.
   ============================================ */

var FRESHNESS_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

class DataService {
  constructor() {
    // { name: { data, lastUpdated, status, error } }
    this.sources = {};
    this.listeners = [];
  }

  /**
   * Initialize all data sources.
   */
  async init() {
    this._log('initializing all data sources...');

    // Fetch all sources in parallel
    await Promise.allSettled([
      this._fetchSource('tasks',    'tasks.json'),
      this._fetchSource('calendar', 'mc-data.json'),
      this._fetchSource('spend',    'model-usage-history.json'),
      this._fetchSource('agents',   'agents.json'),
      this._checkBrain()
    ]);

    this._notifyListeners();
    this._log('initialization complete');
    this._logAllStatuses();
  }

  /**
   * Refresh a single data source by name.
   */
  async refresh(sourceName) {
    var pathMap = {
      tasks:    'tasks.json',
      calendar: 'mc-data.json',
      spend:    'model-usage-history.json',
      agents:   'agents.json'
    };

    if (sourceName === 'brain') {
      await this._checkBrain();
    } else if (pathMap[sourceName]) {
      await this._fetchSource(sourceName, pathMap[sourceName]);
    }

    this._notifyListeners();
  }

  /**
   * Refresh all data sources.
   */
  async refreshAll() {
    this._log('refreshing all sources...');
    await Promise.allSettled([
      this._fetchSource('tasks',    'tasks.json'),
      this._fetchSource('calendar', 'mc-data.json'),
      this._fetchSource('spend',    'model-usage-history.json'),
      this._fetchSource('agents',   'agents.json'),
      this._checkBrain()
    ]);
    this._notifyListeners();
    this._log('refresh complete');
    this._logAllStatuses();
  }

  /**
   * Get data for a specific source.
   */
  getData(sourceName) {
    var source = this.sources[sourceName];
    if (!source) return null;
    return source.data;
  }

  /**
   * Get the status of a specific source.
   */
  getStatus(sourceName) {
    var source = this.sources[sourceName];
    if (!source) return 'disconnected';
    return this._computeStatus(source);
  }

  /**
   * Get health status of all sources.
   * Returns { name: { status, lastUpdated, error } }
   */
  getSourceStatus() {
    var self = this;
    var result = {};
    Object.keys(this.sources).forEach(function(name) {
      var src = self.sources[name];
      result[name] = {
        status: self._computeStatus(src),
        lastUpdated: src.lastUpdated,
        error: src.error
      };
    });
    return result;
  }

  /**
   * Register a listener for status changes.
   */
  onStatusChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.push(callback);
    }
  }

  /* ---- Internal Methods ---- */

  async _fetchSource(name, path) {
    // Mark as loading
    if (!this.sources[name]) {
      this.sources[name] = { data: null, lastUpdated: null, status: 'loading', error: null };
    }
    this.sources[name].status = 'loading';
    this.sources[name].error = null;

    try {
      var response = await fetch(path + '?t=' + Date.now());
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }

      var data = await response.json();
      this.sources[name].data = data;
      this.sources[name].lastUpdated = new Date();
      this.sources[name].status = 'connected';
      this.sources[name].error = null;

      this._logSourceResult(name, true);
    } catch (e) {
      // Keep old data if we had some
      this.sources[name].status = this.sources[name].data ? 'stale' : 'disconnected';
      this.sources[name].error = e.message || String(e);
      this._logSourceResult(name, false, e.message);
    }
  }

  async _checkBrain() {
    var name = 'brain';
    if (!this.sources[name]) {
      this.sources[name] = { data: null, lastUpdated: null, status: 'loading', error: null };
    }
    this.sources[name].status = 'loading';

    // Retry with exponential backoff: 1s, 2s, 4s
    var delays = [0, 1000, 2000];
    for (var attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await this._sleep(delays[attempt]);
      }

      try {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 3000);
        var response = await fetch('http://localhost:3001/health', { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
          var data = await response.json();
          this.sources[name].data = data;
          this.sources[name].lastUpdated = new Date();
          this.sources[name].status = 'connected';
          this.sources[name].error = null;
          this._logSourceResult(name, true);
          return;
        }
      } catch (e) {
        // Continue to next retry
        if (attempt < 2) {
          this._log('brain health check attempt ' + (attempt + 1) + ' failed, retrying...');
        }
      }
    }

    // All retries failed
    this.sources[name].status = 'disconnected';
    this.sources[name].error = 'API unreachable after 3 attempts';
    this._logSourceResult(name, false, 'unreachable after 3 attempts');
  }

  _computeStatus(source) {
    if (source.status === 'loading') return 'loading';
    if (source.status === 'disconnected') return 'disconnected';

    // Check freshness
    if (source.lastUpdated) {
      var age = Date.now() - source.lastUpdated.getTime();
      if (age > FRESHNESS_THRESHOLD_MS) return 'stale';
    }

    return source.status || 'disconnected';
  }

  _notifyListeners() {
    var status = this.getSourceStatus();
    this.listeners.forEach(function(cb) {
      try { cb(status); } catch (e) { console.error('DataService listener error:', e); }
    });
  }

  _logSourceResult(name, success, errorMsg) {
    if (success) {
      var data = this.sources[name].data;
      var detail = '';
      if (name === 'tasks' && data && data.tasks) detail = ' (' + data.tasks.length + ' tasks)';
      if (name === 'calendar' && data && data.calendar && data.calendar.events) detail = ' (' + data.calendar.events.length + ' events)';
      if (name === 'spend') detail = ' (loaded)';
      if (name === 'agents' && data && Array.isArray(data)) detail = ' (' + data.length + ' agents)';
      if (name === 'brain') detail = ' (online)';
      this._log(name + ' fetched' + detail);
    } else {
      this._log(name + ' FAILED - ' + (errorMsg || 'unknown error'));
    }
  }

  _logAllStatuses() {
    var self = this;
    var statuses = Object.keys(this.sources).map(function(name) {
      return name + ':' + self._computeStatus(self.sources[name]);
    }).join(' | ');
    this._log('Status: ' + statuses);
  }

  _log(msg) {
    var ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log('[' + ts + '] DataService: ' + msg);
  }

  _sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }
}

// Global instance
var dataService = new DataService();
