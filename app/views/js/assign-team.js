// ==============================
// Load case data from sessionStorage
// ==============================
let caseData = null;
let selectedInvestigators = [];

window.addEventListener("DOMContentLoaded", () => {
    // Load case data
    const storedData = sessionStorage.getItem('tempCaseData');
    if (!storedData) {
        alert("No case data found. Redirecting to create case page.");
        window.location.href = 'create-case.html';
        return;
    }

    caseData = JSON.parse(storedData);
    document.getElementById('displayCaseNumber').textContent = caseData.caseNumber;
});

// ==============================
// Search investigators
// ==============================
const investigatorSearchInput = document.getElementById("investigatorSearch");
const investigatorResults = document.getElementById("investigatorResults");

investigatorSearchInput.addEventListener("input", async () => {
    const query = investigatorSearchInput.value.trim();
    if (!query) {
        investigatorResults.innerHTML = "";
        return;
    }

    try {
        const res = await fetch(`/api/search-investigator?q=${encodeURIComponent(query)}`);
        const investigators = await res.json();

        investigatorResults.innerHTML = investigators.map(inv => `
            <button type="button" class="list-group-item list-group-item-action" 
                    data-id="${inv.id}" 
                    data-name="${inv.name}" 
                    data-email="${inv.email}">
                <strong>${inv.name}</strong><br>
                <small class="text-muted">${inv.email}</small>
            </button>
        `).join("");

        investigatorResults.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", () => {
                addInvestigator({
                    id: btn.dataset.id,
                    name: btn.dataset.name,
                    email: btn.dataset.email
                });
                investigatorSearchInput.value = "";
                investigatorResults.innerHTML = "";
            });
        });

    } catch (err) {
        console.error("Error searching investigators:", err);
    }
});

// ==============================
// Add investigator to team table
// ==============================
function addInvestigator(investigator) {
    // Check if already added
    if (selectedInvestigators.find(inv => inv.id === investigator.id)) {
        alert("This investigator is already in the team");
        return;
    }

    selectedInvestigators.push({
        ...investigator,
        selected: false
    });

    updateTeamTable();
}

// ==============================
// Update team table display
// ==============================
function updateTeamTable() {
    const tbody = document.getElementById('teamTableBody');

    if (selectedInvestigators.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    <i class="bi bi-person-plus" style="font-size: 48px;"></i>
                    <p class="mt-3">No investigators added yet. Search and add team members above.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = selectedInvestigators.map((inv, index) => `
        <tr>
            <td>
                <input type="checkbox" class="form-check-input investigator-checkbox" 
                       data-index="${index}" 
                       ${inv.selected ? 'checked' : ''}>
            </td>
            <td><strong>${inv.name}</strong></td>
            <td>${inv.email}</td>
            <td><span class="badge bg-primary">Investigator</span></td>
            <td>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="removeInvestigator(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join("");

    // Add event listeners to checkboxes
    document.querySelectorAll('.investigator-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const index = parseInt(e.target.dataset.index);
            selectedInvestigators[index].selected = e.target.checked;
        });
    });
}

// ==============================
// Remove investigator from team
// ==============================
function removeInvestigator(index) {
    selectedInvestigators.splice(index, 1);
    updateTeamTable();
}

// ==============================
// Select/Deselect all checkboxes
// ==============================
document.getElementById('selectAll').addEventListener('change', (e) => {
    const checked = e.target.checked;
    selectedInvestigators.forEach(inv => inv.selected = checked);
    updateTeamTable();
});

// ==============================
// Save case and assign team
// ==============================
async function saveCase() {
    // Get only selected investigators
    const assignedInvestigators = selectedInvestigators
        .filter(inv => inv.selected)
        .map(inv => inv.id);

    if (assignedInvestigators.length === 0) {
        if (!confirm("No investigators have been selected. Do you want to create the case without additional team members?")) {
            return;
        }
    }

    try {
        const res = await fetch("/api/create-case-with-team", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...caseData,
                teamMembers: assignedInvestigators
            })
        });

        const data = await res.json();

        if (res.ok) {
            // Clear sessionStorage
            sessionStorage.removeItem('tempCaseData');
            
            alert("Case created successfully with team assigned!");
            // Redirect to case area page with the case ID
            window.location.href = `case-area.html?id=${data.caseID}`;
        } else {
            alert("Error creating case: " + data.msg);
        }

    } catch (err) {
        console.error("Error creating case:", err);
        alert("An unexpected error occurred while creating the case.");
    }
}