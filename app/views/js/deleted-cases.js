// Load deleted cases
async function loadDeletedCases() {
    try {
        const response = await fetch('/api/my-cases/deleted');
        const data = await response.json();

        if (data.success && data.cases.length > 0) {
            displayDeletedCases(data.cases);
        } else {
            showEmptyState();
        }
    } catch (error) {
        console.error("Error loading deleted cases:", error);
        showEmptyState();
    }
}

// Display deleted cases
function displayDeletedCases(cases) {
    const container = document.querySelector('.main-content');
    
    // Find or create the cases section
    let casesSection = container.querySelector('.deleted-cases-section');
    if (!casesSection) {
        casesSection = document.createElement('div');
        casesSection.className = 'deleted-cases-section';
        container.appendChild(casesSection);
    }
    
    casesSection.innerHTML = `
        <div class="cases-section">
            <div class="table-responsive">
                <table class="table cases-table">
                    <thead>
                        <tr>
                            <th>Case Number</th>
                            <th>Case Name</th>
                            <th>Client</th>
                            <th>Priority</th>
                            <th>Deleted On</th>
                            <th>Days Remaining</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${cases.map(c => createDeletedCaseRow(c)).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// Create a table row for deleted case
function createDeletedCaseRow(caseData) {
    const priorityClass = {
        'low': 'badge bg-secondary',
        'medium': 'badge bg-warning',
        'high': 'badge bg-danger',
        'critical': 'badge bg-dark'
    };

    const deletedDate = new Date(caseData.deleted_at).toLocaleDateString();
    const daysRemaining = calculateDaysRemaining(caseData.deleted_at);
    
    // Color code days remaining
    let daysClass = 'text-success';
    if (daysRemaining <= 30) daysClass = 'text-warning';
    if (daysRemaining <= 10) daysClass = 'text-danger';

    return `
        <tr>
            <td><strong>${caseData.case_number}</strong></td>
            <td>${caseData.case_name}</td>
            <td>${caseData.client_name || 'N/A'}</td>
            <td><span class="${priorityClass[caseData.priority]}">${caseData.priority}</span></td>
            <td>${deletedDate}</td>
            <td><strong class="${daysClass}">${daysRemaining} days</strong></td>
            <td>
                <button class="btn btn-sm btn-success" onclick="confirmRestoreCase(${caseData.case_id}, '${caseData.case_name}')" title="Restore Case">
                    <i class="bi bi-arrow-counterclockwise"></i> Restore
                </button>
                <button class="btn btn-sm btn-danger" onclick="confirmPermanentDelete(${caseData.case_id}, '${caseData.case_name}')" title="Permanently Delete">
                    <i class="bi bi-trash-fill"></i> Delete Forever
                </button>
            </td>
        </tr>
    `;
}

// Calculate days remaining until permanent deletion
function calculateDaysRemaining(deletedAt) {
    const deletedDate = new Date(deletedAt);
    const expiryDate = new Date(deletedDate);
    expiryDate.setDate(expiryDate.getDate() + 90);
    
    const today = new Date();
    const diffTime = expiryDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays > 0 ? diffDays : 0;
}

// Confirm restore
function confirmRestoreCase(caseId, caseName) {
    const confirmed = confirm(`Are you sure you want to restore case "${caseName}"?\n\nThis case will be moved back to your active cases.`);
    
    if (confirmed) {
        restoreCase(caseId);
    }
}

// Restore case
async function restoreCase(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}/restore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                is_deleted: false,
                deleted_at: null,
                status: 'Open' // Force it back to Open when restored
            })
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Case restored successfully', 'success');
            loadDeletedCases();
        } else {
            showNotification('Failed to restore case: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error restoring case:', error);
        showNotification('Error restoring case', 'error');
    }
}

// Confirm permanent deletion
function confirmPermanentDelete(caseId, caseName) {
    const confirmed = confirm(`⚠️ PERMANENT DELETION WARNING ⚠️\n\nAre you absolutely sure you want to PERMANENTLY delete case "${caseName}"?\n\nThis action CANNOT be undone and all case data will be lost forever.`);
    
    if (confirmed) {
        const doubleConfirm = confirm(`This is your final warning!\n\n.`);
        if (doubleConfirm) {
            permanentDeleteCase(caseId);
        }
    }
}

// Permanently delete case
async function permanentDeleteCase(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}/permanent-delete`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            showNotification('Case permanently deleted', 'success');
            loadDeletedCases();
        } else {
            showNotification('Failed to delete case: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error permanently deleting case:', error);
        showNotification('Error deleting case', 'error');
    }
}

// Show empty state
function showEmptyState() {
    const container = document.querySelector('.main-content');
    
    let casesSection = container.querySelector('.deleted-cases-section');
    if (!casesSection) {
        casesSection = document.createElement('div');
        casesSection.className = 'deleted-cases-section';
        container.appendChild(casesSection);
    }
    
    casesSection.innerHTML = `
        <div class="cases-section">
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="bi bi-inbox"></i>
                </div>
                <h3>No Deleted Cases</h3>
                <p>You don't have any deleted cases at the moment.</p>
                <a href="dashboard.html" class="btn btn-primary">
                    <i class="bi bi-arrow-left"></i> Back to Dashboard
                </a>
            </div>
        </div>
    `;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification-toast`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
    `;
    
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Load deleted cases when page loads
document.addEventListener('DOMContentLoaded', loadDeletedCases);

// Add CSS animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);