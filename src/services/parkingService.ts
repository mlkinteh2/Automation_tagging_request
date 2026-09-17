import { supabase } from '@/lib/supabase/client';
import { generateNumberPlateDoc } from '@/lib/docx/generateTagDoc';
import {
  ParkingAssignment,
  BobRequest,
  Tag,
  LotStatus,
  TagStatus,
  BobRequestStatus,
} from '@/types/database';
import { isValidLotNumber } from '@/lib/parking/lotValidation';

export class ParkingService {
  /**
   * Helper to format request numbers (ADD-YYYY-NNNN or REM-YYYY-NNNN)
   */
  private static async generateRequestNumber(prefix: 'ADD' | 'REM'): Promise<string> {
    const year = new Date().getFullYear();
    const prefixStr = `${prefix}-${year}-`;

    const { data, error } = await supabase
      .from('bob_requests')
      .select('request_number')
      .like('request_number', `${prefixStr}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    let nextSeq = 1;
    if (data && data.length > 0) {
      const parts = data[0].request_number.split('-');
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          nextSeq = lastSeq + 1;
        }
      }
    }

    const paddedSeq = nextSeq.toString().padStart(4, '0');
    return `${prefixStr}${paddedSeq}`;
  }

  /**
   * 13. INSTALLATION WORKFLOW
   * Create assignment, update lot to OCCUPIED, create tag INSTALLATION_PENDING,
   * create BOB request ADD-YYYY-NNNN, generate DOCX number plate document.
   */
  static async assignParking(params: {
    parkerId: string;
    vehicleId: string;
    parkingLotId: string;
    createdById?: string;
  }) {
    // 1. Verify lot is AVAILABLE
    const { data: lot, error: lotError } = await supabase
      .from('parking_lots')
      .select('*, floor:floors(*), company:companies(*)')
      .eq('id', params.parkingLotId)
      .single();

    if (lotError || !lot) {
      throw new Error('Parking lot not found.');
    }
    if (!isValidLotNumber(lot.lot_number)) {
      throw new Error('This parking lot has an invalid lot number and cannot be assigned.');
    }

    if (lot.status !== 'AVAILABLE') {
      throw new Error(`Lot ${lot.lot_number} is no longer available. Current status: ${lot.status}`);
    }

    // Fetch Parker and Vehicle details
    const { data: parker } = await supabase.from('parkers').select('*, company:companies(*)').eq('id', params.parkerId).single();
    const { data: vehicle } = await supabase.from('vehicles').select('*').eq('id', params.vehicleId).single();

    if (!parker || !vehicle) {
      throw new Error('Parker or Vehicle record not found.');
    }

    // 2. Insert PARKING_ASSIGNMENT
    const { data: assignment, error: assignError } = await supabase
      .from('parking_assignments')
      .insert({
        parker_id: params.parkerId,
        vehicle_id: params.vehicleId,
        parking_lot_id: params.parkingLotId,
        status: 'ACTIVE',
        created_by: params.createdById,
      })
      .select()
      .single();

    if (assignError || !assignment) {
      throw new Error(`Failed to create assignment: ${assignError?.message}`);
    }

    // 3. Update Lot status to OCCUPIED
    await supabase
      .from('parking_lots')
      .update({ status: 'OCCUPIED', updated_at: new Date().toISOString() })
      .eq('id', params.parkingLotId);

    // 4. Create TAG record with INSTALLATION_PENDING
    const { data: tag } = await supabase
      .from('tags')
      .insert({
        assignment_id: assignment.id,
        tag_status: 'INSTALLATION_PENDING',
      })
      .select()
      .single();

    // 5. Create BOB_REQUEST with INSTALLATION type (ADD-YYYY-NNNN)
    const requestNumber = await this.generateRequestNumber('ADD');
    const { data: bobReq } = await supabase
      .from('bob_requests')
      .insert({
        request_number: requestNumber,
        request_type: 'INSTALLATION',
        assignment_id: assignment.id,
        parking_lot_id: params.parkingLotId,
        vehicle_id: params.vehicleId,
        status: 'PENDING',
        created_by: params.createdById,
      })
      .select()
      .single();

    // 6. Generate Number Plate Word Document
    let docPath = '';
    if (bobReq) {
      try {
        const docBuffer = await generateNumberPlateDoc({
          requestNumber,
          plateNumber: vehicle.plate_number,
          floorCode: lot.floor?.floor_code || 'GF',
          lotNumber: lot.lot_number,
          parkerName: parker.name,
          companyName: parker.company?.name,
        });

        const fileName = `${requestNumber}_${vehicle.plate_number}_${lot.floor?.floor_code || 'GF'}-${lot.lot_number}.docx`;
        docPath = `installation-documents/${fileName}`;

        // Insert metadata in public.documents
        await supabase.from('documents').insert({
          request_id: bobReq.id,
          document_type: 'NUMBER_PLATE',
          file_name: fileName,
          storage_path: docPath,
        });
      } catch (docErr) {
        console.error('Document generation error:', docErr);
      }
    }

    // 7. Audit Log
    await supabase.from('activity_logs').insert({
      user_id: params.createdById,
      action: 'ASSIGN_PARKING',
      entity_type: 'PARKING_ASSIGNMENT',
      entity_id: assignment.id,
      description: `Assigned lot ${lot.lot_number} to ${parker.name} (${vehicle.plate_number}). Request: ${requestNumber}`,
    });

    return {
      assignment,
      requestNumber,
      docPath,
    };
  }

  /**
   * 15. CANCELLATION WORKFLOW
   * Mark assignment CANCELLED, set tag REMOVAL_PENDING, lot PENDING_REMOVAL,
   * create BOB request REM-YYYY-NNNN, NO document generated.
   */
  static async cancelParking(params: {
    assignmentId: string;
    reason?: string;
    cancelledById?: string;
  }) {
    const { data: assignment } = await supabase
      .from('parking_assignments')
      .select('*, vehicle:vehicles(*), parking_lot:parking_lots(*, floor:floors(*)), parker:parkers(*)')
      .eq('id', params.assignmentId)
      .single();

    if (!assignment || assignment.status !== 'ACTIVE') {
      throw new Error('Active assignment not found or already cancelled.');
    }

    // 1. Assignment ACTIVE -> CANCELLED
    await supabase
      .from('parking_assignments')
      .update({
        status: 'CANCELLED',
        end_date: new Date().toISOString(),
        cancellation_reason: params.reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.assignmentId);

    // 2. Tag -> REMOVAL_PENDING
    await supabase
      .from('tags')
      .update({
        tag_status: 'REMOVAL_PENDING',
        updated_at: new Date().toISOString(),
      })
      .eq('assignment_id', params.assignmentId);

    // 3. Lot -> PENDING_REMOVAL (Must NOT become available yet!)
    await supabase
      .from('parking_lots')
      .update({
        status: 'PENDING_REMOVAL',
        updated_at: new Date().toISOString(),
      })
      .eq('id', assignment.parking_lot_id);

    // 4. Create BOB Removal Request REM-YYYY-NNNN (NO document created)
    const requestNumber = await this.generateRequestNumber('REM');
    const { data: bobReq } = await supabase
      .from('bob_requests')
      .insert({
        request_number: requestNumber,
        request_type: 'REMOVAL',
        assignment_id: assignment.id,
        parking_lot_id: assignment.parking_lot_id,
        vehicle_id: assignment.vehicle_id,
        status: 'PENDING',
        created_by: params.cancelledById,
      })
      .select()
      .single();

    // 5. Audit Log
    await supabase.from('activity_logs').insert({
      user_id: params.cancelledById,
      action: 'CANCEL_PARKING',
      entity_type: 'PARKING_ASSIGNMENT',
      entity_id: assignment.id,
      description: `Cancelled parking assignment for ${assignment.parker?.name} on Lot ${assignment.parking_lot?.lot_number}. Tag removal request: ${requestNumber}`,
    });

    return {
      assignmentId: assignment.id,
      removalRequestNumber: requestNumber,
    };
  }

  /**
   * 17. BOB INSTALLATION COMPLETION
   */
  static async completeBobInstallation(params: {
    requestId: string;
    bobUserId?: string;
    notes?: string;
    evidencePhotoUrl?: string;
  }) {
    const { data: req } = await supabase
      .from('bob_requests')
      .select('*, assignment:parking_assignments(*)')
      .eq('id', params.requestId)
      .single();

    if (!req || req.status === 'COMPLETED') {
      throw new Error('BOB Installation request not found or already completed.');
    }

    const now = new Date().toISOString();

    // 1. Update BOB request
    await supabase
      .from('bob_requests')
      .update({
        status: 'COMPLETED',
        completed_at: now,
        completion_notes: params.notes,
        evidence_photo_url: params.evidencePhotoUrl,
        assigned_to: params.bobUserId,
        updated_at: now,
      })
      .eq('id', params.requestId);

    // 2. Update Tag status -> INSTALLED
    await supabase
      .from('tags')
      .update({
        tag_status: 'INSTALLED',
        installed_at: now,
        updated_at: now,
      })
      .eq('assignment_id', req.assignment_id);

    // 3. Audit Log
    await supabase.from('activity_logs').insert({
      user_id: params.bobUserId,
      action: 'COMPLETE_BOB_INSTALLATION',
      entity_type: 'BOB_REQUEST',
      entity_id: req.id,
      description: `BOB completed installation for request ${req.request_number}`,
    });

    return { success: true };
  }

  /**
   * 16. BOB REMOVAL WORKFLOW & COMPLETION
   * ONLY after BOB confirms tag removal should: PENDING_REMOVAL -> AVAILABLE
   */
  static async completeBobRemoval(params: {
    requestId: string;
    bobUserId?: string;
    notes?: string;
    evidencePhotoUrl?: string;
  }) {
    const { data: req } = await supabase
      .from('bob_requests')
      .select('*, assignment:parking_assignments(*)')
      .eq('id', params.requestId)
      .single();

    if (!req || req.status === 'COMPLETED') {
      throw new Error('BOB Removal request not found or already completed.');
    }

    const now = new Date().toISOString();

    // 1. Update BOB request -> COMPLETED
    await supabase
      .from('bob_requests')
      .update({
        status: 'COMPLETED',
        completed_at: now,
        completion_notes: params.notes,
        evidence_photo_url: params.evidencePhotoUrl,
        assigned_to: params.bobUserId,
        updated_at: now,
      })
      .eq('id', params.requestId);

    // 2. Tag -> REMOVED
    await supabase
      .from('tags')
      .update({
        tag_status: 'REMOVED',
        removed_at: now,
        updated_at: now,
      })
      .eq('assignment_id', req.assignment_id);

    // 3. Lot status -> AVAILABLE (Rule 9 & 16)
    await supabase
      .from('parking_lots')
      .update({
        status: 'AVAILABLE',
        updated_at: now,
      })
      .eq('id', req.parking_lot_id);

    // 4. Audit Log
    await supabase.from('activity_logs').insert({
      user_id: params.bobUserId,
      action: 'COMPLETE_BOB_REMOVAL',
      entity_type: 'BOB_REQUEST',
      entity_id: req.id,
      description: `BOB completed removal for request ${req.request_number}. Lot is now AVAILABLE.`,
    });

    return { success: true };
  }

  /**
   * 18. PARKING TRANSFER WORKFLOW
   * Transfer parker from old lot to new lot.
   */
  static async transferParking(params: {
    assignmentId: string;
    newParkingLotId: string;
    createdById?: string;
  }) {
    // 1. Cancel old assignment
    const { data: oldAssignment } = await supabase
      .from('parking_assignments')
      .select('*')
      .eq('id', params.assignmentId)
      .single();

    if (!oldAssignment || oldAssignment.status !== 'ACTIVE') {
      throw new Error('Active assignment for transfer not found.');
    }

    // Mark old assignment TRANSFERRED
    await supabase
      .from('parking_assignments')
      .update({
        status: 'TRANSFERRED',
        end_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.assignmentId);

    // Old tag -> REMOVAL_PENDING
    await supabase
      .from('tags')
      .update({ tag_status: 'REMOVAL_PENDING' })
      .eq('assignment_id', params.assignmentId);

    // Old lot -> PENDING_REMOVAL
    await supabase
      .from('parking_lots')
      .update({ status: 'PENDING_REMOVAL' })
      .eq('id', oldAssignment.parking_lot_id);

    // Create REMOVAL BOB request for old lot
    const remReqNumber = await this.generateRequestNumber('REM');
    await supabase.from('bob_requests').insert({
      request_number: remReqNumber,
      request_type: 'REMOVAL',
      assignment_id: oldAssignment.id,
      parking_lot_id: oldAssignment.parking_lot_id,
      vehicle_id: oldAssignment.vehicle_id,
      status: 'PENDING',
      created_by: params.createdById,
    });

    // 2. Create new assignment for new lot
    const newAssignmentResult = await this.assignParking({
      parkerId: oldAssignment.parker_id,
      vehicleId: oldAssignment.vehicle_id,
      parkingLotId: params.newParkingLotId,
      createdById: params.createdById,
    });

    return {
      oldAssignmentId: oldAssignment.id,
      removalRequestNumber: remReqNumber,
      newAssignment: newAssignmentResult.assignment,
      newInstallationRequestNumber: newAssignmentResult.requestNumber,
    };
  }

  /**
   * 19. REPLACE PARKER ON LOT WORKFLOW
   * Directly replace an active parker on a lot with a new one.
   * Cancels old (creates REMOVAL for BOB) and Assigns new (creates INSTALLATION for BOB).
   */
  static async replaceParkerOnLot(params: {
    parkingLotId: string;
    newParkerId: string;
    newVehicleId: string;
    createdById?: string;
    reason?: string;
  }) {
    // 1. Find the current active assignment for the lot
    const { data: oldAssignment } = await supabase
      .from('parking_assignments')
      .select('*')
      .eq('parking_lot_id', params.parkingLotId)
      .eq('status', 'ACTIVE')
      .single();

    if (!oldAssignment) {
      throw new Error('No active assignment found on this lot to replace.');
    }

    // 2. Cancel the old assignment (This sets lot to PENDING_REMOVAL and creates REMOVAL request)
    const cancelResult = await this.cancelParking({
      assignmentId: oldAssignment.id,
      reason: params.reason || 'Replaced with a new Parker',
      cancelledById: params.createdById,
    });

    // 3. Temporarily set lot back to AVAILABLE so assignParking doesn't fail
    await supabase
      .from('parking_lots')
      .update({ status: 'AVAILABLE', updated_at: new Date().toISOString() })
      .eq('id', params.parkingLotId);

    // 4. Assign the new parker
    const assignResult = await this.assignParking({
      parkerId: params.newParkerId,
      vehicleId: params.newVehicleId,
      parkingLotId: params.parkingLotId,
      createdById: params.createdById,
    });

    return {
      oldAssignmentId: oldAssignment.id,
      removalRequestNumber: cancelResult.removalRequestNumber,
      newAssignment: assignResult.assignment,
      newInstallationRequestNumber: assignResult.requestNumber,
      docPath: assignResult.docPath,
    };
  }
}
