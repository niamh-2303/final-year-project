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
   ENHANCED EVIDENCE TAB FUNCTIONS
====================================================== */

let evidenceListData = [];
let currentViewingEvidenceId = null;

// Load evidence list (compact view)
async function loadEvidenceList(caseId) {
    showEvidenceLoading();
    
    try {
        const response = await fetch(`/api/get-evidence?case_id=${caseId}`);
        const data = await response.json();

        evidenceListData = data;
        renderEvidenceList(data);
        
        // Update count badge
        updateEvidenceCount(data.length);

    } catch (err) {
        console.error('Error loading evidence list:', err);
        showEvidenceError();
    }
}

// Show loading state
function showEvidenceLoading() {
    const container = document.getElementById('evidenceListContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="evidence-loading">
            <div class="evidence-loading-spinner"></div>
            <p>Loading evidence...</p>
        </div>
    `;
}

// Show error state
function showEvidenceError() {
    const container = document.getElementById('evidenceListContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="evidence-empty-state">
            <i class="bi bi-exclamation-triangle"></i>
            <h5>Error Loading Evidence</h5>
            <p>There was a problem loading the evidence list. Please try again.</p>
            <button class="btn btn-primary mt-3" onclick="loadEvidenceList(caseID)">
                <i class="bi bi-arrow-clockwise"></i> Retry
            </button>
        </div>
    `;
}

// Update evidence count badge
function updateEvidenceCount(count) {
    const badge = document.getElementById('evidenceCountBadge');
    if (badge) {
        badge.textContent = count;
    }
}

// Render evidence list
function renderEvidenceList(evidenceArray) {
    const container = document.getElementById('evidenceListContainer');
    if (!container) return;
    
    if (evidenceArray.length === 0) {
        container.innerHTML = `
            <div class="evidence-empty-state">
                <i class="bi bi-file-earmark"></i>
                <h5>No Evidence Files</h5>
                <p>No evidence has been uploaded to this case yet.</p>
                <button class="btn btn-primary" onclick="document.getElementById('evidence-upload-tab').click()">
                    <i class="bi bi-upload"></i> Upload Evidence
                </button>
            </div>
        `;
        return;
    }
    
    let tableHTML = `
        <table class="evidence-table">
            <thead>
                <tr>
                    <th>Evidence Name</th>
                    <th>Date Collected</th>
                    <th>File Hash</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    evidenceArray.forEach((item) => {
        const filename = extractFilename(item.file_path);
        const dateCollected = new Date(item.collected_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
        const hashShort = item.file_hash ? item.file_hash.substring(0, 16) + '...' : 'N/A';
        const description = item.description || 'No description';
        
        tableHTML += `
            <tr onclick="viewEvidenceDetails(${item.evidence_id})">
                <td>
                    <div class="evidence-item-info">
                        <div class="evidence-icon">
                            <i class="bi bi-file-earmark-image"></i>
                        </div>
                        <div class="evidence-name-wrapper">
                            <div class="evidence-name">${item.evidence_name}</div>
                            <div class="evidence-description">${description}</div>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="evidence-date">
                        <i class="bi bi-calendar"></i>
                        ${dateCollected}
                    </div>
                </td>
                <td class="evidence-hash-cell">
                    <span class="evidence-hash-short">${hashShort}</span>
                </td>
                <td>
                    <button class="evidence-view-btn" onclick="event.stopPropagation(); viewEvidenceDetails(${item.evidence_id})">
                        <i class="bi bi-eye"></i>
                        View Details
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
}

// Extract filename from path
function extractFilename(filepath) {
    if (!filepath) return 'Unknown';
    if (filepath.includes('\\') || filepath.includes('/')) {
        return filepath.split('\\').pop().split('/').pop();
    }
    return filepath;
}

// View evidence details (opens modal and logs to audit)
async function viewEvidenceDetails(evidenceId) {
    // Find evidence item
    const evidence = evidenceListData.find(e => e.evidence_id === evidenceId);
    if (!evidence) {
        console.error('Evidence not found:', evidenceId);
        return;
    }
    
    // Set current viewing evidence
    currentViewingEvidenceId = evidenceId;
    
    // Log the view action to audit log
    await logEvidenceView(evidenceId, evidence.evidence_name);
    
    // Populate and show modal
    populateEvidenceModal(evidence);
    
    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('evidenceDetailModal'));
    modal.show();
}

// Log evidence view to audit log
async function logEvidenceView(evidenceId, evidenceName) {
    try {
        // Get user info
        const userResponse = await fetch('/get-user-info');
        const userData = await userResponse.json();
        
        if (!userData.success) {
            console.error('Could not get user info for audit log');
            return;
        }
        
        // Log to backend audit log
        const response = await fetch(`/api/evidence/${evidenceId}/log-view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                case_id: caseID,
                evidence_id: evidenceId,
                evidence_name: evidenceName
            })
        });
        
        const result = await response.json();
        if (result.success) {
            console.log(`Evidence view logged: ${evidenceName}`);
        }
        
    } catch (error) {
        console.error('Error logging evidence view:', error);
        // Don't block the modal from opening if logging fails
    }
}

// Populate evidence detail modal
function populateEvidenceModal(evidence) {
    const filename = extractFilename(evidence.file_path);
    
    // Set modal title
    document.getElementById('evidenceModalTitle').textContent = evidence.evidence_name;
    
    // Image preview
    const imagePreview = document.getElementById('evidenceImagePreview');
    imagePreview.innerHTML = `
        <img src="/uploads/${filename}" 
             alt="${evidence.evidence_name}"
             onerror="this.parentElement.innerHTML='<div class=\\'evidence-image-placeholder\\'><i class=\\'bi bi-image\\' style=\\'font-size: 64px; color: #dee2e6;\\'></i><p>Image preview not available</p></div>'">
    `;
    
    // File information
    document.getElementById('evidenceFileName').textContent = evidence.evidence_name;
    document.getElementById('evidenceFileSize').textContent = formatFileSize(evidence.file_size) || 'N/A';
    document.getElementById('evidenceFileType').textContent = evidence.file_type || 'N/A';
    document.getElementById('evidenceCollectedDate').textContent = new Date(evidence.collected_at).toLocaleString();
    
    // Full hash
    document.getElementById('evidenceFullHash').innerHTML = `<code>${evidence.file_hash || 'N/A'}</code>`;
    
    // Description
    const descriptionEl = document.getElementById('evidenceFullDescription');
    if (evidence.description) {
        descriptionEl.innerHTML = `<div class="evidence-description-full">${evidence.description}</div>`;
    } else {
        descriptionEl.innerHTML = `<div class="text-muted">No description provided</div>`;
    }
    
    // Metadata
    populateMetadataTable(evidence);
}

// Populate metadata table
function populateMetadataTable(evidence) {
    const tbody = document.getElementById('evidenceMetadataBody');
    tbody.innerHTML = '';
    
    const metadataFields = [
        { label: 'Camera Make', value: evidence.make },
        { label: 'Camera Model', value: evidence.model },
        { label: 'Date Taken', value: evidence.datetime_original ? new Date(evidence.datetime_original).toLocaleString() : null },
        { label: 'Date Digitized', value: evidence.datetime_digitized ? new Date(evidence.datetime_digitized).toLocaleString() : null },
        { label: 'Orientation', value: evidence.orientation },
        { label: 'Resolution (X)', value: evidence.x_resolution },
        { label: 'Resolution (Y)', value: evidence.y_resolution },
        { label: 'Software', value: evidence.software },
        { label: 'Artist/Author', value: evidence.artist },
        { label: 'Copyright', value: evidence.copyright },
        { label: 'Exposure Time', value: evidence.exposure_time },
        { label: 'F-Number', value: evidence.f_number },
        { label: 'ISO Speed', value: evidence.iso },
        { label: 'Focal Length', value: evidence.focal_length },
        { label: 'Flash', value: evidence.flash },
        { label: 'White Balance', value: evidence.white_balance },
        { label: 'Image Width', value: evidence.pixel_x_dimension },
        { label: 'Image Height', value: evidence.pixel_y_dimension }
    ];
    
    let hasMetadata = false;
    
    metadataFields.forEach(field => {
        if (field.value !== null && field.value !== undefined && field.value !== '') {
            hasMetadata = true;
            const row = tbody.insertRow();
            row.innerHTML = `
                <td><strong>${field.label}</strong></td>
                <td>${field.value}</td>
            `;
        }
    });
    
    if (!hasMetadata) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="text-muted text-center">No EXIF metadata available</td>
            </tr>
        `;
    }
}

// Format file size
function formatFileSize(bytes) {
    if (!bytes) return null;
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Download evidence file
function downloadEvidenceFile() {
    if (!currentViewingEvidenceId) return;
    
    const evidence = evidenceListData.find(e => e.evidence_id === currentViewingEvidenceId);
    if (!evidence) return;
    
    const filename = extractFilename(evidence.file_path);
    const link = document.createElement('a');
    link.href = `/uploads/${filename}`;
    link.download = evidence.evidence_name;
    link.click();
}

// Close modal
function closeEvidenceModal() {
    const modal = bootstrap.Modal.getInstance(document.getElementById('evidenceDetailModal'));
    if (modal) {
        modal.hide();
    }
    currentViewingEvidenceId = null;
}

// Initialize when evidence tab is shown
document.addEventListener('DOMContentLoaded', function() {
    const evidenceTab = document.getElementById('evidence-tab');
    if (evidenceTab) {
        evidenceTab.addEventListener('shown.bs.tab', function() {
            if (caseID) {
                loadEvidenceList(caseID);
            }
        });
    }
});

// Make functions globally available
window.viewEvidenceDetails = viewEvidenceDetails;
window.downloadEvidenceFile = downloadEvidenceFile;
window.closeEvidenceModal = closeEvidenceModal;


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

                loadEvidenceList(caseID);
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
   ENHANCED AUDIT LOG FUNCTIONS
====================================================== */

let auditLogData = [];
let filteredAuditData = [];
let currentFilter = 'all';

// Load enhanced audit log
async function loadEnhancedAuditLog() {
    showAuditLoading();
    
    try {
        const response = await fetch(`/api/cases/${caseID}/audit-log`);
        const data = await response.json();
        
        if (data.success) {
            auditLogData = data.auditLog;
            filteredAuditData = [...auditLogData];
            
            // Update stats
            updateAuditStats(auditLogData);
            
            // Render timeline
            renderEnhancedTimeline(filteredAuditData);
        }
    } catch (error) {
        console.error('Error loading audit log:', error);
        showAuditError();
    }
}

// Show loading state
function showAuditLoading() {
    const container = document.getElementById('auditTimelineContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="audit-loading">
            <div class="audit-loading-spinner"></div>
            <p>Loading audit log...</p>
        </div>
    `;
}

// Show error state
function showAuditError() {
    const container = document.getElementById('auditTimelineContainer');
    if (!container) return;
    
    container.innerHTML = `
        <div class="audit-empty-state">
            <i class="bi bi-exclamation-triangle"></i>
            <h5>Error Loading Audit Log</h5>
            <p>There was a problem loading the audit log. Please try again.</p>
            <button class="btn btn-primary mt-3" onclick="loadEnhancedAuditLog()">
                <i class="bi bi-arrow-clockwise"></i> Retry
            </button>
        </div>
    `;
}

// Update statistics
function updateAuditStats(auditLog) {
    const totalEvents = auditLog.length;
    const evidenceEvents = auditLog.filter(e => 
        e.action.includes('EVIDENCE') || e.action.includes('UPLOADED')
    ).length;
    const verifiedEvents = auditLog.filter(e => 
        e.action.includes('VERIFIED') || e.action.includes('HASH')
    ).length;
    const cocEvents = auditLog.filter(e => 
        e.action.includes('COC_') || e.action.includes('CHAIN')
    ).length;
    
    document.getElementById('totalEventsCount').textContent = totalEvents;
    document.getElementById('evidenceEventsCount').textContent = evidenceEvents;
    document.getElementById('verifiedEventsCount').textContent = verifiedEvents;
    document.getElementById('cocEventsCount').textContent = cocEvents;
}

// Render enhanced timeline
function renderEnhancedTimeline(events) {
    const container = document.getElementById('auditTimelineContainer');
    if (!container) return;
    
    if (events.length === 0) {
        container.innerHTML = `
            <div class="audit-empty-state">
                <i class="bi bi-journal-code"></i>
                <h5>No Events Found</h5>
                <p>There are no audit log events matching your filters.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    events.forEach((event, index) => {
        const eventCard = createEventCard(event, index);
        container.appendChild(eventCard);
    });
}

// Create event card
function createEventCard(event, index) {
    const card = document.createElement('div');
    card.className = 'audit-event-card';
    card.setAttribute('data-event-id', event.id);
    
    const iconClass = getEventIconClass(event.action);
    const iconType = getEventIconType(event.action);
    const formattedTime = new Date(event.timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Check if this event is linked to Chain of Custody
    const isCoCEvent = event.action.includes('COC_') || 
                       event.action.includes('EVIDENCE') ||
                       event.action.includes('VERIFIED');
    
    card.innerHTML = `
        <div class="audit-event-header">
            <div class="audit-event-type">
                <div class="audit-event-icon ${iconClass}">
                    <i class="bi ${iconType}"></i>
                </div>
                <div class="audit-event-title">
                    <h5>${formatActionTitle(event.action)}</h5>
                    <div class="audit-event-time">
                        <i class="bi bi-clock"></i>
                        ${formattedTime}
                    </div>
                </div>
            </div>
        </div>
        
        <div class="audit-event-body">
            <div class="audit-event-user">
                <i class="bi bi-person-circle"></i>
                <strong>${event.user}</strong>
            </div>
            
            <div class="audit-event-details">
                ${event.details}
            </div>
            
            ${isCoCEvent ? `
                <div class="coc-connection-badge" onclick="showCoCConnection('${event.id}')">
                    <i class="bi bi-link-45deg"></i>
                    View in Chain of Custody
                </div>
            ` : ''}
        </div>
        
        <div class="audit-event-footer">
            <div class="audit-event-hash">
                <i class="bi bi-shield-check"></i>
                <strong>Hash:</strong> 
                <code>${event.hash.substring(0, 16)}...</code>
            </div>
            <div class="audit-event-badges">
                <span class="audit-badge verified">
                    <i class="bi bi-check-circle"></i>
                    Verified
                </span>
                ${isCoCEvent ? `
                    <span class="audit-badge chain-linked">
                        <i class="bi bi-link-45deg"></i>
                        CoC Linked
                    </span>
                ` : ''}
            </div>
        </div>
    `;
    
    return card;
}

// Get icon class based on action
function getEventIconClass(action) {
    if (action.includes('CREATED')) return 'created';
    if (action.includes('UPLOADED') || action.includes('EVIDENCE')) return 'uploaded';
    if (action.includes('ACCESSED') || action.includes('VIEWED')) return 'accessed';
    if (action.includes('VERIFIED') || action.includes('HASH')) return 'verified';
    if (action.includes('MODIFIED') || action.includes('UPDATED')) return 'modified';
    return 'created';
}

// Get icon type
function getEventIconType(action) {
    if (action.includes('CREATED')) return 'bi-plus-circle-fill';
    if (action.includes('UPLOADED')) return 'bi-cloud-upload-fill';
    if (action.includes('EVIDENCE')) return 'bi-file-earmark-lock-fill';
    if (action.includes('ACCESSED')) return 'bi-eye-fill';
    if (action.includes('VERIFIED')) return 'bi-shield-check';
    if (action.includes('MODIFIED')) return 'bi-pencil-fill';
    if (action.includes('COC')) return 'bi-link-45deg';
    return 'bi-circle-fill';
}

// Format action title
function formatActionTitle(action) {
    return action.replace(/_/g, ' ')
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Filter events
function filterAuditEvents(filterType) {
    currentFilter = filterType;
    
    // Update button states
    document.querySelectorAll('.audit-filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Filter data
    if (filterType === 'all') {
        filteredAuditData = [...auditLogData];
    } else if (filterType === 'evidence') {
        filteredAuditData = auditLogData.filter(e => 
            e.action.includes('EVIDENCE') || e.action.includes('UPLOADED')
        );
    } else if (filterType === 'coc') {
        filteredAuditData = auditLogData.filter(e => 
            e.action.includes('COC_') || e.action.includes('CHAIN')
        );
    } else if (filterType === 'verified') {
        filteredAuditData = auditLogData.filter(e => 
            e.action.includes('VERIFIED') || e.action.includes('HASH')
        );
    }
    
    renderEnhancedTimeline(filteredAuditData);
}

// Search events
function searchAuditEvents(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    if (!term) {
        filteredAuditData = [...auditLogData];
    } else {
        filteredAuditData = auditLogData.filter(event => 
            event.action.toLowerCase().includes(term) ||
            event.details.toLowerCase().includes(term) ||
            event.user.toLowerCase().includes(term) ||
            event.hash.toLowerCase().includes(term)
        );
    }
    
    renderEnhancedTimeline(filteredAuditData);
}

// Show CoC connection (navigate to Chain of Custody tab)
function showCoCConnection(eventId) {
    // Switch to Chain of Custody tab
    const cocTab = document.getElementById('chain-of-custody-tab');
    if (cocTab) {
        cocTab.click();
        
        // Highlight related CoC event after a short delay
        setTimeout(() => {
            // You can implement highlighting logic here
            console.log('Showing CoC connection for event:', eventId);
        }, 300);
    }
}

// Export audit log
function exportAuditLog() {
    const csvContent = generateAuditCSV(auditLogData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `audit-log-${caseData.case_number}-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Generate CSV
function generateAuditCSV(events) {
    const headers = ['Event ID', 'Timestamp', 'Action', 'User', 'Details', 'Hash', 'Previous Hash'];
    const rows = events.map(event => [
        event.id,
        new Date(event.timestamp).toISOString(),
        event.action,
        event.user,
        `"${event.details.replace(/"/g, '""')}"`,
        event.hash,
        event.prev_hash
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// Initialize when tab is shown
document.addEventListener('DOMContentLoaded', function() {
    const auditLogTab = document.getElementById('audit-log-tab');
    if (auditLogTab) {
        auditLogTab.addEventListener('shown.bs.tab', function() {
            loadEnhancedAuditLog();
        });
    }
});

// Make functions globally available
window.filterAuditEvents = filterAuditEvents;
window.searchAuditEvents = searchAuditEvents;
window.showCoCConnection = showCoCConnection;
window.exportAuditLog = exportAuditLog;

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
    loadEvidenceList(caseID);
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