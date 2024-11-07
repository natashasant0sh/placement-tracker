const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: '../.env' });

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/public')));

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
    const [rows] = await db.promise().execute('SELECT * FROM STUDENT WHERE srn = ?', [srn]);
    if (rows.length > 0) {
      return res.status(400).json({ error: 'SRN already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new student into database
    const [result] = await db.promise().execute(
      'INSERT INTO STUDENT (srn, name, email, cgpa, year_of_grad, phone, password) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [srn, name, email, cgpa, year_of_grad, phone, hashedPassword]
    );

    if (result.affectedRows === 1) {
      return res.status(201).json({ message: 'User created successfully' });
    } else {
      return res.status(500).json({ error: 'Error creating user' });
    }
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
    const [rows] = await db.promise().execute('SELECT * FROM PLACEMENT_OFFICER WHERE officer_id = ?', [officer_id]);
    if (rows.length > 0) {
      return res.status(400).json({ error: 'Officer ID already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new placement officer into database
    const [result] = await db.promise().execute(
      'INSERT INTO PLACEMENT_OFFICER (officer_id, dept, name, email, password) VALUES (?, ?, ?, ?, ?)',
      [officer_id, dept, name, email, hashedPassword]
    );

    if (result.affectedRows === 1) {
      return res.status(201).json({ message: 'Placement Officer created successfully' });
    } else {
      return res.status(500).json({ error: 'Error creating Placement Officer' });
    }
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

    // Generate JWT token
    const token = jwt.sign({ username: user.srn || user.officer_id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({ token });
  } catch (err) {
    console.error('Error during login:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Student dashboard route
app.get('/dashboard/student', verifyToken, (req, res) => {
  // Logic to fetch student-specific data (e.g., applications, notifications)
  res.send('This is the Student Dashboard');
});

// Placement Officer dashboard route
app.get('/dashboard/placement_officer', verifyToken, (req, res) => {
  // Logic to fetch placement officer-specific data (e.g., company details, job postings)
  res.send('This is the Placement Officer Dashboard');
})

// Protected route (example)
app.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({ message: 'This is a protected route', user: req.user });
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server listening on port ${process.env.PORT || 3000}`);
});
