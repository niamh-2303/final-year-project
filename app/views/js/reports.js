/* ======================================================
   REPORTS PAGE
====================================================== */

let statusChart = null;
let priorityChart = null;

async function loadReportStats() {
    try {
        const response = await fetch('/api/reports/stats');
        const data = await response.json();
        console.log('API response:', data); // ADD THIS

        if (data.success) {
            renderStatCards(data.stats);
            renderStatusChart(data.stats.byStatus);
            if (data.stats.byPriority) renderPriorityChart(data.stats.byPriority);
            renderMostActiveCases(data.stats.mostActiveCases);
        }
    } catch (error) {
        console.error('Error loading report stats:', error);
    }
}

function renderStatCards(stats) {
    document.getElementById('totalCases').textContent = stats.total;
    document.getElementById('activeCases').textContent = stats.byStatus.active || 0;
    document.getElementById('closedCases').textContent = stats.byStatus.closed || 0;
    document.getElementById('archivedCases').textContent = stats.byStatus.archived || 0;
    document.getElementById('pendingCases').textContent = stats.byStatus.pending || 0;
    document.getElementById('totalEvidence').textContent = stats.totalEvidence || 0;
    document.getElementById('avgCloseTime').textContent = stats.avgCloseTimeDays ? `${stats.avgCloseTimeDays} days` : 'N/A';
}

function renderStatusChart(byStatus) {
    const ctx = document.getElementById('statusChart').getContext('2d');

    if (statusChart) statusChart.destroy();

    const labels = Object.keys(byStatus).map(s => s.charAt(0).toUpperCase() + s.slice(1));
    const values = Object.values(byStatus);
    const colours = {
        active: '#28a745',
        pending: '#ffc107',
        closed: '#6c757d',
        archived: '#17a2b8'
    };
    const backgroundColors = Object.keys(byStatus).map(s => colours[s] || '#6c757d');

    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: backgroundColors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 20, font: { size: 13 } }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                            return ` ${context.label}: ${context.parsed} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderMostActiveCases(cases) {
    const tbody = document.getElementById('recentCasesBody');
    tbody.innerHTML = '';

    if (!cases || cases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No cases found</td></tr>';
        return;
    }

    const statusClass = {
        'active': 'badge bg-success',
        'pending': 'badge bg-warning',
        'closed': 'badge bg-secondary',
        'archived': 'badge bg-info'
    };

    const priorityClass = {
        'low': 'badge bg-secondary',
        'medium': 'badge bg-warning',
        'high': 'badge bg-danger',
        'critical': 'badge bg-dark'
    };

    cases.forEach(c => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${c.case_number}</strong></td>
            <td>${c.case_name}</td>
            <td><span class="${statusClass[c.status] || 'badge bg-secondary'}">${c.status}</span></td>
            <td><span class="${priorityClass[c.priority] || 'badge bg-secondary'}">${c.priority}</span></td>
            <td><strong>${c.event_count}</strong> events</td>
        `;
        tbody.appendChild(row);
    });
}

function renderPriorityChart(byPriority) {
    if (!byPriority) return;

    const ctx = document.getElementById('priorityChart').getContext('2d');

    if (priorityChart) priorityChart.destroy();

    const order = ['critical', 'high', 'medium', 'low'];
    const labels = order.map(p => p.charAt(0).toUpperCase() + p.slice(1));
    const values = order.map(p => byPriority[p] || 0);
    const colours = ['#212529', '#dc3545', '#ffc107', '#6c757d'];

    priorityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Cases',
                data: values,
                backgroundColor: colours,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: { color: '#f0f0f0' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', loadReportStats);