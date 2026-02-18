/* ============================================
   Mission Control v3.0 — AgentStore
   Agent registry. Reads agents.json.
   OpenClaw is always present as primary agent.
   ============================================ */

var LS_KEY_AGENTS = 'mc_v3_agents';

class AgentStore {
  constructor() {
    this.agents = [];
    this.loaded = false;
  }

  /**
   * Load agents from DataService and/or localStorage.
   */
  load() {
    this.agents = [];

    // Try localStorage first (user edits)
    var stored = this._loadFromLocalStorage();
    if (stored && stored.length > 0) {
      this.agents = stored;
    } else {
      // Try dataService
      var data = dataService.getData('agents');
      if (data && Array.isArray(data)) {
        var self = this;
        data.forEach(function(raw) {
          var result = validateAgent(raw);
          if (result.valid) {
            self.agents.push(raw);
          } else {
            self._log('skipped invalid agent: ' + result.errors.join(', '));
          }
        });
      }
    }

    // Ensure OpenClaw always exists as primary
    this._ensurePrimary();
    this.loaded = true;
    this._log('loaded ' + this.agents.length + ' agents');
  }

  /**
   * Get all agents.
   */
  getAgents() {
    return this.agents.slice();
  }

  /**
   * Get the primary agent.
   */
  getPrimary() {
    return this.agents.find(function(a) { return a.type === 'primary'; }) || null;
  }

  /**
   * Get all subagents.
   */
  getSubagents() {
    return this.agents.filter(function(a) { return a.type === 'subagent'; });
  }

  /**
   * Get an agent by ID.
   */
  getAgent(id) {
    return this.agents.find(function(a) { return a.id === id; }) || null;
  }

  /**
   * Get count of active agents.
   */
  getActiveCount() {
    return this.agents.filter(function(a) { return a.status === 'active'; }).length;
  }

  /**
   * Get agent names for assignee dropdowns.
   */
  getAssigneeOptions() {
    var options = [{ value: 'eve', label: 'Eve' }];
    this.agents.forEach(function(a) {
      options.push({ value: a.name.toLowerCase(), label: a.name });
    });
    return options;
  }

  /**
   * Get tasks assigned to an agent.
   */
  getAgentTasks(agentName) {
    if (!taskStore || !taskStore.loaded) return [];
    var name = agentName.toLowerCase();
    return taskStore.getTasks().filter(function(t) {
      return t.assignee && t.assignee.toLowerCase() === name;
    });
  }

  /**
   * Add a new subagent.
   */
  addAgent(agentData) {
    var agent = {
      id: generateId(),
      name: (agentData.name || '').trim(),
      type: 'subagent',
      status: agentData.status || 'idle',
      capabilities: agentData.capabilities || [],
      lastActive: new Date().toISOString()
    };

    var result = validateAgent(agent);
    if (!result.valid) {
      this._log('addAgent rejected: ' + result.errors.join(', '));
      return null;
    }

    this.agents.push(agent);
    this._persist();
    this._log('added subagent: ' + agent.name);
    return agent;
  }

  /**
   * Update an agent.
   */
  updateAgent(id, updates) {
    var idx = this.agents.findIndex(function(a) { return a.id === id; });
    if (idx === -1) return null;

    Object.assign(this.agents[idx], updates);
    this._persist();
    this._log('updated agent: ' + this.agents[idx].name);
    return this.agents[idx];
  }

  /* ---- Internal ---- */

  _ensurePrimary() {
    var hasPrimary = this.agents.some(function(a) { return a.type === 'primary'; });
    if (!hasPrimary) {
      this.agents.unshift({
        id: 'openclaw-primary',
        name: 'OpenClaw',
        type: 'primary',
        status: 'active',
        capabilities: ['task-management', 'code-generation', 'research', 'analysis'],
        lastActive: new Date().toISOString()
      });
    }
  }

  _loadFromLocalStorage() {
    try {
      var json = localStorage.getItem(LS_KEY_AGENTS);
      if (!json) return null;
      var arr = JSON.parse(json);
      if (!Array.isArray(arr) || arr.length === 0) return null;

      var valid = [];
      var self = this;
      arr.forEach(function(agent) {
        var result = validateAgent(agent);
        if (result.valid) valid.push(agent);
        else self._log('localStorage: skipped invalid agent');
      });

      return valid.length > 0 ? valid : null;
    } catch (e) {
      this._log('localStorage parse error, discarding');
      localStorage.removeItem(LS_KEY_AGENTS);
      return null;
    }
  }

  _persist() {
    try {
      localStorage.setItem(LS_KEY_AGENTS, JSON.stringify(this.agents));
    } catch (e) {
      this._log('persist failed: ' + e.message);
    }
  }

  _log(msg) {
    var ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    console.log('[' + ts + '] AgentStore: ' + msg);
  }
}

// Global instance
var agentStore = new AgentStore();
