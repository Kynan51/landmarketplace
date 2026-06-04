const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const bcryptjs = require('bcryptjs');

const app = express();

// Middleware for parsing
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Cookie parsing middleware (simple implementation)
app.use((req, res, next) => {
  const cookies = {};
  if (req.headers.cookie) {
    req.headers.cookie.split(';').forEach(cookie => {
      const parts = cookie.trim().split('=');
      if (parts.length === 2) {
        cookies[parts[0]] = decodeURIComponent(parts[1]);
      }
    });
  }
  req.cookies = cookies;
  
  // Intercept setHeader to capture Set-Cookie
  const originalSetHeader = res.setHeader.bind(res);
  res.setHeader = function(name, value) {
    if (name.toLowerCase() === 'set-cookie') {
      const cookieParts = value.split(';');
      const cookieData = cookieParts[0].split('=');
      if (cookieData.length === 2) {
        req.cookies[cookieData[0]] = decodeURIComponent(cookieData[1]);
      }
    }
    return originalSetHeader(name, value);
  };
  
  next();
});

// Simple session management using in-memory store
const sessions = {};

const setSession = (res, userId, userData) => {
  const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  sessions[sessionId] = {
    userId,
    userData,
    createdAt: Date.now()
  };
  // Set cookie header - must be called before res.render()
  res.cookie = res.cookie || {};
  res.setHeader('Set-Cookie', `sessionId=${sessionId}; Path=/; Max-Age=86400; SameSite=Lax`);
  return sessionId;
};

const getSession = (req) => {
  const sessionId = req.cookies?.sessionId;
  if (sessionId && sessions[sessionId]) {
    return sessions[sessionId];
  }
  return null;
};

const isLoggedIn = (req) => {
  return getSession(req) !== null;
};
const validatePasswordStrength = (password) => {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasDigits: /\d/.test(password),
    hasSymbols: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  };

  const isStrong = Object.values(requirements).every(req => req);
  const failedRequirements = Object.entries(requirements)
    .filter(([_, passed]) => !passed)
    .map(([requirement, _]) => requirement);

  return {
    isStrong,
    requirements,
    failedRequirements,
    message: isStrong ? 'Password is strong' : `Password must contain: ${failedRequirements.join(', ')}`
  };
};

// Email validator
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Name validator
const validateName = (name) => {
  return name && name.trim().length >= 2;
};

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

// Routes
app.get('/', (req, res) => {
  const session = getSession(req);
  res.render('home', {
    isLoggedIn: isLoggedIn(req),
    user: session ? session.userData : null
  });
});

app.get('/listings', (req, res) => {
  const session = getSession(req);
  res.render('listings', {
    isLoggedIn: isLoggedIn(req),
    user: session ? session.userData : null
  });
});

app.get('/login', (req, res) => {
  const session = getSession(req);
  res.render('login', {
    isLoggedIn: isLoggedIn(req),
    user: session ? session.userData : null
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Validate inputs
  if (!email || !password) {
    return res.status(400).render('login', {
      isLoggedIn: false,
      user: null,
      message: 'Please enter both email and password'
    });
  }

  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).render('login', {
      isLoggedIn: false,
      user: null,
      message: 'Please provide a valid email address'
    });
  }

  // Query database for user
  dbconnection.query('SELECT id, email, password, name FROM users WHERE email = ?', [email], async (error, results) => {
    if (error) {
      console.log('Login error:', error);
      return res.status(500).render('login', {
        isLoggedIn: false,
        user: null,
        message: 'An error occurred. Please try again later.'
      });
    }

    if (results.length === 0) {
      return res.status(401).render('login', {
        isLoggedIn: false,
        user: null,
        message: 'Email or password is incorrect'
      });
    }

    const user = results[0];
    
    // Compare passwords
    if (!(await bcryptjs.compare(password, user.password))) {
      return res.status(401).render('login', {
        isLoggedIn: false,
        user: null,
        message: 'Email or password is incorrect'
      });
    }

    // Set session on successful login
    setSession(res, user.id, {
      id: user.id,
      name: user.name,
      email: user.email
    });

    console.log('User logged in successfully:', { userId: user.id, email: user.email, name: user.name });
    res.status(200).render('login', {
      isLoggedIn: true,
      user: { id: user.id, name: user.name, email: user.email },
      message: `Welcome back, ${user.name}! Login successful.`
    });
  });
});

app.get('/register', (req, res) => {
  const session = getSession(req);
  res.render('register', {
    isLoggedIn: isLoggedIn(req),
    user: session ? session.userData : null
  });
});

app.post('/register', (req, res) => {
  const { email, password, passwordConfirm, name } = req.body;

  // Validate inputs exist
  if (!email || !password || !passwordConfirm || !name) {
    return res.status(400).render('register', {
      message: 'Please provide all required fields'
    });
  }

  // Validate name
  if (!validateName(name)) {
    return res.status(400).render('register', {
      isLoggedIn: false,
      user: null,
      message: 'Name must be at least 2 characters long'
    });
  }

  // Validate email format
  if (!validateEmail(email)) {
    return res.status(400).render('register', {
      isLoggedIn: false,
      user: null,
      message: 'Please provide a valid email address'
    });
  }

  // Validate password match
  if (password !== passwordConfirm) {
    return res.status(400).render('register', {
      isLoggedIn: false,
      user: null,
      message: 'Passwords do not match'
    });
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isStrong) {
    return res.status(400).render('register', {
      isLoggedIn: false,
      user: null,
      message: passwordValidation.message
    });
  }

  // Check if user already exists
  dbconnection.query('SELECT email FROM users WHERE email = ?', [email], async (error, results) => {
    if (error) {
      console.log(error);
      return res.status(500).render('register', {
        isLoggedIn: false,
        user: null,
        message: 'An error occurred. Please try again later.'
      });
    }

    if (results.length > 0) {
      return res.status(400).render('register', {
        isLoggedIn: false,
        user: null,
        message: 'Email is already registered. Please use a different email.'
      });
    }

    // Hash password
    let hashedPassword = await bcryptjs.hash(password, 8);

    // Create user
    dbconnection.query('INSERT INTO users SET ?', { email: email, password: hashedPassword, name: name }, (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).render('register', {
          isLoggedIn: false,
          user: null,
          message: 'An error occurred during registration. Please try again.'
        });
      }

      const userId = results.insertId;
      
      // Set session on successful registration
      setSession(res, userId, {
        id: userId,
        name: name,
        email: email
      });

      console.log('New user registered:', { email, name, userId });
      return res.status(201).render('register', {
        isLoggedIn: true,
        user: { id: userId, name: name, email: email },
        message: 'User registered successfully. You can now login!'
      });
    });
  });
});

app.get('/profile', (req, res) => {
  console.log('Profile route accessed');
  const session = getSession(req);
  
  if (!isLoggedIn(req)) {
    return res.status(401).redirect('/login');
  }

  // Fetch liked items from database
  dbconnection.query('SELECT * FROM liked_items WHERE user_id = ? ORDER BY added_at DESC', [session.userId], (error, likedItems) => {
    if (error) {
      console.log(error);
      return res.status(500).render('profile', {
        user: session.userData,
        likedItems: [],
        message: 'Error loading liked items'
      });
    }

    res.render('profile', {
      user: session.userData,
      likedItems: likedItems || [],
      isLoggedIn: true
    });
  });
});

// Test route
app.get('/test-profile', (req, res) => {
  res.json({ message: 'Test route working' });
});

// Logout route
app.get('/logout', (req, res) => {
  const sessionId = req.cookies?.sessionId;
  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
  }
  res.clearCookie('sessionId');
  res.redirect('/');
});

// API: Add item to liked items
app.post('/api/liked-items/add', (req, res) => {
  const session = getSession(req);
  
  if (!isLoggedIn(req)) {
    return res.status(401).json({ success: false, message: 'Not logged in' });
  }

  const { itemId, itemName, itemPrice, itemImage, itemDescription } = req.body;
  
  if (!itemId || !itemName || !itemPrice) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  dbconnection.query(
    'INSERT INTO liked_items SET ?',
    {
      user_id: session.userId,
      item_id: itemId,
      item_name: itemName,
      item_price: itemPrice,
      item_image: itemImage || null,
      item_description: itemDescription || null
    },
    (error, results) => {
      if (error) {
        // Check if it's a duplicate entry error
        if (error.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ success: false, message: 'Item already in liked items' });
        }
        console.log(error);
        return res.status(500).json({ success: false, message: 'Error adding item' });
      }

      console.log('Item added to liked items:', { userId: session.userId, itemId });
      res.json({ success: true, message: 'Item added to liked items' });
    }
  );
});

// API: Remove item from liked items
app.post('/api/liked-items/remove', (req, res) => {
  const session = getSession(req);
  
  if (!isLoggedIn(req)) {
    return res.status(401).json({ success: false, message: 'Not logged in' });
  }

  const { itemId } = req.body;
  
  if (!itemId) {
    return res.status(400).json({ success: false, message: 'Item ID required' });
  }

  dbconnection.query(
    'DELETE FROM liked_items WHERE user_id = ? AND item_id = ?',
    [session.userId, itemId],
    (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Error removing item' });
      }

      console.log('Item removed from liked items:', { userId: session.userId, itemId });
      res.json({ success: true, message: 'Item removed from liked items' });
    }
  );
});

// API: Get liked items
app.get('/api/liked-items', (req, res) => {
  const session = getSession(req);
  
  if (!isLoggedIn(req)) {
    return res.status(401).json({ success: false, message: 'Not logged in' });
  }

  dbconnection.query(
    'SELECT * FROM liked_items WHERE user_id = ? ORDER BY added_at DESC',
    [session.userId],
    (error, likedItems) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Error fetching items' });
      }

      res.json({ success: true, likedItems: likedItems || [] });
    }
  );
});

// 404 handler - must be last
app.use((req, res) => {
  const session = getSession(req);
  res.status(404).render('404', {
    isLoggedIn: isLoggedIn(req),
    user: session ? session.userData : null
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

module.exports = dbconnection;
