-- RPSMAS (Reserved Parking & Signboard Management System) Database Schema
-- Run this script in your Supabase SQL Editor.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENUM / CONSTRAINT DEFINITIONS (handled via TEXT with CHECK constraints for maximum compatibility)

-- USERS TABLE (Linked to Supabase Auth or standalone user management)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id UUID UNIQUE, -- References auth.users(id) if using Supabase Auth
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMINISTRATOR', 'SUPERVISOR', 'BOB')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. COMPANIES TABLE
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_code VARCHAR(50) UNIQUE,
    name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PARKERS TABLE
CREATE TABLE IF NOT EXISTS public.parkers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    contact_number VARCHAR(50),
    email VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. VEHICLES TABLE (1:N relationship per parker - MANDATORY NORMALIZATION RULE)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parker_id UUID NOT NULL REFERENCES public.parkers(id) ON DELETE CASCADE,
    plate_number VARCHAR(50) NOT NULL UNIQUE,
    vehicle_type VARCHAR(50) DEFAULT 'CAR',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. FACILITIES TABLE
CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. FLOORS TABLE
CREATE TABLE IF NOT EXISTS public.floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    floor_code VARCHAR(50) NOT NULL, -- e.g. GF, P1, P2, P3
    floor_name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(facility_id, floor_code)
);

-- 7. PARKING LOTS TABLE
CREATE TABLE IF NOT EXISTS public.parking_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID NOT NULL REFERENCES public.floors(id) ON DELETE CASCADE,
    lot_number VARCHAR(50) NOT NULL CHECK (lot_number ~ '^[0-9]+[A-Za-z]?$'), -- e.g. 1, 2, 13, 41A (blocks vehicle plates stored as lots)
    allocation_type VARCHAR(50) DEFAULT 'RESERVED' CHECK (allocation_type IN ('RESERVED', 'VISITOR', 'UNALLOCATED', 'SEASON')),
    allocated_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'PENDING_INSTALLATION', 'PENDING_REMOVAL', 'MAINTENANCE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(floor_id, lot_number)
);

-- 8. PARKING ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.parking_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parker_id UUID NOT NULL REFERENCES public.parkers(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    parking_lot_id UUID NOT NULL REFERENCES public.parking_lots(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'TRANSFERRED', 'EXPIRED', 'PENDING')),
    cancellation_reason TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TAGS TABLE
CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.parking_assignments(id) ON DELETE CASCADE,
    tag_status VARCHAR(50) NOT NULL DEFAULT 'INSTALLATION_PENDING' CHECK (tag_status IN ('INSTALLATION_PENDING', 'INSTALLED', 'REMOVAL_PENDING', 'REMOVED')),
    installed_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. BOB REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.bob_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_number VARCHAR(100) NOT NULL UNIQUE, -- e.g. ADD-2026-0001 or REM-2026-0001
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('INSTALLATION', 'REMOVAL')),
    assignment_id UUID NOT NULL REFERENCES public.parking_assignments(id) ON DELETE CASCADE,
    parking_lot_id UUID NOT NULL REFERENCES public.parking_lots(id) ON DELETE RESTRICT,
    vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
    completion_notes TEXT,
    evidence_photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES public.bob_requests(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL DEFAULT 'NUMBER_PLATE',
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    description TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_parkers_company ON public.parkers(company_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_parker ON public.vehicles(parker_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_plate ON public.vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_parking_lots_floor ON public.parking_lots(floor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_lot ON public.parking_assignments(parking_lot_id);
CREATE INDEX IF NOT EXISTS idx_assignments_parker ON public.parking_assignments(parker_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.parking_assignments(status);
CREATE INDEX IF NOT EXISTS idx_bob_requests_status ON public.bob_requests(status);
CREATE INDEX IF NOT EXISTS idx_bob_requests_req_num ON public.bob_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- DATA-INTEGRITY MIGRATION (run once on existing databases):
-- Enforce valid lot numbers at DB level. Existing corrupt rows must be repaired first.
ALTER TABLE public.parking_lots DROP CONSTRAINT IF EXISTS parking_lots_lot_number_valid;
ALTER TABLE public.parking_lots ADD CONSTRAINT parking_lots_lot_number_valid CHECK (lot_number ~ '^[0-9]+[A-Za-z]?$');

-- RLS (ROW LEVEL SECURITY) ENABLEMENT (Can be configured per role)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parkers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parking_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bob_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous & authenticated access for dev (you can refine RLS policies later in production)
CREATE POLICY "Public Read Access" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.parkers FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.vehicles FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.facilities FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.floors FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.parking_lots FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.parking_assignments FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.tags FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.bob_requests FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.activity_logs FOR SELECT USING (true);
CREATE POLICY "Public Read Access" ON public.notifications FOR SELECT USING (true);

-- Allow full permissions for service/anon during development
CREATE POLICY "Public Write Access Users" ON public.users FOR ALL USING (true);
CREATE POLICY "Public Write Access Companies" ON public.companies FOR ALL USING (true);
CREATE POLICY "Public Write Access Parkers" ON public.parkers FOR ALL USING (true);
CREATE POLICY "Public Write Access Vehicles" ON public.vehicles FOR ALL USING (true);
CREATE POLICY "Public Write Access Facilities" ON public.facilities FOR ALL USING (true);
CREATE POLICY "Public Write Access Floors" ON public.floors FOR ALL USING (true);
CREATE POLICY "Public Write Access Parking Lots" ON public.parking_lots FOR ALL USING (true);
CREATE POLICY "Public Write Access Assignments" ON public.parking_assignments FOR ALL USING (true);
CREATE POLICY "Public Write Access Tags" ON public.tags FOR ALL USING (true);
CREATE POLICY "Public Write Access BOB Requests" ON public.bob_requests FOR ALL USING (true);
CREATE POLICY "Public Write Access Documents" ON public.documents FOR ALL USING (true);
CREATE POLICY "Public Write Access Activity Logs" ON public.activity_logs FOR ALL USING (true);
CREATE POLICY "Public Write Access Notifications" ON public.notifications FOR ALL USING (true);
