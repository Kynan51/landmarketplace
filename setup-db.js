const mysql = require('mysql');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'landmarketplace'
});

db.connect(err => {
  if (err) {
    console.error('DB connection FAILED:', err.message);
    process.exit(1);
  }
  console.log('DB connected successfully');

  // Create users table if it doesn't exist
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `;

  db.query(createUsersTableQuery, (err, results) => {
    if (err) {
      console.error('Error creating users table:', err.message);
      db.end();
      process.exit(1);
    }
    console.log('✓ Users table created or already exists');
    
    // Create liked_items table
    const createLikedItemsTableQuery = `
      CREATE TABLE IF NOT EXISTS liked_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        item_id VARCHAR(100) NOT NULL,
        item_name VARCHAR(255) NOT NULL,
        item_price DECIMAL(10, 2) NOT NULL,
        item_image VARCHAR(500),
        item_description TEXT,
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_item (user_id, item_id)
      )
    `;

    db.query(createLikedItemsTableQuery, (err, results) => {
      if (err) {
        console.error('Error creating liked_items table:', err.message);
        db.end();
        process.exit(1);
      }
      console.log('✓ Liked items table created or already exists');
      
      // Describe both tables
      db.query('DESCRIBE users', (err, results) => {
        if (err) {
          console.error('Error describing users table:', err.message);
        } else {
          console.log('\n✓ Users table structure:');
          console.table(results);
        }

        db.query('DESCRIBE liked_items', (err, results) => {
          if (err) {
            console.error('Error describing liked_items table:', err.message);
          } else {
            console.log('\n✓ Liked items table structure:');
            console.table(results);
          }
          db.end();
        });
      });
    });
  });
});
