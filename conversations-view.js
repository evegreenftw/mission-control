// Conversations View - Display OpenClaw chat logs

async function renderConversationsView() {
    const html = `
        <div class="conversations-view">
            <div class="conversations-header">
                <h2>Conversation History</h2>
                <p>Your recent chats with Eve</p>
            </div>
            <div id="conversationList" class="conversation-list">
                <div style="text-align: center; padding: 60px 20px; color: var(--text-muted);">
                    Loading conversations...
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
    await loadConversations();
}

async function loadConversations() {
    try {
        // For now, load from mc-data.json which should include recent conversations
        // In the future, this can directly parse OpenClaw session files
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
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = conversations.map((conv, idx) => {
        const date = new Date(conv.timestamp);
        const messageCount = conv.messages ? conv.messages.length : 0;
        const preview = conv.messages && conv.messages.length > 0 
            ? conv.messages[0].content.substring(0, 150) + '...'
            : 'No messages';
        
        return `
            <div class="conversation-item" onclick="toggleConversation(${idx})">
                <div class="conversation-item-header">
                    <span class="conversation-date">${formatConversationDate(date)}</span>
                    <div class="conversation-meta">
                        <span>${messageCount} messages</span>
                        <span>${conv.channel || 'telegram'}</span>
                    </div>
                </div>
                <div class="conversation-preview">${preview}</div>
                <div class="conversation-expanded" id="conversation-${idx}" style="display: none;">
                    ${renderConversationMessages(conv.messages || [])}
                </div>
            </div>
        `;
    }).join('');
}

function renderConversationMessages(messages) {
    return messages.map(msg => {
        const role = msg.role === 'user' ? 'user' : 'assistant';
        return `
            <div class="message ${role}">
                <div class="message-role">${msg.role}</div>
                <div class="message-content">${escapeHtml(msg.content)}</div>
            </div>
        `;
    }).join('');
}

function toggleConversation(idx) {
    const el = document.getElementById(`conversation-${idx}`);
    if (el) {
        el.style.display = el.style.display === 'none' ? 'block' : 'none';
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
