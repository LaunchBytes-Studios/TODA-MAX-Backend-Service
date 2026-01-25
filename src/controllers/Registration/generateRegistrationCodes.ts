import { UUID } from 'node:crypto';
import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const generateRegistrationCode = async (req: Request, res: Response) => {
    try {
        // Set expires_at to the end of today (23:59:59.999)
        const now = new Date();
        const expiresAt = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            23, 59, 59, 999
        );

        const enav_id = req.query.enavId as UUID;
        if (!enav_id) {
            return res.status(401).json({ message: "Unauthorized: enavId is required to generate a registration code." });
        }

        const { data, error } = await supabase
            .from("RegistrationCode")
            .insert([{
                enav_id,
                expires_at: expiresAt,
                code: generateRandomCode(),
                status: 'active'
            }])
            .select();
        if (error) {
            return res.status(500).json({ message: "Error generating registration code.", error });
        }
        return res.status(201).json(data[0]);
    } catch (error) {
        return res.status(500).json({ message: "Server error.", error });
    }
};

const generateRandomCode = (): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};