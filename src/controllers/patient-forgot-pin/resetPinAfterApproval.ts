import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import bcrypt from 'bcrypt';

export const resetPinAfterApproval = async (req: Request, res: Response) => {
  try {
    const { resetRequestId, newPin } = req.body;

    if (!resetRequestId || !newPin) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
      });
    }

    const { data: reset } = await supabase
      .from('PinResetRequests')
      .select('*')
      .eq('id', resetRequestId)
      .eq('is_used', true)
      .single();

    if (!reset) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized or invalid reset request',
      });
    }

    const isExpired = new Date(reset.expires_at).getTime() < Date.now();

    if (isExpired) {
      return res.status(403).json({
        success: false,
        message: 'Reset session expired',
      });
    }

    const newHash = await bcrypt.hash(newPin, 10);

    await supabase.from('Patient').update({ pin_hash: newHash }).eq('contact', reset.contact);

    return res.json({
      success: true,
      message: 'PIN reset successfully',
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
