/**
 * PMS Integration Abstraction Layer (DTeck PMS)
 * 
 * Requirement 38: RPSMAS operates independently from the third-party DTeck PMS.
 * Direct database access to DTeck is strictly prohibited.
 * This module defines the interface contract for future DTeck API integrations.
 */

export interface PMSParkerData {
  pmsId?: string;
  name: string;
  icOrPassport?: string;
  companyName?: string;
  email?: string;
  phone?: string;
}

export interface PMSVehicleData {
  pmsId?: string;
  plateNumber: string;
  makeModel?: string;
}

export class PMSService {
  private static isConnected = false;

  /**
   * Check connection status to DTeck API
   */
  static async checkHealth(): Promise<{ status: 'DISCONNECTED' | 'CONNECTED'; message: string }> {
    return {
      status: 'DISCONNECTED',
      message: 'DTeck PMS API integration is currently unconfigured. RPSMAS is operating in standalone mode.',
    };
  }

  /**
   * Fetch parker details from DTeck PMS API
   */
  static async getParker(identifier: string): Promise<PMSParkerData | null> {
    if (!this.isConnected) {
      console.log(`[PMS Service Mock] getParker requested for ${identifier} - Integration disabled.`);
      return null;
    }
    throw new Error('DTeck API client not initialized.');
  }

  /**
   * Fetch vehicle details from DTeck PMS API
   */
  static async getVehicle(plateNumber: string): Promise<PMSVehicleData | null> {
    if (!this.isConnected) {
      console.log(`[PMS Service Mock] getVehicle requested for ${plateNumber} - Integration disabled.`);
      return null;
    }
    throw new Error('DTeck API client not initialized.');
  }

  /**
   * Sync parker creation to DTeck PMS API
   */
  static async syncParker(data: PMSParkerData): Promise<{ success: boolean; pmsId?: string }> {
    console.log('[PMS Service Mock] syncParker called for:', data.name);
    return { success: false };
  }

  /**
   * Sync vehicle registration to DTeck PMS API
   */
  static async syncVehicle(data: PMSVehicleData): Promise<{ success: boolean; pmsId?: string }> {
    console.log('[PMS Service Mock] syncVehicle called for:', data.plateNumber);
    return { success: false };
  }
}
