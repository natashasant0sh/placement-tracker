const express = require('express');
const router = express.Router();
const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: '../.env' });
const createCheckApplicationFunction = require('./createCheckApplicationFunction');


// Create MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
  }else {
    // Create the check application function after successful connection
    createCheckApplicationFunction(db)
      .then(() => {
        console.log('Check application function setup complete');
      })
      .catch(err => {
        console.error('Failed to setup check application function:', err);
      });
  }
  
});

// GET all job postings
router.get('/', (req, res) => {
    const sql = `SELECT * FROM JOB_POSTING`;
    db.query(sql, (err, rows) => {
      if (err) {
        console.error('Error fetching job postings:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
  
      // Determine if this is an API request or a page request
      const isApiRequest = req.headers.accept && req.headers.accept.includes('application/json');
  
      if (isApiRequest) {
        // If it's an API request, send JSON
        res.json(rows);
      } else {
        // If it's a page request, send the HTML file
        res.sendFile(path.join(__dirname, '../client/public/job_postings.html'));
      }
    });
  });

// Check if student has applied to a job
router.post('/check-application', (req, res) => {
    const { srn, jobId } = req.body;
    //FUNCTION CALL
    const sql = `SELECT check_student_application(?, ?) AS hasApplied`;
  
    db.query(sql, [srn, jobId], (err, result) => {
      if (err) {
        console.error('Error checking application:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
  
      res.json({ hasApplied: result[0].hasApplied });
    });
  });

// Apply for a job
router.post('/apply', (req, res) => {
  const { srn, jobId } = req.body;

  const sql = `
    INSERT INTO APPLICATION (srn, job_id, app_status, app_date, offer_status) 
    VALUES (?, ?, 'applied', CURDATE(), 'in_review')
  `;

  db.query(sql, [srn, jobId], (err, result) => {
    if (err) {
      console.error('Error applying for job:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ success: true, message: 'Application submitted successfully' });
  });
});

// Trigger to update APPLIES_TO table
db.query(`
    SELECT TRIGGER_NAME 
    FROM information_schema.TRIGGERS 
    WHERE TRIGGER_SCHEMA = DATABASE() 
    AND TRIGGER_NAME = 'after_application_insert'
  `, (err, result) => {
    if (err) {
      console.error('Error checking for trigger:', err);
    } else if (result.length === 0) { // Trigger doesn't exist
      db.query(`
        CREATE TRIGGER after_application_insert
        AFTER INSERT ON APPLICATION
        FOR EACH ROW
        BEGIN
          INSERT INTO APPLIES_TO (srn, job_id, app_id) 
          VALUES (NEW.srn, NEW.job_id, NEW.app_id);
        END
      `, (err) => {
        if (err) {
          console.error('Error creating trigger:', err);
        } else {
          console.log('Trigger created successfully!'); 
        }
      });
    }
  });

module.exports = router;