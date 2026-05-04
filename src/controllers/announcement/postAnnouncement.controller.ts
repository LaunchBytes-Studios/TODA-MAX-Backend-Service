import { supabase } from '../../config/db';
import { getFirstEnavId } from '../../utils/getFirstEnavId';
import { Request, Response } from 'express';
import { sendPushNotifications } from '../../utils/sendPushNotifications';

export const makeAnnouncement = async (req: Request, res: Response) => {
  const { message } = req.body;

  try {
    let enav_id: string;

    try {
      enav_id = await getFirstEnavId();
    } catch (err) {
      return res.status(500).json({
        error: 'Error fetching enav_id from eNavigator table.',
        details: err instanceof Error ? err.message : err,
      });
    }

    // 1. Save announcement
    const { data, error } = await supabase
      .from('Announcement')
      .insert([
        {
          message,
          announce_date: new Date(),
          type: 'general',
          enav_id,
        },
      ])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // 2. Get all push tokens
    const { data: tokensData } = await supabase.from('UserPushTokens').select('token');

    const tokens = tokensData?.map((t) => t.token) || [];

    // 3. Send push notifications
    if (tokens.length > 0) {
      await sendPushNotifications(tokens, message);
    }

    return res.status(201).json({
      announcement: data[0],
      notified_users: tokens.length,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error,
    });
  }
};
