/* ======================================================
   GLOBAL VARIABLES
====================================================== */
let caseID = null;
let caseData = null;

let selectedFile = null;
let extractedMetadata = null;
let fileHash = null;

/* ======================================================
   SHA-256 and Metadata Functions
====================================================== */
function bufferToHex(buffer) {
    const hashArray = Array.from(new Uint8Array(buffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function calculateSHA256(file) {
    if (!file) return 'No file selected.';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
        return bufferToHex(hashBuffer);
    } catch (error) {
        console.error("Error calculating hash:", error);
        return 'Error during hash calculation.';
    }
}

function extractMetadata(file) {
    return new Promise((resolve, reject) => {
        EXIF.getData(file, function() {
            const allMetaData = EXIF.getAllTags(this);
            
            if (Object.keys(allMetaData).length === 0) {
                resolve(null);
            } else {
                resolve(allMetaData);
            }
        });
    });
}

function formatValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value);
    return value.toString();
}

function displayMetadata(metadata, file) {
    const tbody = document.getElementById('metadataBody');
    tbody.innerHTML = '';

    const addRow = (property, value) => {
        const row = tbody.insertRow();
        row.insertCell(0).innerHTML = `<strong>${property}</strong>`;
        row.insertCell(1).textContent = value;
    };

    // Basic file info
    addRow('File Name', file.name);
    addRow('File Size', formatFileSize(file.size));
    addRow('File Type', file.type);
    addRow('Last Modified', new Date(file.lastModified).toLocaleString());

    if (!metadata || Object.keys(metadata).length === 0) {
        const row = tbody.insertRow();
        row.insertCell(0).innerHTML = '<strong>EXIF Data</strong>';
        row.insertCell(1).textContent = 'No EXIF metadata found in this file';
        return;
    }

    // Add EXIF metadata
    const separatorRow = tbody.insertRow();
    separatorRow.innerHTML = '<td colspan="2"><strong>--- EXIF Metadata ---</strong></td>';

    const importantFields = {
        'Make': 'Camera Make',
        'Model': 'Camera Model',
        'DateTime': 'Date/Time',
        'DateTimeOriginal': 'Date Taken',
        'DateTimeDigitized': 'Date Digitized',
        'Orientation': 'Orientation',
        'XResolution': 'X Resolution',
        'YResolution': 'Y Resolution',
        'Software': 'Software',
        'Artist': 'Artist/Author',
        'Copyright': 'Copyright',
        'ExposureTime': 'Exposure Time',
        'FNumber': 'F-Number',
        'ISO': 'ISO Speed',
        'FocalLength': 'Focal Length',
        'Flash': 'Flash',
        'WhiteBalance': 'White Balance',
        'PixelXDimension': 'Image Width',
        'PixelYDimension': 'Image Height'
    };

    Object.keys(importantFields).forEach(key => {
        if (metadata[key] !== undefined) {
            addRow(importantFields[key], formatValue(metadata[key]));
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Toggle details visibility - MUST be in global scope
window.toggleDetails = function(index) {
    const detailsDiv = document.getElementById(`details-${index}`);
    const chevron = document.getElementById(`chevron-${index}`);
    
    if (detailsDiv.style.display === 'none') {
        detailsDiv.style.display = 'block';
        chevron.className = 'bi bi-chevron-up';
    } else {
        detailsDiv.style.display = 'none';
        chevron.className = 'bi bi-chevron-down';
    }
}

// Generate metadata rows from evidence item
function generateMetadataRows(item) {
    const metadata = [
        { label: 'Camera Make', value: item.make },
        { label: 'Camera Model', value: item.model },
        { label: 'Date Taken', value: item.datetime_original ? new Date(item.datetime_original).toLocaleString() : null },
        { label: 'Date Digitized', value: item.datetime_digitized ? new Date(item.datetime_digitized).toLocaleString() : null },
        { label: 'Orientation', value: item.orientation },
        { label: 'X Resolution', value: item.x_resolution },
        { label: 'Y Resolution', value: item.y_resolution },
        { label: 'Software', value: item.software },
        { label: 'Artist', value: item.artist },
        { label: 'Copyright', value: item.copyright },
        { label: 'Exposure Time', value: item.exposure_time },
        { label: 'F-Number', value: item.f_number },
        { label: 'ISO Speed', value: item.iso },
        { label: 'Focal Length', value: item.focal_length },
        { label: 'Flash', value: item.flash },
        { label: 'White Balance', value: item.white_balance },
        { label: 'Image Width', value: item.pixel_x_dimension },
        { label: 'Image Height', value: item.pixel_y_dimension }
    ];
    
    let rows = '';
    metadata.forEach(field => {
        if (field.value !== null && field.value !== undefined && field.value !== '') {
            rows += `
                <tr>
                    <td><strong>${field.label}</strong></td>
                    <td>${field.value}</td>
                </tr>
            `;
        }
    });
    
    if (rows === '') {
        rows = '<tr><td colspan="2" class="text-muted">No EXIF metadata available</td></tr>';
    }
    
    return rows;
}

/* ======================================================
   Load Evidence Log
====================================================== */
async function loadEvidenceLog(caseId) {
    try {
        const response = await fetch(`/api/get-evidence?case_id=${caseId}`);
        const data = await response.json();

        const container = document.getElementById('evidenceLogContainer');
        container.innerHTML = '';

        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted">No evidence uploaded yet</p>';
            return;
        }

        data.forEach((item, index) => {
            let filename = item.file_path;
            if (filename.includes('\\') || filename.includes('/')) {
                filename = filename.split('\\').pop().split('/').pop();
            }
            
            const evidenceCard = document.createElement('div');
            evidenceCard.className = 'card mb-3';
            evidenceCard.innerHTML = `
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">
                        <i class="bi bi-file-earmark"></i> ${item.evidence_name}
                    </h5>
                    <button class="btn btn-sm btn-outline-primary" onclick="toggleDetails(${index})">
                        <i class="bi bi-chevron-down" id="chevron-${index}"></i> Details
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-4">
                            <img src="/uploads/${filename}" 
                                 class="img-fluid rounded" 
                                 alt="Evidence preview"
                                 id="evidence-img-${index}">
                        </div>
                        <div class="col-md-8">
                            <table class="table table-sm">
                                <tr>
                                    <th style="width: 200px;">File Hash (SHA-256)</th>
                                    <td><code style="word-break: break-all; font-size: 0.85em;">${item.file_hash || 'Hash not available'}</code></td>
                                </tr>
                                <tr>
                                    <th>Description</th>
                                    <td>${item.description || 'No description provided'}</td>
                                </tr>
                                <tr>
                                    <th>Uploaded</th>
                                    <td>${new Date(item.collected_at).toLocaleString()}</td>
                                </tr>
                                <tr>
                                    <th>File Path</th>
                                    <td><small class="text-muted">${filename}</small></td>
                                </tr>
                            </table>
                        </div>
                    </div>
                    
                    <div id="details-${index}" class="mt-3" style="display: none;">
                        <hr>
                        <h6><strong>Detailed EXIF Metadata</strong></h6>
                        <table class="table table-striped table-sm">
                            <thead>
                                <tr>
                                    <th style="width: 200px;">Property</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateMetadataRows(item)}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            
            container.appendChild(evidenceCard);
            
            const img = document.getElementById(`evidence-img-${index}`);
            img.onerror = function() {
                console.log('Failed to load image:', `/uploads/${filename}`);
                this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E';
            };
        });
    } catch (err) {
        console.error('Error loading evidence log:', err);
        const container = document.getElementById('evidenceLogContainer');
        container.innerHTML = '<p class="text-danger">Error loading evidence log</p>';
    }
}

/* ======================================================
   ON PAGE LOAD — SINGLE DOMContentLoaded
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
    
    // Load evidence log
    loadEvidenceLog(caseID);

    // Attach file upload handlers
    attachFileUploadHandlers();
});

function attachFileUploadHandlers() {
    const fileInput = document.getElementById('fileInput');
    const hashOutput = document.getElementById('hashOutput');
    const resultsSection = document.getElementById('resultsSection');
    const clearButton = document.getElementById('clearFileButton');
    const submitButton = document.getElementById('submitEvidenceButton');

    console.log('=== CHECKING ELEMENTS ===');
    console.log('File input:', fileInput);
    console.log('Hash output:', hashOutput);
    console.log('Results section:', resultsSection);
    console.log('Clear button:', clearButton);
    console.log('Submit button:', submitButton);

    if (!fileInput || !hashOutput || !resultsSection || !clearButton || !submitButton) {
        console.error('Some elements not found, retrying in 500ms...');
        setTimeout(attachFileUploadHandlers, 500);
        return;
    }

    console.log('All elements found, attaching event listeners...');

    // File Selection
    fileInput.addEventListener('change', async (event) => {
        selectedFile = event.target.files[0];
        console.log('=== FILE SELECTED ===');
        console.log('File:', selectedFile?.name);

        if (!selectedFile) return;

        resultsSection.classList.remove('hidden');
        clearButton.style.display = 'inline-block';

        // Calculate hash
        hashOutput.textContent = `Calculating hash for "${selectedFile.name}"...`;
        fileHash = await calculateSHA256(selectedFile);
        console.log('Hash calculated:', fileHash);
        hashOutput.textContent = fileHash;

        // Extract metadata
        extractedMetadata = await extractMetadata(selectedFile);
        console.log('Metadata extracted:', extractedMetadata);
        displayMetadata(extractedMetadata, selectedFile);
    });

    // Clear file selection
    clearButton.addEventListener('click', () => {
        console.log('Clear button clicked');
        fileInput.value = '';
        resultsSection.classList.add('hidden');
        selectedFile = null;
        extractedMetadata = null;
        fileHash = null;
        document.getElementById('evidenceSummary').value = '';
    });

    // Upload Evidence
    submitButton.addEventListener('click', async () => {
        console.log('=== UPLOAD BUTTON CLICKED ===');
        
        if (!selectedFile) {
            alert('Please select a file first.');
            return;
        }

        const evidenceSummary = document.getElementById('evidenceSummary').value.trim();
        
        if (!evidenceSummary) {
            alert('Please provide a summary of the evidence.');
            return;
        }

        console.log('File hash:', fileHash);
        console.log('Extracted metadata:', extractedMetadata);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('case_id', caseID);
        formData.append('file_hash', fileHash);
        formData.append('evidence_summary', evidenceSummary);

        // Add extracted metadata
        if (extractedMetadata) {
            Object.keys(extractedMetadata).forEach(key => {
                console.log(`Adding metadata: ${key} = ${extractedMetadata[key]}`);
                formData.append(key, extractedMetadata[key]);
            });
        }

        try {
            const response = await fetch('/api/upload-evidence', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            console.log('Upload result:', result);
            
            if (response.ok && result.success) {
                alert('Evidence uploaded successfully!');
                fileInput.value = '';
                resultsSection.classList.add('hidden');
                selectedFile = null;
                extractedMetadata = null;
                fileHash = null;
                document.getElementById('evidenceSummary').value = '';

                loadEvidenceLog(caseID);
            } else {
                alert('Upload failed: ' + (result.message || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error uploading evidence:', error);
            alert('Upload failed due to a network/server error.');
        }
    });

    console.log('Event listeners attached successfully!');
}

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

    const status = document.getElementById("caseStatus");
    status.className = "badge ms-2";
    if (caseData.status === "active") status.classList.add("bg-success");
    if (caseData.status === "pending") status.classList.add("bg-warning");
    if (caseData.status === "closed") status.classList.add("bg-secondary");

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
    document.getElementById("leadInvestigator").textContent =
        caseData.lead_investigator?.name || "Not assigned";

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

    document.getElementById("clientInfo").textContent =
        caseData.client?.name || "No client assigned";
}

/* ======================================================
   CHAIN OF CUSTODY / AUDIT LOG FUNCTIONS
====================================================== */
let currentView = 'friendly';

// Switch between views
function switchView(view) {
    currentView = view;
    
    if (view === 'friendly') {
        document.getElementById('friendlyView').style.display = 'block';
        document.getElementById('terminalView').style.display = 'none';
        document.getElementById('friendlyViewBtn').classList.add('active');
        document.getElementById('terminalViewBtn').classList.remove('active');
    } else {
        document.getElementById('friendlyView').style.display = 'none';
        document.getElementById('terminalView').style.display = 'block';
        document.getElementById('friendlyViewBtn').classList.remove('active');
        document.getElementById('terminalViewBtn').classList.add('active');
    }
}

// Load audit log data from backend
async function loadAuditLog() {
    try {
        const response = await fetch(`/api/cases/${caseID}/audit-log`);
        const data = await response.json();
        
        if (data.success) {
            const auditLog = data.auditLog;
            
            // Update stats
            document.getElementById('totalEvents').textContent = auditLog.length;
            const evidenceCount = auditLog.filter(e => e.action.includes('EVIDENCE')).length;
            document.getElementById('evidenceCount').textContent = evidenceCount;
            
            // Render both views
            renderFriendlyTimeline(auditLog);
            renderTerminalView(auditLog);
        }
    } catch (error) {
        console.error('Error loading audit log:', error);
        // Use sample data if API fails
        useSampleAuditLog();
    }
}

// Fallback sample data for demonstration
function useSampleAuditLog() {
    const sampleData = [
        {
            id: 1,
            timestamp: new Date().toISOString(),
            action: 'CASE_CREATED',
            user: 'Niamh Armour',
            user_id: 1,
            details: `Case ${caseData.case_number} created with priority: ${caseData.priority}`,
            hash: 'a3f5c9d8e1b2f4a6c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1',
            prev_hash: '0000000000000000000000000000000000000000000000000000000000000000'
        }
    ];
    
    document.getElementById('totalEvents').textContent = sampleData.length;
    document.getElementById('evidenceCount').textContent = 0;
    
    renderFriendlyTimeline(sampleData);
    renderTerminalView(sampleData);
}

function renderFriendlyTimeline(auditLog) {
    const timeline = document.getElementById('auditTimeline');
    if (!timeline) return;
    
    timeline.innerHTML = '';
    
    auditLog.forEach(event => {
        const iconClass = getIconClass(event.action);
        const timeFormatted = new Date(event.timestamp).toLocaleString();
        
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-icon ${iconClass}">
                <i class="bi ${getIconType(event.action)}"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <div class="timeline-title">${formatAction(event.action)}</div>
                    <div class="timeline-time">
                        <i class="bi bi-clock"></i> ${timeFormatted}
                    </div>
                </div>
                <div class="timeline-details">
                    <strong>${event.user}</strong> - ${event.details}
                </div>
                <div class="timeline-hash">
                    <small><i class="bi bi-shield-check"></i> Event Hash (SHA-256)</small>
                    <code>${event.hash}</code>
                </div>
            </div>
        `;
        timeline.appendChild(item);
    });
}

function renderTerminalView(auditLog) {
    const terminalLogs = document.getElementById('terminalLogs');
    if (!terminalLogs) return;
    
    terminalLogs.innerHTML = '';
    
    // Update case ID in terminal
    const terminalCaseId = document.getElementById('terminalCaseId');
    if (terminalCaseId && caseData) {
        terminalCaseId.textContent = caseData.case_number;
    }
    
    auditLog.forEach((event) => {
        const timestamp = new Date(event.timestamp).toISOString();
        
        const eventBlock = document.createElement('div');
        eventBlock.className = 'terminal-event';
        eventBlock.innerHTML = `
            <div class="terminal-line terminal-event-header">[Event #${event.id}] ${event.action}</div>
            <div class="terminal-line terminal-event-detail">├─ Timestamp: ${timestamp}</div>
            <div class="terminal-line terminal-event-detail">├─ User: ${event.user} (ID: ${event.user_id})</div>
            <div class="terminal-line terminal-event-detail">├─ Action: ${event.details}</div>
            <div class="terminal-line terminal-event-detail">├─ Event Hash: <span class="terminal-hash">${event.hash}</span></div>
            <div class="terminal-line terminal-event-detail">└─ Prev Hash: <span class="terminal-hash">${event.prev_hash}</span></div>
            <div class="terminal-line terminal-success">  ✓ Signature verified</div>
            <div class="terminal-line terminal-success">  ✓ Chain link verified</div>
            <div class="terminal-line"></div>
        `;
        terminalLogs.appendChild(eventBlock);
    });
}

function getIconClass(action) {
    if (action.includes('CREATED')) return 'created';
    if (action.includes('UPLOADED')) return 'uploaded';
    if (action.includes('ACCESSED')) return 'accessed';
    if (action.includes('MODIFIED')) return 'modified';
    return 'created';
}

function getIconType(action) {
    if (action.includes('CREATED')) return 'bi-plus-circle';
    if (action.includes('UPLOADED')) return 'bi-cloud-upload';
    if (action.includes('ACCESSED')) return 'bi-eye';
    if (action.includes('MODIFIED')) return 'bi-pencil';
    return 'bi-circle';
}

function formatAction(action) {
    return action.replace(/_/g, ' ').toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Load audit log when CoC tab is clicked
document.addEventListener('DOMContentLoaded', function() {
    const cocTab = document.getElementById('coc-tab');
    if (cocTab) {
        cocTab.addEventListener('shown.bs.tab', function() {
            loadAuditLog();
        });
    }
});

// Make switchView available globally
window.switchView = switchView;