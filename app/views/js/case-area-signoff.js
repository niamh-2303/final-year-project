/* ============================================================
   case-area-signoff.js
   Handles the Report / Sign-Off tab:
     1. Checks whether a report already exists for this case
     2. Runs a live evidence integrity check (re-hashes files)
     3. Generates the PDF report & closes the case
     4. Lets users download an existing report
   ============================================================ */

(function () {
    'use strict';

    /* ── State ─────────────────────────────────────────────── */
    let integrityResults   = [];
    let integrityChecked   = false;
    let allHashesMatch     = false;
    let reportAlreadyExists = false;

    /* ── Entry-point: called when tab becomes visible ───────── */
    async function initSignoffTab() {
        renderSignoffShell();
        await checkReportStatus();
    }

    /* ── Render the base HTML shell ─────────────────────────── */
    function renderSignoffShell() {
        const pane = document.getElementById('signoff');
        if (!pane) return;

        pane.innerHTML = `
        <div class="signoff-container">

            <!-- Page header -->
            <div class="signoff-header">
                <div class="signoff-header-icon">
                    <i class="bi bi-file-earmark-pdf-fill"></i>
                </div>
                <div>
                    <h3 class="mb-1">Generate Final Report</h3>
                    <p class="mb-0 text-muted" style="font-size:14px;">
                        Sign off the case, verify evidence integrity and produce the
                        official DFIR PDF report. This action will close the case.
                    </p>
                </div>
            </div>

            <!-- Steps / progress indicator -->
            <div class="signoff-steps" id="signoffSteps">
                <div class="signoff-step active" id="step1">
                    <div class="signoff-step-num">1</div>
                    <div class="signoff-step-label">Integrity Check</div>
                </div>
                <div class="signoff-step-connector"></div>
                <div class="signoff-step" id="step2">
                    <div class="signoff-step-num">2</div>
                    <div class="signoff-step-label">Review & Confirm</div>
                </div>
                <div class="signoff-step-connector"></div>
                <div class="signoff-step" id="step3">
                    <div class="signoff-step-num">3</div>
                    <div class="signoff-step-label">Generate Report</div>
                </div>
            </div>

            <!-- Dynamic content area -->
            <div id="signoffContent">
                <div class="signoff-loading">
                    <div class="signoff-spinner"></div>
                    <p>Checking report status...</p>
                </div>
            </div>

        </div>`;
    }

    /* ── Check whether a report already exists ─────── */
    async function checkReportStatus() {
        try {
            const res  = await fetch(`/api/cases/${caseID}/report-status`);
            const data = await res.json();

            if (!data.success) throw new Error(data.msg);

            if (data.hasReport) {
                reportAlreadyExists = true;
                renderReportExists(data);
            } else if (data.caseStatus === 'closed') {
                renderCaseClosedNoReport();
            } else {
                renderIntegrityCheckPanel();
            }
        } catch (err) {
            renderError('Failed to check report status: ' + err.message);
        }
    }

    /* ──  report already generated ───────────────────── */
    function renderReportExists(statusData) {
        setStep(3, true);
        const closedDate = statusData.closedAt
            ? new Date(statusData.closedAt).toLocaleString()
            : 'Unknown';

        document.getElementById('signoffContent').innerHTML = `
        <div class="signoff-done-card">
            <div class="signoff-done-icon success">
                <i class="bi bi-file-earmark-check-fill"></i>
            </div>
            <h4>Report Generated</h4>
            <p class="text-muted">
                The final report for this case was generated on
                <strong>${closedDate}</strong> and the case is now closed.
            </p>

            <div class="signoff-download-box">
                <i class="bi bi-file-earmark-pdf" style="font-size:36px; color:#e05c5c;"></i>
                <div>
                    <div style="font-weight:600; font-size:15px;">
                        DFIR-Report-${caseData?.case_number || ''}.pdf
                    </div>
                    <div class="text-muted" style="font-size:13px;">
                        Official case report — confidential
                    </div>
                </div>
                <button class="btn-signoff-primary" onclick="downloadReport()">
                    <i class="bi bi-download"></i> Download Report
                </button>
            </div>

            <div class="alert alert-info mt-4 d-flex align-items-center" style="font-size:13px;">
                <i class="bi bi-lock-fill me-2"></i>
                <span>This case is closed. No further modifications can be made through the report tab.</span>
            </div>
        </div>`;
    }

    /* ──  case closed but no report file ─────────────── */
    function renderCaseClosedNoReport() {
        document.getElementById('signoffContent').innerHTML = `
        <div class="signoff-done-card">
            <div class="signoff-done-icon warning">
                <i class="bi bi-exclamation-triangle-fill"></i>
            </div>
            <h4>Case Closed — No Report Found</h4>
            <p class="text-muted">
                This case has been closed but no PDF report file was found on the server.
                You can re-generate the report below.
            </p>
            <button class="btn-signoff-secondary mt-3" onclick="renderIntegrityCheckPanel()">
                <i class="bi bi-arrow-clockwise"></i> Re-generate Report
            </button>
        </div>`;
    }

    /* ──  Integrity check panel ──────────────────────── */
    window.renderIntegrityCheckPanel = function () {
        setStep(1, false);
        document.getElementById('signoffContent').innerHTML = `
        <div class="signoff-card">
            <div class="signoff-card-header">
                <i class="bi bi-shield-check"></i>
                Step 1 — Evidence Integrity Verification
            </div>
            <div class="signoff-card-body">
                <p style="font-size:14px; color:#475569;">
                    Before generating the report, every evidence file will be
                    re-hashed using SHA-256 and compared against the value
                    recorded at upload. This proves no files have been tampered
                    with since collection.
                </p>

                <div id="integrityStatus" class="integrity-idle-box">
                    <i class="bi bi-shield-slash" style="font-size:32px; color:#94a3b8;"></i>
                    <p class="mt-2 mb-0 text-muted">Integrity check has not been run yet.</p>
                </div>

                <div id="integrityResultsTable" style="display:none; margin-top:16px;"></div>

                <div class="signoff-actions mt-4">
                    <button class="btn-signoff-secondary" id="runIntegrityBtn" onclick="runIntegrityCheck()">
                        <i class="bi bi-cpu"></i> Run Integrity Check
                    </button>
                    <button class="btn-signoff-primary" id="proceedBtn" style="display:none;"
                            onclick="renderConfirmPanel()">
                        Continue to Review <i class="bi bi-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>`;
    };

    /* ── Run integrity check (API call) ──────────────────────── */
    window.runIntegrityCheck = async function () {
        const btn    = document.getElementById('runIntegrityBtn');
        const status = document.getElementById('integrityStatus');

        btn.disabled = true;
        btn.innerHTML = '<span class="signoff-spinner-sm"></span> Checking...';

        status.innerHTML = `
            <div class="d-flex align-items-center gap-3">
                <div class="signoff-spinner-sm"></div>
                <span style="color:#475569;">Re-hashing evidence files — please wait...</span>
            </div>`;
        status.className = 'integrity-running-box';

        try {
            const res  = await fetch(`/api/cases/${caseID}/integrity-check`);
            const data = await res.json();

            if (!data.success) throw new Error(data.msg);

            integrityResults  = data.results;
            allHashesMatch    = data.allMatch;
            integrityChecked  = true;

            renderIntegrityResults(data.results, data.allMatch);

        } catch (err) {
            status.className = 'integrity-fail-box';
            status.innerHTML = `
                <i class="bi bi-x-circle-fill" style="font-size:28px; color:#dc2626;"></i>
                <p class="mt-2 mb-0" style="color:#dc2626;">
                    Error running integrity check: ${err.message}
                </p>`;
            btn.disabled  = false;
            btn.innerHTML = '<i class="bi bi-cpu"></i> Retry Check';
        }
    };

    /* ── Render integrity results table ──────────────────────── */
    function renderIntegrityResults(results, allMatch) {
        const status = document.getElementById('integrityStatus');
        const table  = document.getElementById('integrityResultsTable');

        // Banner
        if (allMatch) {
            status.className = 'integrity-pass-box';
            status.innerHTML = `
                <i class="bi bi-shield-fill-check" style="font-size:32px; color:#16a34a;"></i>
                <p class="mt-2 mb-0" style="color:#166534; font-weight:600;">
                    All ${results.length} evidence items passed SHA-256 integrity verification.
                    No tampering detected.
                </p>`;
        } else {
            const failCount = results.filter(r => !r.match).length;
            status.className = 'integrity-fail-box';
            status.innerHTML = `
                <i class="bi bi-shield-fill-x" style="font-size:32px; color:#dc2626;"></i>
                <p class="mt-2 mb-1" style="color:#991b1b; font-weight:600;">
                    ${failCount} evidence item${failCount !== 1 ? 's' : ''} FAILED integrity check.
                </p>
                <p class="mb-0" style="color:#991b1b; font-size:13px;">
                    Review the table below. You may still generate the report, but the
                    mismatch will be prominently flagged.
                </p>`;
        }

        // Results table
        let rows = results.map((r, i) => {
            const passIcon = r.match
                ? '<span style="color:#16a34a; font-weight:600;"><i class="bi bi-check-circle-fill"></i> PASS</span>'
                : '<span style="color:#dc2626; font-weight:600;"><i class="bi bi-x-circle-fill"></i> FAIL</span>';

            const storedShort   = r.stored_hash   ? r.stored_hash.substring(0, 20) + '…'   : 'N/A';
            const computedShort = r.computed_hash  ? r.computed_hash.substring(0, 20) + '…' : '—';

            return `
            <tr class="${r.match ? '' : 'integrity-row-fail'}">
                <td>${i + 1}</td>
                <td title="${r.evidence_name}">${r.evidence_name.length > 35 ? r.evidence_name.substring(0,35)+'…' : r.evidence_name}</td>
                <td><code style="font-size:11px;">${storedShort}</code></td>
                <td><code style="font-size:11px;">${computedShort}</code></td>
                <td>${passIcon}</td>
                <td>${r.error ? `<span style="color:#dc2626; font-size:12px;">${r.error}</span>` : ''}</td>
            </tr>`;
        }).join('');

        table.style.display = 'block';
        table.innerHTML = `
        <h6 style="color:#334155; font-weight:600; margin-bottom:8px;">
            <i class="bi bi-table"></i> Detailed Integrity Results
        </h6>
        <div style="overflow-x:auto;">
        <table class="integrity-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Evidence Name</th>
                    <th>Stored Hash (SHA-256)</th>
                    <th>Computed Hash</th>
                    <th>Result</th>
                    <th>Notes</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
        </div>`;

        // Show proceed button
        const btn = document.getElementById('runIntegrityBtn');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Re-run Check';

        document.getElementById('proceedBtn').style.display = 'inline-flex';
    }

    /* ──  Review & Confirm panel ─────────────────────── */
    window.renderConfirmPanel = function () {
        if (!integrityChecked) {
            alert('Please run the integrity check first.');
            return;
        }
        setStep(2, false);

        const passCount = integrityResults.filter(r => r.match).length;
        const failCount = integrityResults.length - passCount;
        const integrityBadge = allHashesMatch
            ? `<span class="signoff-badge pass"><i class="bi bi-shield-check"></i> All ${passCount} items verified</span>`
            : `<span class="signoff-badge fail"><i class="bi bi-shield-x"></i> ${failCount} item(s) FAILED</span>`;

        document.getElementById('signoffContent').innerHTML = `
        <div class="signoff-card">
            <div class="signoff-card-header">
                <i class="bi bi-clipboard2-check"></i>
                Step 2 — Review Summary Before Sign-Off
            </div>
            <div class="signoff-card-body">

                <div class="signoff-review-grid">
                    <div class="review-item">
                        <div class="review-label">Case</div>
                        <div class="review-value">${caseData?.case_name || '—'}</div>
                    </div>
                    <div class="review-item">
                        <div class="review-label">Case Number</div>
                        <div class="review-value">${caseData?.case_number || '—'}</div>
                    </div>
                    <div class="review-item">
                        <div class="review-label">Priority</div>
                        <div class="review-value">${(caseData?.priority || '—').toUpperCase()}</div>
                    </div>
                    <div class="review-item">
                        <div class="review-label">Evidence Items</div>
                        <div class="review-value">${integrityResults.length}</div>
                    </div>
                    <div class="review-item">
                        <div class="review-label">Integrity Status</div>
                        <div class="review-value">${integrityBadge}</div>
                    </div>
                    <div class="review-item">
                        <div class="review-label">Action on Completion</div>
                        <div class="review-value">
                            <span class="signoff-badge warning">
                                <i class="bi bi-lock"></i> Case will be CLOSED
                            </span>
                        </div>
                    </div>
                </div>

                ${!allHashesMatch ? `
                <div class="alert alert-warning mt-3 d-flex align-items-start gap-2" style="font-size:13px;">
                    <i class="bi bi-exclamation-triangle-fill mt-1"></i>
                    <div>
                        <strong>Hash mismatch detected.</strong> The report will include a prominent
                        warning and list the affected evidence items. Proceeding is allowed but you
                        should investigate the mismatch before signing off.
                    </div>
                </div>` : ''}

                <div class="alert alert-danger mt-3 d-flex align-items-start gap-2" style="font-size:13px;">
                    <i class="bi bi-exclamation-circle-fill mt-1"></i>
                    <div>
                        <strong>This action is irreversible.</strong> Generating the report will
                        permanently close this case. Evidence and audit logs will remain readable
                        but no further modifications will be possible through the report tab.
                    </div>
                </div>

                <div class="signoff-actions mt-4">
                    <button class="btn-signoff-secondary" onclick="renderIntegrityCheckPanel()">
                        <i class="bi bi-arrow-left"></i> Back
                    </button>
                    <button class="btn-signoff-primary btn-danger-confirm" id="generateBtn"
                            onclick="generateReport()">
                        <i class="bi bi-file-earmark-pdf"></i> Sign Off & Generate Report
                    </button>
                </div>
            </div>
        </div>`;
    };

    /* ──  Generate report ─────────────────────────────── */
    window.generateReport = async function () {
        const btn = document.getElementById('generateBtn');
        if (!btn) return;

        btn.disabled = true;
        btn.innerHTML = '<span class="signoff-spinner-sm"></span> Generating PDF...';
        setStep(3, false);

        // Show progress overlay
        document.getElementById('signoffContent').innerHTML = `
        <div class="signoff-generating">
            <div class="signoff-gen-anim">
                <i class="bi bi-file-earmark-pdf-fill"></i>
            </div>
            <h4 class="mt-3">Generating Report...</h4>
            <p class="text-muted">Re-verifying evidence hashes, compiling all case data
            and building the PDF. This may take a few seconds.</p>
            <div class="signoff-progress">
                <div class="signoff-progress-bar"></div>
            </div>
        </div>`;

        try {
            const res  = await fetch(`/api/cases/${caseID}/generate-report`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });
            const data = await res.json();

            if (!data.success) throw new Error(data.msg);

            setStep(3, true);
            renderSuccess(data);

            // Refresh the case status badge in the header
            if (typeof loadCaseData === 'function') {
                await loadCaseData();
            }

        } catch (err) {
            setStep(2, false);
            renderError('Report generation failed: ' + err.message);
        }
    };

    /* ── Render success state ────────────────────────────────── */
    function renderSuccess(data) {
        const failCount = (data.integrityResults || []).filter(r => !r.match).length;

        document.getElementById('signoffContent').innerHTML = `
        <div class="signoff-done-card">
            <div class="signoff-done-icon success">
                <i class="bi bi-check-circle-fill"></i>
            </div>
            <h4>Report Generated Successfully</h4>
            <p class="text-muted" style="max-width:500px; margin:0 auto;">
                The case has been officially closed and the PDF report has been created.
                ${failCount > 0
                    ? `<br><strong style="color:#dc2626;">Note: ${failCount} evidence item(s) had hash mismatches — this is documented in the report.</strong>`
                    : '<br>All evidence integrity checks passed.'}
            </p>

            <div class="signoff-download-box mt-4">
                <i class="bi bi-file-earmark-pdf" style="font-size:40px; color:#e05c5c;"></i>
                <div>
                    <div style="font-weight:600; font-size:15px;">
                        DFIR-Report-${caseData?.case_number || ''}.pdf
                    </div>
                    <div class="text-muted" style="font-size:13px;">
                        Official case report — confidential
                    </div>
                </div>
                <button class="btn-signoff-primary" onclick="downloadReport()">
                    <i class="bi bi-download"></i> Download Report
                </button>
            </div>
        </div>`;
    }

    /* ── Render error state ──────────────────────────────────── */
    function renderError(msg) {
        document.getElementById('signoffContent').innerHTML = `
        <div class="signoff-done-card">
            <div class="signoff-done-icon fail">
                <i class="bi bi-x-circle-fill"></i>
            </div>
            <h4>Something Went Wrong</h4>
            <p class="text-muted">${msg}</p>
            <button class="btn-signoff-secondary mt-3" onclick="renderIntegrityCheckPanel()">
                <i class="bi bi-arrow-clockwise"></i> Start Over
            </button>
        </div>`;
    }

    /* ── Download report ─────────────────────────────────────── */
    window.downloadReport = function () {
        window.open(`/api/cases/${caseID}/download-report`, '_blank');
    };

    /* ── Step indicator helper ───────────────────────────────── */
    function setStep(active, done) {
        for (let i = 1; i <= 3; i++) {
            const el = document.getElementById(`step${i}`);
            if (!el) continue;
            el.className = 'signoff-step';
            if (i < active || (i === active && done)) el.classList.add('done');
            else if (i === active)                     el.classList.add('active');
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const signoffTab = document.getElementById('signoff-tab');
        if (signoffTab) {
            signoffTab.addEventListener('shown.bs.tab', function () {
                if (caseID) initSignoffTab();
            });
        }
    });

    // Expose for external calls
    window.initSignoffTab = initSignoffTab;

}());