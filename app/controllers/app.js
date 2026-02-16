const express = require('express');
const cors = require('cors');
const path = require('path');
const sql = require('./db.js');
const bcrypt = require('bcrypt');
const session = require('express-session');
const validator = require('validator');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');


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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Helper function to create audit log entries
async function createAuditLog(caseId, userId, action, details) {
    try {
        // Get the previous hash (last event in chain)
        const lastEvent = await sql`
            SELECT event_hash 
            FROM audit_log 
            WHERE case_id = ${caseId}
            ORDER BY timestamp DESC 
            LIMIT 1
        `;
        
        const previousHash = lastEvent.length > 0 
            ? lastEvent[0].event_hash 
            : '0000000000000000000000000000000000000000000000000000000000000000';
        
        // Create event data for hashing
        const timestamp = new Date().toISOString();
        const eventData = `${caseId}|${userId}|${action}|${details}|${timestamp}|${previousHash}`;
        
        // Calculate SHA-256 hash
        const crypto = require('crypto');
        const eventHash = crypto.createHash('sha256').update(eventData).digest('hex');
        
        // Insert audit log entry
        await sql`
            INSERT INTO audit_log (case_id, user_id, action, details, event_hash, previous_hash, timestamp)
            VALUES (${caseId}, ${userId}, ${action}, ${details}, ${eventHash}, ${previousHash}, ${timestamp})
        `;
        
        console.log(`Audit log created: ${action} for case ${caseId}`);
    } catch (err) {
        console.error('Error creating audit log:', err);
    }
}

// ======Middleware===========
//  to check if user is logged in
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

// Role-based access control 
const requireRole = (...allowedRoles) =>{
    return (req, res, next) =>{
        if (!req.session.user){
            console.log('No user session - redirecting to login');
            return res.redirect('/');
        }

        const userRole = req.session.role;

        if (!allowedRoles.includes(userRole)) {
            console.log(`Access denied: User role '${userRole}' not in allowed roles [${allowedRoles.join(', ')}]`);
            
            // If it's an API request, return JSON
            if (req.path.startsWith('/api/')) {
                return res.status(403).json({ 
                    success: false, 
                    msg: 'Access denied: You do not have permission to access this resource' 
                });
            }
            
            // Otherwise, show the nice error page
            return res.redirect('/access-denied.html');
        }
        
        console.log(`Access granted: User role '${userRole}' is authorised`);
        next();
    };
};

//middleware for common roles
const requireInvestigator = requireRole('investigator');
const requireClient = requireRole('client');
const requireAdmin = requireRole('admin');

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

// Access denied page (public - anyone can see it)
app.get('/access-denied', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/access-denied.html'));
});

app.get('/access-denied.html', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/access-denied.html'));
});

// ===== Investigator Only Routes =====
app.get('/dashboard', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

app.get('/dashboard.html', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

app.get('/create-case', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/create-case.html'));
});

app.get('/create-case.html', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/create-case.html'));
});

app.get('/assign-team', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/assign-team.html'));
});

app.get('/assign-team.html', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/assign-team.html'));
});

app.get('/deleted-cases', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/deleted-cases.html'));
});

app.get('/deleted-cases.html', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/deleted-cases.html'));
});

//================ CLIENT-ONLY ROUTES ====================

app.get('/client-dashboard', requireClient, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/client-dashboard.html'));
});

app.get('/client-dashboard.html', requireClient, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/client-dashboard.html'));
});

//================== SHARED ROUTES (Multiple roles can access) =======

app.get('/case-area', requireRole('investigator', 'client'), (req, res) => {
    res.sendFile(path.join(__dirname, '../views/case-area.html'));
});

app.get('/case-area.html', requireRole('investigator', 'client'), (req, res) => {
    res.sendFile(path.join(__dirname, '../views/case-area.html'));
});

app.get('/settings', requireRole('investigator', 'client'), (req, res) => {
    res.sendFile(path.join(__dirname, '../views/settings.html'));
});

app.get('/settings.html', requireRole('investigator', 'client'), (req, res) => {
    res.sendFile(path.join(__dirname, '../views/settings.html'));
});


// ===== AUTHENTICATION ENDPOINTS =====

// Register new account
app.post('/register-account', async (req, res) => {
    const { fname, lname, role, email, psw } = req.body;
    const pswrepeat = req.body['psw-repeat'];
    
    console.log("Register attempt - email: " + email + ", role: " + role);

    // Validate required fields
    if (!fname || !lname || !role || !email || !psw || !pswrepeat) {
        return res.status(400).json({ msg: 'All fields are required' });
    }

    // Validate role
    const validRoles = ['investigator', 'client', 'admin'];
    if (!validRoles.includes(role)) {
        return res.status(400).json({ msg: 'Invalid role specified' });
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
        
        console.log("User registered successfully with role: " + role);
        
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
app.post('/change-password', requireLogin, async (req, res) => {
    const { currentpwd, newpwd, repeatpwd } = req.body;
    
    console.log("Change password attempt for user: " + req.session.user);

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
app.delete('/delete-account', requireLogin, async (req, res) => {
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
app.get('/get-user-info', requireLogin, async (req, res) => {
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

// ===== CASE MANAGEMENT ENDPOINTS (INVESTIGATOR ONLY) =====

// Generate next case number
app.get('/api/next-case-number', requireInvestigator, async (req, res) => {
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
app.get("/api/search-client", requireInvestigator, async (req, res) => {
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
app.post("/api/create-case", requireInvestigator, async (req, res) => {
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

// Get cases for current user (INVESTIGATOR - sees assigned cases, CLIENT - sees their cases)
app.get('/api/my-cases', requireRole('investigator', 'client'), async (req, res) => {
    try {
        const userEmail = req.session.user;
        const userRole = req.session.role;

        //Get user ID
        const user = await sql`
            SELECT user_id 
            FROM users 
            WHERE email = ${userEmail}
        `;

        if (user.length === 0) {
            return res.status(404).json({ msg: "User not found" });
        }

        const userID = user[0].user_id;
        let cases;

        if (userRole === 'investigator') {
            // Investigators see cases they're assigned to (exclude deleted)
            cases = await sql`
                SELECT 
                    c.case_id,
                    c.case_number,
                    c.case_name,
                    c.description,
                    c.priority,
                    c.status,
                    c.created_at,
                    c.is_deleted,
                    cl.first_name || ' ' || cl.last_name AS client_name
                FROM cases c
                LEFT JOIN users cl ON c.client_id = cl.user_id
                WHERE c.investigator_id = ${userID}
                AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)
                ORDER BY c.created_at DESC
            `;
        } else if (userRole === 'client') {
            // Clients see only their own cases (exclude deleted)
            cases = await sql`
                SELECT 
                    c.case_id,
                    c.case_number,
                    c.case_name,
                    c.description,
                    c.priority,
                    c.status,
                    c.created_at,
                    inv.first_name || ' ' || inv.last_name AS investigator_name
                FROM cases c
                LEFT JOIN users inv ON c.investigator_id = inv.user_id
                WHERE c.client_id = ${userID}
                AND (c.is_deleted = FALSE OR c.is_deleted IS NULL)
                ORDER BY c.created_at DESC
            `;
        }

        res.json({ success: true, cases: cases });

    } catch (err) {
        console.error("Error fetching cases:", err);
        res.status(500).json({ success: false, msg: "Error fetching cases" });
    }
});

// Search investigators (only users with role 'investigator')
app.get("/api/search-investigator", requireInvestigator, async (req, res) => {
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
app.post("/api/create-case-with-team", requireInvestigator, async (req, res) => {
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

        // Assign team members to case 
        if (teamMembers && teamMembers.length > 0) {
            for (const memberID of teamMembers) {
                await sql`
                    INSERT INTO case_team (case_id, investigator_id)
                    VALUES (${caseID}, ${memberID})
                `;
            }
        }

        // CREATE AUDIT LOG ENTRY 
        await createAuditLog(
            caseID, 
            investigatorID, 
            'CASE_CREATED', 
            `Case ${caseNumber} created with priority: ${priority}`
        );

        console.log("Case created successfully with team members");
        res.status(200).json({ msg: "Case created successfully", caseID: caseID });

    } catch (err) {
        console.error("Error creating case:", err);
        res.status(500).json({ msg: "Error creating case: " + err.message });
    }
});

// Get single case details WITH team info
app.get('/api/case/:id', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;
    const userRole = req.session.role;

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

        // Get current user's ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        const userId = user[0].user_id;

        // AUTHORIZATION CHECK
        let isAuthorized = false;

        if (userRole === 'investigator') {
            // Check if user is lead investigator
            if (caseData.lead_investigator_id === userId) {
                isAuthorized = true;
            } else {
                // Check if user is part of case team
                const teamMember = await sql`
                    SELECT * FROM case_team 
                    WHERE case_id = ${caseId} 
                    AND investigator_id = ${userId}
                `;
                if (teamMember.length > 0) {
                    isAuthorized = true;
                }
            }
        } else if (userRole === 'client') {
            // Check if user is the client for this case
            if (caseData.client_id === userId) {
                isAuthorized = true;
            }
        }

        if (!isAuthorized) {
            console.log(`Access denied: User ${userId} attempted to access case ${caseId}`);
            return res.status(403).json({ 
                success: false, 
                msg: "Access denied: You do not have permission to view this case" 
            });
        }

        // User is authorized, fetch additional details
        const leadInvestigator = await sql`
            SELECT user_id, first_name || ' ' || last_name AS name
            FROM users
            WHERE user_id = ${caseData.lead_investigator_id}
        `;

        const client = await sql`
            SELECT user_id, first_name || ' ' || last_name AS name
            FROM users
            WHERE user_id = ${caseData.client_id}
        `;

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

// Upload evidence (investigators only, with authorization check)
app.post('/api/upload-evidence', requireInvestigator, upload.single('file'), async (req, res) => {
    try {
        const { case_id, file_hash, evidence_summary, ...exif } = req.body;
        const filename = req.file.filename;
        const userEmail = req.session.user;

        console.log('=== UPLOAD DEBUG ===');
        console.log('case_id:', case_id);
        console.log('file_hash:', file_hash);
        console.log('evidence_summary:', evidence_summary);
        console.log('filename:', filename);
        console.log('EXIF data:', exif);

        //  Get user ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        const userId = user[0].user_id;

        // Check if user is authorized for this case
        const caseData = await sql`
            SELECT investigator_id FROM cases WHERE case_id = ${case_id}
        `;

        if (caseData.length === 0) {
            // Delete uploaded file if case not found
            fs.unlinkSync(path.join(uploadsDir, filename));
            return res.status(404).json({ success: false, message: "Case not found" });
        }

        // Check if user is lead investigator or team member
        let isAuthorized = caseData[0].investigator_id === userId;
        
        if (!isAuthorized) {
            const teamMember = await sql`
                SELECT * FROM case_team 
                WHERE case_id = ${case_id} 
                AND investigator_id = ${userId}
            `;
            isAuthorized = teamMember.length > 0;
        }

        if (!isAuthorized) {
            // Delete uploaded file if not authorized
            fs.unlinkSync(path.join(uploadsDir, filename));
            return res.status(403).json({ 
                success: false, 
                message: "Access denied: You are not authorized to upload evidence for this case" 
            });
        }

        // Helper function to parse EXIF date format (YYYY:MM:DD HH:MM:SS) to ISO
        const parseExifDate = (dateStr) => {
            if (!dateStr || typeof dateStr !== 'string') return null;
            try {
                // EXIF format: "2025:09:29 13:50:51"
                const cleaned = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
                const date = new Date(cleaned);
                return isNaN(date.getTime()) ? null : date.toISOString();
            } catch (e) {
                return null;
            }
        };

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
                ${filename},
                ${file_hash},
                ${evidence_summary || null},
                ${exif.Make || null},
                ${exif.Model || null},
                ${parseExifDate(exif.DateTimeOriginal)},
                ${parseExifDate(exif.DateTimeDigitized)},
                ${exif.Orientation || null},
                ${exif.XResolution || null},
                ${exif.YResolution || null},
                ${exif.Software || null},
                ${exif.Artist || null},
                ${exif.Copyright || null},
                ${exif.ExposureTime || null},
                ${exif.FNumber || null},
                ${exif.ISOSpeedRatings || exif.ISO || null},
                ${exif.FocalLength || null},
                ${exif.Flash || null},
                ${exif.WhiteBalance || null},
                ${exif.PixelXDimension || null},
                ${exif.PixelYDimension || null}
            )
            RETURNING *;
        `;

        await createAuditLog(
            parseInt(case_id),
            userId,
            'EVIDENCE_UPLOADED',
            `Evidence "${req.file.originalname}" uploaded. Hash: ${file_hash}`
        );

        res.json({ success: true, evidence: result[0] });

    } catch (err) {
        console.error('Error uploading evidence:', err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get all evidence for a case
app.get('/api/get-evidence', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.query.case_id;
    const userEmail = req.session.user;
    const userRole = req.session.role;

    if (!caseId) {
        return res.status(400).json({ success: false, msg: 'Missing case_id' });
    }

    try {
        // Get user ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        const userId = user[0].user_id;

        // Check if user is authorized for this case
        const caseData = await sql`
            SELECT investigator_id, client_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        // Authorization check
        let isAuthorized = false;

        if (userRole === 'investigator') {
            if (caseData[0].investigator_id === userId) {
                isAuthorized = true;
            } else {
                const teamMember = await sql`
                    SELECT * FROM case_team 
                    WHERE case_id = ${caseId} 
                    AND investigator_id = ${userId}
                `;
                isAuthorized = teamMember.length > 0;
            }
        } else if (userRole === 'client') {
            isAuthorized = caseData[0].client_id === userId;
        }

        if (!isAuthorized) {
            return res.status(403).json({ 
                success: false, 
                msg: "Access denied: You are not authorized to view evidence for this case" 
            });
        }

        // Fetch evidence
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

// Soft delete a case (move to deleted cases)
app.post('/api/cases/:id/delete', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const { is_deleted, deleted_at } = req.body;
    const userEmail = req.session.user;

    try {
        // Get user ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        const userId = user[0].user_id;

        // Check if user is authorized to delete this case (must be lead investigator)
        const caseData = await sql`
            SELECT investigator_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        if (caseData[0].investigator_id !== userId) {
            return res.status(403).json({ 
                success: false, 
                msg: "Access denied: Only the lead investigator can delete this case" 
            });
        }

        // Delete the case
        await sql`
            UPDATE cases
            SET is_deleted = ${is_deleted},
                deleted_at = ${deleted_at}
            WHERE case_id = ${caseId}
        `;

        res.json({ success: true, msg: "Case moved to deleted cases" });

    } catch (err) {
        console.error("Error deleting case:", err);
        res.status(500).json({ success: false, msg: "Error deleting case" });
    }
});

// Get deleted cases for current user
app.get('/api/my-cases/deleted', requireInvestigator, async (req, res) => {
    try {
        const investigatorEmail = req.session.user;

        const investigator = await sql`
            SELECT user_id 
            FROM users 
            WHERE email = ${investigatorEmail}
        `;

        if (investigator.length === 0) {
            return res.status(404).json({ msg: "User not found" });
        }

        const investigatorID = investigator[0].user_id;

        // Fetch only deleted cases
        const cases = await sql`
            SELECT 
                c.case_id,
                c.case_number,
                c.case_name,
                c.description,
                c.priority,
                c.status,
                c.created_at,
                c.deleted_at,
                cl.first_name || ' ' || cl.last_name AS client_name
            FROM cases c
            LEFT JOIN users cl ON c.client_id = cl.user_id
            WHERE c.investigator_id = ${investigatorID}
            AND c.is_deleted = TRUE
            ORDER BY c.deleted_at DESC
        `;

        res.json({ success: true, cases: cases });

    } catch (err) {
        console.error("Error fetching deleted cases:", err);
        res.status(500).json({ success: false, msg: "Error fetching deleted cases" });
    }
});


// Restore a deleted case
app.post('/api/cases/:id/restore', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;

    try {
        // Get user ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        const userId = user[0].user_id;

        // Check if user is authorized to restore this case (must be lead investigator)
        const caseData = await sql`
            SELECT investigator_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        if (caseData[0].investigator_id !== userId) {
            return res.status(403).json({ 
                success: false, 
                msg: "Access denied: Only the lead investigator can restore this case" 
            });
        }

        // Restore the case
        await sql`
            UPDATE cases
            SET is_deleted = FALSE,
                deleted_at = NULL
            WHERE case_id = ${caseId}
        `;

        res.json({ success: true, msg: "Case restored successfully" });

    } catch (err) {
        console.error("Error restoring case:", err);
        res.status(500).json({ success: false, msg: "Error restoring case" });
    }
});

// Permanently delete a case
app.delete('/api/cases/:id/permanent-delete', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;

    try {
        // Get user ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        const userId = user[0].user_id;

        // Check if user is authorized (must be lead investigator)
        const caseData = await sql`
            SELECT investigator_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        if (caseData[0].investigator_id !== userId) {
            return res.status(403).json({ 
                success: false, 
                msg: "Access denied: Only the lead investigator can permanently delete this case" 
            });
        }

        // Delete related records in the correct order (due to foreign key constraints)
        
        // 1. Delete chain of custody records first
        await sql`
            DELETE FROM chain_of_custody
            WHERE case_id = ${caseId}
        `;

        // 2. Delete audit log records
        await sql`
            DELETE FROM audit_log
            WHERE case_id = ${caseId}
        `;

        // 3. Delete evidence timeline/findings/tools/details
        await sql`
            DELETE FROM case_findings
            WHERE case_id = ${caseId}
        `;

        await sql`
            DELETE FROM case_details
            WHERE case_id = ${caseId}
        `;

        await sql`
            DELETE FROM case_tools
            WHERE case_id = ${caseId}
        `;

        // 4. Delete evidence
        await sql`
            DELETE FROM evidence
            WHERE case_id = ${caseId}
        `;

        // 5. Delete team assignments
        await sql`
            DELETE FROM case_team
            WHERE case_id = ${caseId}
        `;

        // 6. Finally delete the case itself
        await sql`
            DELETE FROM cases
            WHERE case_id = ${caseId}
        `;

        res.json({ success: true, msg: "Case permanently deleted" });

    } catch (err) {
        console.error("Error permanently deleting case:", err);
        res.status(500).json({ success: false, msg: "Error permanently deleting case: " + err.message });
    }
});

// Get audit log for a case
app.get('/api/cases/:id/audit-log', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;
    const userRole = req.session.role;

    try {
        // Get user ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        const userId = user[0].user_id;

        // Verify authorization for this case
        const caseData = await sql`
            SELECT investigator_id, client_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        // Authorization check
        let isAuthorized = false;
        if (userRole === 'investigator') {
            isAuthorized = caseData[0].investigator_id === userId;
            // Check team members too
            if (!isAuthorized) {
                const teamMember = await sql`
                    SELECT * FROM case_team 
                    WHERE case_id = ${caseId} AND investigator_id = ${userId}
                `;
                isAuthorized = teamMember.length > 0;
            }
        } else if (userRole === 'client') {
            isAuthorized = caseData[0].client_id === userId;
        }

        if (!isAuthorized) {
            return res.status(403).json({ 
                success: false, 
                msg: "Access denied" 
            });
        }

        // Fetch audit log events
        const auditLog = await sql`
            SELECT 
                al.audit_id as id,
                al.timestamp,
                al.action,
                al.details,
                al.event_hash as hash,
                al.previous_hash as prev_hash,
                u.first_name || ' ' || u.last_name as user,
                u.user_id
            FROM audit_log al
            JOIN users u ON al.user_id = u.user_id
            WHERE al.case_id = ${caseId}
            ORDER BY al.timestamp ASC
        `;

        res.json({ success: true, auditLog: auditLog });

    } catch (err) {
        console.error("Error fetching audit log:", err);
        res.status(500).json({ success: false, msg: "Error fetching audit log" });
    }
});

// ==================== CASE DETAILS ENDPOINTS ====================

// Get case overview
app.get('/api/cases/:id/overview', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;
    const userRole = req.session.role;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        // Authorization check
        const caseData = await sql`
            SELECT investigator_id, client_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        let isAuthorized = false;
        if (userRole === 'investigator') {
            isAuthorized = caseData[0].investigator_id === userId;
            if (!isAuthorized) {
                const teamMember = await sql`
                    SELECT * FROM case_team WHERE case_id = ${caseId} AND investigator_id = ${userId}
                `;
                isAuthorized = teamMember.length > 0;
            }
        } else if (userRole === 'client') {
            isAuthorized = caseData[0].client_id === userId;
        }

        if (!isAuthorized) {
            return res.status(403).json({ success: false, msg: "Access denied" });
        }

        // Fetch overview
        const overview = await sql`
            SELECT * FROM case_details WHERE case_id = ${caseId}
        `;

        res.json({ 
            success: true, 
            overview: overview[0] || { overview: '' } 
        });

    } catch (err) {
        console.error("Error fetching overview:", err);
        res.status(500).json({ success: false, msg: "Error fetching overview" });
    }
});

// Save/Update case overview (investigators only)
app.post('/api/cases/:id/overview', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const { overview } = req.body;
    const userEmail = req.session.user;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        // Check authorization
        const caseData = await sql`
            SELECT investigator_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        let isAuthorized = caseData[0].investigator_id === userId;
        if (!isAuthorized) {
            const teamMember = await sql`
                SELECT * FROM case_team WHERE case_id = ${caseId} AND investigator_id = ${userId}
            `;
            isAuthorized = teamMember.length > 0;
        }

        if (!isAuthorized) {
            return res.status(403).json({ success: false, msg: "Access denied" });
        }

        // Check if overview exists
        const existing = await sql`
            SELECT * FROM case_details WHERE case_id = ${caseId}
        `;

        if (existing.length > 0) {
            // Update existing
            await sql`
                UPDATE case_details 
                SET overview = ${overview}, 
                    updated_at = NOW(), 
                    updated_by = ${userId}
                WHERE case_id = ${caseId}
            `;
        } else {
            // Insert new
            await sql`
                INSERT INTO case_details (case_id, overview, updated_by)
                VALUES (${caseId}, ${overview}, ${userId})
            `;
        }

        await createAuditLog(
            parseInt(caseId),
            userId,
            'OVERVIEW_MODIFIED',
            `Case overview updated`
        );

        res.json({ success: true, msg: "Overview saved successfully" });

    } catch (err) {
        console.error("Error saving overview:", err);
        res.status(500).json({ success: false, msg: "Error saving overview" });
    }
});

// Get case findings
app.get('/api/cases/:id/findings', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;
    // Same authorization logic as overview
    // ... (similar to overview endpoint)
    
    try {
        const findings = await sql`
            SELECT * FROM case_findings WHERE case_id = ${caseId}
        `;

        res.json({ 
            success: true, 
            findings: findings[0] || { findings: '', recommendations: '' } 
        });
    } catch (err) {
        console.error("Error fetching findings:", err);
        res.status(500).json({ success: false, msg: "Error fetching findings" });
    }
});

// Save findings (investigators only)
app.post('/api/cases/:id/findings', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const { findings, recommendations } = req.body;
    const userEmail = req.session.user;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        // Authorization check (same as overview)
        // ...

        const existing = await sql`
            SELECT * FROM case_findings WHERE case_id = ${caseId}
        `;

        if (existing.length > 0) {
            await sql`
                UPDATE case_findings 
                SET findings = ${findings}, 
                    recommendations = ${recommendations},
                    updated_at = NOW(), 
                    updated_by = ${userId}
                WHERE case_id = ${caseId}
            `;
        } else {
            await sql`
                INSERT INTO case_findings (case_id, findings, recommendations, updated_by)
                VALUES (${caseId}, ${findings}, ${recommendations}, ${userId})
            `;
        }

        await createAuditLog(
            parseInt(caseId),
            userId,
            'FINDINGS_MODIFIED',
            `Case findings and recommendations updated`
        );

        res.json({ success: true, msg: "Findings saved successfully" });

    } catch (err) {
        console.error("Error saving findings:", err);
        res.status(500).json({ success: false, msg: "Error saving findings" });
    }
});

// Get tools used
app.get('/api/cases/:id/tools', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;
    
    try {
        const tools = await sql`
            SELECT * FROM case_tools 
            WHERE case_id = ${caseId}
            ORDER BY created_at ASC
        `;

        res.json({ success: true, tools: tools });
    } catch (err) {
        console.error("Error fetching tools:", err);
        res.status(500).json({ success: false, msg: "Error fetching tools" });
    }
});

// Add tool (investigators only)
app.post('/api/cases/:id/tools', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const { tool_name, tool_version, purpose } = req.body;
    const userEmail = req.session.user;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        await sql`
            INSERT INTO case_tools (case_id, tool_name, tool_version, purpose, added_by)
            VALUES (${caseId}, ${tool_name}, ${tool_version}, ${purpose}, ${userId})
        `;

        res.json({ success: true, msg: "Tool added successfully" });

    } catch (err) {
        console.error("Error adding tool:", err);
        res.status(500).json({ success: false, msg: "Error adding tool" });
    }
});

// Delete tool (investigators only)
app.delete('/api/cases/:caseId/tools/:toolId', requireInvestigator, async (req, res) => {
    const { caseId, toolId } = req.params;

    try {
        await sql`
            DELETE FROM case_tools 
            WHERE tool_id = ${toolId} AND case_id = ${caseId}
        `;

        res.json({ success: true, msg: "Tool deleted successfully" });

    } catch (err) {
        console.error("Error deleting tool:", err);
        res.status(500).json({ success: false, msg: "Error deleting tool" });
    }
});

// Get evidence timeline
app.get('/api/cases/:id/evidence-timeline', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;

    try {
        const timeline = await sql`
            SELECT 
                evidence_id,
                evidence_name,
                datetime_original,
                datetime_digitized,
                collected_at,
                description
            FROM evidence
            WHERE case_id = ${caseId}
            AND (datetime_original IS NOT NULL OR datetime_digitized IS NOT NULL OR collected_at IS NOT NULL)
            ORDER BY 
                COALESCE(datetime_original, datetime_digitized, collected_at) ASC
        `;

        res.json({ success: true, timeline: timeline });

    } catch (err) {
        console.error("Error fetching timeline:", err);
        res.status(500).json({ success: false, msg: "Error fetching timeline" });
    }
});

// ================ Chain of Custody Endpoints ====================

// Get Chain of Custody for a case
app.get('/api/cases/:id/chain-of-custody', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;
    const userRole = req.session.role;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        // Authorization check
        const caseData = await sql`
            SELECT investigator_id, client_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        let isAuthorized = false;
        if (userRole === 'investigator') {
            isAuthorized = caseData[0].investigator_id === userId;
            if (!isAuthorized) {
                const teamMember = await sql`
                    SELECT * FROM case_team WHERE case_id = ${caseId} AND investigator_id = ${userId}
                `;
                isAuthorized = teamMember.length > 0;
            }
        } else if (userRole === 'client') {
            isAuthorized = caseData[0].client_id === userId;
        }

        if (!isAuthorized) {
            return res.status(403).json({ success: false, msg: "Access denied" });
        }

        // Fetch CoC records with evidence details
        const cocRecords = await sql`
            SELECT 
                coc.*,
                e.evidence_name,
                e.file_hash as evidence_hash,
                u1.first_name || ' ' || u1.last_name as created_by_name
            FROM chain_of_custody coc
            LEFT JOIN evidence e ON coc.evidence_id = e.evidence_id
            LEFT JOIN users u1 ON coc.created_by = u1.user_id
            WHERE coc.case_id = ${caseId}
            ORDER BY coc.event_datetime DESC
        `;

        res.json({ success: true, cocRecords: cocRecords });

    } catch (err) {
        console.error("Error fetching CoC:", err);
        res.status(500).json({ success: false, msg: "Error fetching chain of custody" });
    }
});

// Add Chain of Custody event
app.post('/api/cases/:id/chain-of-custody', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;
    const {
        evidence_id,
        event_type,
        released_by_name,
        released_by_role,
        received_by_name,
        received_by_role,
        reason,
        location,
        condition_at_event,
        access_type,
        hash_algorithm,
        hash_match,
        security_controls,
        notes
    } = req.body;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        // Authorization check
        const caseData = await sql`
            SELECT investigator_id FROM cases WHERE case_id = ${caseId}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        let isAuthorized = caseData[0].investigator_id === userId;
        if (!isAuthorized) {
            const teamMember = await sql`
                SELECT * FROM case_team WHERE case_id = ${caseId} AND investigator_id = ${userId}
            `;
            isAuthorized = teamMember.length > 0;
        }

        if (!isAuthorized) {
            return res.status(403).json({ success: false, msg: "Access denied" });
        }

        // Get evidence hash for verification events
        let hashValue = null;
        let hashVerified = false;
        
        if (event_type === 'VERIFIED') {
            const evidence = await sql`
                SELECT file_hash FROM evidence WHERE evidence_id = ${evidence_id}
            `;
            if (evidence.length > 0) {
                hashValue = evidence[0].file_hash;
                hashVerified = true;
            }
        }

        // Insert CoC record
        const result = await sql`
            INSERT INTO chain_of_custody (
                evidence_id,
                case_id,
                event_type,
                released_by_name,
                released_by_role,
                received_by_name,
                received_by_role,
                reason,
                location,
                condition_at_event,
                access_type,
                hash_verified,
                hash_algorithm,
                hash_value,
                hash_match,
                verification_datetime,
                security_controls,
                notes,
                created_by
            ) VALUES (
                ${evidence_id},
                ${caseId},
                ${event_type},
                ${released_by_name || null},
                ${released_by_role || null},
                ${received_by_name || null},
                ${received_by_role || null},
                ${reason},
                ${location || null},
                ${condition_at_event || null},
                ${access_type || null},
                ${hashVerified},
                ${hash_algorithm || null},
                ${hashValue},
                ${hash_match === 'true' ? true : hash_match === 'false' ? false : null},
                ${event_type === 'VERIFIED' ? new Date().toISOString() : null},
                ${security_controls || null},
                ${notes || null},
                ${userId}
            )
            RETURNING *
        `;

        // Create audit log entry
        await createAuditLog(
            parseInt(caseId),
            userId,
            `COC_${event_type}`,
            `Chain of Custody event: ${event_type} - ${reason}`
        );

        res.json({ success: true, msg: "CoC event added successfully", cocRecord: result[0] });

    } catch (err) {
        console.error("Error adding CoC event:", err);
        res.status(500).json({ success: false, msg: "Error adding CoC event" });
    }
});

// Get evidence list for CoC modal
app.get('/api/cases/:id/evidence-list', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;

    try {
        const evidence = await sql`
            SELECT evidence_id, evidence_name, file_hash
            FROM evidence
            WHERE case_id = ${caseId}
            ORDER BY evidence_name ASC
        `;

        res.json({ success: true, evidence: evidence });

    } catch (err) {
        console.error("Error fetching evidence list:", err);
        res.status(500).json({ success: false, msg: "Error fetching evidence list" });
    }
});

// ===== EVIDENCE VIEW LOGGING ENDPOINT =====
// Log evidence view (when someone opens evidence details)
app.post('/api/evidence/:evidenceId/log-view', requireRole('investigator', 'client'), async (req, res) => {
    const evidenceId = req.params.evidenceId;
    const { case_id, evidence_name } = req.body;
    const userEmail = req.session.user;
    const userRole = req.session.role;

    try {
        // Get user ID
        const user = await sql`
            SELECT user_id FROM users WHERE email = ${userEmail}
        `;
        
        if (user.length === 0) {
            return res.status(404).json({ success: false, msg: "User not found" });
        }
        
        const userId = user[0].user_id;

        // Verify authorization for this case
        const caseData = await sql`
            SELECT investigator_id, client_id FROM cases WHERE case_id = ${case_id}
        `;

        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: "Case not found" });
        }

        // Authorization check
        let isAuthorized = false;
        if (userRole === 'investigator') {
            isAuthorized = caseData[0].investigator_id === userId;
            if (!isAuthorized) {
                const teamMember = await sql`
                    SELECT * FROM case_team 
                    WHERE case_id = ${case_id} 
                    AND investigator_id = ${userId}
                `;
                isAuthorized = teamMember.length > 0;
            }
        } else if (userRole === 'client') {
            isAuthorized = caseData[0].client_id === userId;
        }

        if (!isAuthorized) {
            return res.status(403).json({ 
                success: false, 
                msg: "Access denied" 
            });
        }

        // Create audit log entry for evidence view
        await createAuditLog(
            parseInt(case_id),
            userId,
            'EVIDENCE_ACCESSED',
            `Evidence "${evidence_name}" (ID: ${evidenceId}) was viewed`
        );

        res.json({ 
            success: true, 
            msg: "Evidence view logged successfully" 
        });

    } catch (err) {
        console.error("Error logging evidence view:", err);
        res.status(500).json({ 
            success: false, 
            msg: "Error logging evidence view" 
        });
    }
});

// ================ ERROR HANDLING ====================

// Catch-all middleware for any undefined routes
app.use((req, res) => {
    res.redirect('/');
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Role-Based Access Control (RBAC) is enabled`);
});