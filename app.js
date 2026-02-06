// ========================================
// Mission Control v2.0 - Application
// ========================================

class MissionControl {
    constructor() {
        this.currentView = 'dashboard';
        this.currentFilter = 'all';
        this.externalData = null;
        this.charts = {};
        this.calendarView = 'week';
        
        this.init();
    }

    async init() {
        this.bindEvents();
        this.updateTimestamp();
        await this.loadExternalData();
        this.renderDashboard();
        
        // Update timestamp every minute
        setInterval(() => this.updateTimestamp(), 60000);
        
        // Auto-refresh every 5 minutes
        setInterval(() => this.sync(), 5 * 60 * 1000);
    }
    
    async loadExternalData() {
        try {
            const response = await fetch('mc-data.json?t=' + Date.now());
            if (response.ok) {
                this.externalData = await response.json();
                console.log('📊 Loaded external data:', this.externalData.refreshedAt);
                this.updateStatusIndicator(true);
            }
        } catch (e) {
            console.log('Could not load external data:', e);
            this.updateStatusIndicator(false);
        }
    }

    updateStatusIndicator(online) {
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        if (online) {
            dot.className = 'status-dot online';
            text.textContent = 'Eve Online';
        } else {
            dot.className = 'status-dot offline';
            text.textContent = 'Offline';
        }
        
        // Update weather mini
        if (this.externalData?.weather?.temp) {
            document.getElementById('weatherMini').innerHTML = 
                `<span class="weather-temp">${this.externalData.weather.temp}</span>`;
        }
    }

    // ========================================
    // Event Binding
    // ========================================

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchView(item.dataset.view);
            });
        });

        // Modal close
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target.id === 'modalOverlay') {
                this.closeModal();
            }
        });

        // Delegated events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('filter-btn')) {
                this.handleFilter(e.target);
            }
            if (e.target.classList.contains('task-checkbox')) {
                this.toggleTaskComplete(e.target.closest('.task-item').dataset.id);
            }
            if (e.target.classList.contains('btn-tab')) {
                if (e.target.dataset.range) {
                    this.handleChartRange(e.target);
                }
                if (e.target.dataset.calView) {
                    this.handleCalendarView(e.target);
                }
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeModal();
            if (e.key === 'n' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.openAddModal('task');
            }
            if (e.key === 'r' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                this.sync();
            }
        });
    }

    // ========================================
    // Navigation
    // ========================================

    switchView(view) {
        this.currentView = view;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            calendar: 'Calendar',
            tasks: 'Tasks',
            spend: 'Model Usage',
            activity: 'Activity',
            conversations: 'Conversations'
        };
        document.getElementById('pageTitle').textContent = titles[view];

        // Show correct view
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`${view}View`).classList.add('active');

        // Render view content
        switch (view) {
            case 'dashboard': this.renderDashboard(); break;
            case 'calendar': this.renderCalendarFull(); break;
            case 'tasks': renderKanbanView(); break;
            case 'spend': this.renderSpend(); break;
            case 'activity': this.renderActivityView(); break;
            case 'conversations': renderConversationsView(); break;
        }
    }

    // ========================================
    // Dashboard
    // ========================================

    renderDashboard() {
        const tasks = this.getTasks();
        const activeTasks = tasks.filter(t => !t.completed);
        
        // Update stat cards
        document.getElementById('activeTasksCount').textContent = activeTasks.length;
        document.getElementById('headerTasks').textContent = activeTasks.length;
        
        // Sessions today
        const sessionsToday = this.getSessionsToday();
        document.getElementById('sessionsToday').textContent = sessionsToday;
        document.getElementById('headerSessions').textContent = sessionsToday;
        
        // Events today
        const todayEvents = this.getTodayEvents();
        document.getElementById('eventsToday').textContent = todayEvents.length;
        
        // Next event
        const nextEvent = this.getNextEvent();
        if (nextEvent) {
            const time = new Date(nextEvent.start.dateTime).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit' 
            });
            document.getElementById('nextEvent').textContent = `Next: ${time}`;
        } else {
            document.getElementById('nextEvent').textContent = 'No more today';
        }
        
        // Git commits
        const gitActivity = this.externalData?.gitActivity || [];
        document.getElementById('gitCommits').textContent = gitActivity.length;
        
        // Render calendar
        this.renderCalendarEvents();
        
        // Update last refresh time
        if (this.externalData?.refreshedAt) {
            document.getElementById('lastRefresh').textContent = 
                `Updated ${this.timeAgo(this.externalData.refreshedAt)}`;
        }
        
        // Render current work
        this.renderCurrentWork();
        
        // Render activity
        this.renderActivity();
        
        // Render sessions chart
        this.renderSessionsChart();
    }

    getSessionsToday() {
        if (!this.externalData?.modelUsage?.dailyCounts) return 0;
        const today = new Date().toISOString().split('T')[0];
        const todayData = this.externalData.modelUsage.dailyCounts.find(d => d.date === today);
        return todayData?.sessions || 0;
    }

    getTodayEvents() {
        if (!this.externalData?.calendar?.events) return [];
        const today = new Date().toISOString().split('T')[0];
        return this.externalData.calendar.events.filter(e => {
            const eventDate = (e.start.dateTime || e.start.date).split('T')[0];
            return eventDate === today;
        });
    }

    getNextEvent() {
        const now = new Date();
        const todayEvents = this.getTodayEvents();
        return todayEvents.find(e => {
            const eventTime = new Date(e.start.dateTime);
            return eventTime > now;
        });
    }

    getTasks() {
        // First try external data (from tasks.json)
        if (this.externalData?.tasks?.tasks) {
            return this.externalData.tasks.tasks;
        }
        // Fallback to localStorage
        const stored = localStorage.getItem('mc_tasks');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    renderCalendarEvents() {
        const events = this.externalData?.calendar?.events || [];
        const container = document.getElementById('calendarEvents');
        const now = new Date();
        
        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state">No upcoming events</div>';
            return;
        }
        
        // Group events by date
        const eventsByDate = {};
        const daysToShow = this.calendarView === 'day' ? 1 : 7;
        
        events.forEach(event => {
            const startDate = new Date(event.start.dateTime || event.start.date);
            const dateKey = startDate.toISOString().split('T')[0];
            if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
            eventsByDate[dateKey].push(event);
        });
        
        let html = '';
        const dates = Object.keys(eventsByDate).sort().slice(0, daysToShow);
        
        dates.forEach(dateKey => {
            const date = new Date(dateKey + 'T12:00:00');
            const isToday = dateKey === now.toISOString().split('T')[0];
            const isTomorrow = dateKey === new Date(Date.now() + 86400000).toISOString().split('T')[0];
            
            let dayLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            if (isToday) dayLabel = '📍 Today';
            else if (isTomorrow) dayLabel = 'Tomorrow';
            
            html += `<div class="calendar-day ${isToday ? 'today' : ''}">
                <div class="calendar-day-label">${dayLabel}</div>`;
            
            eventsByDate[dateKey].forEach(event => {
                const startTime = new Date(event.start.dateTime || event.start.date);
                const hasTime = event.start.dateTime;
                const timeStr = hasTime ? startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'All day';
                const isPast = startTime < now;
                
                html += `
                    <div class="calendar-event ${isPast ? 'past' : ''}">
                        <span class="event-time">${timeStr}</span>
                        <span class="event-title">${this.escapeHtml(event.summary)}</span>
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        container.innerHTML = html || '<div class="empty-state">No upcoming events</div>';
    }

    handleCalendarView(btn) {
        document.querySelectorAll('[data-cal-view]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.calendarView = btn.dataset.calView;
        this.renderCalendarEvents();
    }

    renderCurrentWork() {
        const tasks = this.getTasks().filter(t => !t.completed).slice(0, 5);
        const container = document.getElementById('currentWorkList');

        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-state">No active tasks</p>';
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="work-item" data-id="${task.id}">
                <div class="work-priority ${task.priority || 'medium'}"></div>
                <div class="work-content">
                    <div class="work-title">${this.escapeHtml(task.title)}</div>
                    <div class="work-meta">${task.category || 'general'} · Due ${this.formatDate(task.dueDate)}</div>
                </div>
            </div>
        `).join('');
    }

    renderActivity() {
        const container = document.getElementById('activityList');
        const activities = [];
        
        // Add git activity
        const gitActivity = this.externalData?.gitActivity || [];
        gitActivity.slice(0, 5).forEach(commit => {
            activities.push({
                type: 'git',
                text: `Committed: ${commit.message}`,
                timestamp: commit.date,
                icon: '📝'
            });
        });
        
        // Add task activity from localStorage
        const storedActivity = localStorage.getItem('mc_activity');
        if (storedActivity) {
            try {
                const taskActivity = JSON.parse(storedActivity);
                activities.push(...taskActivity.slice(0, 5).map(a => ({
                    ...a,
                    icon: '✅'
                })));
            } catch (e) {}
        }
        
        // Sort by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (activities.length === 0) {
            container.innerHTML = '<p class="empty-state">No recent activity</p>';
            return;
        }

        container.innerHTML = activities.slice(0, 6).map(item => `
            <div class="activity-item">
                <div class="activity-icon">${item.icon || '•'}</div>
                <div class="activity-content">
                    <div class="activity-text">${this.escapeHtml(item.text)}</div>
                    <div class="activity-time">${this.timeAgo(item.timestamp)}</div>
                </div>
            </div>
        `).join('');
    }

    renderSessionsChart() {
        const ctx = document.getElementById('sessionsChart');
        if (!ctx) return;
        
        // Destroy existing chart
        if (this.charts.sessions) {
            this.charts.sessions.destroy();
        }
        
        const dailyCounts = this.externalData?.modelUsage?.dailyCounts || [];
        const labels = dailyCounts.map(d => {
            const date = new Date(d.date);
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        });
        const data = dailyCounts.map(d => d.sessions);
        
        this.charts.sessions = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['No data'],
                datasets: [{
                    label: 'Sessions',
                    data: data.length ? data : [0],
                    backgroundColor: 'rgba(99, 91, 255, 0.8)',
                    borderColor: 'rgba(99, 91, 255, 1)',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                    }
                }
            }
        });
    }

    // ========================================
    // Calendar Full View
    // ========================================

    renderCalendarFull() {
        const events = this.externalData?.calendar?.events || [];
        const container = document.getElementById('calendarFull');
        
        if (events.length === 0) {
            container.innerHTML = '<div class="empty-state-large"><p>No upcoming events</p></div>';
            return;
        }
        
        // Group by date
        const eventsByDate = {};
        events.forEach(event => {
            const startDate = new Date(event.start.dateTime || event.start.date);
            const dateKey = startDate.toISOString().split('T')[0];
            if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
            eventsByDate[dateKey].push(event);
        });
        
        const now = new Date();
        let html = '';
        
        Object.keys(eventsByDate).sort().forEach(dateKey => {
            const date = new Date(dateKey + 'T12:00:00');
            const isToday = dateKey === now.toISOString().split('T')[0];
            const dayLabel = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
            });
            
            html += `
                <div class="calendar-day-full ${isToday ? 'today' : ''}">
                    <div class="calendar-day-header">
                        <span class="calendar-day-name">${isToday ? '📍 Today' : dayLabel}</span>
                        <span class="calendar-event-count">${eventsByDate[dateKey].length} events</span>
                    </div>
                    <div class="calendar-events-list">
            `;
            
            eventsByDate[dateKey].forEach(event => {
                const startTime = new Date(event.start.dateTime || event.start.date);
                const endTime = new Date(event.end.dateTime || event.end.date);
                const hasTime = event.start.dateTime;
                const timeStr = hasTime 
                    ? `${startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} - ${endTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                    : 'All day';
                const isPast = startTime < now;
                
                html += `
                    <div class="calendar-event-full ${isPast ? 'past' : ''}">
                        <div class="event-time-full">${timeStr}</div>
                        <div class="event-details">
                            <div class="event-title-full">${this.escapeHtml(event.summary)}</div>
                            ${event.location ? `<div class="event-location">📍 ${this.escapeHtml(event.location)}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += '</div></div>';
        });
        
        container.innerHTML = html;
    }

    // ========================================
    // Tasks
    // ========================================

    renderTasks(filter = this.currentFilter) {
        this.currentFilter = filter;
        let tasks = this.getTasks();

        if (filter === 'active') {
            tasks = tasks.filter(t => !t.completed);
        } else if (filter === 'completed') {
            tasks = tasks.filter(t => t.completed);
        }

        // Update filter buttons
        document.querySelectorAll('[data-filter]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });

        const container = document.getElementById('tasksList');

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state-large">
                    <p>No ${filter === 'all' ? '' : filter} tasks</p>
                    <button class="btn btn-primary" onclick="app.openAddModal('task')">+ Add Task</button>
                </div>
            `;
            return;
        }

        container.innerHTML = tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}"></div>
                <div class="task-content">
                    <div class="task-title">${this.escapeHtml(task.title)}</div>
                    <div class="task-details">
                        <span class="task-priority ${task.priority || 'medium'}">${task.priority || 'medium'}</span>
                        <span>${task.category || 'general'}</span>
                        <span>Due ${this.formatDate(task.dueDate)}</span>
                    </div>
                    ${task.description ? `<div class="task-description">${this.escapeHtml(task.description)}</div>` : ''}
                </div>
                <div class="task-actions">
                    <button class="btn-icon" onclick="app.editTask('${task.id}')" title="Edit">✎</button>
                    <button class="btn-icon danger" onclick="app.deleteTask('${task.id}')" title="Delete">×</button>
                </div>
            </div>
        `).join('');
    }

    handleFilter(btn) {
        const filter = btn.dataset.filter;
        if (filter) {
            this.renderTasks(filter);
        }
    }

    toggleTaskComplete(id) {
        const tasks = this.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.completedAt = task.completed ? new Date().toISOString() : null;
            this.saveTasks(tasks);
            this.addActivity(`${task.completed ? 'Completed' : 'Reopened'} task: ${task.title}`);
            this.renderTasks();
            if (this.currentView === 'dashboard') {
                this.renderDashboard();
            }
        }
    }

    saveTasks(tasks) {
        localStorage.setItem('mc_tasks', JSON.stringify(tasks));
    }

    addActivity(text) {
        const activities = JSON.parse(localStorage.getItem('mc_activity') || '[]');
        activities.unshift({
            id: Date.now().toString(),
            text,
            timestamp: new Date().toISOString(),
            type: 'task'
        });
        localStorage.setItem('mc_activity', JSON.stringify(activities.slice(0, 50)));
    }

    editTask(id) {
        const task = this.getTasks().find(t => t.id === id);
        if (task) {
            this.openAddModal('task', task);
        }
    }

    deleteTask(id) {
        if (confirm('Delete this task?')) {
            const tasks = this.getTasks().filter(t => t.id !== id);
            this.saveTasks(tasks);
            this.renderTasks();
            this.showToast('Task deleted');
        }
    }

    // ========================================
    // Spend View
    // ========================================

    renderSpend() {
        const modelUsage = this.externalData?.modelUsage || {};
        const byModel = modelUsage.byModel || [];
        const dailyCounts = modelUsage.dailyCounts || [];
        const totalCost = modelUsage.totalCost || 0;
        
        // Total sessions and cost
        const total = dailyCounts.reduce((sum, d) => sum + d.sessions, 0);
        document.getElementById('totalSessions').textContent = `${total} sessions · $${totalCost.toFixed(2)} spent`;
        
        // Render model pie chart
        this.renderModelPieChart(byModel);
        
        // Render daily chart
        this.renderDailySessionsChart(dailyCounts);
        
        // Model bars
        this.renderModelBars(byModel);
    }

    renderModelPieChart(byModel) {
        const ctx = document.getElementById('modelPieChart');
        if (!ctx) return;
        
        if (this.charts.modelPie) {
            this.charts.modelPie.destroy();
        }
        
        if (byModel.length === 0) {
            ctx.parentElement.innerHTML = '<div class="empty-state">No model data</div>';
            return;
        }
        
        const colors = ['#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4'];
        
        this.charts.modelPie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: byModel.map(m => m.model),
                datasets: [{
                    data: byModel.map(m => m.count),
                    backgroundColor: colors.slice(0, byModel.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: 'rgba(255, 255, 255, 0.8)' }
                    }
                }
            }
        });
    }

    renderDailySessionsChart(dailyCounts) {
        const ctx = document.getElementById('dailySessionsChart');
        if (!ctx) return;
        
        if (this.charts.dailySessions) {
            this.charts.dailySessions.destroy();
        }
        
        if (dailyCounts.length === 0) {
            ctx.parentElement.innerHTML = '<div class="empty-state">No daily data</div>';
            return;
        }
        
        this.charts.dailySessions = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyCounts.map(d => d.date.slice(5)),
                datasets: [{
                    label: 'Sessions',
                    data: dailyCounts.map(d => d.sessions),
                    borderColor: '#00d4ff',
                    backgroundColor: 'rgba(0, 212, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                    }
                }
            }
        });
    }

    renderModelBars(byModel) {
        const container = document.getElementById('modelBars');
        if (!container) return;
        
        if (byModel.length === 0) {
            container.innerHTML = '<div class="empty-state">No model data</div>';
            return;
        }
        
        const maxCost = Math.max(...byModel.map(m => m.cost || 0), 1);
        const colors = {
            'opus': '#8b5cf6',
            'sonnet': '#3b82f6',
            'haiku': '#22c55e'
        };
        
        container.innerHTML = byModel.map(model => {
            const color = colors[model.model] || '#666';
            const width = ((model.cost || 0) / maxCost) * 100;
            const cost = model.cost ? `$${model.cost.toFixed(2)}` : '$0.00';
            return `
                <div class="model-bar-item">
                    <div class="model-bar-header">
                        <span class="model-bar-name">${model.model}</span>
                        <span class="model-bar-value">${model.count} calls · ${cost}</span>
                    </div>
                    <div class="model-bar-track">
                        <div class="model-bar-fill" style="width: ${width}%; background: ${color}"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ========================================
    // Activity View
    // ========================================

    renderActivityView() {
        const container = document.getElementById('activityTimeline');
        const activities = [];
        
        // Add git activity
        const gitActivity = this.externalData?.gitActivity || [];
        gitActivity.forEach(commit => {
            activities.push({
                type: 'git',
                text: commit.message,
                timestamp: commit.date,
                author: commit.author,
                hash: commit.hash
            });
        });
        
        // Add local activity
        const storedActivity = localStorage.getItem('mc_activity');
        if (storedActivity) {
            try {
                activities.push(...JSON.parse(storedActivity));
            } catch (e) {}
        }
        
        // Sort by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        if (activities.length === 0) {
            container.innerHTML = '<div class="empty-state-large"><p>No recent activity</p></div>';
            return;
        }
        
        container.innerHTML = activities.map(item => {
            const icon = item.type === 'git' ? '📝' : '✅';
            const typeLabel = item.type === 'git' ? 'Git Commit' : 'Task Update';
            
            return `
                <div class="activity-item-full">
                    <div class="activity-icon-full">${icon}</div>
                    <div class="activity-content-full">
                        <div class="activity-header">
                            <span class="activity-type">${typeLabel}</span>
                            <span class="activity-time">${this.timeAgo(item.timestamp)}</span>
                        </div>
                        <div class="activity-text">${this.escapeHtml(item.text)}</div>
                        ${item.hash ? `<div class="activity-meta">Hash: ${item.hash}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ========================================
    // Modal
    // ========================================

    openAddModal(type = 'task', editData = null) {
        const overlay = document.getElementById('modalOverlay');
        const title = document.getElementById('modalTitle');
        const content = document.getElementById('modalContent');

        title.textContent = editData ? `Edit ${type}` : `Add ${type}`;
        content.innerHTML = this.getTaskForm(editData);
        overlay.classList.add('active');
    }

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('active');
    }

    getTaskForm(task = null) {
        const categories = ['development', 'research', 'strategy', 'infrastructure', 'client', 'learning', 'other'];
        
        return `
            <form id="taskForm" onsubmit="app.saveTask(event, ${task ? `'${task.id}'` : 'null'})">
                <div class="form-group">
                    <label class="form-label">Title</label>
                    <input type="text" class="form-input" name="title" value="${task?.title || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea class="form-textarea" name="description">${task?.description || ''}</textarea>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label class="form-label">Priority</label>
                        <select class="form-select" name="priority">
                            <option value="low" ${task?.priority === 'low' ? 'selected' : ''}>Low</option>
                            <option value="medium" ${(!task || task?.priority === 'medium') ? 'selected' : ''}>Medium</option>
                            <option value="high" ${task?.priority === 'high' ? 'selected' : ''}>High</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Category</label>
                        <select class="form-select" name="category">
                            ${categories.map(cat => `
                                <option value="${cat}" ${task?.category === cat ? 'selected' : ''}>${cat}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Due Date</label>
                    <input type="date" class="form-input" name="dueDate" value="${task?.dueDate || this.getDefaultDate()}">
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Task</button>
                </div>
            </form>
        `;
    }

    saveTask(e, id = null) {
        e.preventDefault();
        const form = e.target;
        const tasks = this.getTasks();
        
        const data = {
            id: id || Date.now().toString(),
            title: form.title.value,
            description: form.description.value,
            priority: form.priority.value,
            category: form.category.value,
            dueDate: form.dueDate.value,
            completed: false,
            createdAt: new Date().toISOString()
        };

        if (id) {
            const index = tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                data.completed = tasks[index].completed;
                data.completedAt = tasks[index].completedAt;
                data.createdAt = tasks[index].createdAt;
                tasks[index] = data;
            }
        } else {
            tasks.unshift(data);
        }

        this.saveTasks(tasks);
        this.addActivity(`${id ? 'Updated' : 'Created'} task: ${data.title}`);
        this.closeModal();
        this.showToast(id ? 'Task updated' : 'Task created');
        this.renderTasks();
        if (this.currentView === 'dashboard') {
            this.renderDashboard();
        }
    }

    // ========================================
    // Sync & Refresh
    // ========================================

    async sync() {
        const btn = document.getElementById('syncBtn');
        btn.classList.add('syncing');
        btn.innerHTML = '<span class="sync-icon spinning">⟳</span> Syncing...';
        
        try {
            await this.loadExternalData();
            this.showToast('Data synced successfully');
            
            // Re-render current view
            this.switchView(this.currentView);
        } catch (e) {
            console.error('Sync error:', e);
            this.showToast('Sync failed', 'error');
        }
        
        setTimeout(() => {
            btn.classList.remove('syncing');
            btn.innerHTML = '<span class="sync-icon">⟳</span> Sync';
        }, 1000);
    }

    quickRefresh() {
        this.sync();
    }

    // ========================================
    // Utilities
    // ========================================

    updateTimestamp() {
        const now = new Date();
        document.getElementById('timestamp').textContent = now.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    formatDate(dateStr) {
        if (!dateStr) return 'No date';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((date - now) / (1000 * 60 * 60 * 24));
        
        if (diff === 0) return 'Today';
        if (diff === 1) return 'Tomorrow';
        if (diff === -1) return 'Yesterday';
        if (diff > 0 && diff < 7) return `in ${diff} days`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    timeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = Math.floor((now - then) / 1000);

        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        
        return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    getDefaultDate() {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date.toISOString().split('T')[0];
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    exportData() {
        const data = {
            tasks: this.getTasks(),
            activity: JSON.parse(localStorage.getItem('mc_activity') || '[]'),
            externalData: this.externalData,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mission-control-export-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Data exported');
    }
}

// Initialize app
const app = new MissionControl();
