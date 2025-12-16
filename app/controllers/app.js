const express = require('express');
const cors = require('cors');
const path = require('path');
const sql = require('./db.js');
const bcrypt = require('bcrypt');
const session = require('express-session');
const validator = require('validator');
const bodyParser = require('body-parser');
const multer = require('multer');


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

// Serve static files  - These are always accessible
app.use('/css', express.static(path.join(__dirname, '../views/css')));
app.use('/js', express.static(path.join(__dirname, '../views/js')));
app.use('/images', express.static(path.join(__dirname, '../views/images')));
app.use('/uploads', express.static(path.join(__dirname, 'controllers/uploads')));


// Middleware to check if user is logged in
var requireLogin = function (req, res, next) {
    console.log('Checking if user is logged in');
    if (req.session.user == null) {
        console.log('User not logged in - redirecting to login page');
        return res.redirect('/');
    } else {
        console.log('User logged in: ' + req.session.user);
        next();
    }
};

// ===== PUBLIC ROUTES (No login required) =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
});

// ===== PROTECTED ROUTES (Login required) =====
app.get('/dashboard', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

app.get('/dashboard.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

app.get('/create-case', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/create-case.html'));
});

app.get('/create-case.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/create-case.html'));
});

app.get('/client-dashboard', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/client-dashboard.html'));
});

app.get('/client-dashboard.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/client-dashboard.html'));
});

app.get('/assign-team', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/assign-team.html'));
});

app.get('/assign-team.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/assign-team.html'));
});

app.get('/case-area', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/case-area.html'));
});

app.get('/case-area.html', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/case-area.html'));
});

// ===== AUTHENTICATION ENDPOINTS =====

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
            role: role
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
        const userRole = result[0].role;

        // Compare passwords
        const match = await bcrypt.compare(pwd, savedPassword);
        
        if (match) {
            console.log("Login successful");
            req.session.user = sanitizedEmail;
            req.session.role = userRole;
            return res.status(200).json({ 
                msg: "Login successful",
                role: userRole
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
        res.redirect('/');
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

// ===== CASE MANAGEMENT ENDPOINTS =====

// Generate next case number
app.get('/api/next-case-number', requireLogin, async (req, res) => {
    try {
        const rows = await sql`
            SELECT case_number 
            FROM cases 
            ORDER BY case_id DESC 
            LIMIT 1
        `;

        let nextNum = 1;

        if (rows.length > 0) {
            const last = rows[0].case_number;
            const num = parseInt(last.replace("CASE-", ""));
            nextNum = num + 1;
        }

        const newCaseNumber = "CASE-" + String(nextNum).padStart(5, "0");

        res.json({ caseNumber: newCaseNumber });

    } catch (err) {
        console.error("Error generating case number:", err);
        res.status(500).json({ msg: "Server error generating case number" });
    }
});

// Search clients
app.get("/api/search-client", requireLogin, async (req, res) => {
    const q = req.query.q || "";

    try {
        const results = await sql`
            SELECT user_id AS id, first_name || ' ' || last_name AS client_name
            FROM users
            WHERE role = 'client' AND (first_name || ' ' || last_name) ILIKE ${'%' + q + '%'}
            LIMIT 10
        `;

        res.json(results);

    } catch (err) {
        console.error("Error searching clients:", err);
        res.status(500).json({ msg: "Error searching clients" });
    }
});

// Create case
app.post("/api/create-case", requireLogin, async (req, res) => {
    const { caseNumber, caseName, caseType, clientID, priority, status } = req.body;

    console.log("Received case data:", { caseNumber, caseName, caseType, clientID, priority, status });

    if (!caseNumber || !caseName || !caseType || !clientID || !priority || !status) {
        return res.status(400).json({ msg: "Missing required fields" });
    }

    try {
        // Get logged-in user's ID as investigator
        const investigatorEmail = req.session.user;

        const investigator = await sql`
            SELECT user_id 
            FROM users 
            WHERE email = ${investigatorEmail}
        `;

        if (investigator.length === 0) {
            return res.status(404).json({ msg: "Investigator not found" });
        }

        const investigatorID = investigator[0].user_id;

        console.log("Investigator ID:", investigatorID);
        console.log("Client ID:", clientID);

        // Insert case into database
        await sql`
            INSERT INTO cases 
                (case_number, case_name, description, client_id, investigator_id, priority, status, created_at)
            VALUES 
                (${caseNumber}, ${caseName}, ${caseType}, ${clientID}, ${investigatorID}, ${priority}, ${status}, NOW())
        `;

        console.log("Case created successfully");
        res.status(200).json({ msg: "Case created successfully" });

    } catch (err) {
        console.error("Error creating case:", err);
        res.status(500).json({ msg: "Error creating case: " + err.message });
    }
});

// Get cases for current user (investigator)
app.get('/api/my-cases', requireLogin, async (req, res) => {
    try {
        const investigatorEmail = req.session.user;

        // Get investigator's user_id
        const investigator = await sql`
            SELECT user_id 
            FROM users 
            WHERE email = ${investigatorEmail}
        `;

        if (investigator.length === 0) {
            return res.status(404).json({ msg: "User not found" });
        }

        const investigatorID = investigator[0].user_id;

        // Fetch cases assigned to this investigator
        const cases = await sql`
            SELECT 
                c.case_id,
                c.case_number,
                c.case_name,
                c.description,
                c.priority,
                c.status,
                c.created_at,
                cl.first_name || ' ' || cl.last_name AS client_name
            FROM cases c
            LEFT JOIN users cl ON c.client_id = cl.user_id
            WHERE c.investigator_id = ${investigatorID}
            ORDER BY c.created_at DESC
        `;

        res.json({ success: true, cases: cases });

    } catch (err) {
        console.error("Error fetching cases:", err);
        res.status(500).json({ success: false, msg: "Error fetching cases" });
    }
});

// Search investigators (only users with role 'investigator')
app.get("/api/search-investigator", requireLogin, async (req, res) => {
    const q = req.query.q || "";

    try {
        const results = await sql`
            SELECT 
                user_id AS id, 
                first_name || ' ' || last_name AS name,
                email
            FROM users
            WHERE role = 'investigator' 
            AND (first_name || ' ' || last_name || ' ' || email) ILIKE ${'%' + q + '%'}
            LIMIT 10
        `;

        res.json(results);

    } catch (err) {
        console.error("Error searching investigators:", err);
        res.status(500).json({ msg: "Error searching investigators" });
    }
});

// Create case with team members
app.post("/api/create-case-with-team", requireLogin, async (req, res) => {
    const { caseNumber, caseName, caseType, clientID, priority, status, teamMembers } = req.body;

    console.log("Received case data with team:", { caseNumber, caseName, caseType, clientID, priority, status, teamMembers });

    if (!caseNumber || !caseName || !caseType || !clientID || !priority || !status) {
        return res.status(400).json({ msg: "Missing required fields" });
    }

    try {
        // Get logged-in user's ID as lead investigator
        const investigatorEmail = req.session.user;

        const investigator = await sql`
            SELECT user_id 
            FROM users 
            WHERE email = ${investigatorEmail}
        `;

        if (investigator.length === 0) {
            return res.status(404).json({ msg: "Investigator not found" });
        }

        const investigatorID = investigator[0].user_id;

        // Insert case into database
        const caseResult = await sql`
            INSERT INTO cases 
                (case_number, case_name, description, client_id, investigator_id, priority, status, created_at)
            VALUES 
                (${caseNumber}, ${caseName}, ${caseType}, ${clientID}, ${investigatorID}, ${priority}, ${status}, NOW())
            RETURNING case_id
        `;

        const caseID = caseResult[0].case_id;

        // Assign team members to case (if you have a case_team table)
        if (teamMembers && teamMembers.length > 0) {
            for (const memberID of teamMembers) {
                await sql`
                    INSERT INTO case_team (case_id, investigator_id)
                    VALUES (${caseID}, ${memberID})
                `;
            }
        }

        console.log("Case created successfully with team members");
        res.status(200).json({ msg: "Case created successfully", caseID: caseID });

    } catch (err) {
        console.error("Error creating case:", err);
        res.status(500).json({ msg: "Error creating case: " + err.message });
    }
});

// Get single case details WITH team info
app.get('/api/case/:id', requireLogin, async (req, res) => {
    const caseId = req.params.id;

    try {
        // Fetch main case data
        const caseResult = await sql`
            SELECT 
                c.case_id,
                c.case_number,
                c.case_name,
                c.description,
                c.priority,
                c.status,
                c.created_at,
                c.client_id,
                c.investigator_id AS lead_investigator_id
            FROM cases c
            WHERE c.case_id = ${caseId}
        `;

        if (caseResult.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        const caseData = caseResult[0];

        // Fetch lead investigator details
        const leadInvestigator = await sql`
            SELECT user_id, first_name || ' ' || last_name AS name
            FROM users
            WHERE user_id = ${caseData.lead_investigator_id}
        `;

        // Fetch client details
        const client = await sql`
            SELECT user_id, first_name || ' ' || last_name AS name
            FROM users
            WHERE user_id = ${caseData.client_id}
        `;

        // Fetch other investigators in the team
        const investigators = await sql`
            SELECT u.user_id, u.first_name || ' ' || u.last_name AS name
            FROM case_team ct
            JOIN users u ON u.user_id = ct.investigator_id
            WHERE ct.case_id = ${caseId}
            AND ct.investigator_id != ${caseData.lead_investigator_id}
        `;

        res.json({
            success: true,
            case: {
                ...caseData,
                lead_investigator: leadInvestigator[0] || null,
                client: client[0] || null,
                investigators: investigators
            }
        });

    } catch (err) {
        console.error("Error fetching case:", err);
        res.status(500).json({ success: false, msg: "Error fetching case" });
    }
});

// Setup storage for uploaded files
const fs = require('fs');

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, uploadsDir);
    },
    filename: function(req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

app.post('/api/upload-evidence', upload.single('file'), async (req, res) => {
    try {
        const { case_id, file_hash, evidence_summary, ...exif } = req.body;
        const file_path = req.file.path;

        const result = await sql`
            INSERT INTO evidence (
                case_id,
                evidence_name,
                file_path,
                file_hash,
                description,
                make, model,
                datetime_original,
                datetime_digitized,
                orientation,
                x_resolution,
                y_resolution,
                software,
                artist,
                copyright,
                exposure_time,
                f_number,
                iso,
                focal_length,
                flash,
                white_balance,
                pixel_x_dimension,
                pixel_y_dimension
            ) VALUES (
                ${case_id},
                ${req.file.originalname},
                ${file_path},
                ${file_hash},
                ${evidence_summary || null},
                ${exif.Make || null},
                ${exif.Model || null},
                ${exif.DateTimeOriginal || null},
                ${exif.DateTimeDigitized || null},
                ${exif.Orientation || null},
                ${exif.XResolution || null},
                ${exif.YResolution || null},
                ${exif.Software || null},
                ${exif.Artist || null},
                ${exif.Copyright || null},
                ${exif.ExposureTime || null},
                ${exif.FNumber || null},
                ${exif.ISO || null},
                ${exif.FocalLength || null},
                ${exif.Flash || null},
                ${exif.WhiteBalance || null},
                ${exif.PixelXDimension || null},
                ${exif.PixelYDimension || null}
            )
            RETURNING *;
        `;

        res.json({ success: true, evidence: result[0] });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get all evidence for a case
app.get('/api/get-evidence', requireLogin, async (req, res) => {
    const caseId = req.query.case_id;
    if (!caseId) return res.status(400).json({ success: false, msg: 'Missing case_id' });

    try {
        const evidence = await sql`
            SELECT *
            FROM evidence
            WHERE case_id = ${caseId}
            ORDER BY collected_at DESC
        `;
        res.json(evidence);
    } catch (err) {
        console.error("Error fetching evidence:", err);
        res.status(500).json({ success: false, msg: "Server error fetching evidence" });
    }
});




// Catch-all middleware for any undefined routes
app.use((req, res) => {
    res.redirect('/');
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});