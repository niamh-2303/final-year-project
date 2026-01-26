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

// View case details
function viewCase(caseId) {
    window.location.href = `case-area.html?id=${caseId}`;
}

// Load cases when page loads
document.addEventListener('DOMContentLoaded', loadClientCases);