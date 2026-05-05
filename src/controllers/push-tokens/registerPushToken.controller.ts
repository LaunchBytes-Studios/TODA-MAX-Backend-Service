import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const registerPushToken = async (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  const { error } = await supabase.from('UserPushTokens').upsert(
    {
      user_id: null,
      token,
      updated_at: new Date(),
    },
    {
      onConflict: 'token',
    },
  );

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
};
