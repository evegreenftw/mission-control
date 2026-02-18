/* ============================================
   Mission Control v3.0 — Calendar View
   Week/day views with event rendering.
   ============================================ */

var calendarState = {
  mode: 'week',       // 'week' | 'day'
  currentDate: null    // Date object for the focused date
};

/**
 * Render the Calendar view. Called by app.switchView().
 */
function renderCalendarView() {
  var container = $('#calendarView');
  if (!container) return;

  // Initialize currentDate if not set
  if (!calendarState.currentDate) {
    calendarState.currentDate = new Date();
  }

  var status = dataService.getStatus('calendar');
  var html = '';

  // Controls
  html += _renderCalendarControls();

  // Offline banner
  if (status === 'disconnected') {
    var freshness = calendarStore.getFreshness();
    html += '<div class="calendar-offline-banner">';
    html += '  <span class="calendar-offline-text">Calendar offline \u2014 last synced ' + escapeHtml(freshness.label) + '</span>';
    html += '  <button class="btn btn-danger btn-sm" onclick="retryCalendar()">Retry</button>';
    html += '</div>';
  }

  // View content
  if (!calendarStore.loaded) {
    html += _calendarLoadingState();
  } else if (calendarState.mode === 'week') {
    html += _renderWeekView();
  } else {
    html += _renderDayView();
  }

  container.innerHTML = html;
}

/* ---- Controls ---- */

function _renderCalendarControls() {
  var d = calendarState.currentDate;
  var label;

  if (calendarState.mode === 'week') {
    var weekStart = _getWeekStart(d);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    label = _shortDate(weekStart) + ' \u2013 ' + _shortDate(weekEnd);
  } else {
    label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  var freshness = calendarStore.getFreshness();

  var html = '<div class="calendar-controls">';
  html += '<div class="calendar-controls-left">';
  html += '  <button class="calendar-nav-btn" onclick="calendarNav(\'prev\')">\u2039</button>';
  html += '  <button class="calendar-nav-btn" onclick="calendarNav(\'today\')">Today</button>';
  html += '  <button class="calendar-nav-btn" onclick="calendarNav(\'next\')">\u203A</button>';
  html += '  <span class="calendar-date-label">' + escapeHtml(label) + '</span>';
  html += '</div>';
  html += '<div class="calendar-controls-right">';
  html += '  <span class="calendar-freshness">Synced ' + escapeHtml(freshness.label) + '</span>';
  html += '  <button class="btn btn-secondary btn-sm" onclick="retryCalendar()">\u21BB Refresh</button>';
  html += '  <div class="pill-group">';
  html += '    <button class="pill' + (calendarState.mode === 'week' ? ' active' : '') + '" onclick="setCalendarMode(\'week\')">Week</button>';
  html += '    <button class="pill' + (calendarState.mode === 'day' ? ' active' : '') + '" onclick="setCalendarMode(\'day\')">Day</button>';
  html += '  </div>';
  html += '</div>';
  html += '</div>';

  return html;
}

/* ---- Week View ---- */

function _renderWeekView() {
  var weekStart = _getWeekStart(calendarState.currentDate);
  var today = new Date();
  var todayStr = today.toISOString().substring(0, 10);

  var html = '<div class="calendar-week-grid">';

  for (var i = 0; i < 7; i++) {
    var day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    var dateStr = day.toISOString().substring(0, 10);
    var isToday = dateStr === todayStr;
    var dayName = day.toLocaleDateString('en-US', { weekday: 'short' });
    var dayNum = day.getDate();

    var dayEvents = calendarStore.getEventsForDate(dateStr);
    var dayTasks = taskStore.getTasksDueOn(dateStr);

    html += '<div class="calendar-day-cell' + (isToday ? ' today' : '') + '">';

    // Header
    html += '<div class="calendar-day-header">';
    html += '  <span class="calendar-day-name">' + dayName + '</span>';
    html += '  <span class="calendar-day-number">' + dayNum + '</span>';
    html += '</div>';

    // Events
    html += '<div class="calendar-day-events">';

    if (dayEvents.length === 0 && dayTasks.length === 0) {
      html += '<div class="calendar-no-events">No events</div>';
    } else {
      dayEvents.forEach(function(evt) {
        var timeStr = evt.allDay ? 'All day' : formatTime(evt.start);
        html += '<div class="calendar-event-block" onclick="showEventDetail(\'' + escapeHtml(evt.id) + '\')" title="' + escapeHtml(evt.title) + '">';
        html += '  <span class="event-time">' + escapeHtml(timeStr) + '</span> ';
        html += escapeHtml(evt.title);
        html += '</div>';
      });

      dayTasks.forEach(function(task) {
        html += '<div class="calendar-task-block" title="Task due: ' + escapeHtml(task.title) + '">';
        html += '  \u2611 ' + escapeHtml(task.title);
        html += '</div>';
      });
    }

    html += '</div>'; // calendar-day-events
    html += '</div>'; // calendar-day-cell
  }

  html += '</div>'; // calendar-week-grid
  return html;
}

/* ---- Day View ---- */

function _renderDayView() {
  var d = calendarState.currentDate;
  var dateStr = d.toISOString().substring(0, 10);
  var dayEvents = calendarStore.getEventsForDate(dateStr);

  // Build hourly event map (7am to 10pm)
  var eventsByHour = {};
  dayEvents.forEach(function(evt) {
    var start = new Date(evt.start);
    var hour = start.getHours();
    if (!eventsByHour[hour]) eventsByHour[hour] = [];
    eventsByHour[hour].push(evt);
  });

  var html = '<div class="calendar-day-view">';

  for (var h = 7; h <= 22; h++) {
    var label = _formatHourLabel(h);
    var events = eventsByHour[h] || [];

    html += '<div class="calendar-hour-row">';
    html += '  <div class="calendar-hour-label">' + label + '</div>';
    html += '  <div class="calendar-hour-content">';

    events.forEach(function(evt) {
      html += '<div class="calendar-day-event" onclick="showEventDetail(\'' + escapeHtml(evt.id) + '\')">';
      html += '  <div class="calendar-day-event-title">' + escapeHtml(evt.title) + '</div>';
      html += '  <div class="calendar-day-event-time">' + escapeHtml(formatTime(evt.start)) + ' \u2013 ' + escapeHtml(formatTime(evt.end)) + '</div>';
      if (evt.location) {
        html += '  <div class="calendar-day-event-location">' + escapeHtml(evt.location) + '</div>';
      }
      html += '</div>';
    });

    html += '  </div>';
    html += '</div>';
  }

  html += '</div>';

  // Tasks due today
  var dayTasks = taskStore.getTasksDueOn(dateStr);
  if (dayTasks.length > 0) {
    html += '<div style="margin-top:var(--sp-4)">';
    html += '<div class="card">';
    html += '<div class="card-header"><span class="card-title">Tasks Due Today</span></div>';
    dayTasks.forEach(function(task) {
      html += '<div class="dashboard-task-item" style="padding:var(--sp-2) 0">';
      html += '  <span class="dashboard-task-priority" style="background:var(--priority-' + (task.priority || 'medium') + ')"></span>';
      html += '  <span class="dashboard-task-title">' + escapeHtml(task.title) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  return html;
}

/* ---- Event Detail ---- */

function showEventDetail(eventId) {
  var events = calendarStore.getEvents();
  var evt = events.find(function(e) { return e.id === eventId; });
  if (!evt) return;

  var bodyHtml = '<div>';
  bodyHtml += '<div class="event-popover-detail"><span class="label">Time</span><br>';
  if (evt.allDay) {
    bodyHtml += 'All day';
  } else {
    bodyHtml += escapeHtml(formatTime(evt.start)) + ' \u2013 ' + escapeHtml(formatTime(evt.end));
  }
  bodyHtml += '</div>';

  bodyHtml += '<div class="event-popover-detail" style="margin-top:var(--sp-2)"><span class="label">Date</span><br>';
  bodyHtml += escapeHtml(formatDate(evt.start));
  bodyHtml += '</div>';

  if (evt.location) {
    bodyHtml += '<div class="event-popover-detail" style="margin-top:var(--sp-2)"><span class="label">Location</span><br>';
    bodyHtml += escapeHtml(evt.location);
    bodyHtml += '</div>';
  }

  if (evt.description) {
    bodyHtml += '<div class="event-popover-detail" style="margin-top:var(--sp-2)"><span class="label">Description</span><br>';
    bodyHtml += escapeHtml(evt.description);
    bodyHtml += '</div>';
  }

  if (evt.attendees && evt.attendees.length > 0) {
    bodyHtml += '<div class="event-popover-detail" style="margin-top:var(--sp-2)"><span class="label">Attendees</span><br>';
    evt.attendees.forEach(function(a) {
      bodyHtml += escapeHtml(a.email || a) + '<br>';
    });
    bodyHtml += '</div>';
  }

  if (evt.htmlLink) {
    bodyHtml += '<div style="margin-top:var(--sp-4)">';
    bodyHtml += '<a href="' + escapeHtml(evt.htmlLink) + '" target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none">Open in Google Calendar</a>';
    bodyHtml += '</div>';
  }

  bodyHtml += '</div>';

  app.openModal(evt.title, bodyHtml);
}

/* ---- Navigation ---- */

function calendarNav(direction) {
  var d = calendarState.currentDate;
  var step = calendarState.mode === 'week' ? 7 : 1;

  if (direction === 'prev') {
    d.setDate(d.getDate() - step);
  } else if (direction === 'next') {
    d.setDate(d.getDate() + step);
  } else if (direction === 'today') {
    calendarState.currentDate = new Date();
  }

  renderCalendarView();
}

function setCalendarMode(mode) {
  calendarState.mode = mode;
  renderCalendarView();
}

async function retryCalendar() {
  showToast('Refreshing calendar...', 'success');
  await calendarStore.refresh();
  renderCalendarView();
}

/* ---- Helpers ---- */

function _getWeekStart(date) {
  var d = new Date(date);
  var day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function _shortDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function _formatHourLabel(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return h + ' AM';
  if (h === 12) return '12 PM';
  return (h - 12) + ' PM';
}

function _calendarLoadingState() {
  var html = '<div class="calendar-week-grid">';
  for (var i = 0; i < 7; i++) {
    html += '<div class="calendar-day-cell">';
    html += '  <div class="calendar-day-header">';
    html += '    <div class="loading-skeleton skeleton-text short"></div>';
    html += '  </div>';
    html += '  <div class="calendar-day-events">';
    html += '    <div class="loading-skeleton" style="height:20px;margin:2px 0;border-radius:var(--radius-xs)"></div>';
    html += '    <div class="loading-skeleton" style="height:20px;margin:2px 0;border-radius:var(--radius-xs)"></div>';
    html += '  </div>';
    html += '</div>';
  }
  html += '</div>';
  return html;
}
