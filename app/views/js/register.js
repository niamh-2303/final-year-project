async function registerAccount() {
    // Get form values
    const fname = document.getElementById('fname').value;
    const lname = document.getElementById('lname').value;
    const role = document.getElementById('role').value;
    const email = document.getElementById('email').value;
    const psw = document.getElementById('psw').value;
    const pswRepeat = document.getElementById('psw-repeat').value;

    // Basic validation
    if (!fname || !lname || !role || !email || !psw || !pswRepeat) {
        alert('Please fill in all fields');
        return;
    }

    if (psw !== pswRepeat) {
        alert('Passwords do not match');
        return;
    }

    try {
        const response = await fetch('http://localhost:8080/register-account', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
           body: JSON.stringify({
            fname: fname,
            lname: lname,
            role: role,
            email: email,
            psw: psw,
            pswrepeat: pswRepeat  
           })
        });

        const data = await response.json();

        if (response.ok) {
            alert('Account registered successfully!');
            window.location.href = 'index.html'; // Redirect to login page
        } else {
            alert(data.msg || 'Registration failed');
        }

    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during registration');
    }
}