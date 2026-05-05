import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const attachPushTokenToUser = async (req: Request, res: Response) => {
  const user = req.user;
  const { token } = req.body;

  if (!token || !user?.id) {
    return res.status(400).json({ error: 'Missing data' });
  }

  const { error } = await supabase.from('UserPushTokens').upsert(
    {
      token,
      user_id: user.id,
      updated_at: new Date().toISOString(),
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
