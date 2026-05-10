import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const attachPushTokenToUser = async (req: Request, res: Response) => {
  const user = req.user;
  const { token, deviceId, platform } = req.body;

  if (!token || !user?.userId || !deviceId) {
    return res.status(400).json({ error: 'Missing data' });
  }

  const now = new Date().toISOString();

  try {
    const { error } = await supabase.from('UserPushTokens').upsert(
      {
        device_id: deviceId,
        token,
        user_id: user.userId,
        platform,
        updated_at: now,
        last_seen_at: now,
      },
      {
        onConflict: 'device_id',
      },
    );

    if (error) {
      console.error(error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
