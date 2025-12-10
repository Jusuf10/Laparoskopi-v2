# Testing Scenarios for Laparoskopi V2

## Test Environment Setup
1.  **Backup**: Copy `patients.db` and the `patients/` folder to a safe location before testing.
2.  **Clean State (Optional)**: Delete `patients.db` (it will be recreated) and empty `patients/` folder to test from scratch.
3.  **Hardware**: Ensure a webcam or video capture device is connected.

---

## Scenario 1: The "Happy Path" (standard workflow)
**Goal**: Verify the complete lifecycle of a patient procedure.

### Steps:
1.  **Launch App**: Open the application.
2.  **Add Patient**:
    *   Navigate to **Patients Data**.
    *   Enter:
        *   MRN: `TEST-001`
        *   Name: `John Doe`
        *   Age: `30`
        *   Procedure: `Appendectomy`
        *   Doctor: `Dr. Smith`
    *   Click **Add Queue**.
    *   *Check*: Patient appears in the table.
3.  **Start Procedure**:
    *   Click the row for `John Doe`.
    *   Switch to **Procedure** tab (or confirm prompt).
    *   Click **Start Procedure / Konfirmasi**.
    *   *Check*: Camera feed appears. Folder `patients/TEST-001/[Date]/Appendectomy/[Time]` is created.
4.  **Capture Media**:
    *   Click **Capture Photo** (3 times).
    *   Click **Record Video** -> Wait 5 seconds -> Click **Stop**.
    *   *Check*: Notifications "Saved" appear. Files exist in the folder.
5.  **Finish**:
    *   Click **Finish Procedure**.
    *   Confirm "Yes".
    *   *Check*: App redirects to "Data" (Reports) tab. Input controls are disabled/reset.
6.  **Verify Report**:
    *   In **Data** tab, find `John Doe`.
    *   Click **Create Report** (PDF icon).
    *   Select 2 photos.
    *   Click **Print / PDF**.
    *   *Check*: PDF is generated with the selected photos.

---

## Scenario 2: Data Integrity & Persistence
**Goal**: Ensure data survives app restarts and incorrect operations.

### Steps:
1.  **Restart App**: Close and reopen the app after Scenario 1.
2.  **Verify Data**:
    *   Go to **Data** tab.
    *   Check if `John Doe` is still there.
    *   Click the folder icon -> Verify photos/videos are loadable.
3.  **Search**:
    *   Type `John` in the search bar.
    *   *Check*: The record filters correctly.
    *   Type `TEST-001`.
    *   *Check*: The record filters correctly.

---

## Scenario 3: Folder Structure Handling
**Goal**: Verify that the file system hierarchy respects the logic.

### Steps:
1.  **Same Patient, New Procedure**:
    *   Go to **Patients Data**.
    *   Add `John Doe` (MRN: `TEST-001`) again but with Procedure: `Cholecystectomy`.
    *   Start Procedure.
    *   *Check*: A NEW folder is created under `patients/TEST-001/[Date]/Cholecystectomy/`.
    *   It should NOT overwrite the previous `Appendectomy` folder.

---

## Scenario 4: Error Handling & Edge Cases
**Goal**: Ensure the app doesn't crash under stress.

### Steps:
1.  **No Camera**:
    *   Disconnect camera (if possible) or block permission.
    *   Start Procedure.
    *   *Check*: App shows error alert "Camera not found" but does not white-screen crash.
2.  **Empty Input**:
    *   Try to Add Patient without MRN or Name.
    *   *Check*: Validation prevents submission or DB error is handled gracefully.
3.  **Delete Active Data**:
    *   Go to **Data** tab.
    *   Delete the report for `John Doe`.
    *   *Check*: The row disappears. The files in `patients/TEST-001/...` are deleted (if "Delete All" was selected).
