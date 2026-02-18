/* ============================================
   Mission Control v3.0 — SpendStore
   Model usage analytics with aggregation.
   Reads model-usage-history.json.
   ============================================ */

// Consistent model colors for charts
var MODEL_COLORS = {
  opus:     '#8b5cf6',
  sonnet:   '#3b82f6',
  haiku:    '#22c55e',
  minimax:  '#f59e0b',
  deepseek: '#06b6d4',
  kimi:     '#ec4899',
  gemini:   '#ef4444'
};

var MODEL_DISPLAY_NAMES = {
  opus:     'Claude Opus',
  sonnet:   'Claude Sonnet',
  haiku:    'Claude Haiku',
  minimax:  'Minimax',
  deepseek: 'DeepSeek',
  kimi:     'Kimi',
  gemini:   'Gemini'
};

class SpendStore {
  constructor() {
    this.raw = null;
    this.loaded = false;
    this.invalidEntries = 0;
  }

  /**
   * Load spend data from DataService.
   */
  load() {
    this.raw = null;
    this.invalidEntries = 0;

    var data = dataService.getData('spend');
    if (!data) {
      this.loaded = true;
      this._log('no spend data available — empty state');
      return;
    }

    var result = validateSpendData(data);
    if (!result.valid) {
      this.loaded = true;
      this._log('spend data failed validation: ' + result.errors.join(', '));
      return;
    }

    // Validate each day entry
    var self = this;
    if (data.byDay) {
      Object.keys(data.byDay).forEach(function(dateKey) {
        var dayResult = validateSpendDayEntry(dateKey, data.byDay[dateKey]);
        if (!dayResult.valid) {
          self.invalidEntries++;
          self._log('invalid day entry ' + dateKey + ': ' + dayResult.errors.join(', '));
        }
      });
    }

    this.raw = data;
    this.loaded = true;
    this._log('loaded spend data (' + this.invalidEntries + ' invalid entries)');
  }

  /**
   * Check if we have data.
   */
  hasData() {
    return this.raw !== null;
  }

  /**
   * Get total spend (all time).
   */
  total() {
    if (!this.raw) return null;
    return {
      cost: this.raw.totalCost,
      byModel: this._mapAllTime(this.raw.allTime)
    };
  }

  /**
   * Get spend data grouped by day for a date range.
   * Returns array of { date, models: { modelName: { count, cost } } }
   */
  byDay(startDate, endDate) {
    if (!this.raw || !this.raw.byDay) return [];

    var start = startDate ? new Date(startDate) : null;
    var end = endDate ? new Date(endDate) : null;
    var result = [];

    var sortedDays = Object.keys(this.raw.byDay).sort();
    sortedDays.forEach(function(dateKey) {
      var d = new Date(dateKey);
      if (start && d < start) return;
      if (end && d > end) return;

      result.push({
        date: dateKey,
        models: this.raw.byDay[dateKey]
      });
    }.bind(this));

    return result;
  }

  /**
   * Get spend for the current week (last 7 days).
   */
  byWeek() {
    var end = new Date();
    var start = new Date();
    start.setDate(start.getDate() - 7);
    return this._aggregateRange(start, end);
  }

  /**
   * Get spend for the current month.
   */
  byMonth() {
    var now = new Date();
    var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    if (this.raw && this.raw.byMonth && this.raw.byMonth[monthKey]) {
      return this._mapAllTime(this.raw.byMonth[monthKey]);
    }

    // Fall back to aggregating byDay
    var start = new Date(now.getFullYear(), now.getMonth(), 1);
    return this._aggregateRange(start, now);
  }

  /**
   * Get spend grouped by model for a given period.
   * period: 'day' | 'week' | 'month' | 'all'
   */
  byModel(period) {
    if (!this.raw) return [];

    var models;
    if (period === 'all') {
      models = this.raw.allTime;
    } else if (period === 'month') {
      var now = new Date();
      var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      models = (this.raw.byMonth && this.raw.byMonth[monthKey]) || {};
    } else if (period === 'week') {
      var agg = this.byWeek();
      return agg;
    } else if (period === 'day') {
      var today = new Date().toISOString().substring(0, 10);
      models = (this.raw.byDay && this.raw.byDay[today]) || {};
    } else {
      models = this.raw.allTime;
    }

    return this._mapAllTime(models);
  }

  /**
   * Get the total cost for a given period.
   * Returns number or null if no data.
   */
  totalForPeriod(period) {
    var models = this.byModel(period);
    if (!models || models.length === 0) return null;
    var total = 0;
    models.forEach(function(m) { total += m.cost; });
    return total;
  }

  /**
   * Get total sessions for a given period.
   */
  totalSessionsForPeriod(period) {
    var models = this.byModel(period);
    if (!models || models.length === 0) return null;
    var total = 0;
    models.forEach(function(m) { total += m.count; });
    return total;
  }

  /**
   * Get the most expensive model for a given period.
   */
  mostExpensiveModel(period) {
    var models = this.byModel(period);
    if (!models || models.length === 0) return null;
    models.sort(function(a, b) { return b.cost - a.cost; });
    return models[0];
  }

  /**
   * Get the number of invalid entries.
   */
  getInvalidCount() {
    return this.invalidEntries;
  }

  /**
   * Get daily spend data for chart rendering.
   * Returns { labels: [dates], datasets: [{ model, data: [costs] }] }
   */
  getChartData(startDate, endDate) {
    var days = this.byDay(startDate, endDate);
    if (days.length === 0) return null;

    // Collect all model names
    var allModels = {};
    days.forEach(function(day) {
      Object.keys(day.models).forEach(function(m) { allModels[m] = true; });
    });

    var modelNames = Object.keys(allModels).sort();
    var labels = days.map(function(d) { return d.date; });
    var datasets = modelNames.map(function(model) {
      return {
        model: model,
        label: MODEL_DISPLAY_NAMES[model] || model,
        color: MODEL_COLORS[model] || '#888888',
        data: days.map(function(day) {
          var entry = day.models[model];
          return entry ? entry.cost : 0;
        })
      };
    });

    return { labels: labels, datasets: datasets };
  }

  /* ---- Internal ---- */

  _mapAllTime(models) {
    if (!models || typeof models !== 'object') return [];
    var result = [];
    Object.keys(models).forEach(function(name) {
      var entry = models[name];
      if (!entry || typeof entry.cost !== 'number' || isNaN(entry.cost)) return;
      if (!entry || typeof entry.count !== 'number' || isNaN(entry.count)) return;
      result.push({
        model: name,
        displayName: MODEL_DISPLAY_NAMES[name] || name,
        color: MODEL_COLORS[name] || '#888888',
        count: entry.count,
        cost: entry.cost
      });
    });
    return result;
  }

  _aggregateRange(start, end) {
    if (!this.raw || !this.raw.byDay) return [];

    var totals = {};
    Object.keys(this.raw.byDay).forEach(function(dateKey) {
      var d = new Date(dateKey);
      if (d < start || d > end) return;

      var dayData = this.raw.byDay[dateKey];
      Object.keys(dayData).forEach(function(model) {
        if (!totals[model]) totals[model] = { count: 0, cost: 0 };
        var entry = dayData[model];
        if (entry && typeof entry.count === 'number') totals[model].count += entry.count;
        if (entry && typeof entry.cost === 'number') totals[model].cost += entry.cost;
      });
    }.bind(this));

    var result = [];
    Object.keys(totals).forEach(function(model) {
      result.push({
        model: model,
        displayName: MODEL_DISPLAY_NAMES[model] || model,
        color: MODEL_COLORS[model] || '#888888',
        count: totals[model].count,
        cost: totals[model].cost
      });
    });
    return result;
  }

  _log(msg) {
    var ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log('[' + ts + '] SpendStore: ' + msg);
  }
}

// Global instance
var spendStore = new SpendStore();
