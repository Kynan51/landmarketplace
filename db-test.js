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

  db.query('SELECT 1 + 1 AS result', (err, results) => {
    if (err) {
      console.error('Test query failed:', err.message);
      process.exit(1);
    }
    console.log('Test query passed, result =', results[0].result);
    db.end();
  });
});