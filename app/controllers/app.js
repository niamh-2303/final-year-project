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
const crypto = require('crypto');
const { execFile } = require('child_process');
const os = require('os');


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
app.use(requireCaseOpenFull);

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

async function requireCaseOpenFull(req, res, next) {
    if (req.method === 'GET') return next();

    const alwaysAllowed = [
        /\/api\/cases\/\d+\/(archive|restore)$/,
        /\/api\/cases\/\d+\/download-report$/,
        /\/api\/cases\/\d+\/generate-report$/,
        /\/api\/evidence\/\d+\/log-view$/,
        /\/api\/invitations\/\d+\/respond$/,
    ];
    if (alwaysAllowed.some(p => p.test(req.path))) return next();

    let caseId = null;
    const urlMatch = req.path.match(/\/api\/cases\/(\d+)\//);
    if (urlMatch) caseId = urlMatch[1];
    if (!caseId && req.path === '/api/upload-evidence') {
        caseId = req.body?.case_id || req.query?.case_id;
    }
    if (!caseId) return next();

    try {
        const result = await sql`SELECT status FROM cases WHERE case_id = ${caseId}`;
        if (result.length === 0) return next();
        if (result[0].status === 'closed') {
            console.log(`[Closed Case Guard] Blocked ${req.method} ${req.path} — case ${caseId} is closed`);
            return res.status(403).json({
                success: false,
                msg: 'This case is closed. No modifications are permitted.'
            });
        }
        next();
    } catch (err) {
        console.error('requireCaseOpen middleware error:', err);
        next();
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

app.get('/archive-cases', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/archive-cases.html'));
});
app.get('/archive-cases.html', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/archive-cases.html'));
});

app.get('/reports', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/reports.html'));
});
app.get('/reports.html', requireInvestigator, (req, res) => {
    res.sendFile(path.join(__dirname, '../views/reports.html'));
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
            SELECT user_id, first_name, last_name, email, role            
            FROM users
            WHERE email = ${req.session.user}
        `;

        if (result.length === 0) {
            return res.status(404).json({ success: false, msg: 'User not found' });
        }

        const user = result[0];
        res.json({
        success: true,
        userId: user.user_id,   
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
            cases = await sql`
                SELECT DISTINCT
                    c.case_id,
                    c.case_number,
                    c.case_name,
                    c.description,
                    c.priority,
                    c.status,
                    c.created_at,
                    c.is_archived,
                    cl.first_name || ' ' || cl.last_name AS client_name
                FROM cases c
                LEFT JOIN users cl ON c.client_id = cl.user_id
                LEFT JOIN case_team ct ON ct.case_id = c.case_id
                WHERE (
                    c.investigator_id = ${userID}  -- lead investigator always sees it
                    OR (
                        ct.investigator_id = ${userID}
                        AND EXISTS (
                            SELECT 1 FROM case_invitations ci
                            WHERE ci.case_id = c.case_id
                            AND ci.user_id = ${userID}
                            AND ci.status = 'accepted'
                        )
                    )
                )
                AND (c.is_archived = FALSE OR c.is_archived IS NULL)
                ORDER BY c.created_at DESC
            `;
        } else if (userRole === 'client') {
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
                AND (c.is_archived = FALSE OR c.is_archived IS NULL)
                AND c.client_access = TRUE
                AND EXISTS (
                    SELECT 1 FROM case_invitations ci
                    WHERE ci.case_id = c.case_id
                    AND ci.user_id = ${userID}
                    AND ci.status = 'accepted'
                )
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
    const { caseNumber, caseName, caseType, clientID, priority, status, teamMembers, clientAccess } = req.body;

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
            (case_number, case_name, description, client_id, investigator_id, priority, status, client_access, created_at)
        VALUES 
            (${caseNumber}, ${caseName}, ${caseType}, ${clientID}, ${investigatorID}, ${priority}, ${status}, ${clientAccess ?? true}, NOW())
        RETURNING case_id
    `;

        const caseID = caseResult[0].case_id;

        // Assign team members to case 
        if (teamMembers && teamMembers.length > 0) {
            for (const memberID of teamMembers) {
                await sql`
                    INSERT INTO case_invitations (case_id, user_id, invited_by, role)
                    VALUES (${caseID}, ${memberID}, ${investigatorID}, 'investigator')
                `;
            }
        }

        //send client invitation if clientAccess is true
        if (clientAccess) {
            await sql`
                INSERT INTO case_invitations (case_id, user_id, invited_by, role)
                VALUES (${caseID}, ${clientID}, ${investigatorID}, 'client')
            `;
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
                c.client_access,
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
            // Check if user is the client AND access is enabled
            if (caseData.client_id === userId && caseData.client_access === true) {
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

// Soft archive a case (move to archived cases)
app.post('/api/cases/:id/archive', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const { is_archived, archived_at } = req.body;
    const userEmail = req.session.user;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        const caseData = await sql`SELECT investigator_id, status FROM cases WHERE case_id = ${caseId}`;

        if (caseData.length === 0) return res.status(404).json({ success: false, msg: "Case not found" });

        if (caseData[0].investigator_id !== userId) {
            return res.status(403).json({ success: false, msg: "Access denied: Only the lead investigator can archive this case" });
        }

        // Only change status to 'archived' if it was active, otherwise keep existing status
        const currentStatus = caseData[0].status;
        const newStatus = currentStatus === 'active' ? 'archived' : currentStatus;

        await sql`
            UPDATE cases
            SET is_archived = ${is_archived},
                archived_at = ${archived_at},
                status = ${newStatus}
            WHERE case_id = ${caseId}
        `;

        res.json({ success: true, msg: "Case moved to archive" });

    } catch (err) {
        console.error("Error archiving case:", err);
        res.status(500).json({ success: false, msg: "Error archiving case" });
    }
});

// Get archived cases for current user
app.get('/api/my-cases/archived', requireInvestigator, async (req, res) => {
    try {
        const investigatorEmail = req.session.user;
        const investigator = await sql`SELECT user_id FROM users WHERE email = ${investigatorEmail}`;

        if (investigator.length === 0) return res.status(404).json({ msg: "User not found" });

        const investigatorID = investigator[0].user_id;

        const cases = await sql`
            SELECT DISTINCT
                c.case_id, c.case_number, c.case_name, c.description,
                c.priority, c.status, c.created_at, c.archived_at,
                cl.first_name || ' ' || cl.last_name AS client_name
            FROM cases c
            LEFT JOIN users cl ON c.client_id = cl.user_id
            LEFT JOIN case_team ct ON c.case_id = ct.case_id
            WHERE (
                c.investigator_id = ${investigatorID}
                OR ct.investigator_id = ${investigatorID}
            )
            AND c.is_archived = TRUE
            ORDER BY c.archived_at DESC
        `;

        res.json({ success: true, cases });

    } catch (err) {
        console.error("Error fetching archived cases:", err);
        res.status(500).json({ success: false, msg: "Error fetching archived cases" });
    }
});


// Restore an archived case
app.post('/api/cases/:id/restore', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        const caseData = await sql`SELECT investigator_id, status FROM cases WHERE case_id = ${caseId}`;

        if (caseData.length === 0) return res.status(404).json({ success: false, msg: "Case not found" });

        if (caseData[0].investigator_id !== userId) {
            return res.status(403).json({ success: false, msg: "Access denied: Only the lead investigator can restore this case" });
        }

        // Only change status back to active if it was archived, leave closed cases as closed
        const currentStatus = caseData[0].status;
        const newStatus = currentStatus === 'archived' ? 'active' : currentStatus;

        await sql`
            UPDATE cases
            SET is_archived = FALSE,
                archived_at = NULL,
                status = ${newStatus}
            WHERE case_id = ${caseId}
        `;

        res.json({ success: true, msg: "Case restored successfully" });

    } catch (err) {
        console.error("Error restoring case:", err);
        res.status(500).json({ success: false, msg: "Error restoring case" });
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

// ================ Pending Innvitations ====================

app.get('/api/my-invitations', requireRole('investigator', 'client'), async (req, res) => {
    const userEmail = req.session.user;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        const invitations = await sql`
            SELECT 
                ci.invitation_id,
                ci.case_id,
                ci.role,
                ci.created_at,
                c.case_name,
                c.case_number,
                c.priority,
                c.status,
                u.first_name || ' ' || u.last_name AS invited_by_name
            FROM case_invitations ci
            JOIN cases c ON ci.case_id = c.case_id
            JOIN users u ON ci.invited_by = u.user_id
            WHERE ci.user_id = ${userId}
            AND ci.status = 'pending'
            ORDER BY ci.created_at DESC
        `;

        res.json({ success: true, invitations });

    } catch (err) {
        console.error("Error fetching invitations:", err);
        res.status(500).json({ success: false, msg: "Error fetching invitations" });
    }
});

// ================ Respond to Investigations ====================

app.post('/api/invitations/:id/respond', requireRole('investigator', 'client'), async (req, res) => {
    const invitationId = req.params.id;
    const { action } = req.body; // 'accept' or 'decline'
    const userEmail = req.session.user;
    const userRole = req.session.role;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        // Verify this invitation belongs to this user
        const invitation = await sql`
            SELECT * FROM case_invitations 
            WHERE invitation_id = ${invitationId} AND user_id = ${userId} AND status = 'pending'
        `;

        if (invitation.length === 0) {
            return res.status(404).json({ success: false, msg: "Invitation not found" });
        }

        const inv = invitation[0];

        if (action === 'accept') {
            // Add to the appropriate table
            if (inv.role === 'investigator') {
                await sql`
                    INSERT INTO case_team (case_id, investigator_id)
                    VALUES (${inv.case_id}, ${userId})
                    ON CONFLICT DO NOTHING
                `;
            }
            // For clients, client_access is already true on the case
            // so no extra insert needed - they just gain dashboard visibility

            await createAuditLog(
                inv.case_id,
                userId,
                'INVITATION_ACCEPTED',
                `User accepted ${inv.role} invitation for the case`
            );
        } else {
            await createAuditLog(
                inv.case_id,
                userId,
                'INVITATION_DECLINED',
                `User declined ${inv.role} invitation for the case`
            );
        }

        // Update invitation status
        await sql`
            UPDATE case_invitations
            SET status = ${action === 'accept' ? 'accepted' : 'declined'},
                responded_at = NOW()
            WHERE invitation_id = ${invitationId}
        `;

        res.json({ success: true, msg: `Invitation ${action}ed successfully` });

    } catch (err) {
        console.error("Error responding to invitation:", err);
        res.status(500).json({ success: false, msg: "Error responding to invitation" });
    }
});

// ==================REPORTS API ====================
app.get('/api/reports/stats', requireInvestigator, async (req, res) => {
    try {
        const userEmail = req.session.user;
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        // Get all relevant case IDs first (avoids duplicate join issues)
        const userCases = await sql`
            SELECT DISTINCT c.case_id
            FROM cases c
            LEFT JOIN case_team ct ON c.case_id = ct.case_id
            WHERE c.investigator_id = ${userId}
            OR ct.investigator_id = ${userId}
        `;
        const caseIds = userCases.map(r => r.case_id);

        if (caseIds.length === 0) {
            return res.json({
                success: true,
                stats: {
                    total: 0,
                    byStatus: {},
                    byPriority: {},
                    totalEvidence: 0,
                    avgCloseTimeDays: null,
                    mostActiveCases: []
                }
            });
        }

        const statusCounts = await sql`
            SELECT status, COUNT(*) as count
            FROM cases
            WHERE case_id = ANY(${caseIds})
            GROUP BY status
        `;

        const priorityCounts = await sql`
            SELECT priority, COUNT(*) as count
            FROM cases
            WHERE case_id = ANY(${caseIds})
            GROUP BY priority
        `;

        const evidenceCount = await sql`
            SELECT COUNT(*) as count
            FROM evidence
            WHERE case_id = ANY(${caseIds})
        `;

        const avgClose = await sql`
            SELECT ROUND(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400)) as avg_days
            FROM cases
            WHERE case_id = ANY(${caseIds})
            AND status = 'closed'
            AND closed_at IS NOT NULL
        `;

        const mostActiveCases = await sql`
            SELECT c.case_id, c.case_name, c.case_number, c.status, c.priority,
                COUNT(a.audit_id) as event_count
            FROM cases c
            LEFT JOIN audit_log a ON c.case_id = a.case_id
            WHERE c.case_id = ANY(${caseIds})
            GROUP BY c.case_id, c.case_name, c.case_number, c.status, c.priority
            ORDER BY event_count DESC
            LIMIT 5
        `;

        const byStatus = {};
        statusCounts.forEach(row => {
            byStatus[row.status] = parseInt(row.count);
        });

        const byPriority = {};
        priorityCounts.forEach(row => {
            byPriority[row.priority] = parseInt(row.count);
        });

        const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

        res.json({
            success: true,
            stats: {
                total,
                byStatus,
                byPriority,
                totalEvidence: parseInt(evidenceCount[0].count),
                avgCloseTimeDays: avgClose[0].avg_days ? parseInt(avgClose[0].avg_days) : null,
                mostActiveCases: mostActiveCases.map(c => ({
                    case_id: c.case_id,
                    case_name: c.case_name,
                    case_number: c.case_number,
                    status: c.status,
                    priority: c.priority,
                    event_count: parseInt(c.event_count)
                }))
            }
        });

    } catch (err) {
        console.error('Error generating report stats:', err);
        res.status(500).json({ success: false, msg: 'Error generating stats' });
    }
});

//===========Updating case status ==================
app.post('/api/cases/:id/status', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const { status } = req.body;
    const userEmail = req.session.user;

    const validStatuses = ['active', 'pending', 'closed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, msg: 'Invalid status' });
    }

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        const caseData = await sql`SELECT investigator_id FROM cases WHERE case_id = ${caseId}`;
        if (caseData.length === 0) return res.status(404).json({ success: false, msg: 'Case not found' });

        // Only lead investigator can change status
        if (caseData[0].investigator_id !== userId) {
            return res.status(403).json({ success: false, msg: 'Only the lead investigator can change case status' });
        }

        const closedAt = status === 'closed' ? new Date().toISOString() : null;

        await sql`
            UPDATE cases 
            SET status = ${status}, 
                closed_at = ${closedAt}
            WHERE case_id = ${caseId}
        `;

        await createAuditLog(
            parseInt(caseId),
            userId,
            'STATUS_CHANGED',
            `Case status changed to: ${status}`
        );

        res.json({ success: true, msg: 'Status updated successfully' });

    } catch (err) {
        console.error('Error updating status:', err);
        res.status(500).json({ success: false, msg: 'Error updating status' });
    }
});

//=======Generate Report Sections==============
// ── Helper: compute SHA-256 of a file on disk ────────────────
function computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
        const crypto = require('crypto');
        const fs = require('fs');
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// Re-hashes every evidence file for this case and compares
// against the stored SHA-256 values.  Returns per-item results.
app.get('/api/cases/:id/integrity-check', requireInvestigator, async (req, res) => {
    const caseId = req.params.id;
    const userEmail = req.session.user;

    try {
        // Auth check – lead investigator or team member only
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        const caseData = await sql`
            SELECT investigator_id FROM cases WHERE case_id = ${caseId}
        `;
        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: 'Case not found' });
        }

        let isAuthorized = caseData[0].investigator_id === userId;
        if (!isAuthorized) {
            const tm = await sql`
                SELECT * FROM case_team
                WHERE case_id = ${caseId} AND investigator_id = ${userId}
            `;
            isAuthorized = tm.length > 0;
        }
        if (!isAuthorized) {
            return res.status(403).json({ success: false, msg: 'Access denied' });
        }

        // Fetch all evidence for this case
        const evidenceList = await sql`
            SELECT evidence_id, evidence_name, file_path, file_hash
            FROM evidence
            WHERE case_id = ${caseId}
        `;

        const results = [];
        const uploadsDir = path.join(__dirname, 'uploads');

        for (const ev of evidenceList) {
            const filePath = path.join(uploadsDir, ev.file_path);
            let computedHash = null;
            let fileExists  = false;
            let error       = null;

            try {
                if (fs.existsSync(filePath)) {
                    fileExists  = true;
                    computedHash = await computeFileHash(filePath);
                } else {
                    error = 'File not found on disk';
                }
            } catch (e) {
                error = e.message;
            }

            const match = fileExists && computedHash === ev.file_hash;

            results.push({
                evidence_id:   ev.evidence_id,
                evidence_name: ev.evidence_name,
                stored_hash:   ev.file_hash,
                computed_hash: computedHash,
                file_exists:   fileExists,
                match,
                error,
            });
        }

        const allMatch = results.length > 0 && results.every(r => r.match);

        res.json({ success: true, results, allMatch });

    } catch (err) {
        console.error('Error running integrity check:', err);
        res.status(500).json({ success: false, msg: 'Error running integrity check' });
    }
});


// Collects all case data, runs integrity check, generates PDF,
// logs to audit, stores PDF path, and closes the case.
app.post('/api/cases/:id/generate-report', requireInvestigator, async (req, res) => {
    const caseId    = req.params.id;
    const userEmail = req.session.user;
    const crypto    = require('crypto');
    const os        = require('os');
    const { execFile } = require('child_process');

    try {
        const user = await sql`SELECT user_id, first_name, last_name FROM users WHERE email = ${userEmail}`;
        if (user.length === 0) return res.status(401).json({ success: false, msg: 'User not found' });
        const userId      = user[0].user_id;
        const userName    = `${user[0].first_name} ${user[0].last_name}`;

        const caseData = await sql`
            SELECT * FROM cases WHERE case_id = ${caseId}
        `;
        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: 'Case not found' });
        }

        // Only lead investigator can generate the final report
        if (caseData[0].investigator_id !== userId) {
            return res.status(403).json({
                success: false,
                msg: 'Only the lead investigator can generate the final report'
            });
        }

        const theCase = caseData[0];


        // Lead investigator
        const leadInv = await sql`
            SELECT user_id, first_name || ' ' || last_name AS name
            FROM users WHERE user_id = ${theCase.investigator_id}
        `;

        // Client
        const client = await sql`
            SELECT user_id, first_name || ' ' || last_name AS name
            FROM users WHERE user_id = ${theCase.client_id}
        `;

        // Other investigators
        const investigators = await sql`
            SELECT u.user_id, u.first_name || ' ' || u.last_name AS name
            FROM case_team ct
            JOIN users u ON u.user_id = ct.investigator_id
            WHERE ct.case_id = ${caseId}
            AND ct.investigator_id != ${theCase.investigator_id}
        `;

        // Overview
        const overview = await sql`SELECT overview FROM case_details WHERE case_id = ${caseId}`;

        // Findings
        const findings = await sql`SELECT findings, recommendations FROM case_findings WHERE case_id = ${caseId}`;

        // Tools
        const tools = await sql`SELECT * FROM case_tools WHERE case_id = ${caseId} ORDER BY created_at ASC`;

        // Evidence
        const evidence = await sql`SELECT * FROM evidence WHERE case_id = ${caseId} ORDER BY collected_at ASC`;

        // CoC records
        const cocRecords = await sql`
            SELECT coc.*, e.evidence_name, u.first_name || ' ' || u.last_name AS created_by_name
            FROM chain_of_custody coc
            LEFT JOIN evidence e ON coc.evidence_id = e.evidence_id
            LEFT JOIN users u ON coc.created_by = u.user_id
            WHERE coc.case_id = ${caseId}
            ORDER BY coc.event_datetime ASC
        `;

        // Audit log
        const auditLog = await sql`
            SELECT al.*, u.first_name || ' ' || u.last_name AS user
            FROM audit_log al
            JOIN users u ON al.user_id = u.user_id
            WHERE al.case_id = ${caseId}
            ORDER BY al.timestamp ASC
        `;

        // Integrity check 
        const uploadsDir = path.join(__dirname, 'uploads');
        const integrityResults = [];

        for (const ev of evidence) {
            const filePath = path.join(uploadsDir, ev.file_path);
            let computedHash = null;
            let fileExists   = false;
            let error        = null;

            try {
                if (fs.existsSync(filePath)) {
                    fileExists   = true;
                    computedHash = await computeFileHash(filePath);
                } else {
                    error = 'File not found on disk';
                }
            } catch (e) {
                error = e.message;
            }

            const match = fileExists && computedHash === ev.file_hash;
            integrityResults.push({
                evidence_id:   ev.evidence_id,
                evidence_name: ev.evidence_name,
                stored_hash:   ev.file_hash,
                computed_hash: computedHash,
                file_exists:   fileExists,
                match,
                error,
            });
        }

        const allMatch = integrityResults.length > 0
            ? integrityResults.every(r => r.match)
            : true;

        const generatedAt = new Date().toUTCString()
            .replace('GMT', 'UTC')
            .replace(/:\d{2} UTC/, ' UTC');

        // Build JSON payload for Python script 
        const reportPayload = {
            case: {
                ...theCase,
                status:            'closed',
                lead_investigator: leadInv[0] || null,
                client:            client[0]  || null,
                investigators:     investigators,
                client_name:       client[0]?.name || '—',
            },
            overview:           overview[0]?.overview || '',
            findings:           findings[0] || { findings: '', recommendations: '' },
            tools:              tools,
            evidence:           evidence,
            integrity_results:  integrityResults,
            coc_records:        cocRecords,
            audit_log:          auditLog,
            report_meta: {
                generated_by:     userName,
                generated_at:     generatedAt,
                case_number:      theCase.case_number,
                evidence_count:   evidence.length,
                all_hashes_match: allMatch,
            },
        };

        // Write temp JSON and call Python 
        const tmpJson = path.join(os.tmpdir(), `dfir_case_${caseId}_${Date.now()}.json`);
        const pdfDir  = path.join(__dirname, 'reports');
        if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

        const pdfFileName = `DFIR-Report-${theCase.case_number}-${Date.now()}.pdf`;
        const pdfPath     = path.join(pdfDir, pdfFileName);

        fs.writeFileSync(tmpJson, JSON.stringify(reportPayload));

        // Resolve script path 
        const scriptPath = path.join(__dirname, 'generate_report.py');

        await new Promise((resolve, reject) => {
            execFile('python3', [scriptPath, '--input', tmpJson, '--output', pdfPath],
                { timeout: 60000 },
                (err, stdout, stderr) => {
                    // Clean up temp file regardless
                    try { fs.unlinkSync(tmpJson); } catch (_) {}
                    if (err) return reject(new Error(stderr || err.message));
                    resolve();
                }
            );
        });

        //Store report path + close case
        await sql`
            UPDATE cases
            SET status     = 'closed',
                closed_at  = NOW(),
                report_path = ${pdfFileName}
            WHERE case_id = ${caseId}
        `;

        // Audit log entries 
        const integrityStatus = allMatch
            ? `All ${integrityResults.length} evidence items passed SHA-256 integrity check`
            : `WARNING: ${integrityResults.filter(r => !r.match).length} evidence item(s) failed integrity check`;

        await createAuditLog(parseInt(caseId), userId, 'INTEGRITY_CHECK',
            integrityStatus);

        await createAuditLog(parseInt(caseId), userId, 'REPORT_GENERATED',
            `Final report generated: ${pdfFileName}. Case closed.`);

        // Respond 
        res.json({
            success:        true,
            msg:            'Report generated and case closed successfully',
            pdfFileName,
            allMatch,
            integrityResults,
        });

    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).json({ success: false, msg: 'Error generating report: ' + err.message });
    }
});


// Streams the stored PDF report to the client.
app.get('/api/cases/:id/download-report', requireRole('investigator', 'client'), async (req, res) => {
    const caseId    = req.params.id;
    const userEmail = req.session.user;
    const userRole  = req.session.role;

    try {
        const user = await sql`SELECT user_id FROM users WHERE email = ${userEmail}`;
        const userId = user[0].user_id;

        const caseData = await sql`
            SELECT investigator_id, client_id, case_number, report_path
            FROM cases WHERE case_id = ${caseId}
        `;
        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: 'Case not found' });
        }

        const theCase = caseData[0];

        // Auth check
        let isAuthorized = false;
        if (userRole === 'investigator') {
            isAuthorized = theCase.investigator_id === userId;
            if (!isAuthorized) {
                const tm = await sql`
                    SELECT * FROM case_team WHERE case_id = ${caseId} AND investigator_id = ${userId}
                `;
                isAuthorized = tm.length > 0;
            }
        } else if (userRole === 'client') {
            isAuthorized = theCase.client_id === userId;
        }

        if (!isAuthorized) {
            return res.status(403).json({ success: false, msg: 'Access denied' });
        }

        if (!theCase.report_path) {
            return res.status(404).json({ success: false, msg: 'No report has been generated for this case yet' });
        }

        const pdfPath = path.join(__dirname, 'reports', theCase.report_path);
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ success: false, msg: 'Report file not found on server' });
        }

        await createAuditLog(parseInt(caseId), userId, 'REPORT_DOWNLOADED',
            `Report downloaded: ${theCase.report_path}`);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition',
            `attachment; filename="DFIR-Report-${theCase.case_number}.pdf"`);
        fs.createReadStream(pdfPath).pipe(res);

    } catch (err) {
        console.error('Error downloading report:', err);
        res.status(500).json({ success: false, msg: 'Error downloading report' });
    }
});


// Returns whether a report has already been generated.
app.get('/api/cases/:id/report-status', requireRole('investigator', 'client'), async (req, res) => {
    const caseId = req.params.id;
    try {
        const caseData = await sql`
            SELECT status, report_path, closed_at FROM cases WHERE case_id = ${caseId}
        `;
        if (caseData.length === 0) {
            return res.status(404).json({ success: false, msg: 'Case not found' });
        }
        const { status, report_path, closed_at } = caseData[0];
        res.json({
            success:      true,
            hasReport:    !!report_path,
            reportPath:   report_path || null,
            caseStatus:   status,
            closedAt:     closed_at,
        });
    } catch (err) {
        console.error('Error fetching report status:', err);
        res.status(500).json({ success: false, msg: 'Error fetching report status' });
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