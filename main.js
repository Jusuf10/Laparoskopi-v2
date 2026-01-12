const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require("child_process");
const path = require('path');
const fs = require("fs");
const db = require('./database');
const isDev = !app.isPackaged;

const USER_DATA = app.getPath("userData");

<<<<<<< HEAD
let mainWindow;
let splash;

=======
>>>>>>> e95d0c79ab3b3e0f8019bd52df8193ab85dfd2f8
const PATHS = {
  patients: path.join(USER_DATA, "patients"),
  icons: path.join(USER_DATA, "icons"),
  settings: path.join(USER_DATA, "file.json"),
};

// const basePatientsFolder = path.join(__dirname, "patients");
const basePatientsFolder = PATHS.patients;

const patientsDir = basePatientsFolder;

// pastikan folder ada
Object.values(PATHS).forEach(p => {
  if (!p.endsWith(".json")) {
    fs.mkdirSync(p, { recursive: true });
  }
});

function createWindow() {

  splash = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true, // Pastikan splash selalu paling depan
    resizable: false,
    center: true
  });
  splash.loadFile('splash.html');

  const win = new BrowserWindow({
    width: 1250,
    height: 700,
    minWidth: 1250,
    show: false,

    // maximizable: false,
    maximizable: true,
    minimizable: true,
    resizable: false,

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
      webviewTag: false,

      devTools: isDev
    },
  });
  win.setMenu(null);
  win.loadFile('index.html');

  // win.maximize();

  // win.webContents.openDevTools(); // aktifkan DevTools di sini
  mainWindow = win;

  // 3. LOGIKA TRANSISI: Tunggu loading selesai
  win.once('ready-to-show', () => {
    // Jalankan timer 2 detik
    setTimeout(() => {
      if (splash) {
        splash.close(); // Tutup splash dulu sampai hilang
      }
    }, 2000);
  });

  // 4. MUNCULKAN MAIN WINDOW HANYA SAAT SPLASH DITUTUP
  splash.on('closed', () => {
    mainWindow.maximize(); // Maximize sekarang
    mainWindow.show();     // Baru tampilkan
    mainWindow.focus();    // Pastikan di depan
  });
}

function convertSQLDateToFolderDate(date) {
  if (!date) return "";
  const parts = date.split("-");
  if (parts.length === 3) {
    // yyyy-mm-dd → dd-mm-yyyy
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return date;
}

// --- Helper: Safe folder delete (delete only if empty) ---
function deleteFolderIfEmpty(folderPath) {
  if (fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    if (files.length === 0) {
      fs.rmdirSync(folderPath);
      return true;
    }
  }
  return false;
}

ipcMain.handle("save-logo", async (event, file) => {
  // const iconsDir = path.join(__dirname, "icons");
  const iconsDir = PATHS.icons;
  // Pastikan folder icons ada
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir);
  }

  // lokasi akhir logo
  const savePath = path.join(iconsDir, file.name);

  // simpan file
  fs.writeFileSync(savePath, Buffer.from(file.data));

  return savePath; // dikirim balik ke renderer
});

ipcMain.handle("save-settings", async (event, data) => {
  const jsonPath = PATHS.settings;
<<<<<<< HEAD

  // 1. Baca data lama dulu (jika ada)
  let currentSettings = {};
  if (fs.existsSync(jsonPath)) {
    currentSettings = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  }

=======
  
  // 1. Baca data lama dulu (jika ada)
  let currentSettings = {};
  if (fs.existsSync(jsonPath)) {
    currentSettings = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  }

>>>>>>> e95d0c79ab3b3e0f8019bd52df8193ab85dfd2f8
  // 2. Timpa hanya data yang dikirim (Merge)
  const settings = {
    rs: data.rs !== undefined ? data.rs : currentSettings.rs,
    departmentsRs: data.departmentsRs !== undefined ? data.departmentsRs : currentSettings.departmentsRs,
    detailRs: data.detailRs !== undefined ? data.detailRs : currentSettings.detailRs,
    logoPath: data.logoPath !== undefined ? data.logoPath : currentSettings.logoPath
  };

  fs.writeFileSync(jsonPath, JSON.stringify(settings, null, 2));
  console.log("✅ Settings berhasil di-update:", settings);
  return true;
});

ipcMain.handle("get-full-path", (event, relativePath) => {
  return path.join(basePatientsFolder, relativePath);
});

ipcMain.handle("get-disk-usage", async () => {
  return new Promise((resolve, reject) => {
    const projectPath = app.getAppPath();
    let drive = path.parse(projectPath).root; // contoh "D:\\"
    drive = drive.replace(/\\$/, "").replace(":", ""); // => "D"

    const cmd = `powershell -Command "(Get-PSDrive '${drive}').Free; (Get-PSDrive '${drive}').Used; (Get-PSDrive '${drive}').Capacity"`;

    exec(cmd, (err, stdout) => {
      if (err) {
        console.error("ERR:", err);
        return reject(err);
      }

      // console.log("RAW OUT:\n", stdout);

      const nums = stdout
        .trim()
        .split(/\s+/)
        .map(n => Number(n));

      // console.log("PARSED:", nums);

      const [free, used] = nums;       // cuma 2 angka
      const total = free + used;       // hitung sendiri

      resolve({ free, used, total });
    });
  });
});

/**
 * Delete logic explanation:
 * - If ANY procedure is finished:
 *   → Patient identity is considered VALID
 *   → Only queued (pre-action) procedures may be deleted
 *
 * - If NO procedure is finished:
 *   → Patient is considered WRONG INPUT
 *   → All procedures + patient record are removed
 *
 * Context:
 * - This logic applies ONLY during initial patient registration phase
 * - Designed for procedural workstation (1–2 procedures max per patient/day)
 */

ipcMain.handle("delete-patient-or-procedures", (event, patientId) => {
  // Ambil semua procedures milik pasien ini
  const procedures = db.prepare(`
    SELECT * FROM procedures WHERE patient_id = ?
  `).all(patientId);

  // Cek apakah ada status=finish
  const hasFinish = procedures.some(p => p.status === "finish");

  if (hasFinish) {
    console.log("🟢 Ada procedure finish → hapus hanya queue");

    const stmt = db.prepare(`
      DELETE FROM procedures 
      WHERE patient_id = ? AND status = 'queue'
    `);

    stmt.run(patientId);

    return { type: "delete_queue_only" };
  }

  else {
    console.log("🔴 Tidak ada finish → hapus semua procedure + patient");

    db.prepare(`DELETE FROM procedures WHERE patient_id = ?`).run(patientId);
    db.prepare(`DELETE FROM patients WHERE patient_id = ?`).run(patientId);

    return { type: "delete_all" };
  }
});

ipcMain.handle('get-patients', () => {
  return db.prepare(`
    SELECT patient_id, mrn, name, age, sex
    FROM patients
    ORDER BY patient_id
  `).all();
});

// 🔍 AUTOCOMPLETE / SUGGEST DOCTOR
ipcMain.handle("suggest-doctors", (_, keyword) => {
  if (!keyword) return [];

  return db.prepare(`
    SELECT doctor_id, name
    FROM doctors
    WHERE name LIKE ?
    ORDER BY name
    LIMIT 10
  `).all(`%${keyword}%`);
});

// ➕ INSERT dokter baru (dipanggil saat save procedure)
ipcMain.handle("insert-doctor-if-not-exists", (_, name) => {
  if (!name) return;

  db.prepare(`
    INSERT OR IGNORE INTO doctors (name)
    VALUES (?)
  `).run(name);
});

// ❌ HAPUS dokter typo
ipcMain.handle("delete-doctor", (_, doctor_id) => {
  db.prepare(`
    DELETE FROM doctors
    WHERE doctor_id = ?
  `).run(doctor_id);
});

ipcMain.handle("search-patients", (event, query) => {
  const q = `%${query}%`;

  return db.prepare(`
    SELECT 
      patients.patient_id,
      patients.mrn,
      patients.name,
      patients.age,
      patients.sex,
      
      procedures.procedure_id,
      procedures.procedure,
      procedures.date_procedure,
      procedures.procedure_time,
      procedures.status,
      procedures.doctor_name,
      procedures.referring_doctor,
      procedures.class,
      procedures.bed,
      procedures.complaint,
      procedures.diagnose

    FROM patients
    LEFT JOIN procedures ON patients.patient_id = procedures.patient_id

    WHERE (patients.mrn LIKE ?
       OR LOWER(patients.name) LIKE LOWER(?))
      AND procedures.status = 'finish'

    ORDER BY procedures.procedure_id DESC
  `).all(q, q);
});

ipcMain.handle("get-procedure-by-id", async (event, procedureId) => {
  const stmt = db.prepare(`
    SELECT *
    FROM procedures
    WHERE procedure_id = ?
  `);

  const row = stmt.get(procedureId);

  return row || null;
});

// Tambah pasien baru
ipcMain.handle('add-patient', async (event, patient) => {
  try {
    // 1. Masukkan ke tabel patients
    const insertPatient = db.prepare(`
      INSERT INTO patients (mrn, name, date_of_birth, age, sex, address, city, telephone)
      VALUES (@mrn, @name, @date_of_birth, @age, @sex, @address, @city, @telephone)
    `);

    const patientInfo = insertPatient.run(patient);

    const patient_id = patientInfo.lastInsertRowid;

    // 2. Masukkan ke tabel procedures
    const insertProcedure = db.prepare(`
      INSERT INTO procedures (
        patient_id, procedure, doctor_name, date_procedure,
        referring_doctor, class, bed, complaint,
        diagnose, status
      )
      VALUES (
        @patient_id, @procedure, @doctor_name, @date_procedure,
        @referring_doctor, @class, @bed, @complaint,
        @diagnose, 'queue'
      )
    `);

    insertProcedure.run({
      ...patient,
      patient_id
    });

    return { success: true, patient_id };

  } catch (err) {
    console.error("❌ add-patient failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('add-procedure', async (event, procedure) => {
  try {
    const insertProcedure = db.prepare(`
      INSERT INTO procedures (
        patient_id, procedure, doctor_name, date_procedure,
        referring_doctor, class, bed, complaint,
        diagnose, status
      )
      VALUES (
        @patient_id, @procedure, @doctor_name, @date_procedure,
        @referring_doctor, @class, @bed, @complaint,
        @diagnose, @status
      )
    `);

    insertProcedure.run(procedure);

    return { success: true };
  } catch (err) {
    console.error("❌ add-procedure failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-patient-by-mrn", (event, mrn) => {
  return db.prepare("SELECT * FROM patients WHERE mrn = ?").get(mrn);
});

ipcMain.handle("get-patient-by-id", (event, patient_id) => {
  return db.prepare(`
    SELECT p.*, pr.*
    FROM patients p
    LEFT JOIN procedures pr ON pr.patient_id = p.patient_id
    WHERE p.patient_id = ?
  `).get(patient_id);
});

ipcMain.handle('get-procedures-by-patient-id', (event, patient_id) => {
  return db.prepare("SELECT * FROM procedures WHERE patient_id = ? ORDER BY date_procedure DESC")
    .all(patient_id);
});

ipcMain.handle("update-patient", async (event, patient) => {

  db.prepare(`
    UPDATE patients SET
      name=@name,
      age=@age,
      sex=@sex,
      date_of_birth=@date_of_birth,
      address=@address,
      city=@city,
      telephone=@telephone
    WHERE patient_id=@patient_id
  `).run(patient);

  db.prepare(`
    UPDATE procedures SET
      procedure=@procedure,
      doctor_name=@doctor_name,
      date_procedure=@date_procedure,
      referring_doctor=@referring_doctor,
      class=@class,
      bed=@bed,
      complaint=@complaint,
      diagnose=@diagnose,
      status='queue'
    WHERE procedure_id=@procedure_id
  `).run(patient);

  return { success: true };
});

ipcMain.handle('delete-patient-by-id', (event, id) => {
  const stmt = db.prepare('DELETE FROM patients WHERE patient_id = ?');
  stmt.run(id);
  return true;
});



ipcMain.handle("get-procedures-by-mrn", (event, mrn) => {
  return db.prepare(
    `SELECT p2.* 
     FROM procedures p2
     JOIN patients p1 ON p1.patient_id = p2.patient_id
     WHERE p1.mrn = ?
     ORDER BY p2.procedure_id ASC`
  ).all(mrn);
});

ipcMain.handle("delete-patient", async (event, patientId) => {

  // Hapus semua procedures milik patient
  db.prepare("DELETE FROM procedures WHERE patient_id = ?").run(patientId);

  // Hapus patient
  db.prepare("DELETE FROM patients WHERE patient_id = ?").run(patientId);

  return true;
});

ipcMain.handle("delete-procedure", async (event, procedureId) => {
  db.prepare("DELETE FROM procedures WHERE procedure_id = ?").run(procedureId);
  return true;
});

ipcMain.handle('suggest-examinations', (event, q) => {
  return db.prepare("SELECT * FROM examinations WHERE name LIKE ? LIMIT 10").all(`%${q}%`);
});

ipcMain.handle('insert-examination', (event, name) => {
  return db.prepare("INSERT OR IGNORE INTO examinations (name) VALUES (?)").run(name);
});

ipcMain.handle('delete-examination', (event, id) => {
  return db.prepare("DELETE FROM examinations WHERE examination_id = ?").run(id);
});

<<<<<<< HEAD
// ipcMain.handle("ensure-patient-folder", async (event, {
//   mrn,
//   procedure,
//   procedureDate,
//   procedureTime,
//   procedureId
// }) => {

//   console.log("📥 ensure-patient-folder PARAMETER:", {
//     mrn, procedure, procedureDate, procedureTime, procedureId
//   });

//   if (!mrn) throw new Error("MRN kosong!");
//   if (!procedure) throw new Error("Procedure kosong!");

//   // const projectRoot = path.join(__dirname, "patients");
//   const projectRoot = PATHS.patients;

//   const datePart =
//     procedureDate ||
//     new Date().toLocaleDateString("id-ID").replace(/\//g, "-");

//   const timePart =
//     procedureTime ||
//     new Date()
//       .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
//       .replace(":", ".");

//   // === Folder Structure ===
//   const patientDir = path.join(projectRoot, mrn.toString());
//   const dateDir = path.join(patientDir, datePart);
//   const procedureDir = path.join(dateDir, procedure);
//   const timeDir = path.join(procedureDir, timePart);

//   fs.mkdirSync(timeDir, { recursive: true });

//   // === SAVE TIME TO DATABASE ===
//   if (procedureId) {
//     db.prepare(`
//       UPDATE procedures 
//       SET procedure_time = ? 
//       WHERE procedure_id = ?
//     `).run(timePart, procedureId);

//     console.log("💾 Saved procedure_time:", timePart);
//   } else {
//     console.warn("⚠ procedureId tidak dikirim → waktu TIDAK disimpan!");
//   }

//   // 🔥 INI WAJIB: return sebagai object
//   return { folderPath: timeDir };
// });

=======
>>>>>>> e95d0c79ab3b3e0f8019bd52df8193ab85dfd2f8
ipcMain.handle("ensure-patient-folder", async (event, {
  mrn,
  procedure,
  procedureId
}) => {

  if (!mrn) throw new Error("MRN kosong!");
  if (!procedure) throw new Error("Procedure kosong!");
  if (!procedureId) throw new Error("procedureId wajib!");

  const projectRoot = PATHS.patients;

  // === ambil dari DB (SOURCE OF TRUTH) ===
  const row = db.prepare(`
    SELECT procedure_time, date_procedure
    FROM procedures
    WHERE procedure_id = ?
  `).get(procedureId);

  if (!row) throw new Error("Procedure tidak ditemukan!");

  let datePartSQL = row.date_procedure;
  let timePart = row.procedure_time;

  const datePart = convertSQLDateToFolderDate(datePartSQL);

  // === SET SEKALI SAJA ===
  if (!timePart) {
    timePart = new Date()
      .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      .replace(":", ".");

    db.prepare(`
      UPDATE procedures
      SET procedure_time = ?
      WHERE procedure_id = ?
    `).run(timePart, procedureId);
  }

  // === Folder Structure ===
  const patientDir = path.join(projectRoot, mrn.toString());
  const dateDir = path.join(patientDir, datePart);
  const procedureDir = path.join(dateDir, procedure);
  const timeDir = path.join(procedureDir, timePart);

  fs.mkdirSync(timeDir, { recursive: true });

  return { folderPath: timeDir };
});

ipcMain.handle("save-file-to-folder", async (event, { folderPath, fileName, data, type }) => {
  let actualFolder;

  if (path.isAbsolute(folderPath)) {
    actualFolder = folderPath;
  } else {
    // const basePatientsFolder = path.join(__dirname, "patients");
    const basePatientsFolder = PATHS.patients;
    actualFolder = path.join(basePatientsFolder, folderPath);
  }

  if (!fs.existsSync(actualFolder)) {
    fs.mkdirSync(actualFolder, { recursive: true });
  }

  const fullPath = path.join(actualFolder, fileName);

  if (type === "base64") {
    fs.writeFileSync(fullPath, data, "base64");
  } else if (type === "uint8" || type === "arraybuffer") {
    // Jika data sudah Uint8Array, pakai langsung
    const buffer = data instanceof Uint8Array ? Buffer.from(data) : Buffer.from(new Uint8Array(data));
    fs.writeFileSync(fullPath, buffer);
  } else {
    // fallback: anggap string biasa
    fs.writeFileSync(fullPath, data);
  }

  return fullPath;
});

ipcMain.handle("update-patient-status", (event, { procedure_id, status }) => {
  db.prepare("UPDATE procedures SET status=? WHERE procedure_id=?")
    .run(status, procedure_id);
  return true;
});


ipcMain.handle("read-folder", async (event, folderPath) => {
  try {
    const files = fs.readdirSync(folderPath)
      .map(name => path.join(folderPath, name));
    return files;
  } catch (err) {
    console.error("Gagal membaca folder:", err);
    return [];
  }
});

ipcMain.handle("check-pdf-status", async (event, r) => {
  const rootPatients = PATHS.patients;
  const mrn = r.mrn.toString();
  const date = convertSQLDateToFolderDate(r.date_procedure);
  const time = r.procedure_time;
<<<<<<< HEAD

=======
  
>>>>>>> e95d0c79ab3b3e0f8019bd52df8193ab85dfd2f8
  let hasPdf = false;
  let folderKey = "";

  if (time) {
    folderKey = `${mrn}/${date}/${r.procedure}/${time}`;
    const absFolder = path.join(rootPatients, folderKey);

    if (fs.existsSync(absFolder)) {
      const files = fs.readdirSync(absFolder);
      hasPdf = files.some(f => f.toLowerCase().endsWith(".pdf"));
    }
  }

  return { hasPdf, folderKey };
});

ipcMain.handle("get-reports", () => {
  // const rootPatients = path.join(__dirname, "patients");
  const rootPatients = PATHS.patients;

  const rows = db.prepare(`
    SELECT 
      pr.procedure_id,
      pr.procedure,
      pr.date_procedure,
      pr.procedure_time,
      p.mrn,
      p.name
    FROM procedures pr
    JOIN patients p ON p.patient_id = pr.patient_id
    WHERE pr.status = 'finish'
    ORDER BY pr.procedure_id DESC
  `).all();

  const results = [];

  rows.forEach(r => {
    const mrn = r.mrn.toString();
    const date = convertSQLDateToFolderDate(r.date_procedure);
    const time = r.procedure_time;     // 🔥 pakai waktu yang valid dari DB

    let hasPdf = false;
    let folderKey = "";

    if (time) {
      folderKey = `${mrn}/${date}/${r.procedure}/${time}`;

      const absFolder = path.join(rootPatients, folderKey);

      if (fs.existsSync(absFolder)) {
        const files = fs.readdirSync(absFolder);
        hasPdf = files.some(f => f.toLowerCase().endsWith(".pdf"));
      }
    }

    results.push({
      id: r.procedure_id,
      mrnName: `${mrn}-${r.name}`,
      procedure: r.procedure,
      date: date,
      time: time || "-",
      hasPdf,
      folderPath: folderKey
    });
  });

  return results;
});

ipcMain.handle("get-folder-files", (event, relativePath) => {
  // const rootPatients = path.join(__dirname, "patients");
  const rootPatients = PATHS.patients;

  const fullPath = path.join(rootPatients, relativePath);
  console.log("📁 Baca folder:", fullPath);

  if (!fs.existsSync(fullPath)) return [];

  const entries = fs.readdirSync(fullPath);

  return entries.map(name => {
    const filePath = path.join(fullPath, name);
    const stat = fs.statSync(filePath);

    return {
      name,
      type: stat.isDirectory() ? "folder" : "file",
      ext: path.extname(name).toLowerCase(),
      path: filePath
    };
  });
});

ipcMain.handle("set-current-folder", (_, folder) => {
  global.currentReportFolder = folder;
});

ipcMain.handle("get-report-patient", (event, mrn) => {
  try {
    const stmt = db.prepare(`SELECT * FROM patients WHERE mrn = ?`);
    const row = stmt.get(mrn);

    return row || null;

  } catch (err) {
    console.error("❌ get-report-patient error:", err);
    return null;
  }
});

ipcMain.handle("get-full-report-data", (event, procedure_id) => {
  return db.prepare(`
    SELECT 
      p.*,
      pr.procedure,
      pr.doctor_name,
      pr.date_procedure,
      pr.procedure_time,
      pr.referring_doctor,
      pr.class,
      pr.bed,
      pr.complaint,
      pr.diagnose
    FROM procedures pr
    JOIN patients p ON p.patient_id = pr.patient_id
    WHERE pr.procedure_id = ?
  `).get(procedure_id);
});

ipcMain.handle("update-patient-data", (event, data) => {
  const fields = [
    "mrn",
    "name",
    "date_of_birth",
    "age",
    "sex",
    "address",
    "city",
    "telephone"
  ];

  const setClause = fields.map(f => `${f} = ?`).join(", ");

  const stmt = db.prepare(`
    UPDATE patients 
    SET ${setClause}
    WHERE patient_id = ?
  `);

  const values = fields.map(f => data[f]);
  values.push(data.patient_id);

  return stmt.run(values);
});

ipcMain.handle("delete-folder", async (event, fullPath) => {
  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error("❌ Gagal delete folder:", err);
    return false;
  }
});





// Delete the latest procedure for a given patient_id and remove its folder
ipcMain.handle("delete-just-procedure", async (event, patient_id) => {
  if (!patient_id) throw new Error("patient_id kosong!");

  // ambil prosedur terakhir untuk patient_id
  const stmt = db.prepare(`
    SELECT * FROM procedures WHERE patient_id = ? ORDER BY procedure_id DESC LIMIT 1
  `);
  const proc = stmt.get(patient_id);

  if (!proc) return { success: false, message: 'procedure not found' };

  // ambil mrn pasien
  const p = db.prepare(`SELECT mrn FROM patients WHERE patient_id = ?`).get(proc.patient_id);
  const mrn = p ? p.mrn.toString() : null;

  const folderDate = convertSQLDateToFolderDate(proc.date_procedure);

  const deepestFolder = path.join(
    basePatientsFolder,
    mrn || String(proc.patient_id),
    folderDate,
    proc.procedure,
    proc.procedure_time || ""
  );

  try {
    if (fs.existsSync(deepestFolder)) {
      fs.rmSync(deepestFolder, { recursive: true, force: true });
    }

    const procedureFolder = path.join(basePatientsFolder, mrn || String(proc.patient_id), folderDate, proc.procedure);
    deleteFolderIfEmpty(procedureFolder);

    const dateFolder = path.join(basePatientsFolder, mrn || String(proc.patient_id), folderDate);
    deleteFolderIfEmpty(dateFolder);

    const mrnFolder = path.join(basePatientsFolder, mrn || String(proc.patient_id));
    deleteFolderIfEmpty(mrnFolder);

    // delete from database
    db.prepare(`DELETE FROM procedures WHERE procedure_id = ?`).run(proc.procedure_id);

    return { success: true };
  } catch (err) {
    console.error('❌ delete-just-procedure failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-settings", async () => {
  const settingsPath = PATHS.settings;

  if (!fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (e) {
    console.error("Error parsing settings:", e);
    return null;
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
