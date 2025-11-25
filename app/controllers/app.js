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

// HTML routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/register.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/dashboard.html'));
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
