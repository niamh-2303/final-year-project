function calculateDaysArchived(archivedAt) {
    const archived = new Date(archivedAt);
    const now = new Date();
    return Math.floor((now - archived) / (1000 * 60 * 60 * 24));
}

async function loadClientArchivedCases() {
    try {
        const response = await fetch('/api/client/my-cases/archived');
        const data = await response.json();

        if (!data.success) {
            renderArchivedCases([]);
            console.error('Failed to load archived cases:', data.msg || 'Unknown error');
            return;
        }

        renderArchivedCases(data.cases || []);
    } catch (error) {
        console.error('Error loading archived cases:', error);
        renderArchivedCases([]);
    }
}

function renderArchivedCases(cases) {
    const container = document.getElementById('archivedCasesContainer');
    if (!cases || cases.length === 0) {
        container.innerHTML = `
            <div class="cases-section">
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="bi bi-archive"></i></div>
                    <h3>No Archived Cases</h3>
                    <p>You don\'t have any archived cases at the moment.</p>
                    <a href="client-dashboard.html" class="btn btn-primary">
                        <i class="bi bi-arrow-left"></i> Back to Dashboard
                    </a>
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = `
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
                            <th>Archived On</th>
                            <th>Days Archived</th>
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
            <td>${caseData.investigator_name || 'N/A'}</td>
            <td><span class="${priorityClass[caseData.priority] || 'badge bg-secondary'}">${caseData.priority || 'N/A'}</span></td>
            <td><span class="${statusClass[caseData.status] || 'badge bg-secondary'}">${caseData.status || 'archived'}</span></td>
            <td>${archivedDate}</td>
            <td><strong>${daysArchived} days</strong></td>
        </tr>
    `;
}

document.addEventListener('DOMContentLoaded', loadClientArchivedCases);
