/* ============================================
   Mission Control v3.0 — Chart Manager
   Chart.js lifecycle management singleton.
   Prevents memory leaks by tracking instances.
   ============================================ */

var chartManager = (function() {
  var charts = {}; // canvasId → Chart instance

  return {
    /**
     * Create a Chart.js chart on a canvas.
     * Destroys any existing chart on that canvas first.
     */
    create: function(canvasId, config) {
      // Destroy existing chart on this canvas
      this.destroy(canvasId);

      var canvas = document.getElementById(canvasId);
      if (!canvas) {
        console.warn('[ChartManager] canvas not found: ' + canvasId);
        return null;
      }

      var ctx = canvas.getContext('2d');
      var chart = new Chart(ctx, config);
      charts[canvasId] = chart;
      return chart;
    },

    /**
     * Destroy a specific chart by canvas ID.
     */
    destroy: function(canvasId) {
      if (charts[canvasId]) {
        charts[canvasId].destroy();
        delete charts[canvasId];
      }
    },

    /**
     * Destroy all tracked charts.
     * Call on view switch to prevent memory leaks.
     */
    destroyAll: function() {
      Object.keys(charts).forEach(function(id) {
        if (charts[id]) {
          charts[id].destroy();
        }
      });
      charts = {};
    },

    /**
     * Get a chart instance by canvas ID.
     */
    get: function(canvasId) {
      return charts[canvasId] || null;
    },

    /**
     * Get count of active charts.
     */
    count: function() {
      return Object.keys(charts).length;
    }
  };
})();
