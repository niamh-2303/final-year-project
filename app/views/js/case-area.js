// ==============================
// Load case data from URL parameter
// ==============================
let caseID = null;
let caseData = null;

window.addEventListener("DOMContentLoaded", async () => {
    // Get case ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    caseID = urlParams.get('id');

    if (!caseID) {
        alert("No case ID provided. Redirecting to dashboard.");
        window.location.href = 'dashboard.html';
        return;
    }

    // Load case data
    await loadCaseData();
});

// ==============================
// Fetch case data from backend
// ==============================
async function loadCaseData() {
    try {
        const response = await fetch(`/api/case/${caseID}`);
        const data = await response.json();

        if (data.success) {
            caseData = data.case;
            displayCaseData();
        } else {
            alert("Case not found. Redirecting to dashboard.");
            window.location.href = 'dashboard.html';
        }

    } catch (error) {
        console.error("Error loading case data:", error);
        alert("Error loading case. Redirecting to dashboard.");
        window.location.href = 'dashboard.html';
    }
}

// ==============================
// Display case data on page
// ==============================
function displayCaseData() {
    // Update header information
    document.getElementById('breadcrumbCaseNumber').textContent = caseData.case_number;
    document.getElementById('caseName').textContent = caseData.case_name;
    document.getElementById('caseNumber').textContent = caseData.case_number;
    document.getElementById('caseStatus').textContent = caseData.status;
    document.getElementById('casePriority').textContent = caseData.priority;

    // Update status badge color
    const statusBadge = document.getElementById('caseStatus');
    statusBadge.className = 'badge ms-2';
    if (caseData.status === 'active') {
        statusBadge.classList.add('bg-success');
    } else if (caseData.status === 'pending') {
        statusBadge.classList.add('bg-warning');
    } else if (caseData.status === 'closed') {
        statusBadge.classList.add('bg-secondary');
    }

    // Update priority badge color
    const priorityBadge = document.getElementById('casePriority');
    priorityBadge.className = 'badge';
    if (caseData.priority === 'low') {
        priorityBadge.classList.add('bg-secondary');
    } else if (caseData.priority === 'medium') {
        priorityBadge.classList.add('bg-warning');
    } else if (caseData.priority === 'high') {
        priorityBadge.classList.add('bg-danger');
    } else if (caseData.priority === 'critical') {
        priorityBadge.classList.add('bg-dark');
    }

    console.log("Case data loaded:", caseData);
}