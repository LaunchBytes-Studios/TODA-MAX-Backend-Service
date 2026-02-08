import { Request, Response } from 'express';
import { supabase } from '../../config/db';

// Maintenance: expire by expires_at < now (excluding 'used'),
// and delete records older than 30 days (excluding 'used').
export const maintenanceRegistrationCode = async (req: Request, res: Response) => {
  try {
    const confirm = (req.query.confirm as string | undefined)?.toLowerCase();

    if (confirm !== 'true') {
      return res.status(400).json({
        message: "Maintenance requires explicit confirmation. Provide '?confirm=true'.",
      });
    }

    console.log('[MAINTENANCE] Registration code maintenance started');

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const thirtyDaysAgoIso = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    console.log('[MAINTENANCE] Performing atomic maintenance operation');
    console.log('[MAINTENANCE] Expiring codes with expires_at <', nowIso);
    console.log('[MAINTENANCE] Deleting codes with created_at <=', thirtyDaysAgoIso);

    // Perform both operations atomically using a PostgreSQL function via RPC
    const { data: maintenanceResult, error: maintenanceError } = await supabase
      .rpc('maintenance_registration_codes', {
        p_current_time: nowIso,
        p_cleanup_threshold: thirtyDaysAgoIso
      });

    if (maintenanceError) {
      console.error('[MAINTENANCE] Transaction failed:', maintenanceError);
      return res.status(500).json({ 
        message: 'Failed to perform maintenance operation. Please try again later.',
        correlationId: `maintenance-${Date.now()}`
      });
    }

    // maintenanceResult should contain { expired_count, deleted_count }
    const { expired_count: expiredCount, deleted_count: deletedCount } = maintenanceResult || { expired_count: 0, deleted_count: 0 };
    
    console.log('[MAINTENANCE] Expired codes count:', expiredCount);
    console.log('[MAINTENANCE] Deleted codes count:', deletedCount);
    console.log('[MAINTENANCE] Maintenance completed successfully at', nowIso);

    return res.status(200).json({
      success: true,
      expiredCount,
      deletedCount,
      performedAt: nowIso,
    });
  } catch (err) {
    console.error('[MAINTENANCE] Server error:', err);
    return res.status(500).json({ 
      message: 'Internal server error during maintenance operation.',
      correlationId: `maintenance-error-${Date.now()}`
    });
  }
};
