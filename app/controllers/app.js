const express = require('express');
const cors = require('cors');
const path = require('path');
const sql = require('./db.js');
const bcrypt = require('bcrypt');
const session = require('express-session');
const validator = require('validator');
const bodyParser = require('body-parser');

const app = express();
const saltRounds = 10;

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'your-production-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.use(cors());

// Serve all static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, '../views')));

// Middleware to check if user is logged in
var requireLogin = function (req, res, next) {
    console.log('Checking if user is logged in');
    if (req.session.user == null) {
        console.log('User not logged in');
        res.sendFile(path.join(__dirname, '../views/index.html'));
    } else {
        console.log('User logged in: ' + req.session.user);
        next();
    }
};

// HTML routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
});

app.get('/dashboard', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

app.get('/create-case', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/create-case.html'));
});

// FOR AUTHENTICATION 
// Register new account
app.post('/register-account', async (req, res) => {
    const { fname, lname, role, email, psw } = req.body;
    const pswrepeat = req.body['psw-repeat'];
    
    console.log("Register attempt - email: " + email);

    // Validate required fields
    if (!fname || !lname || !role || !email || !psw || !pswrepeat) {
        return res.status(400).json({ msg: 'All fields are required' });
    }

    // Check if passwords match
    if (psw !== pswrepeat) {
        return res.status(400).json({ msg: 'Passwords do not match' });
    }

    try {
        // Hash the password
        const hash = await bcrypt.hash(psw, saltRounds);
        console.log("Password hashed successfully");

        // Insert into the database
        await sql`
            INSERT INTO users (first_name, last_name, role, email, password)
            VALUES (${fname}, ${lname}, ${role}, ${email}, ${hash})
        `;
        
        console.log("User registered successfully");
        
        // Set session for auto-login after registration
        req.session.user = email;
        req.session.role = role;
        
        return res.status(200).json({ 
            msg: "Account registered successfully",
            role: role  // Send role to frontend
        });

    } catch (err) {
        console.error('Error registering user:', err);
        if (err.code === '23505') {
            return res.status(400).json({ msg: "This email is already registered" });
        }
        return res.status(500).json({ msg: "An error occurred during registration" });
    }
});

// Login
app.post('/login', async (req, res) => {
    const { email, pwd } = req.body;

    if (!email || !pwd) {
        return res.status(400).json({ msg: "Email and password are required" });
    }

    // Sanitize email
    const sanitizedEmail = validator.blacklist(email, '/\\{}:;');
    console.log("Login attempt - email: " + sanitizedEmail);

    try {
        // Get user from database - also get the role
        const result = await sql`
            SELECT email, password, role
            FROM users
            WHERE email = ${sanitizedEmail}
        `;

        if (result.length === 0) {
            console.log("User not found");
            return res.status(401).json({ msg: "Invalid email or password" });
        }

        const savedPassword = result[0].password;
        const userRole = result[0].role;  // Get the role

        // Compare passwords
        const match = await bcrypt.compare(pwd, savedPassword);
        
        if (match) {
            console.log("Login successful");
            req.session.user = sanitizedEmail;
            req.session.role = userRole;  // Store role in session
            return res.status(200).json({ 
                msg: "Login successful",
                role: userRole  // Send role to frontend
            });
        } else {
            console.log("Incorrect password");
            return res.status(401).json({ msg: "Invalid email or password" });
        }

    } catch (error) {
        console.error("Error during login:", error);
        return res.status(500).json({ msg: "Internal server error" });
    }
});

// Logout
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.status(500).json({ msg: "Error logging out" });
        }
        res.sendFile(path.join(__dirname, '../views/index.html'));
    });
});

// Change password
app.post('/change-password', async (req, res) => {
    const { currentpwd, newpwd, repeatpwd } = req.body;
    
    console.log("Change password attempt for user: " + req.session.user);

    if (!req.session.user) {
        return res.status(401).json({ msg: "Not logged in" });
    }

    if (!currentpwd || !newpwd || !repeatpwd) {
        return res.status(400).json({ msg: "All fields are required" });
    }

    if (newpwd !== repeatpwd) {
        return res.status(400).json({ msg: "New passwords do not match" });
    }

    try {
        // Get current password from database
        const result = await sql`
            SELECT password 
            FROM users
            WHERE email = ${req.session.user}
        `;

        if (result.length === 0) {
            return res.status(404).json({ msg: "User not found" });
        }

        const storedPassword = result[0].password;
        
        // Verify current password
        const match = await bcrypt.compare(currentpwd, storedPassword);
        
        if (!match) {
            return res.status(401).json({ msg: "Current password is incorrect" });
        }

        // Hash new password
        const newHash = await bcrypt.hash(newpwd, saltRounds);

        // Update password in database
        await sql`
            UPDATE users
            SET password = ${newHash}
            WHERE email = ${req.session.user}
        `;

        console.log("Password changed successfully");
        return res.status(200).json({ msg: "Password changed successfully" });

    } catch (err) {
        console.error("Error changing password:", err);
        return res.status(500).json({ msg: "Internal server error" });
    }
});

// Delete account
app.delete('/delete-account', async (req, res) => {
    const email = req.session.user;

    if (!email) {
        return res.status(401).json({ msg: "Not logged in" });
    }

    try {
        await sql`
            DELETE FROM users
            WHERE email = ${email}
        `;
        
        console.log(email + ' account deleted');
        
        req.session.destroy((err) => {
            if (err) {
                console.error("Error destroying session:", err);
            }
            res.status(200).json({ msg: "Account deleted successfully" });
        });

    } catch (err) {
        console.error('Error deleting account:', err);
        res.status(500).json({ msg: "An error occurred while deleting the account" });
    }
});

// Get current user info
app.get('/get-user-info', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, msg: 'Not logged in' });
    }

    try {
        const result = await sql`
            SELECT first_name, last_name, email, role
            FROM users
            WHERE email = ${req.session.user}
        `;

        if (result.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = result[0];
        res.json({
            success: true,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            role: user.role
        });

    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ success: false, msg: 'Server error' });
    }
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});