const Database = require('better-sqlite3');
const db = new Database('patients.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mrn TEXT,
    name TEXT,
    age INTEGER,
    sex TEXT,
    procedure TEXT,
    doctor_name TEXT,
    path TEXT,
    address TEXT,
    city TEXT,
    telephone TEXT,
    date_procedure TEXT,
    referring_doctor TEXT,
    class TEXT,
    bed TEXT,
    complaint TEXT,
    diagnose TEXT
  )
`).run();

module.exports = db;
