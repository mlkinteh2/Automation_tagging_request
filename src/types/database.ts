export type UserRole = 'ADMINISTRATOR' | 'SUPERVISOR' | 'BOB';
export type UserStatus = 'ACTIVE' | 'INACTIVE';

export interface User {
  id: string;
  auth_id?: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  company_code?: string;
  name: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Parker {
  id: string;
  name: string;
  company_id?: string;
  contact_number?: string;
  email?: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  // Included relations
  company?: Company;
  vehicles?: Vehicle[];
}

export interface Vehicle {
  id: string;
  parker_id: string;
  plate_number: string;
  vehicle_type: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  parker?: Parker;
}

export interface Facility {
  id: string;
  name: string;
  address?: string;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: string;
  facility_id: string;
  floor_code: string; // e.g. GF, P1, P2, P3
  floor_name: string;
  sort_order: number;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  facility?: Facility;
}

export type AllocationType = 'RESERVED' | 'VISITOR' | 'UNALLOCATED' | 'SEASON';
export type LotStatus =
  | 'AVAILABLE'
  | 'OCCUPIED'
  | 'PENDING_INSTALLATION'
  | 'PENDING_REMOVAL'
  | 'MAINTENANCE'
  | 'INACTIVE';

export interface ParkingLot {
  id: string;
  floor_id: string;
  lot_number: string;
  allocation_type: AllocationType;
  allocated_company_id?: string;
  status: LotStatus;
  created_at: string;
  updated_at: string;
  floor?: Floor;
  allocated_company?: Company;
  current_assignment?: ParkingAssignment;
}

export type AssignmentStatus =
  | 'ACTIVE'
  | 'CANCELLED'
  | 'TRANSFERRED'
  | 'EXPIRED'
  | 'PENDING';

export interface ParkingAssignment {
  id: string;
  parker_id: string;
  vehicle_id: string;
  parking_lot_id: string;
  start_date: string;
  end_date?: string;
  status: AssignmentStatus;
  cancellation_reason?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  parker?: Parker;
  vehicle?: Vehicle;
  parking_lot?: ParkingLot;
  tag?: Tag;
}

export type TagStatus =
  | 'INSTALLATION_PENDING'
  | 'INSTALLED'
  | 'REMOVAL_PENDING'
  | 'REMOVED';

export interface Tag {
  id: string;
  assignment_id: string;
  tag_status: TagStatus;
  installed_at?: string;
  removed_at?: string;
  created_at: string;
  updated_at: string;
  assignment?: ParkingAssignment;
}

export type BobRequestType = 'INSTALLATION' | 'REMOVAL';
export type BobRequestStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface BobRequest {
  id: string;
  request_number: string; // e.g. ADD-2026-0001 or REM-2026-0001
  request_type: BobRequestType;
  assignment_id: string;
  parking_lot_id: string;
  vehicle_id: string;
  status: BobRequestStatus;
  created_by?: string;
  assigned_to?: string;
  completion_notes?: string;
  evidence_photo_url?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
  assignment?: ParkingAssignment;
  parking_lot?: ParkingLot;
  vehicle?: Vehicle;
  document?: DocumentRecord;
}

export interface DocumentRecord {
  id: string;
  request_id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  user?: User;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  read_at?: string;
  created_at: string;
}
