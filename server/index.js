const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public/')));
app.use(express.static(path.join(__dirname, '../client/src/')));


const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    return;
  }
  console.log('Database connected successfully');
});

// Signup route (Student)
app.post('/signup/student', async (req, res) => {
  const { srn, name, email, cgpa, year_of_grad, phone, password } = req.body;

  try {
    // Check if srn already exists
    const sql = 'SELECT * FROM STUDENT WHERE srn = ?';
    db.query(sql, [srn], (err, rows) => {
      if (err) {
        console.error('Error checking SRN:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (rows.length > 0) {
        return res.status(400).json({ error: 'SRN already exists' });
      }

      // Hash the password
      bcrypt.hash(password, 10)
        .then(hashedPassword => {
          // Insert new student into database
          const insertSql = 'INSERT INTO STUDENT (srn, name, email, cgpa, year_of_grad, phone, password) VALUES (?, ?, ?, ?, ?, ?, ?)';
          db.query(insertSql, [srn, name, email, cgpa, year_of_grad, phone, hashedPassword], (err, result) => {
            if (err) {
              console.error('Error creating student:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            if (result.affectedRows === 1) {
              return res.status(201).json({ message: 'User created successfully' });
            } else {
              return res.status(500).json({ error: 'Error creating user' });
            }
          });
        })
        .catch(err => {
          console.error('Error hashing password:', err);
          return res.status(500).json({ error: 'Internal server error' });
        });
    });
  } catch (err) {
    console.error('Error during signup:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Signup route (Placement Officer)
app.post('/signup/placement_officer', async (req, res) => {
  const { officer_id, dept, name, email, password } = req.body;

  try {
    // Check if officer_id already exists
    const sql = 'SELECT * FROM PLACEMENT_OFFICER WHERE officer_id = ?';
    db.query(sql, [officer_id], (err, rows) => {
      if (err) {
        console.error('Error checking Officer ID:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (rows.length > 0) {
        return res.status(400).json({ error: 'Officer ID already exists' });
      }

      // Hash the password
      bcrypt.hash(password, 10)
        .then(hashedPassword => {
          // Insert new placement officer into database
          const insertSql = 'INSERT INTO PLACEMENT_OFFICER (officer_id, dept, name, email, password) VALUES (?, ?, ?, ?, ?)';
          db.query(insertSql, [officer_id, dept, name, email, hashedPassword], (err, result) => {
            if (err) {
              console.error('Error creating placement officer:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }
            if (result.affectedRows === 1) {
              return res.status(201).json({ message: 'Placement Officer created successfully' });
            } else {
              return res.status(500).json({ error: 'Error creating Placement Officer' });
            }
          });
        })
        .catch(err => {
          console.error('Error hashing password:', err);
          return res.status(500).json({ error: 'Internal server error' });
        });
    });
  } catch (err) {
    console.error('Error during signup:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
  
    try {
      let user;
      // Check if student
      const [studentRows] = await db.promise().execute('SELECT * FROM STUDENT WHERE srn = ?', [username]);
      if (studentRows.length > 0) {
        user = studentRows[0];
      } else {
        // Check if placement officer
        const [officerRows] = await db.promise().execute('SELECT * FROM PLACEMENT_OFFICER WHERE officer_id = ?', [username]);
        if (officerRows.length > 0) {
          user = officerRows[0];
        } else {
          return res.status(401).json({ error: 'Invalid username or password' });
        }
      }
  
      // Compare password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
  
      // Redirect to appropriate dashboard based on user type
      if (user.srn) {
        return res.status(200).json({ redirect: `/student-dashboard?srn=${user.srn}` });
      } else {
        return res.status(200).json({ redirect: `/placement-officer-dashboard?officer_id=${user.officer_id}` });
      }
    } catch (err) {
      console.error('Error during login:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Modify the student-dashboard route in index.js
app.get('/student-dashboard', (req, res) => {
    const { srn } = req.query;
    
    if (!srn) {
      return res.status(400).json({ error: 'SRN is required' });
    }
  
    const sql = `
      SELECT s.*, a.*, jp.description AS job_description, jp.company_name 
      FROM STUDENT s
      LEFT JOIN APPLICATION a ON s.srn = a.srn
      LEFT JOIN JOB_POSTING jp ON a.job_id = jp.job_id 
      WHERE s.srn = ?
    `;
  
    db.query(sql, [srn], (err, rows) => {
      if (err) {
        console.error('Error fetching student dashboard data:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
  
      // Group the results
      const groupedData = {
        studentData: {
          srn: rows[0].srn,
          name: rows[0].name,
          email: rows[0].email,
          cgpa: rows[0].cgpa,
          year_of_grad: rows[0].year_of_grad,
          phone: rows[0].phone
        },
        applications: rows.filter(row => row.app_id).map(row => ({
          app_id: row.app_id,
          job_id: row.job_id,
          company_name: row.company_name,
          job_description: row.job_description,
          app_status: row.app_status,
          app_date: row.app_date,
          offer_status: row.offer_status
        }))
      };
  
      // Determine if this is an API request or a page request
      const isApiRequest = req.headers.accept && req.headers.accept.includes('application/json');
      
      if (isApiRequest) {
        // If it's an API request, send JSON
        res.json(groupedData);
      } else {
        // If it's a page request, send the HTML file
        res.sendFile(path.join(__dirname, '../client/public/student_dashboard.html'));
      }
    });
  });

  app.put('/update-offer-status', (req, res) => {
    const { appId, offerStatus } = req.body;
    
    const sql = `
        UPDATE APPLICATION 
        SET offer_status = ? 
        WHERE app_id = ?
    `;
    
    db.query(sql, [offerStatus, appId], (err, result) => {
        if (err) {
            console.error('Error updating offer status:', err);
            return res.status(500).json({ 
                success: false, 
                error: 'Failed to update offer status' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Offer status updated successfully' 
        });
    });
});

const jobPostingsRouter = require('./job_postings');
app.use('/job-postings', jobPostingsRouter);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listening on port ${process.env.PORT || 3000}`);
});