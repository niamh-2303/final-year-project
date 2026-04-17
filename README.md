# Digital Forensics & Incident Response (DFIR) Case Management System
Student: Niamh Armour (C22397066)

Project: Final Year Project - A  web application for forensic case management.

#  Overview
This application is a specialised management tool for forensic investigators. It provides a secure environment to track cases, manage evidence, and maintain a tamper-evident audit trail.

Key Features
Tamper-Evident Logging: Uses a SHA-256 blockchain-inspired hashing chain to link every action in the audit log.

Role-Based Access Control (RBAC): Specific views and permissions for Investigators and Clients.

Evidence Integrity: Supports evidence uploads with automatic cryptographic hashing and EXIF data extraction.

Case Security: A "Closed Case Guard" prevents any modifications to evidence or logs once a case has been officially closed.

#  Tech Stack
Backend: Node.js, Express.js

Database: PostgreSQL

Security: Bcrypt (password hashing), Express-Session (session management), Validator (input sanitization)

File Handling: Multer

#  Deployment Instructions
1. Database Setup
Ensure PostgreSQL is installed and running on your machine.

Create a new database named final_year_project.

Execute the provided backup.sql script to set up the necessary tables.

Note: You may need to update the credentials in ./db.js (host, user, password) to match your local PostgreSQL configuration.

2. Install Dependencies
Navigate to the root of the project directory and run:

npm install
This will install all required packages: express, cors, bcrypt, express-session, validator, multer, body-parser, and postgres.

3. Running the Application
To start the web server:

Open your terminal and navigate to the controller subfolder:


cd app/controller
Run the application:


node app.js
The application will be deployed to: http://localhost:8080
