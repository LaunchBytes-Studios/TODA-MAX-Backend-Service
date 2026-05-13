import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import bcrypt from 'bcrypt';

export const verifyPinReset = async (req: Request, res: Response) => {
  try {
    const { contact, code } = req.body;

    if (!contact || !code) {
      return res.status(400).json({
        success: false,
        message: 'Contact and code required',
      });
    }

    const { data, error } = await supabase
      .from('PinResetRequests')
      .select('*')
      .eq('contact', contact)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return res.status(400).json({
        success: false,
        message: 'No active reset request found',
      });
    }

    if (new Date(data.expires_at) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Code expired',
      });
    }

    const isValid = await bcrypt.compare(code, data.reset_code_hash);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid code',
      });
    }

    await supabase
      .from('PinResetRequests')
      .update({
        is_used: true,
      })
      .eq('id', data.id);

    return res.json({
      success: true,
      message: 'Code verified',
      canReset: true,
      resetRequestId: data.id,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};
