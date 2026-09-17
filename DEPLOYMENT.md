# RPSMAS Deployment Guide

## Production Deployment Checklist

### 1. Database Deployment (Supabase)
1. Log in to [Supabase Dashboard](https://supabase.com/).
2. Create a new PostgreSQL project.
3. Open **SQL Editor** and run the contents of [`schema.sql`](file:///d:/Projects/Automation_tagging_request/schema.sql).
4. Under **Storage**, create buckets:
   - `installation-documents` (Private)
   - `completion-evidence` (Private)

### 2. Frontend Deployment (Vercel)
1. Push project repository to GitHub.
2. Import project into Vercel Dashboard.
3. Add Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Click **Deploy**.
