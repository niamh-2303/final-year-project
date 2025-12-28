// Load user information
async function loadUserInfo() {
    try {
        const response = await fetch('/get-user-info');
        const data = await response.json();
        
        if (data.success) {
            // Update all user info displays
            const fullName = `${data.firstName} ${data.lastName}`;
            
            // For input fields, use .value instead of .textContent
            document.getElementById('fullName').value = fullName;
            document.getElementById('emailAddress').value = data.email;
            document.getElementById('userRole').value = data.role.charAt(0).toUpperCase() + data.role.slice(1);
            
            // Update sidebar (these are text elements)
            document.getElementById('sidebarUserName').textContent = fullName;
            document.getElementById('sidebarUserRole').textContent = data.role.charAt(0).toUpperCase() + data.role.slice(1);
            
            // Update header dropdown (these are text elements)
            document.getElementById('userName').textContent = fullName;
            document.getElementById('userEmail').textContent = data.email;
        } else {
            console.error('Failed to load user info');
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Change password form handler
document.addEventListener('DOMContentLoaded', () => {
    const changePasswordForm = document.getElementById('changePasswordForm');
    
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const currentPassword = document.getElementById('currentPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            const alertDiv = document.getElementById('passwordAlert');
            
            // Client-side validation
            if (newPassword !== confirmPassword) {
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = 'New passwords do not match';
                alertDiv.style.display = 'block';
                return;
            }
            
            if (newPassword.length < 6) {
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = 'Password must be at least 6 characters long';
                alertDiv.style.display = 'block';
                return;
            }
            
            try {
                const response = await fetch('/change-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentpwd: currentPassword,
                        newpwd: newPassword,
                        repeatpwd: confirmPassword
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    alertDiv.className = 'alert alert-success';
                    alertDiv.textContent = data.msg;
                    alertDiv.style.display = 'block';
                    
                    // Clear form
                    changePasswordForm.reset();
                    
                    // Hide success message after 3 seconds
                    setTimeout(() => {
                        alertDiv.style.display = 'none';
                    }, 3000);
                } else {
                    alertDiv.className = 'alert alert-danger';
                    alertDiv.textContent = data.msg;
                    alertDiv.style.display = 'block';
                }
            } catch (error) {
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = 'An error occurred. Please try again.';
                alertDiv.style.display = 'block';
                console.error('Error changing password:', error);
            }
        });
    }
    
    // Load user info on page load
    loadUserInfo();
});

// Delete account function
async function deleteAccount() {
    try {
        const response = await fetch('/delete-account', {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(data.msg);
            window.location.href = '/';
        } else {
            alert(data.msg);
        }
    } catch (error) {
        alert('An error occurred while deleting your account');
        console.error('Error deleting account:', error);
    }
}