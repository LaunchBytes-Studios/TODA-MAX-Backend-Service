import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const getRegistrationCode = async (req: Request, res: Response) => {
    const registration_code = req.query.registration_code as string;
    const enav_id = req.query.enavId as string;
    console.log('enav_id:', enav_id);
    if (!enav_id) {
        return res.status(401).json({ message: "Unauthorized: enavId is required to generate a registration code." });
    }
    try {
        let query = supabase.from("RegistrationCode").select("*").eq("enav_id", enav_id);
        if (registration_code) {
            query = query.eq("code", registration_code);
        }
        const { data, error } = await query;
        console.log('data:', data, 'error:', error);
        if (error || !data || data.length === 0) {
            return res.status(404).json({ message: "Invalid registration code or enavId." });
        }
        // Always return an array
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ message: "Server error.", error });
    }
};