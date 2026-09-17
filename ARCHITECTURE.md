# RPSMAS System Architecture

## Architecture Overview

RPSMAS follows a modular, decoupled full-stack architecture built with Next.js App Router and PostgreSQL (Supabase).

```
+-------------------------------------------------------------+
|                      Next.js Frontend                       |
|   (App Router / Tailwind CSS / React Server & Client Components) |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                   Business Logic Layer                      |
| (ParkingService / TagDocGenerator / SeedParser / PMSService) |
+------------------------------+------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                     Supabase Backend                        |
|    (PostgreSQL Database / Row Level Security / Storage)     |
+-------------------------------------------------------------+
```

## Modular Service Breakdown

- **`ParkingService`**: Enforces strict database transaction consistency between Assignments, Parking Lots, Tags, and BOB Requests.
- **`PMSService`**: Abstracted service interface (`src/services/pms/index.ts`) ensuring zero hard dependency on third-party DTeck PMS databases.
- **`generateTagDoc`**: Programmatic DOCX generator for vehicle number-plate physical signboards.
- **`importData`**: Parser & validator for legacy tab-separated Excel records.
