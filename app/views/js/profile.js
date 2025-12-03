// Toggle dropdown menu
document.getElementById('profileButton').addEventListener('click', function(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('dropdownMenu');
    dropdown.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('dropdownMenu');
    const profileButton = document.getElementById('profileButton');
    
    if (!profileButton.contains(event.target) && !dropdown.contains(event.target)) {
        dropdown.classList.remove('show');
    }
});

// Fetch and display user info
async function loadUserProfile() {
    try {
        const response = await fetch('http://localhost:8080/get-user-info');
        const data = await response.json();
        
        if (data.success) {
            // Update header dropdown
            document.getElementById('userName').textContent = `${data.firstName} ${data.lastName}`;
            document.getElementById('userEmail').textContent = data.email;
            
            // Update sidebar profile (add these lines)
            const sidebarName = document.getElementById('sidebarUserName');
            const sidebarRole = document.getElementById('sidebarUserRole');
            
            if (sidebarName) {
                sidebarName.textContent = `${data.firstName} ${data.lastName}`;
            }
            if (sidebarRole) {
                sidebarRole.textContent = data.role.charAt(0).toUpperCase() + data.role.slice(1);
            }
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        document.getElementById('userName').textContent = 'User';
        document.getElementById('userEmail').textContent = '';
        
        // Update sidebar on error too
        const sidebarName = document.getElementById('sidebarUserName');
        const sidebarRole = document.getElementById('sidebarUserRole');
        
        if (sidebarName) sidebarName.textContent = 'User';
        if (sidebarRole) sidebarRole.textContent = 'Role';
    }
}

// Load profile when page loads
loadUserProfile();