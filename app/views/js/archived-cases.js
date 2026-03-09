function calculateDaysArchived(archivedAt) {
    const archived = new Date(archivedAt);
    const now = new Date();
    return Math.floor((now - archived) / (1000 * 60 * 60 * 24));
}

async function loadArchivedCases() {
    try {
        const response = await fetch('/api/my-cases/archived');
        const data = await response.json();

        if (data.success && data.cases.length > 0) {
            displayArchivedCases(data.cases);
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error("Error loading archived cases:", error);
        showEmptyState();
    }
}

function displayArchivedCases(cases) {
    const container = document.querySelector('.main-content');
    let section = container.querySelector('.archived-cases-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'archived-cases-section';
        container.appendChild(section);
    }

    section.innerHTML = `
        <div class="cases-section">
            <div class="table-responsive">
                <table class="table cases-table">
                    <thead>
                        <tr>
                            <th>Case Number</th>
                            <th>Case Name</th>
                            <th>Client</th>
                            <th>Priority</th>
                            <th>Status</th>
                            <th>Archived On</th>
                            <th>Days Archived</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cases.map(c => createArchivedCaseRow(c)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function createArchivedCaseRow(caseData) {
    const priorityClass = {
        'low': 'badge bg-secondary',
        'medium': 'badge bg-warning',
        'high': 'badge bg-danger',
        'critical': 'badge bg-dark'
    };

    const archivedDate = new Date(caseData.archived_at).toLocaleDateString();
    const daysArchived = calculateDaysArchived(caseData.archived_at);

    return `
        <tr>
            <td><strong>${caseData.case_number}</strong></td>
            <td>${caseData.case_name}</td>
            <td>${caseData.client_name || 'N/A'}</td>
            <td><span class="${priorityClass[caseData.priority]}">${caseData.priority}</span></td>
            <td>${archivedDate}</td>
            <td><strong>${daysArchived} days</strong></td>
            <td>
                <button class="btn btn-sm btn-success" 
                    onclick="confirmRestoreCase(${caseData.case_id}, '${caseData.case_name}')" 
                    title="Restore Case">
                    <i class="bi bi-arrow-counterclockwise"></i> Restore
                </button>
            </td>
        </tr>
    `;
}

function confirmRestoreCase(caseId, caseName) {
    const confirmed = confirm(`Restore case "${caseName}"?\n\nThis will move it back to your active cases.`);
    if (confirmed) restoreCase(caseId);
}

async function restoreCase(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.success) {
            showNotification('Case restored successfully', 'success');
            loadArchivedCases();
        } else {
            showNotification('Failed to restore: ' + data.message, 'error');
        }
    } catch (error) {
        showNotification('Error restoring case', 'error');
    }
}

function showEmptyState() {
    const container = document.querySelector('.main-content');
    let section = container.querySelector('.archived-cases-section');
    if (!section) {
        section = document.createElement('div');
        section.className = 'archived-cases-section';
        container.appendChild(section);
    }
    section.innerHTML = `
        <div class="cases-section">
            <div class="empty-state">
                <div class="empty-state-icon"><i class="bi bi-archive"></i></div>
                <h3>No Archived Cases</h3>
                <p>You don't have any archived cases at the moment.</p>
                <a href="dashboard.html" class="btn btn-primary">
                    <i class="bi bi-arrow-left"></i> Back to Dashboard
                </a>
            </div>
        </div>
    `;
}

function createArchivedCaseRow(caseData) {
    const priorityClass = {
        'low': 'badge bg-secondary',
        'medium': 'badge bg-warning',
        'high': 'badge bg-danger',
        'critical': 'badge bg-dark'
    };

    const statusClass = {
        'active': 'badge bg-success',
        'pending': 'badge bg-warning',
        'closed': 'badge bg-secondary',
        'archived': 'badge bg-info'
    };

    const archivedDate = new Date(caseData.archived_at).toLocaleDateString();
    const daysArchived = calculateDaysArchived(caseData.archived_at);

    return `
        <tr>
            <td><strong>${caseData.case_number}</strong></td>
            <td>${caseData.case_name}</td>
            <td>${caseData.client_name || 'N/A'}</td>
            <td><span class="${priorityClass[caseData.priority]}">${caseData.priority}</span></td>
            <td><span class="${statusClass[caseData.status] || 'badge bg-secondary'}">${caseData.status}</span></td>
            <td>${archivedDate}</td>
            <td><strong>${daysArchived} days</strong></td>
            <td>
                <button class="btn btn-sm btn-success" 
                    onclick="confirmRestoreCase(${caseData.case_id}, '${caseData.case_name}')" 
                    title="Restore Case">
                    <i class="bi bi-arrow-counterclockwise"></i> Restore
                </button>
            </td>
        </tr>
    `;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification-toast`;
    notification.style.cssText = `position:fixed;top:20px;right:20px;z-index:9999;min-width:300px;box-shadow:0 4px 12px rgba(0,0,0,0.15);animation:slideIn 0.3s ease-out;`;
    notification.innerHTML = `<div class="d-flex align-items-center"><i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i><span>${message}</span></div>`;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.animation = 'slideOut 0.3s ease-out'; setTimeout(() => notification.remove(), 300); }, 3000);
}

document.addEventListener('DOMContentLoaded', loadArchivedCases);