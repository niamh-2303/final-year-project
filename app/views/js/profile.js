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
            document.getElementById('userName').textContent = `${data.firstName} ${data.lastName}`;
            document.getElementById('userEmail').textContent = data.email;
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        document.getElementById('userName').textContent = 'User';
        document.getElementById('userEmail').textContent = '';
    }
}

// Load profile when page loads
loadUserProfile();