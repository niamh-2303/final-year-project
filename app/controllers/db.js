const postgres = require('postgres');

const sql = postgres({
    host: "localhost",
    user: "postgres",
    database: "final_year_project",  
    password: "postgres"      
}) 

module.exports = sql;