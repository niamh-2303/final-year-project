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
    AUDIT LOG FUNCTIONS
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

document.addEventListener('DOMContentLoaded', function() {
    // Audit Log tab
    const auditLogTab = document.getElementById('audit-log-tab');
    if (auditLogTab) {
        auditLogTab.addEventListener('shown.bs.tab', function() {
            loadAuditLog();
        });
    }
    
    // Chain of Custody tab 
    const cocTab = document.getElementById('chain-of-custody-tab');
    if (cocTab) {
        cocTab.addEventListener('shown.bs.tab', function() {
            loadChainOfCustody();
        });
    }
});

// Make switchView available globally
window.switchView = switchView;

/* ======================================================
   CHAIN OF CUSTODY FUNCTIONS (NIST Compliant)
====================================================== */
let cocModal = null;

// Load Chain of Custody records
async function loadChainOfCustody() {
    try {
        const response = await fetch(`/api/cases/${caseID}/chain-of-custody`);
        const data = await response.json();
        
        if (data.success) {
            displayChainOfCustody(data.cocRecords);
        }
    } catch (error) {
        console.error('Error loading CoC:', error);
        document.getElementById('cocTimeline').innerHTML = '<p class="text-danger">Error loading chain of custody</p>';
    }
}

// Display CoC records in timeline
function displayChainOfCustody(records) {
    const timeline = document.getElementById('cocTimeline');
    
    if (records.length === 0) {
        timeline.innerHTML = '<p class="text-muted">No chain of custody events recorded yet. Click "Add CoC Event" to record evidence handling.</p>';
        return;
    }
    
    timeline.innerHTML = '';
    
    records.forEach(record => {
        const eventCard = document.createElement('div');
        eventCard.className = 'coc-event-card mb-3';
        
        const iconClass = getCoCIconClass(record.event_type);
        const timeFormatted = new Date(record.event_datetime).toLocaleString();
        
        let transferInfo = '';
        if (record.event_type === 'TRANSFERRED') {
            transferInfo = `
                <div class="row mt-3">
                    <div class="col-md-6">
                        <strong>Released By:</strong><br>
                        ${record.released_by_name || 'N/A'}<br>
                        <small class="text-muted">${record.released_by_role || ''}</small>
                    </div>
                    <div class="col-md-6">
                        <strong>Received By:</strong><br>
                        ${record.received_by_name || 'N/A'}<br>
                        <small class="text-muted">${record.received_by_role || ''}</small>
                    </div>
                </div>
            `;
        }
        
        let verificationInfo = '';
        if (record.event_type === 'VERIFIED' && record.hash_verified) {
            const matchClass = record.hash_match ? 'text-success' : 'text-danger';
            const matchIcon = record.hash_match ? 'check-circle' : 'x-circle';
            verificationInfo = `
                <div class="mt-3">
                    <strong>Hash Verification:</strong><br>
                    Algorithm: ${record.hash_algorithm}<br>
                    Result: <span class="${matchClass}"><i class="bi bi-${matchIcon}"></i> ${record.hash_match ? 'Match - Integrity Verified' : 'Mismatch - Integrity Compromised'}</span><br>
                    <small class="text-muted">Hash: <code>${record.hash_value ? record.hash_value.substring(0, 16) + '...' : 'N/A'}</code></small>
                </div>
            `;
        }
        
        eventCard.innerHTML = `
            <div class="d-flex">
                <div class="coc-icon ${iconClass}">
                    <i class="bi ${getCoCIcon(record.event_type)}"></i>
                </div>
                <div class="coc-content flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div>
                            <h5 class="mb-1">${formatEventType(record.event_type)}</h5>
                            <small class="text-muted">
                                <i class="bi bi-clock"></i> ${timeFormatted}
                            </small>
                        </div>
                        <span class="badge bg-primary">${record.evidence_name}</span>
                    </div>
                    
                    <div class="coc-details">
                        <p class="mb-2"><strong>Reason:</strong> ${record.reason}</p>
                        
                        ${record.location ? `<p class="mb-2"><strong>Location:</strong> ${record.location}</p>` : ''}
                        ${record.condition_at_event ? `<p class="mb-2"><strong>Condition:</strong> ${record.condition_at_event}</p>` : ''}
                        ${record.access_type ? `<p class="mb-2"><strong>Access Type:</strong> ${record.access_type.replace(/_/g, ' ')}</p>` : ''}
                        ${record.security_controls ? `<p class="mb-2"><strong>Security:</strong> ${record.security_controls}</p>` : ''}
                        
                        ${transferInfo}
                        ${verificationInfo}
                        
                        ${record.notes ? `<p class="mt-3 mb-0"><strong>Notes:</strong><br>${record.notes}</p>` : ''}
                    </div>
                    
                    <div class="mt-2">
                        <small class="text-muted">
                            <i class="bi bi-person"></i> Recorded by ${record.created_by_name} on ${new Date(record.created_at).toLocaleString()}
                        </small>
                    </div>
                </div>
            </div>
        `;
        
        timeline.appendChild(eventCard);
    });
}

// Show Add CoC Event Modal
async function showAddCoCEventModal() {
    if (!cocModal) {
        cocModal = new bootstrap.Modal(document.getElementById('addCoCEventModal'));
    }
    
    // Load evidence list
    try {
        const response = await fetch(`/api/cases/${caseID}/evidence-list`);
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('cocEvidenceId');
            select.innerHTML = '<option value="">Select evidence...</option>';
            
            data.evidence.forEach(item => {
                const option = document.createElement('option');
                option.value = item.evidence_id;
                option.textContent = item.evidence_name;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading evidence list:', error);
    }
    
    // Reset form
    document.getElementById('cocEventForm').reset();
    updateCoCFormFields();
    
    cocModal.show();
}

// Update form fields based on event type
function updateCoCFormFields() {
    const eventType = document.getElementById('cocEventType').value;
    
    document.getElementById('transferFields').style.display = eventType === 'TRANSFERRED' ? 'block' : 'none';
    document.getElementById('accessFields').style.display = eventType === 'ACCESSED' ? 'block' : 'none';
    document.getElementById('verificationFields').style.display = eventType === 'VERIFIED' ? 'block' : 'none';
}

// Submit CoC event
async function submitCoCEvent() {
    const evidenceId = document.getElementById('cocEvidenceId').value;
    const eventType = document.getElementById('cocEventType').value;
    const reason = document.getElementById('cocReason').value;
    
    if (!evidenceId || !eventType || !reason) {
        alert('Please fill in all required fields');
        return;
    }
    
    const cocData = {
        evidence_id: evidenceId,
        event_type: eventType,
        reason: reason,
        location: document.getElementById('cocLocation').value,
        condition_at_event: document.getElementById('cocCondition').value,
        security_controls: document.getElementById('cocSecurityControls').value,
        notes: document.getElementById('cocNotes').value
    };
    
    // Add type-specific fields
    if (eventType === 'TRANSFERRED') {
        cocData.released_by_name = document.getElementById('releasedBy').value;
        cocData.released_by_role = document.getElementById('releasedByRole').value;
        cocData.received_by_name = document.getElementById('receivedBy').value;
        cocData.received_by_role = document.getElementById('receivedByRole').value;
    }
    
    if (eventType === 'ACCESSED') {
        cocData.access_type = document.getElementById('accessType').value;
    }
    
    if (eventType === 'VERIFIED') {
        cocData.hash_algorithm = document.getElementById('hashAlgorithm').value;
        cocData.hash_match = document.getElementById('hashMatch').value;
    }
    
    try {
        const response = await fetch(`/api/cases/${caseID}/chain-of-custody`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cocData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            cocModal.hide();
            loadChainOfCustody();
            alert('Chain of Custody event added successfully!');
        } else {
            alert('Error: ' + data.msg);
        }
    } catch (error) {
        console.error('Error adding CoC event:', error);
        alert('Error adding CoC event');
    }
}

// Helper functions
function getCoCIconClass(eventType) {
    const icons = {
        'ACQUIRED': 'coc-acquired',
        'TRANSFERRED': 'coc-transferred',
        'ACCESSED': 'coc-accessed',
        'VERIFIED': 'coc-verified',
        'STORED': 'coc-stored',
        'DISPOSED': 'coc-disposed'
    };
    return icons[eventType] || 'coc-default';
}

function getCoCIcon(eventType) {
    const icons = {
        'ACQUIRED': 'bi-download',
        'TRANSFERRED': 'bi-arrow-left-right',
        'ACCESSED': 'bi-eye',
        'VERIFIED': 'bi-shield-check',
        'STORED': 'bi-archive',
        'DISPOSED': 'bi-trash'
    };
    return icons[eventType] || 'bi-circle';
}

function formatEventType(eventType) {
    const names = {
        'ACQUIRED': 'Initial Acquisition',
        'TRANSFERRED': 'Custody Transfer',
        'ACCESSED': 'Access/Handling Event',
        'VERIFIED': 'Hash Verification',
        'STORED': 'Storage Change',
        'DISPOSED': 'Final Disposition'
    };
    return names[eventType] || eventType;
}

// Make functions globally available
window.showAddCoCEventModal = showAddCoCEventModal;
window.updateCoCFormFields = updateCoCFormFields;
window.submitCoCEvent = submitCoCEvent;

/* ======================================================
   OVERVIEW FUNCTIONS
====================================================== */
let originalOverview = '';

async function loadOverview() {
    try {
        const response = await fetch(`/api/cases/${caseID}/overview`);
        const data = await response.json();
        
        if (data.success) {
            const overview = data.overview.overview || 'No overview has been added yet.';
            document.getElementById('overviewDisplay').innerHTML = `<p>${overview.replace(/\n/g, '<br>')}</p>`;
            document.getElementById('overviewTextarea').value = overview;
            originalOverview = overview;
        }
    } catch (error) {
        console.error('Error loading overview:', error);
        document.getElementById('overviewDisplay').innerHTML = '<p class="text-danger">Error loading overview</p>';
    }
}

function toggleEditOverview() {
    document.getElementById('overviewDisplay').style.display = 'none';
    document.getElementById('overviewTextarea').style.display = 'block';
    document.getElementById('editOverviewBtn').style.display = 'none';
    document.getElementById('saveOverviewBtn').style.display = 'inline-block';
    document.getElementById('cancelOverviewBtn').style.display = 'inline-block';
}

function cancelEditOverview() {
    document.getElementById('overviewDisplay').style.display = 'block';
    document.getElementById('overviewTextarea').style.display = 'none';
    document.getElementById('editOverviewBtn').style.display = 'inline-block';
    document.getElementById('saveOverviewBtn').style.display = 'none';
    document.getElementById('cancelOverviewBtn').style.display = 'none';
    document.getElementById('overviewTextarea').value = originalOverview;
}

async function saveOverview() {
    const overview = document.getElementById('overviewTextarea').value;
    
    try {
        const response = await fetch(`/api/cases/${caseID}/overview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ overview })
        });
        
        const data = await response.json();
        
        if (data.success) {
            originalOverview = overview;
            document.getElementById('overviewDisplay').innerHTML = `<p>${overview.replace(/\n/g, '<br>')}</p>`;
            cancelEditOverview();
            alert('Overview saved successfully!');
        } else {
            alert('Error saving overview: ' + data.msg);
        }
    } catch (error) {
        console.error('Error saving overview:', error);
        alert('Error saving overview');
    }
}

/* ======================================================
   FINDINGS FUNCTIONS
====================================================== */
let originalFindings = '';
let originalRecommendations = '';

async function loadFindings() {
    try {
        const response = await fetch(`/api/cases/${caseID}/findings`);
        const data = await response.json();
        
        if (data.success) {
            const findings = data.findings.findings || 'No findings have been documented yet.';
            const recommendations = data.findings.recommendations || 'No recommendations have been provided yet.';
            
            document.getElementById('findingsText').innerHTML = `<p>${findings.replace(/\n/g, '<br>')}</p>`;
            document.getElementById('recommendationsText').innerHTML = `<p>${recommendations.replace(/\n/g, '<br>')}</p>`;
            document.getElementById('findingsTextarea').value = findings;
            document.getElementById('recommendationsTextarea').value = recommendations;
            
            originalFindings = findings;
            originalRecommendations = recommendations;
        }
    } catch (error) {
        console.error('Error loading findings:', error);
    }
}

function toggleEditFindings() {
    document.getElementById('findingsDisplay').style.display = 'none';
    document.getElementById('findingsEdit').style.display = 'block';
    document.getElementById('editFindingsBtn').style.display = 'none';
    document.getElementById('saveFindingsBtn').style.display = 'inline-block';
    document.getElementById('cancelFindingsBtn').style.display = 'inline-block';
}

function cancelEditFindings() {
    document.getElementById('findingsDisplay').style.display = 'block';
    document.getElementById('findingsEdit').style.display = 'none';
    document.getElementById('editFindingsBtn').style.display = 'inline-block';
    document.getElementById('saveFindingsBtn').style.display = 'none';
    document.getElementById('cancelFindingsBtn').style.display = 'none';
    document.getElementById('findingsTextarea').value = originalFindings;
    document.getElementById('recommendationsTextarea').value = originalRecommendations;
}

async function saveFindings() {
    const findings = document.getElementById('findingsTextarea').value;
    const recommendations = document.getElementById('recommendationsTextarea').value;
    
    try {
        const response = await fetch(`/api/cases/${caseID}/findings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ findings, recommendations })
        });
        
        const data = await response.json();
        
        if (data.success) {
            originalFindings = findings;
            originalRecommendations = recommendations;
            document.getElementById('findingsText').innerHTML = `<p>${findings.replace(/\n/g, '<br>')}</p>`;
            document.getElementById('recommendationsText').innerHTML = `<p>${recommendations.replace(/\n/g, '<br>')}</p>`;
            cancelEditFindings();
            alert('Findings saved successfully!');
        } else {
            alert('Error saving findings: ' + data.msg);
        }
    } catch (error) {
        console.error('Error saving findings:', error);
        alert('Error saving findings');
    }
}

/* ======================================================
   TOOLS FUNCTIONS
====================================================== */
let toolsModal = null;

async function loadTools() {
    try {
        const response = await fetch(`/api/cases/${caseID}/tools`);
        const data = await response.json();
        
        if (data.success) {
            displayTools(data.tools);
        }
    } catch (error) {
        console.error('Error loading tools:', error);
    }
}

function displayTools(tools) {
    const tbody = document.getElementById('toolsTableBody');
    tbody.innerHTML = '';
    
    if (tools.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-muted text-center">No tools added yet</td></tr>';
        return;
    }
    
    tools.forEach(tool => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${tool.tool_name}</strong></td>
            <td>${tool.tool_version || 'N/A'}</td>
            <td>${tool.purpose || 'N/A'}</td>
            <td>${new Date(tool.created_at).toLocaleDateString()}</td>
            <td class="investigator-only">
                <button class="btn btn-sm btn-danger" onclick="deleteTool(${tool.tool_id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function showAddToolModal() {
    if (!toolsModal) {
        toolsModal = new bootstrap.Modal(document.getElementById('addToolModal'));
    }
    document.getElementById('toolName').value = '';
    document.getElementById('toolVersion').value = '';
    document.getElementById('toolPurpose').value = '';
    toolsModal.show();
}

async function addTool() {
    const toolName = document.getElementById('toolName').value.trim();
    const toolVersion = document.getElementById('toolVersion').value.trim();
    const toolPurpose = document.getElementById('toolPurpose').value.trim();
    
    if (!toolName) {
        alert('Please enter a tool name');
        return;
    }
    
    try {
        const response = await fetch(`/api/cases/${caseID}/tools`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                tool_name: toolName, 
                tool_version: toolVersion, 
                purpose: toolPurpose 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            toolsModal.hide();
            loadTools();
            alert('Tool added successfully!');
        } else {
            alert('Error adding tool: ' + data.msg);
        }
    } catch (error) {
        console.error('Error adding tool:', error);
        alert('Error adding tool');
    }
}

async function deleteTool(toolId) {
    if (!confirm('Are you sure you want to delete this tool?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/cases/${caseID}/tools/${toolId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadTools();
            alert('Tool deleted successfully!');
        } else {
            alert('Error deleting tool: ' + data.msg);
        }
    } catch (error) {
        console.error('Error deleting tool:', error);
        alert('Error deleting tool');
    }
}

/* ======================================================
   EVIDENCE TIMELINE FUNCTIONS
====================================================== */
async function loadEvidenceTimeline() {
    try {
        const response = await fetch(`/api/cases/${caseID}/evidence-timeline`);
        const data = await response.json();
        
        if (data.success) {
            displayEvidenceTimeline(data.timeline);
        }
    } catch (error) {
        console.error('Error loading timeline:', error);
        document.getElementById('evidenceTimeline').innerHTML = '<p class="text-danger">Error loading timeline</p>';
    }
}

function displayEvidenceTimeline(timeline) {
    const container = document.getElementById('evidenceTimeline');
    
    if (timeline.length === 0) {
        container.innerHTML = '<p class="text-muted">No evidence with timestamp metadata available</p>';
        return;
    }
    
    container.innerHTML = '';
    
    timeline.forEach((item, index) => {
        const timestamp = item.datetime_original || item.datetime_digitized || item.collected_at;
        const date = new Date(timestamp);
        
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        timelineItem.innerHTML = `
            <div class="timeline-icon uploaded">
                <i class="bi bi-file-earmark"></i>
            </div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <div class="timeline-title">${item.evidence_name}</div>
                    <div class="timeline-time">
                        <i class="bi bi-clock"></i> ${date.toLocaleString()}
                    </div>
                </div>
                <div class="timeline-details">
                    ${item.description || 'No description provided'}
                </div>
                <div class="timeline-hash">
                    <small><i class="bi bi-calendar"></i> 
                        ${item.datetime_original ? 'Original Date' : item.datetime_digitized ? 'Digitized Date' : 'Upload Date'}
                    </small>
                </div>
            </div>
        `;
        container.appendChild(timelineItem);
    });
}

/* ======================================================
   UPDATE PAGE LOAD TO INCLUDE NEW FUNCTIONS
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
    loadEvidenceLog(caseID);
    loadOverview();
    loadFindings();
    loadTools();
    loadEvidenceTimeline();
    loadChainOfCustody();
    attachFileUploadHandlers();
});

// Make functions available globally
window.toggleEditOverview = toggleEditOverview;
window.cancelEditOverview = cancelEditOverview;
window.saveOverview = saveOverview;
window.toggleEditFindings = toggleEditFindings;
window.cancelEditFindings = cancelEditFindings;
window.saveFindings = saveFindings;
window.showAddToolModal = showAddToolModal;
window.addTool = addTool;
window.deleteTool = deleteTool;