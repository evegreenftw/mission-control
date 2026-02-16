// Conversations View - Display OpenClaw chat logs with Second Brain search

let searchDebounceTimer = null;
let currentSearchQuery = '';
let searchMode = 'recent'; // 'recent' or 'search'

async function renderConversationsView() {
    const html = `
        <div class="conversations-view">
            <div class="conversations-header">
                <h2>Conversation History</h2>
                <p>Search your conversations with Eve using semantic search</p>
            </div>
            
            <!-- Search Bar -->
            <div class="conversations-search-container">
                <div class="search-bar">
                    <svg class="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" stroke-width="1.5"/>
                        <path d="M12.5 12.5L16.5 16.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                    </svg>
                    <input 
                        type="text" 
                        id="conversationSearch" 
                        class="search-input" 
                        placeholder="Search conversations... (e.g., 'AI consulting pricing strategy')"
                        autocomplete="off"
                    >
                    <button id="clearSearch" class="search-clear" style="display: none;">×</button>
                </div>
                <div class="search-status" id="searchStatus">
                    <span class="status-indicator">◉</span>
                    <span id="searchStatusText">Semantic search ready</span>
                </div>
            </div>
            
            <!-- Search Results Container -->
            <div id="searchResultsContainer" style="display: none;">
                <div class="search-results-header">
                    <h3 id="searchResultsTitle">Search Results</h3>
                    <button class="btn-text" onclick="clearSearch()">← Back to recent</button>
                </div>
                <div id="searchResults" class="search-results">
                    <!-- Populated by search -->
                </div>
            </div>
            
            <!-- Recent Conversations (Default View) -->
            <div id="recentConversations">
                <div class="conversations-list-header">
                    <h3>Recent Conversations</h3>
                </div>
                <div id="conversationList" class="conversation-list">
                    <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                        Loading conversations...
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('content').querySelector('.view.active').innerHTML = html;
    
    // Bind search events
    bindSearchEvents();
    
    // Load recent conversations
    await loadConversations();
}

function bindSearchEvents() {
    const searchInput = document.getElementById('conversationSearch');
    const clearBtn = document.getElementById('clearSearch');
    
    // Search input with debounce
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        
        // Show/hide clear button
        clearBtn.style.display = query ? 'block' : 'none';
        
        // Clear existing timer
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
        }
        
        // If empty query, show recent conversations
        if (!query) {
            showRecentConversations();
            return;
        }
        
        // Debounce search
        searchDebounceTimer = setTimeout(() => {
            performSearch(query);
        }, 300);
    });
    
    // Clear button
    clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearBtn.style.display = 'none';
        showRecentConversations();
        searchInput.focus();
    });
    
    // Focus search on load
    searchInput.focus();
}

async function performSearch(query) {
    currentSearchQuery = query;
    searchMode = 'search';
    
    // Update UI
    document.getElementById('recentConversations').style.display = 'none';
    document.getElementById('searchResultsContainer').style.display = 'block';
    
    // Show loading state
    const resultsContainer = document.getElementById('searchResults');
    resultsContainer.innerHTML = `
        <div class="search-loading">
            <div class="spinner"></div>
            <p>Searching conversations...</p>
        </div>
    `;
    
    try {
        // Call Second Brain search API
        const response = await fetch(`http://localhost:3001/search?q=${encodeURIComponent(query)}`);
        
        if (!response.ok) {
            throw new Error('Search service unavailable');
        }
        
        const results = await response.json();
        renderSearchResults(results, query);
        
    } catch (error) {
        console.error('Search error:', error);
        renderSearchError(error.message);
    }
}

function renderSearchResults(results, query) {
    const resultsContainer = document.getElementById('searchResults');
    const titleEl = document.getElementById('searchResultsTitle');
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="search-empty">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor">
                    <circle cx="24" cy="24" r="16" stroke="currentColor" stroke-width="2" fill="none"/>
                    <path d="M36 36L48 48" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M24 18V24M24 24V30M24 24H18M24 24H30" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <h3>No matches found</h3>
                <p>Try different keywords or browse recent conversations below</p>
                <button class="btn btn-secondary" onclick="clearSearch()">Show recent conversations</button>
            </div>
        `;
        titleEl.textContent = 'No Results';
        return;
    }
    
    titleEl.textContent = `Found ${results.length} result${results.length === 1 ? '' : 's'}`;
    
    resultsContainer.innerHTML = results.map((result, idx) => {
        const relevance = Math.round(Math.abs(result.relevance) * 100);
        const date = new Date(result.timestamp);
        
        return `
            <div class="search-result-card" data-result-idx="${idx}">
                <div class="search-result-header">
                    <div class="search-result-meta">
                        <span class="search-result-date">${formatConversationDate(date)}</span>
                        <span class="search-result-messages">${result.message_count} messages</span>
                        <span class="search-result-relevance" data-relevance="${relevance}">
                            ${relevance}% match
                        </span>
                    </div>
                </div>
                <div class="search-result-snippet">
                    ${highlightSearchTerms(result.snippet, query)}
                </div>
                <button class="search-result-expand" onclick="toggleSearchResult(${idx})">
                    <span class="expand-text">Show full conversation</span>
                    <svg class="expand-icon" width="16" height="16" viewBox="0 0 16 16">
                        <path d="M4 6L8 10L12 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
                <div class="search-result-full" id="searchResult-${idx}" style="display: none;">
                    <div class="loading-conversation">Loading full conversation...</div>
                </div>
            </div>
        `;
    }).join('');
    
    // Store results for expansion
    window.searchResults = results;
}

function renderSearchError(errorMessage) {
    const resultsContainer = document.getElementById('searchResults');
    const statusText = document.getElementById('searchStatusText');
    
    resultsContainer.innerHTML = `
        <div class="search-error">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor">
                <circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M32 20V36M32 42V44" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <h3>Search unavailable</h3>
            <p>${errorMessage}</p>
            <p style="margin-top: 8px; font-size: 0.9em; color: var(--text-muted);">
                The Second Brain search service may be offline. Showing recent conversations instead.
            </p>
            <button class="btn btn-secondary" onclick="clearSearch()">Browse recent conversations</button>
        </div>
    `;
    
    // Update status indicator
    statusText.textContent = 'Search unavailable (showing recent)';
    document.getElementById('searchStatus').style.color = 'var(--warning)';
}

async function toggleSearchResult(idx) {
    const resultEl = document.getElementById(`searchResult-${idx}`);
    const expandBtn = resultEl.previousElementSibling;
    const expandText = expandBtn.querySelector('.expand-text');
    const expandIcon = expandBtn.querySelector('.expand-icon');
    
    if (resultEl.style.display === 'none') {
        // Expand
        resultEl.style.display = 'block';
        expandText.textContent = 'Hide conversation';
        expandIcon.style.transform = 'rotate(180deg)';
        
        // Load full conversation if not already loaded
        if (resultEl.querySelector('.loading-conversation')) {
            await loadFullConversation(idx, resultEl);
        }
    } else {
        // Collapse
        resultEl.style.display = 'none';
        expandText.textContent = 'Show full conversation';
        expandIcon.style.transform = 'rotate(0deg)';
    }
}

async function loadFullConversation(idx, containerEl) {
    const result = window.searchResults[idx];
    
    try {
        // Load the full conversation from conversations.json
        const response = await fetch('conversations.json?t=' + Date.now());
        const data = await response.json();
        
        // Find the matching conversation by sessionId
        const conversation = data.conversations.find(c => c.sessionId === result.sessionId);
        
        if (conversation && conversation.messages) {
            containerEl.innerHTML = renderConversationMessages(conversation.messages);
        } else {
            containerEl.innerHTML = `
                <div style="padding: 20px; text-align: center; color: var(--text-muted);">
                    <p>Full conversation not available</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading full conversation:', error);
        containerEl.innerHTML = `
            <div style="padding: 20px; text-align: center; color: var(--error);">
                <p>Error loading conversation</p>
            </div>
        `;
    }
}

function highlightSearchTerms(text, query) {
    if (!query || !text) return text;
    
    // Simple word-based highlighting
    const words = query.toLowerCase().split(/\s+/);
    let highlighted = escapeHtml(text);
    
    words.forEach(word => {
        if (word.length > 2) { // Only highlight words with 3+ chars
            const regex = new RegExp(`(${word})`, 'gi');
            highlighted = highlighted.replace(regex, '<mark>$1</mark>');
        }
    });
    
    return highlighted;
}

function showRecentConversations() {
    searchMode = 'recent';
    currentSearchQuery = '';
    
    document.getElementById('recentConversations').style.display = 'block';
    document.getElementById('searchResultsContainer').style.display = 'none';
    
    // Reset status
    document.getElementById('searchStatusText').textContent = 'Semantic search ready';
    document.getElementById('searchStatus').style.color = '';
}

function clearSearch() {
    document.getElementById('conversationSearch').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    showRecentConversations();
}

async function loadConversations() {
    try {
        const response = await fetch('conversations.json?t=' + Date.now());
        if (response.ok) {
            const data = await response.json();
            renderConversationList(data.conversations || []);
        } else {
            renderConversationList([]);
        }
    } catch (e) {
        console.error('Error loading conversations:', e);
        renderConversationList([]);
    }
}

function renderConversationList(conversations) {
    const listEl = document.getElementById('conversationList');
    
    if (conversations.length === 0) {
        listEl.innerHTML = `
            <div class="conversation-empty">
                <svg viewBox="0 0 64 64" fill="currentColor">
                    <path d="M32 8C18.745 8 8 18.745 8 32s10.745 24 24 24c3.652 0 7.086-.823 10.181-2.285L52 56l-2.285-9.819C51.177 43.086 56 37.652 56 32c0-13.255-10.745-24-24-24zm0 4c11.046 0 20 8.954 20 20 0 4.923-1.786 9.43-4.743 12.915l-.629.742.371 1.579 1.086 4.622-4.622-1.086-1.579-.371-.742.629C38.43 54.214 33.923 56 29 56c-11.046 0-20-8.954-20-20S20.954 12 32 12z"/>
                    <circle cx="24" cy="32" r="2"/>
                    <circle cx="32" cy="32" r="2"/>
                    <circle cx="40" cy="32" r="2"/>
                </svg>
                <p>No conversations yet</p>
                <p style="margin-top: 8px; color: var(--text-muted); font-size: 0.9em;">
                    Your conversation history will appear here once indexed
                </p>
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = conversations.map((conv, idx) => {
        const date = new Date(conv.startTime || conv.timestamp);
        const messageCount = conv.messages ? conv.messages.length : 0;
        
        // Get preview from first user message if available
        let preview = 'No messages';
        if (conv.messages && conv.messages.length > 0) {
            const firstUserMsg = conv.messages.find(m => m.role === 'user');
            if (firstUserMsg) {
                preview = firstUserMsg.content.substring(0, 200) + (firstUserMsg.content.length > 200 ? '...' : '');
            } else {
                preview = conv.messages[0].content.substring(0, 200) + '...';
            }
        }
        
        return `
            <div class="conversation-item">
                <div class="conversation-item-header" onclick="toggleConversation(${idx})">
                    <span class="conversation-date">${formatConversationDate(date)}</span>
                    <div class="conversation-meta">
                        <span>${messageCount} messages</span>
                        <span class="conversation-expand-icon">▼</span>
                    </div>
                </div>
                <div class="conversation-preview" onclick="toggleConversation(${idx})">
                    ${escapeHtml(preview)}
                </div>
                <div class="conversation-expanded" id="conversation-${idx}" style="display: none;">
                    ${renderConversationMessages(conv.messages || [])}
                </div>
            </div>
        `;
    }).join('');
}

function renderConversationMessages(messages) {
    if (!messages || messages.length === 0) {
        return '<div style="padding: 20px; text-align: center; color: var(--text-muted);">No messages</div>';
    }
    
    return messages.map(msg => {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        const content = msg.content || '';
        
        return `
            <div class="message ${role}">
                <div class="message-role">${msg.role === 'user' ? 'You' : 'Eve'}</div>
                <div class="message-content">${escapeHtml(content)}</div>
            </div>
        `;
    }).join('');
}

function toggleConversation(idx) {
    const el = document.getElementById(`conversation-${idx}`);
    const item = el.parentElement;
    const icon = item.querySelector('.conversation-expand-icon');
    
    if (el) {
        if (el.style.display === 'none') {
            el.style.display = 'block';
            icon.textContent = '▲';
            item.classList.add('expanded');
        } else {
            el.style.display = 'none';
            icon.textContent = '▼';
            item.classList.remove('expanded');
        }
    }
}

function formatConversationDate(date) {
    const now = new Date();
    const diffTime = now - date;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Today ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
