async function logout() {
    try {
        const response = await fetch('http://localhost:8080/logout');
        
        if (response.ok) {
            window.location.href = 'index.html';
        } else {
            alert('Error logging out');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error logging out');
    }
}