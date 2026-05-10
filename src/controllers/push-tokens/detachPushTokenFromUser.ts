import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const detachPushTokenFromUser = async (req: Request, res: Response) => {
  const user = req.user;
  const { deviceId } = req.body;

  if (!deviceId || !user?.userId) {
    return res.status(400).json({
      error: 'Missing data',
    });
  }

  const { error } = await supabase
    .from('UserPushTokens')
    .update({
      user_id: null,
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    })
    .eq('device_id', deviceId)
    .eq('user_id', user.userId);

  if (error) {
    return res.status(500).json({
      error: error.message,
    });
  }

  return res.status(200).json({
    success: true,
  });
};
