# RPSMAS Database Architecture & Schema

## Entity Relationship Model

```
Company (1) ---> (*) Parker (1) ---> (*) Vehicle
                      |
                      v
             Parking Assignment (1) ---> (1) Parking Lot
                      |
                      v
                   Tag (1) ---> (1) BOB Request ---> (0..1) Document
```

## Core Tables & Normalization

1. **`users`**: Managed roles (`ADMINISTRATOR`, `SUPERVISOR`, `BOB`).
2. **`companies`**: Corporate accounts allocated parking blocks.
3. **`parkers`**: Individuals linked to `companies.id`.
4. **`vehicles`**: 1:N relationship per parker. **No comma-separated plate strings allowed**.
5. **`facilities` & `floors`**: Hierarchical location catalog (GF, P1, P2, P3).
6. **`parking_lots`**: Lot status control (`AVAILABLE`, `OCCUPIED`, `PENDING_INSTALLATION`, `PENDING_REMOVAL`, `MAINTENANCE`).
7. **`parking_assignments`**: Active and historical assignment records.
8. **`tags`**: Physical signboard status (`INSTALLATION_PENDING`, `INSTALLED`, `REMOVAL_PENDING`, `REMOVED`).
9. **`bob_requests`**: Field task tickets with request numbers `ADD-YYYY-NNNN` and `REM-YYYY-NNNN`.
10. **`documents`**: Metadata for generated number plate `.docx` files.
11. **`activity_logs`**: Immutable security audit trail.
