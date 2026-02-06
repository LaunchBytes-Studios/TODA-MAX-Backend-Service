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

    console.log('[MAINTENANCE] Expiring codes with expires_at <', nowIso);

    // 1) Mark as expired: expires_at < now AND status is not 'used' or already 'expired'
    const { data: expiredData, error: updateError } = await supabase
      .from('RegistrationCode')
      .update({ status: 'expired' })
      .lt('expires_at', nowIso)
      .neq('status', 'used')
      .select();

    if (updateError) {
      console.error('[MAINTENANCE] Error expiring codes:', updateError);
      return res.status(500).json({ message: 'Failed to expire old registration codes.', error: updateError });
    }

    const expiredCount = Array.isArray(expiredData) ? expiredData.length : 0;
    console.log('[MAINTENANCE] Expired codes count:', expiredCount);

    console.log('[MAINTENANCE] Deleting codes with created_at <=', thirtyDaysAgoIso);

    // 2) Delete very old codes that are 'expired' (used codes are preserved for audit purposes).
    const { data: deletedData, error: deleteError } = await supabase
      .from('RegistrationCode')
      .delete()
      .lte('created_at', thirtyDaysAgoIso)
      .eq('status', 'expired')
      .select();

    if (deleteError) {
      console.error('[MAINTENANCE] Error deleting codes:', deleteError);
      return res.status(500).json({ message: 'Failed to delete very old registration codes.', error: deleteError });
    }

    const deletedCount = Array.isArray(deletedData) ? deletedData.length : 0;
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
    return res.status(500).json({ message: 'Server error.', error: err });
  }
};
