async function loadClientReports() {
    try {
        const response = await fetch('/api/client/reports');
        const data = await response.json();

        if (!data.success) {
            renderReports([]);
            console.error('Failed to load client reports:', data.msg || 'Unknown error');
            return;
        }

        renderReports(data.reports || []);
        handleQueryCase(data.reports || []);
    } catch (error) {
        console.error('Error loading client reports:', error);
        renderReports([]);
    }
}

function renderReports(reports) {
    const tbody = document.getElementById('reportsTableBody');
    const noReportsMessage = document.getElementById('noReportsMessage');

    tbody.innerHTML = '';

    if (!reports || reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No reports available</td></tr>';
        noReportsMessage.classList.remove('d-none');
        return;
    }

    noReportsMessage.classList.add('d-none');

    reports.forEach(report => {
        const row = document.createElement('tr');
        row.dataset.caseId = report.case_id;
        row.innerHTML = `
            <td><strong>${report.case_number}</strong></td>
            <td>${report.case_name}</td>
            <td>${report.investigator_name || 'N/A'}</td>
            <td>${report.closed_at ? new Date(report.closed_at).toLocaleDateString() : 'Pending'}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="downloadReport(${report.case_id})">
                    <i class="bi bi-file-earmark-pdf"></i> Download
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function downloadReport(caseId) {
    window.open(`/api/cases/${caseId}/download-report`, '_blank');
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

function handleQueryCase(reports) {
    const selectedCaseId = getQueryParam('case_id');
    if (!selectedCaseId) return;

    const rows = document.querySelectorAll('#reportsTableBody tr');
    let found = false;

    rows.forEach(row => {
        if (row.dataset.caseId === selectedCaseId) {
            row.classList.add('table-primary');
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            found = true;
        } else {
            row.classList.remove('table-primary');
        }
    });

    const banner = document.getElementById('selectedReportBanner');
    if (found) {
        const selectedReport = reports.find(r => String(r.case_id) === selectedCaseId);
        banner.textContent = selectedReport
            ? `Selected report for case ${selectedReport.case_number}. You can download it below.`
            : 'Selected report found.';
        banner.classList.remove('d-none');
    } else {
        banner.textContent = 'The selected case report was not found. It may not be available yet.';
        banner.classList.remove('d-none');
    }
}

window.downloadReport = downloadReport;

document.addEventListener('DOMContentLoaded', loadClientReports);