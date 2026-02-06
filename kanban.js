// Kanban Board functionality

function renderKanbanView() {
    const tasks = getTasks();
    const columns = {
        ideas: { title: 'Task Ideas', icon: '💡', tasks: [] },
        assigned: { title: 'Assigned Tasks', icon: '📋', tasks: [] },
        inProgress: { title: 'In Progress', icon: '🚧', tasks: [] },
        completed: { title: 'Completed', icon: '✅', tasks: [] }
    };
    
    // Group tasks by status
    tasks.forEach(task => {
        const status = task.status || 'ideas';
        if (columns[status]) {
            columns[status].tasks.push(task);
        }
    });
    
    const html = `
        <div class="view-header">
            <div class="view-title">
                <h2>Task Board</h2>
                <p>Drag and drop tasks between columns</p>
            </div>
            <button class="btn-primary" onclick="app.openAddModal('task')">
                <span>+</span> New Task
            </button>
        </div>
        
        <div class="kanban-board">
            ${Object.entries(columns).map(([status, col]) => renderKanbanColumn(status, col)).join('')}
        </div>
    `;
    
    document.getElementById('mainContent').innerHTML = html;
    initDragAndDrop();
}

function renderKanbanColumn(status, column) {
    return `
        <div class="kanban-column" data-status="${status}">
            <div class="kanban-header">
                <h3>${column.icon} ${column.title}</h3>
                <span class="kanban-count">${column.tasks.length}</span>
            </div>
            <div class="kanban-cards" data-status="${status}">
                ${column.tasks.length > 0 
                    ? column.tasks.map(task => renderKanbanCard(task)).join('')
                    : '<div class="kanban-empty">No tasks</div>'
                }
            </div>
            <button class="kanban-add-card" onclick="app.openAddModal('task', '${status}')">
                + Add task
            </button>
        </div>
    `;
}

function renderKanbanCard(task) {
    const dueDate = task.dueDate ? formatRelativeDate(task.dueDate) : '';
    return `
        <div class="kanban-card" draggable="true" data-task-id="${task.id}">
            <h4 class="kanban-card-title">${task.title}</h4>
            ${task.description ? `<p class="kanban-card-description">${task.description}</p>` : ''}
            <div class="kanban-card-meta">
                <span class="kanban-card-priority ${task.priority}">${task.priority}</span>
                ${dueDate ? `<span class="kanban-card-date">📅 ${dueDate}</span>` : ''}
                <span class="kanban-card-category">${task.category}</span>
            </div>
        </div>
    `;
}

function initDragAndDrop() {
    const cards = document.querySelectorAll('.kanban-card');
    const columns = document.querySelectorAll('.kanban-cards');
    
    cards.forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });
    
    columns.forEach(column => {
        column.addEventListener('dragover', handleDragOver);
        column.addEventListener('drop', handleDrop);
        column.addEventListener('dragenter', handleDragEnter);
        column.addEventListener('dragleave', handleDragLeave);
    });
}

let draggedElement = null;

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.kanban-cards').forEach(col => {
        col.classList.remove('drag-over');
    });
}

function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    if (e.target === this) {
        this.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    
    if (draggedElement) {
        const taskId = draggedElement.dataset.taskId;
        const newStatus = this.dataset.status;
        
        // Update task status
        updateTaskStatus(taskId, newStatus);
        
        // Re-render the board
        renderKanbanView();
    }
    
    return false;
}

function updateTaskStatus(taskId, newStatus) {
    const tasks = getTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.status = newStatus;
        if (newStatus === 'completed') {
            task.completed = true;
            task.completedAt = new Date().toISOString();
        } else {
            task.completed = false;
            task.completedAt = null;
        }
        saveTasks(tasks);
        app.showToast(`Task moved to ${newStatus}`, 'success');
    }
}

function formatRelativeDate(dateStr) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    const diffTime = date - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 1) return `in ${diffDays} days`;
    if (diffDays < -1) return `${Math.abs(diffDays)} days ago`;
}
