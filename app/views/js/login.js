async function login() {
    const email = document.getElementById('email').value;
    const pwd = document.getElementById('pwd').value;

    if (!email || !pwd) {
        alert('Please enter email and password');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                pwd: pwd
            })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Login successful!');
            window.location.href = 'dashboard.html'; // Redirect to dashboard
        } else {
            alert(data.msg || 'Login failed');
        }

    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during login');
    }
}