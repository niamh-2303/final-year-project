// Load and display cases
async function loadCases() {
    try {
        const response = await fetch('/api/my-cases');
        const data = await response.json();

        if (data.success && data.cases.length > 0) {
            displayCases(data.cases);
        } else {
            console.log("No cases found");
        }
    } catch (error) {
        console.error("Error loading cases:", error);
    }
}

// Display cases in the active tab
function displayCases(cases) {
    const activeTab = document.getElementById('active');
    const allTab = document.getElementById('all');

    // Filter active cases (exclude deleted)
    const activeCases = cases.filter(c => c.status === 'active' && !c.is_deleted);
    
    // Display active cases
    if (activeCases.length > 0) {
        activeTab.innerHTML = `
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
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeCases.map(c => createCaseRow(c)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Display all cases (exclude deleted)
    const nonDeletedCases = cases.filter(c => !c.is_deleted);
    if (nonDeletedCases.length > 0) {
        allTab.innerHTML = `
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
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${nonDeletedCases.map(c => createCaseRow(c)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

// Create a table row for a case
function createCaseRow(caseData) {
    const priorityClass = {
        'low': 'badge bg-secondary',
        'medium': 'badge bg-warning',
        'high': 'badge bg-danger',
        'critical': 'badge bg-dark'
    };

    const statusClass = {
        'active': 'badge bg-success',
        'pending': 'badge bg-warning',
        'closed': 'badge bg-secondary'
    };

    const createdDate = new Date(caseData.created_at).toLocaleDateString();

    return `
        <tr>
            <td><strong>${caseData.case_number}</strong></td>
            <td>${caseData.case_name}</td>
            <td>${caseData.client_name || 'N/A'}</td>
            <td><span class="${priorityClass[caseData.priority]}">${caseData.priority}</span></td>
            <td><span class="${statusClass[caseData.status]}">${caseData.status}</span></td>
            <td>${createdDate}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewCase(${caseData.case_id})" title="View Case">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="editCase(${caseData.case_id})" title="Edit Case">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteCase(${caseData.case_id}, '${caseData.case_name}')" title="Delete Case">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `;
}

// Confirm deletion with modal
function confirmDeleteCase(caseId, caseName) {
    const confirmed = confirm(`Are you sure you want to delete case "${caseName}"?\n\nThis case will be moved to Deleted Cases and can be restored within 90 days.`);
    
    if (confirmed) {
        deleteCase(caseId);
    }
}

// Delete case (soft delete)
async function deleteCase(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}/delete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_deleted: true,
                deleted_at: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (data.success) {
            // Show success message
            showNotification('Case moved to Deleted Cases successfully', 'success');
            
            // Reload cases to refresh the view
            loadCases();
        } else {
            showNotification('Failed to delete case: ' + data.message, 'error');
        }
    } catch (error) {
        console.error('Error deleting case:', error);
        showNotification('Error deleting case', 'error');
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Create notification element
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
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// View case details
function viewCase(caseId) {
    window.location.href = `case-area.html?id=${caseId}`;
}

// Edit case (also goes to case area)
function editCase(caseId) {
    window.location.href = `case-area.html?id=${caseId}`;
}

// Load cases when page loads
document.addEventListener('DOMContentLoaded', loadCases);

// Add CSS animation for notifications
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