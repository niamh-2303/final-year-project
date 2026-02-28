// Load and display cases for clients
async function loadClientCases() {
    try {
        const response = await fetch('/api/my-cases');
        const data = await response.json();

        if (data.success && data.cases.length > 0) {
            displayClientCases(data.cases);
        } else {
            console.log("No cases found for client");
        }
    } catch (error) {
        console.error("Error loading cases:", error);
    }
}

// Display cases in the tabs
function displayClientCases(cases) {
    const activeTab = document.getElementById('active');
    const allTab = document.getElementById('all');

    // Filter active cases
    const activeCases = cases.filter(c => c.status === 'active');
    
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
                                <th>Investigator</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${activeCases.map(c => createClientCaseRow(c)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // Display all cases
    if (cases.length > 0) {
        allTab.innerHTML = `
            <div class="cases-section">
                <div class="table-responsive">
                    <table class="table cases-table">
                        <thead>
                            <tr>
                                <th>Case Number</th>
                                <th>Case Name</th>
                                <th>Investigator</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cases.map(c => createClientCaseRow(c)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

// Create a table row for a case (client view)
function createClientCaseRow(caseData) {
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
            <td>${caseData.investigator_name || 'Not Assigned'}</td>
            <td><span class="${priorityClass[caseData.priority]}">${caseData.priority}</span></td>
            <td><span class="${statusClass[caseData.status]}">${caseData.status}</span></td>
            <td>${createdDate}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewCase(${caseData.case_id})" title="View Case">
                    <i class="bi bi-eye"></i> View
                </button>
            </td>
        </tr>
    `;
}

// load invitations into the Requests tab
async function loadInvitations() {
    try {
        const response = await fetch('/api/my-invitations');
        const data = await response.json();
        console.log("Invitations data:", data); 
        const requestsTab = document.getElementById('requests');

        if (!data.success || data.invitations.length === 0) {
            return; // leave the empty state as-is
        }

        requestsTab.innerHTML = `
            <div class="cases-section">
                <div class="table-responsive">
                    <table class="table cases-table">
                        <thead>
                            <tr>
                                <th>Case Number</th>
                                <th>Case Name</th>
                                <th>Invited By</th>
                                <th>Role</th>
                                <th>Priority</th>
                                <th>Date</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.invitations.map(inv => `
                                <tr>
                                    <td><strong>${inv.case_number}</strong></td>
                                    <td>${inv.case_name}</td>
                                    <td>${inv.invited_by_name}</td>
                                    <td><span class="badge bg-info">${inv.role}</span></td>
                                    <td>${inv.priority}</td>
                                    <td>${new Date(inv.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <button class="btn btn-sm btn-success me-1" onclick="respondToInvitation(${inv.invitation_id}, 'accept')">
                                            <i class="bi bi-check-lg"></i> Accept
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" onclick="respondToInvitation(${inv.invitation_id}, 'decline')">
                                            <i class="bi bi-x-lg"></i> Decline
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        // Show count badge on the tab
        document.getElementById('requests-tab').innerHTML = 
            `Requests <span class="badge bg-danger ms-1">${data.invitations.length}</span>`;

    } catch (error) {
        console.error("Error loading invitations:", error);
    }
}

async function respondToInvitation(invitationId, action) {
    try {
        const res = await fetch(`/api/invitations/${invitationId}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
        });

        const data = await res.json();

        if (data.success) {
            showNotification(
                action === 'accept' ? 'Case accepted! It will now appear in your cases.' : 'Invitation declined.',
                'success'
            );
            loadInvitations(); // refresh requests tab
            loadCases();       // refresh cases tab (use loadClientCases() in client-cases.js)
        } else {
            showNotification('Error: ' + data.msg, 'error');
        }
    } catch (err) {
        console.error("Error responding to invitation:", err);
    }
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
    `;
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
            <span>${message}</span>
        </div>
    `;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// View case details
function viewCase(caseId) {
    window.location.href = `case-area.html?id=${caseId}`;
}

// Load cases when page loads
document.addEventListener('DOMContentLoaded', () => {
    loadClientCases();
    loadInvitations();
});