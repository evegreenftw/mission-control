// ========================================
// Mission Control v2.0 - Data Layer
// ========================================

// This file provides fallback data and utilities
// Real data is loaded from mc-data.json (populated by refresh-data.sh)

const DEFAULT_TASKS = [
    {
        id: '1',
        title: 'Build Mission Control dashboard',
        description: 'Create PM app for tracking Eve\'s work and model spend',
        priority: 'high',
        category: 'development',
        dueDate: '2026-02-05',
        createdAt: '2026-02-05T17:00:00Z',
        completed: true,
        completedAt: '2026-02-05T19:06:00Z'
    },
    {
        id: '2',
        title: 'Upgrade dashboard with real data',
        description: 'Add Chart.js, real model tracking, git activity',
        priority: 'high',
        category: 'development',
        dueDate: '2026-02-06',
        createdAt: '2026-02-05T23:50:00Z',
        completed: false
    }
];

// Model color mapping
const MODEL_COLORS = {
    'claude-opus-4-5': '#8b5cf6',
    'claude-sonnet-4-5': '#3b82f6',
    'claude-haiku-4-5': '#22c55e',
    'anthropic/claude-opus-4-5': '#8b5cf6',
    'anthropic/claude-sonnet-4-5': '#3b82f6',
    'anthropic/claude-haiku-4-5': '#22c55e',
    'deepseek': '#f59e0b',
    'minimax': '#ef4444',
    'kimi': '#ec4899',
    'gemini': '#06b6d4'
};

// Priority colors
const PRIORITY_COLORS = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e'
};

// Initialize localStorage with defaults if empty
(function initializeDefaults() {
    if (!localStorage.getItem('mc_tasks')) {
        localStorage.setItem('mc_tasks', JSON.stringify(DEFAULT_TASKS));
    }
    if (!localStorage.getItem('mc_activity')) {
        localStorage.setItem('mc_activity', JSON.stringify([
            {
                id: '1',
                text: 'Dashboard upgraded to v2.0',
                type: 'system',
                timestamp: new Date().toISOString()
            }
        ]));
    }
})();
