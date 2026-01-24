import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const getRegistrationCode = async (req: Request, res: Response) => {
    const registration_code = req.query.registration_code as string | undefined;
    console.log('registration_code:', registration_code);
    try {
        let query = supabase.from("RegistrationCode").select("*");
        if (registration_code) {
            query = query.eq("code", registration_code);
        }
        const { data, error } = await query;
        console.log('data:', data, 'error:', error);
        if (error || !data || data.length === 0) {
            return res.status(404).json({ message: "Invalid registration code." });
        }
        // Always return an array
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ message: "Server error.", error });
    }
};