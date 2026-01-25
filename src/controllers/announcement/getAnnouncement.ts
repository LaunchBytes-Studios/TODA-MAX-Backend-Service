import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const getAnnouncement = async (req: Request, res: Response) => {
    
    const announce_id = req.query.announce_id as string | undefined;
    try {
        let query = supabase
            .from("Announcement")
            .select("*");

        if (announce_id) {
            query = query.eq("announce_id", announce_id);
        }

        const { data, error } = await query;
        console.log('data:', data, 'error:', error);

        if (error || !data || data.length === 0) {
            return res.status(404).json({ message: "No announcement(s) found." });
        }
        // If announce_id is provided, return the first match; otherwise, return all
        return res.status(200).json(announce_id ? data[0] : data);
    } catch (error) {
        return res.status(500).json({ message: "Server error.", error });
    }
};