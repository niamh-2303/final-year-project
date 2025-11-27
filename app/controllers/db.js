const postgres = require('postgres');

const sql = postgres({
    host: "localhost",
    user: "postgres",
    database: "final_year_project",  // ← Change this to your DFIR database name
    password: "postgres"      // ← Add your postgres password
}) 

module.exports = sql;