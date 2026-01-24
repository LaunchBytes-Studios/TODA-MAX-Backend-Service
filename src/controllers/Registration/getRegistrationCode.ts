import { supabase } from '../../config/db';
import { Request, Response } from 'express';


export const getRegistrationCode = async (req: Request, res: Response) => {
    const registration_code = req.query.registration_code as string;
    console.log('registration_code:', registration_code);
    try {
        const { data, error } = await supabase
            .from("RegistrationCode")
            .select("*")
            .eq("code", registration_code);
        console.log('data:', data, 'error:', error);
        if (error || !data || data.length === 0) {
            return res.status(404).json({ message: "Invalid registration code." });
        }
        return res.status(200).json(data[0]);
    } catch (error) {
        return res.status(500).json({ message: "Server error.", error });
    }
};