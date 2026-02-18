/* ============================================
   Mission Control v3.0 — BrainStore
   Second Brain API connection with health checks
   and exponential backoff retry.
   ============================================ */

var BRAIN_API_BASE = 'http://localhost:3001';
var BRAIN_TIMEOUT_MS = 3000;

class BrainStore {
  constructor() {
    this.status = 'disconnected'; // 'connected' | 'disconnected' | 'loading'
    this.lastChecked = null;
    this.error = null;
  }

  /**
   * Check if the Second Brain API is reachable.
   * Uses the DataService's brain check result.
   */
  load() {
    var brainStatus = dataService.getStatus('brain');
    this.status = brainStatus;
    this.lastChecked = new Date();

    if (brainStatus === 'connected') {
      this._log('online');
    } else {
      this.error = 'API unreachable';
      this._log('offline — semantic search unavailable');
    }
  }

  /**
   * Get connection status.
   */
  getStatus() {
    return this.status;
  }

  /**
   * Check if online.
   */
  isOnline() {
    return this.status === 'connected';
  }

  /**
   * Perform a health check directly.
   */
  async healthCheck() {
    this.status = 'loading';
    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, BRAIN_TIMEOUT_MS);
      var response = await fetch(BRAIN_API_BASE + '/health', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        this.status = 'connected';
        this.error = null;
        this.lastChecked = new Date();
        this._log('health check passed');
        return true;
      }
    } catch (e) {
      // Fall through to disconnected
    }

    this.status = 'disconnected';
    this.error = 'API unreachable';
    this.lastChecked = new Date();
    this._log('health check failed');
    return false;
  }

  /**
   * Search the Second Brain.
   * Returns { results: [], error: string|null }
   */
  async search(query, limit) {
    if (!query || query.trim() === '') {
      return { results: [], error: null };
    }

    if (this.status === 'disconnected') {
      return { results: [], error: 'Second Brain is offline. Check if the API is running on port 3001.' };
    }

    limit = limit || 10;

    // Retry with exponential backoff: immediate, 1s, 2s
    var delays = [0, 1000, 2000];
    for (var attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await this._sleep(delays[attempt]);
        this._log('search retry attempt ' + (attempt + 1));
      }

      try {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, BRAIN_TIMEOUT_MS * 2);

        var response = await fetch(BRAIN_API_BASE + '/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), limit: limit }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          var data = await response.json();
          this.status = 'connected';
          this.error = null;
          this._log('search returned ' + (data.results ? data.results.length : 0) + ' results for "' + query + '"');
          return { results: data.results || [], error: null };
        } else {
          this._log('search HTTP ' + response.status);
        }
      } catch (e) {
        if (attempt === 2) {
          this.status = 'disconnected';
          this.error = 'API unreachable during search';
          this._log('search failed after 3 attempts: ' + (e.message || e));
          return { results: [], error: 'Search failed — Second Brain API is not responding.' };
        }
      }
    }

    return { results: [], error: 'Search failed after retries.' };
  }

  /**
   * Retry connection (for the "Retry" button in UI).
   */
  async retryConnection() {
    this._log('retrying connection...');
    await dataService.refresh('brain');
    this.load();
    return this.isOnline();
  }

  /* ---- Internal ---- */

  _sleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  _log(msg) {
    var ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log('[' + ts + '] BrainStore: ' + msg);
  }
}

// Global instance
var brainStore = new BrainStore();
