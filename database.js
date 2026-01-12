// const Database = require('better-sqlite3');
// const db = new Database('patients.db');

// db.prepare(`
//   CREATE TABLE IF NOT EXISTS patients (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     mrn TEXT,
//     name TEXT,
//     age INTEGER,
//     sex TEXT,
//     procedure TEXT,
//     doctor_name TEXT,
//     path TEXT,
//     address TEXT,
//     city TEXT,
//     telephone TEXT,
//     date_procedure TEXT,
//     referring_doctor TEXT,
//     class TEXT,
//     bed TEXT,
//     complaint TEXT,
//     diagnose TEXT
//   )
// `).run();

// module.exports = db;

const Database = require("better-sqlite3");
const path = require("path");
const { app } = require("electron");

const dbPath = path.join(app.getPath("userData"), "patients.db");
const db = new Database(dbPath);

// === PATIENTS ===
db.prepare(`
  CREATE TABLE IF NOT EXISTS patients (
    patient_id INTEGER PRIMARY KEY AUTOINCREMENT,
    mrn TEXT,
    name TEXT,
    date_of_birth TEXT,
    age INTEGER,
    sex TEXT,
    address TEXT,
    city TEXT,
    telephone TEXT
  )
`).run();

// === PROCEDURES ===
db.prepare(`
  CREATE TABLE IF NOT EXISTS procedures (
    procedure_id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,

    procedure TEXT,
    doctor_name TEXT,
    date_procedure TEXT,
    referring_doctor TEXT,
    class TEXT,
    bed TEXT,
    complaint TEXT,
    diagnose TEXT,

    status TEXT,
    procedure_time TEXT,

    created_at TEXT DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(patient_id) REFERENCES patients(patient_id)
  )
`).run();

// === DOCTORS (MASTER) ===
db.prepare(`
  CREATE TABLE IF NOT EXISTS doctors (
    doctor_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// === EXAMINATIONS (MASTER) ===
db.prepare(`
  CREATE TABLE IF NOT EXISTS examinations (
    examination_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();

console.log("DB PATH:", dbPath);

module.exports = db;
