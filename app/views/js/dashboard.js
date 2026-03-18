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
    const allTab    = document.getElementById('all');

    const activeCases    = cases.filter(c => c.status === 'active' && !c.is_deleted);
    const nonDeletedCases = cases.filter(c => !c.is_deleted);

    const tableHead = `
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
        </thead>`;

    if (activeCases.length > 0) {
        activeTab.innerHTML = `
            <div class="cases-section">
                <div class="table-responsive">
                    <table class="table cases-table">
                        ${tableHead}
                        <tbody>${activeCases.map(c => createCaseRow(c)).join('')}</tbody>
                    </table>
                </div>
            </div>`;
    }

    if (nonDeletedCases.length > 0) {
        allTab.innerHTML = `
            <div class="cases-section">
                <div class="table-responsive">
                    <table class="table cases-table">
                        ${tableHead}
                        <tbody>${nonDeletedCases.map(c => createCaseRow(c)).join('')}</tbody>
                    </table>
                </div>
            </div>`;
    }
}

// Create a table row for a case
function createCaseRow(caseData) {
    const isClosed = caseData.status === 'closed';

    const priorityClass = {
        'low':      'badge bg-secondary',
        'medium':   'badge bg-warning text-dark',
        'high':     'badge bg-danger',
        'critical': 'badge bg-dark'
    };

    const statusClass = {
        'active':  'badge bg-success',
        'pending': 'badge bg-warning text-dark',
        'closed':  'badge bg-secondary'
    };

    const createdDate = new Date(caseData.created_at).toLocaleDateString();

    // ── Closed case: only View Report + Archive ──────────────────────────────
    if (isClosed) {
        return `
            <tr class="case-row-closed">
                <td><strong>${caseData.case_number}</strong></td>
                <td>
                    ${caseData.case_name}
                    <span class="closed-lock-badge">
                        <i class="bi bi-lock-fill"></i> Closed
                    </span>
                </td>
                <td>${caseData.client_name || 'N/A'}</td>
                <td><span class="${priorityClass[caseData.priority] || 'badge bg-secondary'}">${caseData.priority}</span></td>
                <td><span class="${statusClass[caseData.status]}">${caseData.status}</span></td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn btn-sm btn-outline-danger me-1"
                            onclick="viewCase(${caseData.case_id})"
                            title="View Report">
                        <i class="bi bi-file-earmark-pdf"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary"
                            onclick="confirmArchiveCase(${caseData.case_id}, '${escapeSingleQuotes(caseData.case_name)}')"
                            title="Archive Case">
                        <i class="bi bi-archive"></i>
                    </button>
                </td>
            </tr>`;
    }

    // ── Active / pending: full action set ────────────────────────────────────
    return `
        <tr>
            <td><strong>${caseData.case_number}</strong></td>
            <td>${caseData.case_name}</td>
            <td>${caseData.client_name || 'N/A'}</td>
            <td><span class="${priorityClass[caseData.priority] || 'badge bg-secondary'}">${caseData.priority}</span></td>
            <td><span class="${statusClass[caseData.status]}">${caseData.status}</span></td>
            <td>${createdDate}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary me-1"
                        onclick="viewCase(${caseData.case_id})"
                        title="View Case">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary"
                        onclick="confirmArchiveCase(${caseData.case_id}, '${escapeSingleQuotes(caseData.case_name)}')"
                        title="Archive Case">
                    <i class="bi bi-archive"></i>
                </button>
            </td>
        </tr>`;
}

function escapeSingleQuotes(str) {
    return (str || '').replace(/'/g, "\\'");
}

// Load invitations into the Requests tab
async function loadInvitations() {
    try {
        const response = await fetch('/api/my-invitations');
        const data     = await response.json();
        const requestsTab = document.getElementById('requests');

        if (!data.success || data.invitations.length === 0) return;

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
                                        <button class="btn btn-sm btn-success me-1"
                                                onclick="respondToInvitation(${inv.invitation_id}, 'accept')">
                                            <i class="bi bi-check-lg"></i> Accept
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger"
                                                onclick="respondToInvitation(${inv.invitation_id}, 'decline')">
                                            <i class="bi bi-x-lg"></i> Decline
                                        </button>
                                    </td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

        document.getElementById('requests-tab').innerHTML =
            `Requests <span class="badge bg-danger ms-1">${data.invitations.length}</span>`;

    } catch (error) {
        console.error("Error loading invitations:", error);
    }
}

async function respondToInvitation(invitationId, action) {
    try {
        const res  = await fetch(`/api/invitations/${invitationId}/respond`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ action })
        });
        const data = await res.json();

        if (data.success) {
            showNotification(
                action === 'accept'
                    ? 'Case accepted! It will now appear in your cases.'
                    : 'Invitation declined.',
                'success'
            );
            loadInvitations();
            loadCases();
        } else {
            showNotification('Error: ' + data.msg, 'error');
        }
    } catch (err) {
        console.error("Error responding to invitation:", err);
    }
}

function confirmArchiveCase(caseId, caseName) {
    if (confirm(`Archive case "${caseName}"?\n\nIt will be moved to Archived Cases.`)) {
        archiveCase(caseId);
    }
}

async function archiveCase(caseId) {
    try {
        const response = await fetch(`/api/cases/${caseId}/archive`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                is_archived: true,
                archived_at: new Date().toISOString()
            })
        });
        const data = await response.json();

        if (data.success) {
            showNotification('Case moved to Archive successfully', 'success');
            loadCases();
        } else {
            showNotification('Failed to archive case: ' + (data.message || data.msg), 'error');
        }
    } catch (error) {
        console.error('Error archiving case:', error);
        showNotification('Error archiving case', 'error');
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification-toast`;
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;`;
    notification.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-circle'} me-2"></i>
            <span>${message}</span>
        </div>`;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function viewCase(caseId) {
    window.location.href = `case-area.html?id=${caseId}`;
}


document.addEventListener('DOMContentLoaded', () => {
    loadCases();
    loadInvitations();
});

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to   { transform: translateX(0);     opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0);     opacity: 1; }
        to   { transform: translateX(400px); opacity: 0; }
    }

    /* Closed case row — slightly muted */
    .case-row-closed td { color: #6b7280; }
    .case-row-closed td:first-child strong { color: #374151; }

    /* Small "Closed" lock badge next to the case name */
    .closed-lock-badge {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        font-size: 10px;
        font-weight: 600;
        color: #6b7280;
        background: #f3f4f6;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        padding: 1px 6px;
        margin-left: 8px;
        vertical-align: middle;
    }
`;
document.head.appendChild(style);