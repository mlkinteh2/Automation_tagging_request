# RPSMAS User Guide

## Administrator Workflow Guide

### 1. Assigning New Reserved Parking
1. Navigate to **Parking Management > Parking Layout** or click **+ Assign Parking**.
2. Select the Parker and registered vehicle plate.
3. Select an **AVAILABLE** reserved parking lot (filtered by Floor).
4. Click **Confirm Assignment**.
   - System creates assignment record.
   - Lot status changes to `OCCUPIED`.
   - BOB installation request `ADD-YYYY-NNNN` is created automatically.
   - Vehicle number-plate Word document (`.docx`) is generated.

### 2. Cancelling Reserved Parking
1. Open an active assignment detail view.
2. Click **Cancel Reserved Parking**.
3. Confirm in the dialog.
   - Assignment status changes to `CANCELLED`.
   - BOB removal request `REM-YYYY-NNNN` is created.
   - **NO** removal Word document is generated.
   - Lot status changes to `PENDING_REMOVAL`.
   - Lot becomes `AVAILABLE` **only** after BOB confirms removal.

---

## BOB Field Operations Guide

1. Switch role to **BOB (Field Ops)** or log in with BOB credentials.
2. Open **My Tasks / BOB Requests**.
3. For **INSTALLATION** tasks (`ADD-YYYY-NNNN`):
   - Download the Number Plate Word document (`.docx`).
   - Print the number plate and physically install the signboard at the assigned lot.
   - Click **Confirm Installation Completed**.
4. For **REMOVAL** tasks (`REM-YYYY-NNNN`):
   - Locate lot number.
   - Physically remove existing signboard tag.
   - Click **Confirm Removal Completed**.
