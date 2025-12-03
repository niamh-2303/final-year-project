// -----------------------------
// Auto-fill user info and start date
// -----------------------------
window.addEventListener("DOMContentLoaded", () => {
    // Fill lead investigator
    fetch("/get-user-info")
        .then(res => res.json())
        .then(user => {
            if (user.success) {
                const investigatorInput = document.getElementById("investigator");
                investigatorInput.value = `${user.firstName} ${user.lastName}`;
            }
        });

    // Fill start date as today
    const startDateInput = document.getElementById("startDate");
    const today = new Date().toISOString().split('T')[0];
    startDateInput.value = today;

    // Generate next case number
    fetch("/api/next-case-number")
        .then(res => res.json())
        .then(data => {
            document.getElementById("caseNumber").value = data.caseNumber;
        });
});

// -----------------------------
// Client Search
// -----------------------------
const clientSearchInput = document.getElementById("clientSearch");
const clientResults = document.getElementById("clientResults");
const clientIDInput = document.getElementById("clientID");

clientSearchInput.addEventListener("input", () => {
    const query = clientSearchInput.value.trim();
    if (!query) {
        clientResults.innerHTML = "";
        return;
    }

    fetch(`/api/search-client?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(clients => {
            clientResults.innerHTML = "";
            clients.forEach(client => {
                const item = document.createElement("button");
                item.type = "button";
                item.className = "list-group-item list-group-item-action";
                item.textContent = client.client_name;
                item.addEventListener("click", () => {
                    clientSearchInput.value = client.client_name;
                    clientIDInput.value = client.id;
                    clientResults.innerHTML = "";
                });
                clientResults.appendChild(item);
            });
        })
        .catch(err => console.error("Error searching clients:", err));
});

// Close dropdown if clicking outside
document.addEventListener("click", (e) => {
    if (!clientSearchInput.contains(e.target) && !clientResults.contains(e.target)) {
        clientResults.innerHTML = "";
    }
});

// -----------------------------
// Create Case
// -----------------------------
async function createCase() {
    const caseName = document.getElementById("caseName").value.trim();
    const caseNumber = document.getElementById("caseNumber").value.trim();
    const priority = document.getElementById("priority").value;
    const status = document.getElementById("status").value;
    const description = document.getElementById("description").value.trim();
    const investigator = document.getElementById("investigator").value.trim();
    const clientID = document.getElementById("clientID").value;
    const startDate = document.getElementById("startDate").value;

    // Validate required fields
    if (!caseName || !caseNumber || !priority || !status || !clientID) {
        alert("Please fill in all required fields and select a client");
        return;
    }

    const caseData = {
        caseNumber,
        caseName,
        caseType: description || "N/A",
        clientID,
        startDate,
        priority,
        status,
        investigator
    };

    try {
        const response = await fetch("/api/create-case", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(caseData)
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.msg || "Case created successfully!");
            window.location.href = "dashboard.html";
        } else {
            alert(result.msg || "Error creating case");
        }
    } catch (err) {
        console.error("Error creating case:", err);
        alert("Error creating case. Check console for details.");
    }
}
