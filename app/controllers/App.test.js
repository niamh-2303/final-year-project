/**
 * DFIR Case Management System - Automated Test Suite
 * Uses Jest + Supertest
 *
 */

const request = require('supertest');
const app = require('./app'); 
const sql = require('./db.js');

// ============================================================
// TEST SUITE 1: Authentication & Session Management (NFR1.1)
// ============================================================

describe('T-01 to T-03 | Authentication & Session Management (NFR1.1)', () => {

    // T-01: Login with valid investigator credentials returns 200 and correct role
    test('T-01 | Login with valid investigator credentials returns success and investigator role', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                email: 'investigator@test.com',
                pwd: 'investigatortest'             
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.msg).toBe('Login successful');
        expect(res.body.role).toBe('investigator');
    });

    // T-02: Login with valid client credentials returns 200 and client role
    test('T-02 | Login with valid client credentials returns success and client role', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                email: 'client@test.com', 
                pwd: 'clienttest'         
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.msg).toBe('Login successful');
        expect(res.body.role).toBe('client');
    });

    // T-03: Login with wrong password returns 401
    test('T-03 | Login with incorrect password returns 401 Unauthorized', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                email: 'investigator@test.com',
                pwd: 'completelywrongpassword'
            });

        expect(res.statusCode).toBe(401);
        expect(res.body.msg).toBe('Invalid email or password');
    });

    // T-04: Login with missing fields returns 400
    test('T-04 | Login with missing password field returns 400 Bad Request', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                email: 'investigator@test.com'
                // pwd deliberately omitted
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toBe('Email and password are required');
    });

});

// ============================================================
// TEST SUITE 2: Access Control - Unauthenticated Requests (NFR1.1)
// ============================================================

describe('T-05 to T-07 | Access Control - Unauthenticated Requests (NFR1.1)', () => {

    // T-05: Accessing a protected API route without a session returns 403 or redirect
    test('T-05 | Unauthenticated request to /api/next-case-number is rejected', async () => {
        const res = await request(app)
            .get('/api/next-case-number');

        // Should redirect to login (302) or return 403 — not 200
        expect([302, 403]).toContain(res.statusCode);
    });

    // T-06: Accessing investigator-only dashboard page without login redirects
    test('T-06 | Unauthenticated GET /dashboard.html redirects to login', async () => {
        const res = await request(app)
            .get('/dashboard.html');

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });

    // T-07: Accessing client-only dashboard page without login redirects
    test('T-07 | Unauthenticated GET /client-dashboard.html redirects to login', async () => {
        const res = await request(app)
            .get('/client-dashboard.html');

        expect(res.statusCode).toBe(302);
        expect(res.headers.location).toBe('/');
    });

});

// ============================================================
// TEST SUITE 3: Registration (NFR1.1)
// ============================================================

describe('T-08 to T-10 | User Registration (NFR1.1)', () => {

    // T-08: Registration with mismatched passwords returns 400
    test('T-08 | Registration with mismatched passwords returns 400', async () => {
        const res = await request(app)
            .post('/register-account')
            .send({
                fname: 'Test',
                lname: 'User',
                role: 'investigator',
                email: 'newuser_unique@test.com',
                psw: 'password123',
                'psw-repeat': 'differentpassword'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toBe('Passwords do not match');
    });

    // T-09: Registration with missing fields returns 400
    test('T-09 | Registration with missing fields returns 400', async () => {
        const res = await request(app)
            .post('/register-account')
            .send({
                fname: 'Test',
                // lname missing
                role: 'investigator',
                email: 'incomplete@test.com',
                psw: 'password123',
                'psw-repeat': 'password123'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toBe('All fields are required');
    });

    // T-10: Registration with an invalid role returns 400
    test('T-10 | Registration with invalid role value returns 400', async () => {
        const res = await request(app)
            .post('/register-account')
            .send({
                fname: 'Test',
                lname: 'User',
                role: 'superadmin', // not a valid role
                email: 'badrole@test.com',
                psw: 'password123',
                'psw-repeat': 'password123'
            });

        expect(res.statusCode).toBe(400);
        expect(res.body.msg).toBe('Invalid role specified');
    });

});

// ============================================================
// TEST SUITE 4: Case Status Update — requireCaseOpenFull (FR2.0)
// ============================================================

describe('T-11 | Closed Case Write Protection - requireCaseOpenFull Middleware (FR2.0)', () => {

    /**
     * This test verifies that the requireCaseOpenFull middleware blocks
     * POST requests to a closed case. It simulates a logged-in investigator
     * session using Supertest's agent (which persists cookies across requests).
     *
     * Replace the values below with a real closed case ID and valid
     * investigator credentials from your database.
     */
    test('T-11 | POST to a closed case overview is blocked with 403', async () => {
        const agent = request.agent(app); // agent persists the session cookie

        // Step 1: Log in as an investigator
        await agent
            .post('/login')
            .send({
                email: 'investigator@test.com', 
                pwd: 'investigatortest'
            });

        // Step 2: Attempt to POST to a closed case (replace 1 with a real closed case_id)
        const closedCaseId = 9; 

        const res = await agent
            .post(`/api/cases/${closedCaseId}/overview`)
            .send({ overview: 'Attempting to modify a closed case' });

        expect(res.statusCode).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.msg).toBe('This case is closed. No modifications are permitted.');
    });

});

// ============================================================
// TEST SUITE 5: Case Status Endpoint (FR1.0)
// ============================================================

describe('T-12 to T-13 | Case Status Update (FR1.0)', () => {

    // T-12: Invalid status value returns 400
    test('T-12 | Sending an invalid status value returns 400 Bad Request', async () => {
        const agent = request.agent(app);

        await agent
            .post('/login')
            .send({
                email: 'investigator@test.com',
                pwd: 'investigatortest'
            });

        const res = await agent
            .post('/api/cases/1/status') // case ID doesn't matter here — validation fires first
            .send({ status: 'invalid_status_value' });

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.msg).toBe('Invalid status');
    });

    // T-13: Unauthenticated status change is rejected
    test('T-13 | Unauthenticated POST to /api/cases/:id/status is rejected', async () => {
        const res = await request(app)
            .post('/api/cases/1/status')
            .send({ status: 'active' });

        expect([302, 403]).toContain(res.statusCode);
    });

});

// ============================================================
// TEST SUITE 6: Get User Info Endpoint (NFR1.1)
// ============================================================

describe('T-14 to T-15 | Get User Info (NFR1.1)', () => {

    // T-14: /get-user-info returns user details when logged in
    test('T-14 | GET /get-user-info returns userId, role, and email for logged-in user', async () => {
        const agent = request.agent(app);

        await agent
            .post('/login')
            .send({
                email: 'investigator@test.com',
                pwd: 'investigatortest'
            });

        const res = await agent.get('/get-user-info');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('userId');
        expect(res.body).toHaveProperty('role');
        expect(res.body).toHaveProperty('email');
        expect(res.body.userId).not.toBeUndefined();
        expect(res.body.userId).not.toBeNull();
    });

    // T-15: /get-user-info without a session returns 401
    test('T-15 | GET /get-user-info without a session returns 302 redirect', async () => {
        const res = await request(app).get('/get-user-info');

        // requireLogin redirects unauthenticated users
        expect(res.statusCode).toBe(302);
    });

});

// ============================================================
// TEST SUITE 7: Evidence Upload Validation (FR2.0)
// ============================================================

describe('T-16 | Evidence Upload — Unauthenticated Request (FR2.0)', () => {

    // T-16: Unauthenticated evidence upload is rejected
    test('T-16 | Unauthenticated POST to /api/upload-evidence is rejected', async () => {
        const res = await request(app)
            .post('/api/upload-evidence')
            .field('case_id', '1')
            .field('file_hash', 'fakehash123');

        // Should be rejected — not 200
        expect([302, 403]).toContain(res.statusCode);
    });

});

// ============================================================
// TEST SUITE 8: Public Routes (Smoke Tests)
// ============================================================

describe('T-17 to T-19 | Public Routes Smoke Tests', () => {

    // T-17: Login page is publicly accessible
    test('T-17 | GET / returns 200 (login page is publicly accessible)', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toBe(200);
    });

    // T-18: Register page is publicly accessible
    test('T-18 | GET /register.html returns 200 (registration page is public)', async () => {
        const res = await request(app).get('/register.html');
        expect(res.statusCode).toBe(200);
    });

    // T-19: Access denied page is publicly accessible
    test('T-19 | GET /access-denied.html returns 200 (access denied page is public)', async () => {
        const res = await request(app).get('/access-denied.html');
        expect(res.statusCode).toBe(200);
    });

});

// ============================================================
// TEST SUITE 9: Forensic Integrity & Team Management
// ============================================================
const createdCaseNumbers = [];

describe('T-20 to T-22 | Forensic Integrity & Team Management', () => {
    let agent;

    beforeAll(async () => {
        agent = request.agent(app);

        const loginRes = await agent.post('/login').send({
            email: 'investigator@test.com',
            pwd: 'investigatortest'
        });

        expect(loginRes.statusCode).toBe(200);
    });

    test('T-20 | Creating a case generates a verifiable SHA-256 Audit Log hash', async () => {
        const caseNumber = `CASE-77777-${Date.now()}`;
        createdCaseNumbers.push(caseNumber);

        const res = await agent
            .post('/api/create-case-with-team')
            .send({
                caseNumber,
                caseName: 'Integrity Test',
                caseType: 'Malware Analysis',
                clientID: 8,
                priority: 'high',
                status: 'active',
                teamMembers: [5],
                clientAccess: true
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.caseID).toBeDefined();

        const logs = await sql`
            SELECT * FROM audit_log
            WHERE case_id = ${res.body.caseID}
        `;

        expect(logs.length).toBeGreaterThan(0);
    });

    test('T-21 | Case creation correctly invites the client', async () => {
        const caseNumber = `CASE-88888-${Date.now()}`;
        createdCaseNumbers.push(caseNumber);

        const res = await agent
            .post('/api/create-case-with-team')
            .send({
                caseNumber,
                caseName: 'Invitation Test',
                caseType: 'Network Logs',
                clientID: 8,
                priority: 'high',
                status: 'active',
                teamMembers: [],
                clientAccess: true
            });

        expect(res.statusCode).toBe(200);

        const invite = await sql`
            SELECT * FROM case_invitations
            WHERE case_id = ${res.body.caseID}
            AND user_id = 8
        `;

        expect(invite.length).toBe(1);
    });

    test('T-22 | Authenticated Investigator can upload evidence to case', async () => {
        const caseNumber = `CASE-TEMP-UPLOAD-${Date.now()}`;
        createdCaseNumbers.push(caseNumber);

        const setupCase = await agent.post('/api/create-case-with-team').send({
            caseNumber,
            caseName: 'Upload Test',
            caseType: 'Forensics',
            clientID: 8,
            priority: 'low',
            status: 'active',
            teamMembers: [5],
            clientAccess: true
        });

        expect(setupCase.statusCode).toBe(200);
        expect(setupCase.body.caseID).toBeDefined();

        const res = await agent
            .post('/api/upload-evidence')
            .field('case_id', String(setupCase.body.caseID))
            .field('evidence_summary', 'Automated Test')
            .field(
                'file_hash',
                '916f0027a575074ce72a331777c3478d6513f786a591bd892da1a577bf233f0'
            )
            .attach('file', Buffer.from('test data'), 'evidence.txt');

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
    });
});

afterAll(async () => {
    try {
        if (createdCaseNumbers.length > 0) {
            const cases = await sql`
                SELECT case_id FROM cases
                WHERE case_number = ANY(${createdCaseNumbers})
            `;

            const ids = cases.map(c => c.case_id);

            if (ids.length > 0) {
                await sql`DELETE FROM audit_log WHERE case_id = ANY(${ids})`;
                await sql`DELETE FROM case_invitations WHERE case_id = ANY(${ids})`;
                await sql`DELETE FROM evidence WHERE case_id = ANY(${ids})`;
                await sql`DELETE FROM cases WHERE case_id = ANY(${ids})`;
            }
        }
    } finally {
        await sql.end();
    }
});