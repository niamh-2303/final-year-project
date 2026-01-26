// Handle role-based navigation in case area
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Get user info to determine role
        const response = await fetch('/get-user-info');
        const data = await response.json();
        
        if (data.success) {
            const userRole = data.role;
            
            // Determine the correct dashboard URL based on role
            let dashboardUrl = 'dashboard.html'; // default for investigator
            if (userRole === 'client') {
                dashboardUrl = 'client-dashboard.html';
            } else if (userRole === 'investigator') {
                dashboardUrl = 'dashboard.html';
            }
            
            // Update ALL possible dashboard links
            
            // 1. Regular anchor links with href="dashboard.html"
            const dashboardLinks = document.querySelectorAll('a[href="dashboard.html"]');
            dashboardLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // 2. Sidebar logo link
            const logoLinks = document.querySelectorAll('.sidebar-logo a');
            logoLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // 3. Breadcrumb navigation links
            const breadcrumbLinks = document.querySelectorAll('.breadcrumb-link[href="dashboard.html"], .breadcrumb-nav a[href="dashboard.html"]');
            breadcrumbLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // 4. "Back to Dashboard" buttons (with various classes)
            const backButtons = document.querySelectorAll(
                'a[href="dashboard.html"].btn, ' +
                'a[href="dashboard.html"].btn-primary, ' +
                'a[href="dashboard.html"].btn-secondary, ' +
                'button[onclick*="dashboard.html"]'
            );
            backButtons.forEach(button => {
                if (button.tagName === 'A') {
                    button.href = dashboardUrl;
                } else if (button.tagName === 'BUTTON') {
                    button.onclick = () => window.location.href = dashboardUrl;
                }
            });
            
            // 5. Dashboard nav items in sidebar
            const dashboardNavLinks = document.querySelectorAll('.nav-link[href="dashboard.html"]');
            dashboardNavLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // Hide/show elements based on role
            if (userRole === 'client') {
                hideInvestigatorFeatures();
                showClientFeatures();
            } else if (userRole === 'investigator') {
                showInvestigatorFeatures();
                hideClientFeatures();
            }
        }
    } catch (error) {
        console.error('Error determining user role:', error);
    }
});

// Hide features that only investigators should see
function hideInvestigatorFeatures() {
    const investigatorElements = document.querySelectorAll('.investigator-only');
    investigatorElements.forEach(el => {
        el.style.display = 'none';
    });
    
    // Hide deleted cases link
    const deletedCasesLinks = document.querySelectorAll('a[href="deleted-cases.html"]');
    deletedCasesLinks.forEach(link => {
        const navItem = link.closest('.nav-item');
        if (navItem) {
            navItem.style.display = 'none';
        }
    });
}

// Show all investigator features
function showInvestigatorFeatures() {
    const investigatorElements = document.querySelectorAll('.investigator-only');
    investigatorElements.forEach(el => {
        el.style.display = '';
    });
}

// Show client-specific features
function showClientFeatures() {
    const clientElements = document.querySelectorAll('.client-only');
    clientElements.forEach(el => {
        el.style.display = '';
    });
}

// Hide client-specific features
function hideClientFeatures() {
    const clientElements = document.querySelectorAll('.client-only');
    clientElements.forEach(el => {
        el.style.display = 'none';
    });
}