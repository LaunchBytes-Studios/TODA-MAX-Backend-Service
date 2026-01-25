import { UUID } from 'node:crypto';
import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const makeAnnouncement = async (req: Request, res: Response) => {
    const { message } = req.body;
    try {
        const enav_id = req.query.enavId as UUID;
        if (!enav_id) {
            return res.status(401).json({ error: "Unauthorized: enavId is required to post an announcement." });
        }
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const { data, error } = await supabase
            .from("Announcement")
            .insert([{
                message,
                announce_date: now,
                type: 'general',
                enav_id
            }])
            .select();

        if (error) {
            return res.status(500).json({ error: error.message });
        }
        return res.status(201).json({ announcement: data[0] });
    } catch (error) {
        return res.status(500).json({ error: 'Internal Server Error', details: error });
    }
}