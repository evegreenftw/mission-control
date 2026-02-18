/* ============================================
   Mission Control v3.0 — CalendarStore
   Calendar data with freshness tracking.
   Reads from mc-data.json calendar section.
   ============================================ */

class CalendarStore {
  constructor() {
    this.events = [];
    this.refreshedAt = null;
    this.loaded = false;
    this.skippedCount = 0;
  }

  /**
   * Load calendar events from DataService.
   */
  load() {
    this.events = [];
    this.skippedCount = 0;

    var raw = dataService.getData('calendar');
    if (!raw) {
      this.loaded = true;
      this._log('no calendar data available — empty state');
      return;
    }

    // mc-data.json has { refreshedAt, calendar: { events: [...] } }
    if (raw.refreshedAt) {
      this.refreshedAt = new Date(raw.refreshedAt);
    }

    var rawEvents = (raw.calendar && raw.calendar.events) || [];
    var self = this;

    rawEvents.forEach(function(evt) {
      var result = validateCalendarEvent(evt);
      if (result.valid) {
        self.events.push(self._normalizeEvent(evt));
      } else {
        self.skippedCount++;
        self._log('skipped invalid event: ' + result.errors.join(', '));
      }
    });

    // Sort by start time
    this.events.sort(function(a, b) {
      return new Date(a.start) - new Date(b.start);
    });

    this.loaded = true;
    this._log('loaded ' + this.events.length + ' events (' + this.skippedCount + ' invalid skipped)');
  }

  /**
   * Get all events.
   */
  getEvents() {
    return this.events.slice();
  }

  /**
   * Get events for a specific date (YYYY-MM-DD).
   */
  getEventsForDate(dateStr) {
    return this.events.filter(function(evt) {
      var evtDate = new Date(evt.start).toISOString().substring(0, 10);
      return evtDate === dateStr;
    });
  }

  /**
   * Get events for a week starting from a given date.
   */
  getEventsForWeek(startDate) {
    var start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    var end = new Date(start);
    end.setDate(end.getDate() + 7);

    return this.events.filter(function(evt) {
      var evtStart = new Date(evt.start);
      return evtStart >= start && evtStart < end;
    });
  }

  /**
   * Get today's events.
   */
  getTodayEvents() {
    var today = new Date().toISOString().substring(0, 10);
    return this.getEventsForDate(today);
  }

  /**
   * Get upcoming events (from now forward), limited to n.
   */
  getUpcoming(n) {
    var now = new Date();
    var upcoming = this.events.filter(function(evt) {
      return new Date(evt.end) > now;
    });
    return upcoming.slice(0, n || 5);
  }

  /**
   * Get freshness info.
   */
  getFreshness() {
    if (!this.refreshedAt) return { fresh: false, age: null, label: 'Never synced' };

    var ageMs = Date.now() - this.refreshedAt.getTime();
    var ageMin = Math.floor(ageMs / 60000);
    var fresh = ageMs < FRESHNESS_THRESHOLD_MS;

    var label;
    if (ageMin < 1) label = 'Just now';
    else if (ageMin < 60) label = ageMin + 'm ago';
    else label = Math.floor(ageMin / 60) + 'h ago';

    return { fresh: fresh, age: ageMs, label: label };
  }

  /**
   * Refresh calendar data.
   */
  async refresh() {
    await dataService.refresh('calendar');
    this.load();
  }

  /* ---- Internal ---- */

  _normalizeEvent(raw) {
    return {
      id: raw.id || generateId(),
      title: raw.summary || raw.title || 'Untitled',
      start: raw.start,
      end: raw.end,
      allDay: raw.all_day || false,
      location: raw.location || null,
      description: raw.description || null,
      attendees: raw.attendees || [],
      htmlLink: raw.html_link || null
    };
  }

  _log(msg) {
    var ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log('[' + ts + '] CalendarStore: ' + msg);
  }
}

// Global instance
var calendarStore = new CalendarStore();
