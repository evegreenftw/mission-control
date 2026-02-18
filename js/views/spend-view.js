/* ============================================
   Mission Control v3.0 — Spend Analytics View
   Time-period toggles, pie chart, line chart,
   sortable breakdown table, summary cards.
   ============================================ */

var spendState = {
  period: 'week',  // 'day' | 'week' | 'month' | 'all'
  sortCol: 'cost',
  sortDir: 'desc'
};

/**
 * Render the Spend view. Called by app.switchView().
 */
function renderSpendView() {
  var container = $('#spendView');
  if (!container) return;

  // Destroy any existing charts when re-rendering
  chartManager.destroy('spendPieChart');
  chartManager.destroy('spendLineChart');

  var status = dataService.getStatus('spend');
  var html = '';

  // Controls
  html += _renderSpendControls();

  // Data availability check
  if (!spendStore.loaded) {
    html += _spendLoadingState();
    container.innerHTML = html;
    return;
  }

  if (!spendStore.hasData()) {
    html += '<div class="spend-empty">No spend data available</div>';
    container.innerHTML = html;
    return;
  }

  // Invalid entries warning
  var invalidCount = spendStore.getInvalidCount();
  if (invalidCount > 0) {
    html += '<div class="spend-warning">' + invalidCount + ' entries excluded due to invalid data</div>';
  }

  // Summary cards
  html += _renderSpendSummaryCards();

  // Charts
  html += _renderSpendCharts();

  // Breakdown table
  html += _renderSpendTable();

  container.innerHTML = html;

  // Render Chart.js charts after DOM is in place
  setTimeout(function() {
    _renderPieChart();
    _renderLineChart();
  }, 0);
}

/* ---- Controls ---- */

function _renderSpendControls() {
  var html = '<div class="spend-controls">';
  html += '<div class="spend-controls-left">';
  html += '  <div class="pill-group">';

  var periods = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'all', label: 'All Time' }
  ];

  periods.forEach(function(p) {
    var active = spendState.period === p.id ? ' active' : '';
    html += '<button class="pill' + active + '" onclick="setSpendPeriod(\'' + p.id + '\')">' + p.label + '</button>';
  });

  html += '  </div>';
  html += '</div>';
  html += '<div class="spend-controls-right">';
  html += '  <button class="btn btn-secondary btn-sm" onclick="app.refreshData()">\u21BB Refresh</button>';
  html += '</div>';
  html += '</div>';

  return html;
}

/* ---- Summary Cards ---- */

function _renderSpendSummaryCards() {
  var models = spendStore.byModel(spendState.period);
  var totalCost = spendStore.totalForPeriod(spendState.period);
  var totalSessions = spendStore.totalSessionsForPeriod(spendState.period);
  var topModel = spendStore.mostExpensiveModel(spendState.period);

  var html = '<div class="spend-summary-cards">';

  // Total Spend
  html += '<div class="spend-summary-card">';
  html += '<div class="spend-summary-label">Total Spend</div>';
  if (totalCost !== null) {
    html += '<div class="spend-summary-value">' + formatCurrency(totalCost) + '</div>';
    html += '<div class="spend-summary-sub">' + _periodLabel() + '</div>';
  } else {
    html += '<div class="spend-summary-value unavailable">\u2014</div>';
    html += '<div class="spend-summary-sub">No data for this period</div>';
  }
  html += '</div>';

  // Most Expensive Model
  html += '<div class="spend-summary-card">';
  html += '<div class="spend-summary-label">Top Model</div>';
  if (topModel) {
    html += '<div class="spend-summary-value" style="font-size:var(--text-lg)">' + escapeHtml(topModel.displayName) + '</div>';
    html += '<div class="spend-summary-sub">' + formatCurrency(topModel.cost) + '</div>';
  } else {
    html += '<div class="spend-summary-value unavailable">\u2014</div>';
    html += '<div class="spend-summary-sub">No data</div>';
  }
  html += '</div>';

  // Average Daily Spend
  html += '<div class="spend-summary-card">';
  html += '<div class="spend-summary-label">Avg Daily Spend</div>';
  if (totalCost !== null) {
    var days = _periodDays();
    var avg = days > 0 ? totalCost / days : 0;
    html += '<div class="spend-summary-value">' + formatCurrency(avg) + '</div>';
    html += '<div class="spend-summary-sub">per day</div>';
  } else {
    html += '<div class="spend-summary-value unavailable">\u2014</div>';
    html += '<div class="spend-summary-sub">No data</div>';
  }
  html += '</div>';

  // Total Sessions
  html += '<div class="spend-summary-card">';
  html += '<div class="spend-summary-label">Total Sessions</div>';
  if (totalSessions !== null) {
    html += '<div class="spend-summary-value">' + totalSessions + '</div>';
    html += '<div class="spend-summary-sub">' + _periodLabel() + '</div>';
  } else {
    html += '<div class="spend-summary-value unavailable">\u2014</div>';
    html += '<div class="spend-summary-sub">No data</div>';
  }
  html += '</div>';

  html += '</div>';
  return html;
}

/* ---- Charts ---- */

function _renderSpendCharts() {
  var html = '<div class="spend-charts">';

  // Pie chart
  html += '<div class="spend-chart-card">';
  html += '<div class="spend-chart-title">Spend by Model</div>';
  html += '<div class="spend-chart-wrap"><canvas id="spendPieChart"></canvas></div>';
  html += '</div>';

  // Line chart
  html += '<div class="spend-chart-card">';
  html += '<div class="spend-chart-title">Spend Over Time</div>';
  html += '<div class="spend-chart-wrap"><canvas id="spendLineChart"></canvas></div>';
  html += '</div>';

  html += '</div>';
  return html;
}

function _renderPieChart() {
  var models = spendStore.byModel(spendState.period);
  if (!models || models.length === 0) return;

  var labels = models.map(function(m) { return m.displayName; });
  var data = models.map(function(m) { return m.cost; });
  var colors = models.map(function(m) { return m.color; });

  chartManager.create('spendPieChart', {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: 'rgba(0,0,0,0.3)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#a0a0b0',
            font: { family: 'Inter', size: 11 },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              var value = context.parsed;
              var total = context.dataset.data.reduce(function(a, b) { return a + b; }, 0);
              var pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return context.label + ': ' + formatCurrency(value) + ' (' + pct + '%)';
            }
          }
        }
      }
    }
  });
}

function _renderLineChart() {
  var range = _getDateRange();
  var chartData = spendStore.getChartData(range.start, range.end);
  if (!chartData) return;

  var datasets = chartData.datasets.map(function(ds) {
    return {
      label: ds.label,
      data: ds.data,
      borderColor: ds.color,
      backgroundColor: ds.color + '20',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.3,
      fill: false
    };
  });

  chartManager.create('spendLineChart', {
    type: 'line',
    data: {
      labels: chartData.labels.map(function(d) {
        var parts = d.split('-');
        return parts[1] + '/' + parts[2];
      }),
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#a0a0b0',
            font: { family: 'Inter', size: 11 },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#666', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: {
            color: '#666',
            font: { size: 10 },
            callback: function(val) { return '$' + val.toFixed(2); }
          },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

/* ---- Breakdown Table ---- */

function _renderSpendTable() {
  var models = spendStore.byModel(spendState.period);
  if (!models || models.length === 0) {
    return '<div class="spend-empty">No model data for this period</div>';
  }

  // Sort
  models = models.slice().sort(function(a, b) {
    var valA = a[spendState.sortCol];
    var valB = b[spendState.sortCol];
    if (typeof valA === 'string') {
      return spendState.sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return spendState.sortDir === 'asc' ? valA - valB : valB - valA;
  });

  var html = '<div class="spend-table-card">';
  html += '<div class="spend-table-header">';
  html += '  <span class="spend-table-title">Cost Breakdown</span>';
  html += '</div>';
  html += '<table class="spend-table">';
  html += '<thead><tr>';

  var cols = [
    { key: 'displayName', label: 'Model' },
    { key: 'count', label: 'Sessions' },
    { key: 'cost', label: 'Cost' }
  ];

  cols.forEach(function(col) {
    var sorted = spendState.sortCol === col.key;
    var arrow = sorted ? (spendState.sortDir === 'asc' ? '\u25B2' : '\u25BC') : '\u25BC';
    html += '<th class="' + (sorted ? 'sorted' : '') + '" onclick="sortSpendTable(\'' + col.key + '\')">';
    html += col.label + ' <span class="sort-arrow">' + arrow + '</span>';
    html += '</th>';
  });

  html += '</tr></thead><tbody>';

  var totalSessions = 0;
  var totalCost = 0;

  models.forEach(function(m) {
    totalSessions += m.count;
    totalCost += m.cost;

    html += '<tr>';
    html += '<td><span class="model-color-dot" style="background:' + m.color + '"></span>' + escapeHtml(m.displayName) + '</td>';
    html += '<td>' + m.count + '</td>';
    html += '<td class="cost-cell">' + formatCurrency(m.cost) + '</td>';
    html += '</tr>';
  });

  // Totals row
  html += '<tr class="totals-row">';
  html += '<td>Total</td>';
  html += '<td>' + totalSessions + '</td>';
  html += '<td class="cost-cell">' + formatCurrency(totalCost) + '</td>';
  html += '</tr>';

  html += '</tbody></table></div>';
  return html;
}

/* ---- Loading State ---- */

function _spendLoadingState() {
  var html = '<div class="spend-summary-cards">';
  for (var i = 0; i < 4; i++) {
    html += '<div class="spend-summary-card">';
    html += '<div class="loading-skeleton skeleton-text short"></div>';
    html += '<div class="loading-skeleton" style="height:32px;margin:var(--sp-2) 0;border-radius:var(--radius-xs)"></div>';
    html += '</div>';
  }
  html += '</div>';
  html += '<div class="spend-charts">';
  html += '<div class="spend-chart-card"><div class="loading-skeleton skeleton-chart"></div></div>';
  html += '<div class="spend-chart-card"><div class="loading-skeleton skeleton-chart"></div></div>';
  html += '</div>';
  return html;
}

/* ---- Actions ---- */

function setSpendPeriod(period) {
  spendState.period = period;
  renderSpendView();
}

function sortSpendTable(col) {
  if (spendState.sortCol === col) {
    spendState.sortDir = spendState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    spendState.sortCol = col;
    spendState.sortDir = 'desc';
  }
  renderSpendView();
}

/* ---- Helpers ---- */

function _periodLabel() {
  var labels = { day: 'today', week: 'this week', month: 'this month', all: 'all time' };
  return labels[spendState.period] || '';
}

function _periodDays() {
  var map = { day: 1, week: 7, month: 30, all: 365 };
  return map[spendState.period] || 7;
}

function _getDateRange() {
  var end = new Date();
  var start = new Date();

  if (spendState.period === 'day') {
    start.setDate(start.getDate() - 1);
  } else if (spendState.period === 'week') {
    start.setDate(start.getDate() - 7);
  } else if (spendState.period === 'month') {
    start.setMonth(start.getMonth() - 1);
  } else {
    start = null; // all time
  }

  return { start: start, end: end };
}
