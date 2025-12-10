# Comprehensive Bug Report for Laparoskopi V2

After a detailed analysis of the codebase, I have identified several Critical, High, and Medium severity bugs.

## 🔴 CRITICAL SEVERITY
**These bugs will cause the application to crash or fail completely in a production environment.**

### 1. Missing `procedures` Table in Database Schema
*   **Location**: `database.js`
*   **The Bug**: The file only creates the `patients` table. However, `main.js` relies heavily on a `procedures` table to store procedure details, timestamps, and status (`db.prepare('INSERT INTO procedures ...')`).
*   **Consequence**: If `patients.db` is deleted or the app is installed on a new machine, **the application will crash immediately** upon trying to add a patient or start a procedure (`BSQLITE_ERROR: no such table: procedures`).
*   **Fix**: Add the `CREATE TABLE IF NOT EXISTS procedures (...)` statement to `database.js`.

### 2. Writing to Read-Only Path (ASAR Violation)
*   **Location**: `main.js` (Lines 7, 77, 467, etc.)
*   **The Bug**: The app writes user data (photos, videos, settings, database) specifically to `path.join(__dirname, "patients")` and `path.join(__dirname, "file.json")`.
*   **Consequence**: When the app is packaged (e.g., `.exe`), `__dirname` points inside the `app.asar` archive, which is **read-only**.
    *   **Result**: The app will fail to save ANY photos, videos, or settings in the packaged version. It will likely throw an `EACCES` or `EROFS` error.
*   **Fix**: Change the storage path to `app.getPath("userData")` (e.g., `C:\Users\Name\AppData\Roaming\AppName\`).

## 🟠 HIGH SEVERITY
**These bugs result in data loss or significant logic failures.**

### 3. Orphaned Media / "New Folder" Logic Flaw
*   **Location**: `main.js` (IPC `ensure-patient-folder`) & `renderer.js` (`startProcedureSession`)
*   **The Bug**:
    *   `ensure-patient-folder` creates a new folder based on the *current time* (e.g., `14.30`) and **updates the `procedures` table** with this new time.
    *   `startProcedureSession` is called lazily (e.g., when you click Capture).
    *   **Scenario**:
        1.  User starts procedure at 14:00. Takes a photo. Folder `14.00` created. DB records `14.00`.
        2.  User closes app or restarts procedure at 15:00.
        3.  User takes another photo. Folder `15.00` is created. DB updates `procedure_time` to `15.00`.
*   **Consequence**: The database now only knows about folder `15.00`. The photos in folder `14.00` are **orphaned**. When the user generates a report, **only the new photos are visible**. The old photos are effectively lost to the user interface.
*   **Fix**: Only set `procedure_time` ONCE when the procedure is first created or explicitly started, not every time a folder check is made. Or, check if `procedure_time` is already set in DB before overwriting.

## 🟡 MEDIUM SEVERITY
**These bugs affect performance or user experience.**

### 4. Memory Leak / Event Listener Accumulation
*   **Location**: `renderer.js` (`renderReportsTable` function)
*   **The Bug**: Inside `renderReportsTable`, you execute `document.addEventListener("click", ...)` for the buttons `.btn-open`, `.pdf-create`, etc.
*   **Consequence**: Every time the user clicks the "Data" tab, `renderReportsTable` runs again, adding **another duplicate copy** of these event listeners.
    *   **Result**: If a user switches tabs 10 times, clicking "Delete" once will trigger the delete popup 10 times. This causes performance degradation and erratic UI behavior (multiple modals opening).
*   **Fix**: Move these event listeners **outside** the function (to the top level of `renderer.js`) or use named functions and `removeEventListener`.

### 5. Inconsistent Patient Deletion Logic
*   **Location**: `main.js` (IPC `delete-patient-or-procedures`)
*   **The Bug**:
    *   The logic checks `if (hasFinish)`.
    *   If `true` (patient has a past record): It deletes `queue` items but **keeps the patient**.
    *   If `false`: It deletes **ALL procedures and the patient**.
*   **Consequence**:
    *   If I have a patient with 1 finished result and 1 queued result, and I try to delete the queue, it works.
    *   If I have a patient with 0 finished results and 2 queued results (maybe duplicates), deleting one might delete **the entire patient record** and the other queued item unexpectedly.
*   **Fix**: Clarify the intended behavior. Deleting a procedure should likely never implicitly delete the patient record unless explicitly requested ("Delete Patient").

## 🟢 LOW SEVERITY / CODE SMELLS

### 6. Synchronous IPC Blocking
*   **Location**: `ipcMain.handle` often calls `db.prepare(...).run()`.
*   **The Bug**: `better-sqlite3` is synchronous. While fast, running heavy queries or file system operations (like `fs.readdirSync` on large folders) on the main thread blocks the entire UI renderer for that duration.
*   **Fix**: Use `fs.promises` or `async` versions for file operations. (SQLite sync is usually acceptable for local desktop apps, but file I/O should be async).

### 7. Security Risk with `loadHTML`
*   **Location**: `preload.js` -> `loadHTML`
*   **The Bug**: It accepts a `relativePath` and reads it with `fs.readFileSync`.
*   **Consequence**: A malicious script (if injected) could potentially read any file the user has access to by passing `../../../../secret.txt`.
*   **Fix**: Sanitize inputs or use a predefined map of allowed view files.

---

### **Recommended Immediate Actions**
1.  **Stop writing to `__dirname`**. This is the most urgent fix for production.
2.  **Add the `procedures` table SQL** to `database.js`.
3.  **Refactor the Event Listeners** in `renderer.js` to prevent memory leaks.
