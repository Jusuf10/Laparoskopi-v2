# Laparoskopi V2 - Application Documentation

## 1. Overview
**Laparoskopi V2** is a desktop application designed for medical practitioners to record, manage, and report on laparoscopy procedures. Built with Electron, it interfaces with video capture devices (like endoscopes or capture cards) to snap photos and record videos during surgeries, organizing them by patient and procedure for easy reporting.

## 2. Technical Architecture
*   **Platform**: Electron (Windows).
*   **Backend**: Node.js (Main Process) with `better-sqlite3` for data persistence and `fs` for file management.
*   **Frontend**: HTML/CSS (Bootstrap 5) + Vanilla JavaScript (Renderer Process).
*   **Database**: SQLite (`patients.db`).
*   **File Storage**: Local file system structure under `patients/` directory.

## 3. Key Features

### A. Patient Management
*   **Registration**: Add new patients with MRN (Medical Record Number), Name, DOB, Age, Sex, Address, etc.
*   **Search**: Real-time search by Name or MRN.
*   **History**: View past procedures for a patient.
*   **CRUD**: Edit patient details or delete records (with safety checks for existing procedures).

### B. Procedure Session (The "Procedure" Tab)
*   **Workflow**:
    1.  Select a patient from the "Patients Data" list.
    2.  Navigate to the "Procedure" tab.
    3.  Confirm patient details.
    4.  **Start Procedure**: This creates a structured session folder.
*   **Media Capture**:
    *   **Live View**: Displays feed from selected video input device.
    *   **Capture Image**: Saves high-resolution snapshots to the session folder.
    *   **Record Video**: Records `.webm` video clips.
*   **Session Management**:
    *   Prevents tab switching during active procedures to ensure data integrity.
    *   "Finish Procedure" locks the session and marks the procedure status as `finish`.

### C. Reporting & Data (The "Data" Tab)
*   **Reports List**: Displays all finished procedures.
*   **Gallery**: View captured images and videos for a specific procedure.
*   **PDF Generation**:
    *   Select captured images to include.
    *   Generates a PDF report with the Hospital Letterhead (Kop Surat).
    *   Features a "Drag and Drop" interface (left-to-right) to select photos for the report.
*   **Settings**: Configure Hospital Name, Address, and Logo for the report header.

## 4. Data Structure

### Database Schema (`patients.db`)
*   **`patients` Table**: Stores demographic data (`mrn`, `name`, `age`, `sex`, etc.).
*   **`procedures` Table**: Stores procedure details (`procedure`, `doctor_name`, `date_procedure`, `status`). Linked to `patients` via `patient_id`.
    *   `status`: 'queue' (scheduled/in-progress) or 'finish' (completed).

### File System hierarchy
Medical data is stored locally in a rigorous hierarchy to ensure order:
```
patients/
└── [MRN]/
    └── [Date (DD-MM-YYYY)]/
        └── [Procedure Name]/
            └── [Time (HH.MM)]/  <-- Session Folder
                ├── capture_123456789.jpg
                ├── record_123456789.webm
                └── ...
```

## 5. User Workflow Guide

### Step 1: Patient Entry
1.  Go to **Patients Data** tab.
2.  Fill in the "New Patient" form (MRN, Name, Procedure Plan, etc.).
3.  Click **Add Queue**.
4.  The patient appears in the table below.

### Step 2: Start Procedure
1.  Click on a patient row in the table.
2.  The **Procedure** tab becomes accessible (or click the tab manually).
3.  Click **Start Procedure / Konfirmasi**.
4.  The system creates the folder structure.
5.  Select the correct Camera Source from the dropdown if not auto-detected.

### Step 3: Intra-Operative
1.  **Snap**: Click "Camera" icon or button to take photos.
2.  **Record**: Click "Record" button to start/stop video.
3.  **Finish**: When done, click **Finish Procedure**. Confirm the prompt.

### Step 4: Post-Operative Reporting
1.  Go to **Data** tab.
2.  Find the procedure in the list.
3.  **View Media**: Click the folder icon/button to see files.
4.  **Create Report**: Click the "PDF" icon or "Create Report".
    *   On the create page, you see all photos on the LEFT.
    *   Click photos to move them to the RIGHT (Selected).
    *   Click "Print / Save PDF" to generate the final document.
