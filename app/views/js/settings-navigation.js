// Handle role-based navigation in settings
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
            
            // Update ALL dashboard links
            const dashboardLinks = document.querySelectorAll('a[href="dashboard.html"]');
            dashboardLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // Update sidebar logo link
            const logoLinks = document.querySelectorAll('.sidebar-logo a');
            logoLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // Update breadcrumb links
            const breadcrumbLinks = document.querySelectorAll('.breadcrumb-link[href="dashboard.html"], .breadcrumb-nav a[href="dashboard.html"]');
            breadcrumbLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // Update dashboard nav items
            const dashboardNavLinks = document.querySelectorAll('.nav-link[href="dashboard.html"]');
            dashboardNavLinks.forEach(link => {
                link.href = dashboardUrl;
            });
            
            // Hide/show role-specific elements
            if (userRole === 'client') {
                hideInvestigatorFeatures();
            } else if (userRole === 'investigator') {
                showInvestigatorFeatures();
            }
        }
    } catch (error) {
        console.error('Error determining user role:', error);
    }
});

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

function showInvestigatorFeatures() {
    const investigatorElements = document.querySelectorAll('.investigator-only');
    investigatorElements.forEach(el => {
        el.style.display = '';
    });
}