const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcryptjs = require('bcryptjs');

const app = express();

// Database connection
const dbconnection = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "landmarketplace"
});

dbconnection.connect((err) => {
  if (err) throw err;
  console.log('Connected to database');
});

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Parse incoming request data
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Routes
app.get('/', (req, res) => {
  res.render('home');
});

app.get('/listings', (req, res) => {
  res.render('listings');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Validate inputs
  if (!email || !password) {
    return res.status(400).render('login', {
      message: 'Please enter email and password'
    });
  }

  // Query database for user
  dbconnection.query('SELECT email, password FROM users WHERE email = ?', [email], async (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).render('login', {
        message: 'An error occurred'
      });
    }

    if (results.length === 0 || !(await bcryptjs.compare(password, results[0].password))) {
      return res.status(401).render('login', {
        message: 'Email or Password is incorrect'
      });
    }

    res.status(200).render('login', {
      message: 'User logged in successfully'
    });
  });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { email, password, passwordConfirm, name } = req.body;

  // Validate inputs
  if (!email || !password || !passwordConfirm || !name) {
    return res.status(400).render('register', {
      message: 'Please provide all required fields'
    });
  }

  if (password !== passwordConfirm) {
    return res.status(400).render('register', {
      message: 'Passwords do not match'
    });
  }

  // Check if user already exists
  dbconnection.query('SELECT email FROM users WHERE email = ?', [email], async (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).render('register', {
        message: 'An error occurred'
      });
    }

    if (results.length > 0) {
      return res.status(400).render('register', {
        message: 'Email is already in use'
      });
    }

    // Hash password
    let hashedPassword = await bcryptjs.hash(password, 8);

    // Create user
    dbconnection.query('INSERT INTO users SET ?', { email: email, password: hashedPassword, name: name }, (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).render('register', {
          message: 'An error occurred'
        });
      }

      return res.status(201).render('register', {
        message: 'User registered successfully'
      });
    });
  });
});

// 404 Error Handler - Must be after all other routes
app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

module.exports = dbconnection;
