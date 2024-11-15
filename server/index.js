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
          // Create database user for the student
          const createUserSql = `CREATE USER '${srn}'@'localhost' IDENTIFIED BY ?`;
          db.query(createUserSql, [password], async (err) => {
            if (err) {
              console.error('Error creating database user:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            try {
              await db.promise().query(`GRANT SELECT ON ${process.env.DB_NAME}.JOB_POSTING TO '${srn}'@'localhost'`);
              await db.promise().query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${process.env.DB_NAME}.STUDENT TO '${srn}'@'localhost'`);
              await db.promise().query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${process.env.DB_NAME}.APPLICATION TO '${srn}'@'localhost'`);
              await db.promise().query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${process.env.DB_NAME}.APPLIES_TO TO '${srn}'@'localhost'`);
              await db.promise().query('FLUSH PRIVILEGES');

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
            } catch (err) {
              console.error('Error granting privileges:', err);
              // Cleanup: Drop the user if privilege granting fails
              await db.promise().query(`DROP USER '${srn}'@'localhost'`);
              return res.status(500).json({ error: 'Internal server error' });
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
          // Create database user for the placement officer
          const createUserSql = `CREATE USER '${officer_id}'@'localhost' IDENTIFIED BY ?`;
          db.query(createUserSql, [password], async (err) => {
            if (err) {
              console.error('Error creating database user:', err);
              return res.status(500).json({ error: 'Internal server error' });
            }

            try {
              // Grant all privileges to the placement officer
              await db.promise().query(`GRANT ALL PRIVILEGES ON ${process.env.DB_NAME}.* TO '${officer_id}'@'localhost'`);
              await db.promise().query('FLUSH PRIVILEGES');

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
            } catch (err) {
              console.error('Error granting privileges:', err);
              // Cleanup: Drop the user if privilege granting fails
              await db.promise().query(`DROP USER '${officer_id}'@'localhost'`);
              return res.status(500).json({ error: 'Internal server error' });
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
      } else 
      {
        //console.log(user.officer_id)
        return res.status(200).json({ redirect: `/placement-officer-dashboard` });
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
  
  //JOIN QUERY
  const sql = `
    SELECT s.srn, s.name, s.email, s.cgpa, s.year_of_grad, s.phone,
           a.app_id, a.job_id, a.app_status, a.app_date, a.offer_status,
           jp.description AS job_description, jp.company_name 
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

    // First ensure we have student data
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
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
      applications: rows[0].app_id ? rows.map(row => ({
        app_id: row.app_id,
        job_id: row.job_id,
        company_name: row.company_name,
        job_description: row.job_description,
        app_status: row.app_status,
        app_date: row.app_date,
        offer_status: row.offer_status
      })) : []
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
    
    //UPDATE OPERATION
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

// Placement Officer Dashboard route
app.get('/placement-officer-dashboard', (req, res) => {
  // Send the HTML file for the placement officer dashboard
  res.sendFile(path.join(__dirname, '../client/public/placement_officer_dashboard.html'));
});




// Route to search for student applications
app.get('/placement-officer-dashboard/search', (req, res) => {
  const { srn, job_id } = req.query;

  if (!srn) {
    return res.status(400).json({ error: 'SRN is required' });
  }

  // Construct SQL query based on the presence of job_id
  let sql = `
    SELECT a.*, jp.description AS job_description, jp.company_name 
    FROM APPLICATION a
    LEFT JOIN JOB_POSTING jp ON a.job_id = jp.job_id 
    WHERE a.srn = ?
  `;
  const params = [srn];

  // If job_id is provided, add it to the query and parameters
  if (job_id) {
    sql += ` AND a.job_id = ?`;
    params.push(job_id);
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error('Error fetching student applications:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    res.json({ applications: rows });
  });
});


// Route to create a new job posting
app.post('/job-posting', (req, res) => {
  const { job_id, company_name, description, salary, deadline, link } = req.body;

  const sql = `
      INSERT INTO JOB_POSTING (job_id, company_name, description,salary, deadline,link)
      VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(sql, [job_id, company_name, description, salary, deadline, link], (err, result) => {
      if (err) {
          console.error('Error creating job posting:', err);
          return res.status(500).json({ error: 'Internal server error' });
      }
      res.status(201).json({ message: 'Job posting created successfully' });
  });
});

// Route to fetch all job postings
app.get('/job-postings-po', (req, res) => {
  
  res.sendFile(path.join(__dirname, '../client/public/job_postings_po.html'));
});

//NESTED AND AGGREGATE QUERY
app.get('/job-postings-po/data', (req, res) => {
  const sql = `
    SELECT 
      jp.job_id,
      jp.company_name,
      jp.description,
      jp.salary,
      jp.deadline,
      jp.link,
      -- Subquery to calculate the average GPA of applicants
      (SELECT AVG(s.cgpa) 
       FROM APPLICATION a 
       JOIN STUDENT s ON a.srn = s.srn 
       WHERE a.job_id = jp.job_id) AS average_gpa
    FROM JOB_POSTING jp
  `;
  
  db.query(sql, (err, rows) => {
    if (err) {
      console.error('Error fetching job postings:', err);
      return res.status(500).json({ error: 'Failed to retrieve job postings' });
    }
    res.json(rows);
  });
});

app.delete('/job-postings-po/:jobId', (req, res) => {
  const { jobId } = req.params;

  // Check if the trigger exists, then create it if it doesn't
  //TRIGGER and DELETE
  const checkTriggerSql = `
    SELECT COUNT(*) AS triggerExists 
    FROM information_schema.TRIGGERS 
    WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'delete_job_posting_and_dependent_records';
  `;

  db.query(checkTriggerSql, (err, results) => {
    if (err) {
      console.error('Error checking for existing trigger:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    const triggerExists = results[0].triggerExists > 0;
    if (!triggerExists) {
      const createTriggerSql = `
        CREATE TRIGGER delete_job_posting_and_dependent_records
        BEFORE DELETE ON JOB_POSTING
        FOR EACH ROW
        BEGIN
          -- First, delete dependent records from the 'APPLIES_TO' table
          DELETE FROM APPLIES_TO WHERE job_id = OLD.job_id;

          -- Then, delete dependent records from the 'APPLICATION' table
          DELETE FROM APPLICATION WHERE job_id = OLD.job_id;

          -- After all dependencies are deleted, the job record will be deleted automatically
        END;
      `;

      db.query(createTriggerSql, (err) => {
        if (err) {
          console.error('Error creating delete trigger for job postings and dependent records:', err);
          return res.status(500).json({ error: 'Internal server error' });
        }

        // Proceed with deleting the job posting
        deleteJobPosting(jobId, res);
      });
    } else {
      // Trigger already exists, proceed with deleting the job posting
      deleteJobPosting(jobId, res);
    }
  });
});

function deleteJobPosting(jobId, res) {
  const deleteJobSql = 'DELETE FROM JOB_POSTING WHERE job_id = ?';

  db.query(deleteJobSql, [jobId], (err, result) => {
    if (err) {
      console.error('Error deleting job posting:', err);
      return res.status(500).json({ error: 'Failed to delete job posting' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Job posting not found' });
    }

    res.status(200).json({ message: 'Job posting deleted successfully' });
  });
}




app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listening on port ${process.env.PORT || 3000}`);
});