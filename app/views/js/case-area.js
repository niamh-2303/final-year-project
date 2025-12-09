/* ======================================================
   GLOBAL VARIABLES
====================================================== */
let caseID = null;
let caseData = null;
let CURRENT_CASE_ID = caseID;

let selectedFile = null;
let extractedMetadata = null;
let fileHash = null;

/* ======================================================
   ON PAGE LOAD — Get Case ID + Load Data
====================================================== */
window.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    caseID = params.get("id");

    if (!caseID) {
        alert("No case ID found. Redirecting...");
        window.location.href = "dashboard.html";
        return;
    }

    await loadCaseData();
});

/* ======================================================
   FETCH CASE DATA
====================================================== */
async function loadCaseData() {
    try {
        const response = await fetch(`/api/case/${caseID}`);
        const data = await response.json();

        if (!data.success) {
            alert("Case not found.");
            window.location.href = "dashboard.html";
            return;
        }

        caseData = data.case;
        displayCaseData();
        populateTeamTab();

    } catch (err) {
        console.error("Error loading case:", err);
        alert("Error loading case.");
        window.location.href = "dashboard.html";
    }
}

/* ======================================================
   UPDATE PAGE WITH CASE DATA
====================================================== */
function displayCaseData() {
    document.getElementById("breadcrumbCaseNumber").textContent = caseData.case_number;
    document.getElementById("caseName").textContent = caseData.case_name;
    document.getElementById("caseNumber").textContent = caseData.case_number;
    document.getElementById("caseStatus").textContent = caseData.status;
    document.getElementById("casePriority").textContent = caseData.priority;

    /* Status badge */
    const status = document.getElementById("caseStatus");
    status.className = "badge ms-2";
    if (caseData.status === "active") status.classList.add("bg-success");
    if (caseData.status === "pending") status.classList.add("bg-warning");
    if (caseData.status === "closed") status.classList.add("bg-secondary");

    /* Priority badge */
    const priority = document.getElementById("casePriority");
    priority.className = "badge";
    if (caseData.priority === "low") priority.classList.add("bg-secondary");
    if (caseData.priority === "medium") priority.classList.add("bg-warning");
    if (caseData.priority === "high") priority.classList.add("bg-danger");
    if (caseData.priority === "critical") priority.classList.add("bg-dark");

    console.log("Case Loaded:", caseData);
}

/* ======================================================
   TEAM TAB POPULATION
====================================================== */
function populateTeamTab() {

    /* Lead Investigator */
    document.getElementById("leadInvestigator").textContent =
        caseData.lead_investigator?.name || "Not assigned";

    /* Other Investigators */
    const other = document.getElementById("otherInvestigators");
    other.innerHTML = "";

    if (caseData.investigators?.length > 0) {
        caseData.investigators.forEach(i => {
            const p = document.createElement("p");
            p.textContent = i.name;
            other.appendChild(p);
        });
    } else {
        other.innerHTML = "<p>No investigators assigned.</p>";
    }

    /* Client */
    document.getElementById("clientInfo").textContent =
        caseData.client?.name || "No client assigned";
}
// ==============================
// CASE AREA — Evidence Upload & Log
// ==============================

document.addEventListener("DOMContentLoaded", async () => {
    // Get current case ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const CURRENT_CASE_ID = urlParams.get('id');

    if (!CURRENT_CASE_ID) {
        alert("No case ID provided. Redirecting to dashboard.");
        window.location.href = 'dashboard.html';
        return;
    }

    // DOM elements
    const fileInput = document.getElementById('fileInput');
    const hashOutput = document.getElementById('hashOutput');
    const resultsSection = document.getElementById('resultsSection');
    const clearButton = document.getElementById('clearFileButton');
    const submitButton = document.getElementById('submitEvidenceButton');
    const tbody = document.getElementById('evidenceLogBody');

    let selectedFile = null;
    let extractedMetadata = null;
    let fileHash = null;

    // ------------------------------
    // Load Evidence Log
    // ------------------------------
    async function loadEvidenceLog(caseId) {
    try {
        const response = await fetch(`/api/get-evidence?case_id=${caseId}`);
        const data = await response.json();

        const tbody = document.getElementById('evidenceLogBody');
        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">No evidence uploaded yet</td></tr>';
            return;
        }

        data.forEach(item => {
            const row = tbody.insertRow();
            const filename = item.file_path.split('\\').pop(); // get just the filename
            row.insertCell(0).textContent = item.evidence_name;
            row.insertCell(1).innerHTML = `<img src="/uploads/${filename}" width="100">`;
            row.insertCell(2).textContent = item.file_hash || '';
            row.insertCell(3).textContent = item.uploaded_by || 'N/A';
            row.insertCell(4).textContent = new Date(item.collected_at).toLocaleString();
        });
    } catch (err) {
        console.error('Error loading evidence log:', err);
    }
    }


    // Load evidence log on page load
    loadEvidenceLog(CURRENT_CASE_ID);

    // ------------------------------
    // File Selection
    // ------------------------------
    if (fileInput) {
        fileInput.addEventListener('change', async (event) => {
            selectedFile = event.target.files[0];

            if (!selectedFile) return;

            resultsSection.classList.remove('hidden');
            clearButton.style.display = 'inline-block';

            // Calculate hash
            hashOutput.textContent = `Calculating hash for "${selectedFile.name}"...`;
            fileHash = await calculateSHA256(selectedFile);
            hashOutput.textContent = fileHash;

            // Extract metadata
            extractedMetadata = await extractMetadata(selectedFile);
            displayMetadata(extractedMetadata, selectedFile);
        });
    }

    // ------------------------------
    // Clear file selection
    // ------------------------------
    if (clearButton) {
        clearButton.addEventListener('click', () => {
            fileInput.value = '';
            resultsSection.classList.add('hidden');
            selectedFile = null;
            extractedMetadata = null;
            fileHash = null;
        });
    }

    // ------------------------------
    // Upload Evidence
    // ------------------------------
    if (submitButton) {
        submitButton.addEventListener('click', async () => {
            if (!selectedFile) {
                alert('Please select a file first.');
                return;
            }

            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('case_id', CURRENT_CASE_ID);
            formData.append('file_hash', fileHash);

            // Add extracted metadata
            if (extractedMetadata) {
                Object.keys(extractedMetadata).forEach(key => {
                    formData.append(key, extractedMetadata[key]);
                });
            }

            try {
                const response = await fetch('/api/upload-evidence', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                if (response.ok && result.success) {
                    alert('Evidence uploaded successfully!');
                    // Clear selection
                    fileInput.value = '';
                    resultsSection.classList.add('hidden');
                    selectedFile = null;
                    extractedMetadata = null;
                    fileHash = null;

                    // Refresh evidence log
                    loadEvidenceLog(CURRENT_CASE_ID);
                } else {
                    alert('Upload failed: ' + (result.message || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error uploading evidence:', error);
                alert('Upload failed due to a network/server error.');
            }
        });
    }
});

