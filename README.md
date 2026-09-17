# RPSMAS - Reserved Parking & Signboard Management System

RPSMAS is a production-ready enterprise web application built for smart parking operations to automate reserved parking assignments, cancellations, lot availability tracking, and physical tag/signboard workflows with BOB (the field installation team).

---

## Key Features

- **Automated BOB Workflow**: Assigning reserved parking automatically creates installation requests (`ADD-YYYY-NNNN`), generates vehicle number-plate Word (`.docx`) documents, and updates lot status.
- **Strict Cancellation Flow**: Cancelling an assignment creates a removal request (`REM-YYYY-NNNN`) without generating DOCX files. The lot remains `PENDING_REMOVAL` until BOB confirms physical tag removal, ensuring data consistency.
- **Normalization Rule**: Supports multiple vehicle number plates per parker (e.g. `JTF5279`, `JWW1076`, `VET3052`) without storing comma-separated strings in database fields.
- **Role-Based Access Control**:
  - **Administrator / Supervisor**: Complete management of Parkers, Companies, Vehicles, Lots, Layouts, Reports, and Data Imports.
  - **BOB (Field Ops)**: Mobile-optimized dashboard to view pending task locations, download signboard `.docx` tags, and confirm physical completion.
- **Independent Database Architecture**: Operates independently with PostgreSQL / Supabase, decoupling RPSMAS from third-party PMS databases (e.g. DTeck PMS).

---

## Technology Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS
- **Document Generation**: `docx` package for programmatic Word tag creation
- **Backend & Database**: PostgreSQL, Supabase Auth, Supabase Storage
- **Deployment**: Vercel & Supabase Cloud

---

## Getting Started

### 1. Environment Setup
Copy `.env.example` to `.env.local` and add your Supabase credentials:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2. Database Setup
Run the SQL script provided in [`schema.sql`](file:///d:/Projects/Automation_tagging_request/schema.sql) inside your Supabase SQL Editor.

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Documentation Links

- [Database Architecture (`DATABASE.md`)](file:///d:/Projects/Automation_tagging_request/DATABASE.md)
- [System Architecture (`ARCHITECTURE.md`)](file:///d:/Projects/Automation_tagging_request/ARCHITECTURE.md)
- [Deployment Guide (`DEPLOYMENT.md`)](file:///d:/Projects/Automation_tagging_request/DEPLOYMENT.md)
- [User Guide (`USER_GUIDE.md`)](file:///d:/Projects/Automation_tagging_request/USER_GUIDE.md)
