// ==============================
// Store case data temporarily (Global declaration)
// ==============================
let tempCaseData = null; // Declared once at the top

// ==============================
// Fetch current user info
// ==============================
fetch("/get-user-info")
    .then(res => res.json())
    .then(user => {
        if (user.success) {
            document.getElementById("investigator").value = `${user.firstName} ${user.lastName}`;
        } else {
            console.error("Failed to fetch user info");
        }
    })
    .catch(err => console.error("Error fetching user info:", err));

// ==============================
// Auto-generate case number AND set start date
// ==============================
window.addEventListener("DOMContentLoaded", () => {
    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    document.getElementById("startDate").value = today;

    // Generate case number
    fetch("/api/next-case-number")
        .then(res => res.json())
        .then(data => {
            document.getElementById("caseNumber").value = data.caseNumber;
        })
        .catch(err => console.error("Error fetching case number:", err));
});

// ==============================
// Client search functionality
// ==============================
const clientSearchInput = document.getElementById("clientSearch");
const clientResults = document.getElementById("clientResults");
const clientIDInput = document.getElementById("clientID");

// Disable Enter key submission
clientSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
    }
});

clientSearchInput.addEventListener("input", async () => {
    const query = clientSearchInput.value.trim();
    
    // Clear client ID when user types
    clientIDInput.value = "";
    
    if (!query) {
        clientResults.innerHTML = "";
        return;
    }

    try {
        const res = await fetch(`/api/search-client?q=${encodeURIComponent(query)}`);
        const clients = await res.json();

        // Show "no results" message if empty
        if (clients.length === 0) {
            clientResults.innerHTML = `
                <div class="list-group-item text-muted">
                    No one with this name is available
                </div>
            `;
            return;
        }

        clientResults.innerHTML = clients.map(c => `
            <button type="button" class="list-group-item list-group-item-action" data-id="${c.id}">
                ${c.client_name}
            </button>
        `).join("");

        clientResults.querySelectorAll("button").forEach(btn => {
            btn.addEventListener("click", () => {
                clientSearchInput.value = btn.textContent.trim();
                clientIDInput.value = btn.dataset.id;
                clientResults.innerHTML = "";
            });
        });

    } catch (err) {
        console.error("Error searching clients:", err);
    }
});

// ==============================
// Handle form submission - Save data and go to assign team (NEW LOGIC)
// ==============================
async function createCase() {
    const caseName = document.getElementById("caseName").value.trim();
    const caseNumber = document.getElementById("caseNumber").value.trim();
    const caseType = document.getElementById("description").value.trim();
    const clientID = document.getElementById("clientID").value;
    const priority = document.getElementById("priority").value;
    const status = document.getElementById("status").value;

    console.log("Form data:", { caseName, caseNumber, caseType, clientID, priority, status });

    if (!caseName || !caseNumber || !caseType || !clientID || !priority || !status) {
        alert("Please fill in all required fields");
        console.log("Missing fields detected");
        return;
    }

    // Store data temporarily in sessionStorage
    tempCaseData = {
        caseNumber,
        caseName,
        caseType,
        clientID,
        priority,
        status
    };

    // The key is 'tempCaseData'
    sessionStorage.setItem('tempCaseData', JSON.stringify(tempCaseData));

    // Redirect to assign team page
    window.location.href = 'assign-team.html';
}