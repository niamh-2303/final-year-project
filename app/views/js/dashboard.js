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
                                <th>Client</th>
                                <th>Priority</th>
                                <th>Status</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cases.map(c => createCaseRow(c)).join('')}
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
                <button class="btn btn-sm btn-outline-primary" onclick="viewCase(${caseData.case_id})" aria-label="View Case">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="editCase(${caseData.case_id})" aria-label="Edit Case">
                    <i class="bi bi-pencil"></i>
                </button>
            </td>
        </tr>
    `;
}

// View case details (placeholder)
function viewCase(caseId) {
    alert(`View case ${caseId} - Feature coming soon!`);
}

// Edit case (placeholder)
function editCase(caseId) {
    alert(`Edit case ${caseId} - Feature coming soon!`);
}

// Load cases when page loads
document.addEventListener('DOMContentLoaded', loadCases);