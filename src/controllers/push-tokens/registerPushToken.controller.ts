import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const registerPushToken = async (req: Request, res: Response) => {
  const { token, deviceId, platform } = req.body;

  if (!token || !deviceId || !platform) {
    return res.status(400).json({
      error: 'All fields are required',
    });
  }

  const now = new Date().toISOString();

  try {
    const { error } = await supabase.from('UserPushTokens').upsert(
      {
        token,
        user_id: null, // anonymous user
        device_id: deviceId,
        platform: platform,
        created_at: now,
        updated_at: now,
        last_seen_at: now,
      },
      {
        onConflict: 'device_id',
      },
    );

    if (error) {
      return res.status(500).json({
        error: error.message,
      });
    }

    return res.status(200).json({
      success: true,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: 'Internal server error',
    });
  }
};
