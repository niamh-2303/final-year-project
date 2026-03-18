(function () {
    'use strict';

    const ALLOWED_TABS_CLOSED = ['signoff-tab'];

    function waitForCaseData(callback) {
        if (typeof caseData !== 'undefined' && caseData !== null) {
            callback();
        } else {
            setTimeout(() => waitForCaseData(callback), 80);
        }
    }

    function applyClosedMode() {
        if (!caseData || caseData.status !== 'closed') return;

        hideAllTabsExceptReport();
        activateReportTab();
        injectClosedBanner();
        lockStatusSelect();
        disableStrayEditButtons();
    }

    //  Hide every tab except the Report/Sign-off tab 
    function hideAllTabsExceptReport() {
        // All <li> items in the tab bar
        const tabItems = document.querySelectorAll('#caseTabs .nav-item');
        tabItems.forEach(li => {
            const btn = li.querySelector('button[data-bs-toggle="tab"]');
            if (!btn) return;
            const id = btn.id; // e.g. 'overview-tab', 'signoff-tab'
            if (ALLOWED_TABS_CLOSED.includes(id)) {
                // Keep it, but re-label it so it's obvious
                btn.innerHTML = '<i class="bi bi-file-earmark-pdf"></i> Report';
                li.style.display = '';
            } else {
                li.style.display = 'none';
            }
        });
    }

    // Force Report tab to be the active pane
    function activateReportTab() {
        // Deactivate all panes
        document.querySelectorAll('#caseTabsContent .tab-pane').forEach(pane => {
            pane.classList.remove('show', 'active');
        });
        // Deactivate all tab buttons
        document.querySelectorAll('#caseTabs .nav-link').forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
        });

        // Activate the signoff tab button
        const signoffBtn = document.getElementById('signoff-tab');
        if (signoffBtn) {
            signoffBtn.classList.add('active');
            signoffBtn.setAttribute('aria-selected', 'true');
        }

        // Activate the signoff pane
        const signoffPane = document.getElementById('signoff');
        if (signoffPane) {
            signoffPane.classList.add('show', 'active');
        }

        // Trigger the signoff tab's init (loads report status etc.)
        if (typeof window.initSignoffTab === 'function') {
            window.initSignoffTab();
        }
    }

    // case closed" banner 
    function injectClosedBanner() {
        if (document.getElementById('caseClosedBanner')) return; // already there

        const closedAt = caseData.closed_at
            ? new Date(caseData.closed_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric'
              })
            : null;

        const banner = document.createElement('div');
        banner.id = 'caseClosedBanner';
        banner.innerHTML = `
            <div class="closed-case-banner">
                <div class="closed-case-banner-inner">
                    <div class="closed-banner-icon">
                        <i class="bi bi-lock-fill"></i>
                    </div>
                    <div class="closed-banner-text">
                        <strong>This case is closed and read-only.</strong>
                        ${closedAt ? `Closed on ${closedAt}.` : ''}
                        All evidence, audit logs and chain of custody records are preserved.
                        The final report is available below.
                    </div>
                </div>
            </div>`;

        // Insert just before the tab bar
        const header = document.querySelector('.content-header');
        const tabBar = document.querySelector('.case-tabs-scroll-wrapper');
        if (header && tabBar) {
            header.insertBefore(banner, tabBar);
        } else if (header) {
            header.appendChild(banner);
        }
    }

    // Lock the status select so it cannot be changed 
    function lockStatusSelect() {
        const sel = document.getElementById('statusSelect');
        if (sel) {
            sel.disabled = true;
            sel.title = 'Case is closed — status cannot be changed';
        }
        // Also hide the status control strip entirely for cleanliness
        const strip = document.querySelector('.status-control-strip');
        if (strip) strip.style.display = 'none';
    }

    // disable any stray edit/save buttons ─
    function disableStrayEditButtons() {
        const dangerSelectors = [
            '#editOverviewBtn',
            '#saveOverviewBtn',
            '#cancelOverviewBtn',
            '#editFindingsBtn',
            '#saveFindingsBtn',
            '#cancelFindingsBtn',
            '[onclick*="showAddToolModal"]',
            '[onclick*="deleteTool"]',
            '[onclick*="showAddCoCEventModal"]',
            '[onclick*="submitCoCEvent"]',
            '#submitEvidenceButton',
            '#clearFileButton',
        ];
        dangerSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
                el.disabled = true;
                el.style.display = 'none';
            });
        });
    }

    //Intercept any accidental write API calls 
    // Patch fetch so that if a write endpoint is called for a
    // closed case the call is blocked client-side with a clear error.
    const WRITE_PATTERNS = [
        /\/api\/cases\/\d+\/overview$/,
        /\/api\/cases\/\d+\/findings$/,
        /\/api\/cases\/\d+\/tools$/,
        /\/api\/cases\/\d+\/chain-of-custody$/,
        /\/api\/cases\/\d+\/status$/,
        /\/api\/upload-evidence$/,
    ];

    const _originalFetch = window.fetch;
    window.fetch = function (url, options = {}) {
        const method = (options.method || 'GET').toUpperCase();
        if (method !== 'GET' && caseData && caseData.status === 'closed') {
            const urlStr = typeof url === 'string' ? url : url.toString();
            const blocked = WRITE_PATTERNS.some(p => p.test(urlStr));
            if (blocked) {
                console.warn(`[Closed Case] Blocked write request to ${urlStr}`);
                return Promise.resolve(new Response(
                    JSON.stringify({
                        success: false,
                        msg: 'This case is closed. No modifications are permitted.'
                    }),
                    { status: 403, headers: { 'Content-Type': 'application/json' } }
                ));
            }
        }
        return _originalFetch.apply(this, arguments);
    };

    document.addEventListener('DOMContentLoaded', () => {
        waitForCaseData(applyClosedMode);
    });

    // Also expose so case-area.js can call it directly after
    // loadCaseData() completes if needed:
    window.applyClosedModeIfNeeded = applyClosedMode;

}());