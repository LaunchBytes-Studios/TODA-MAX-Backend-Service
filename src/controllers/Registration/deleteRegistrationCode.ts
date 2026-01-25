import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const deleteRegistrationCode = async (req: Request, res: Response) => {
    const codeId = req.query.codeId as string;
    if (!codeId) {
        return res.status(400).json({ message: 'Missing codeId parameter.' });
    }
    try {
        // Fetch the code's expiry date
        const { data, error: fetchError } = await supabase
            .from('RegistrationCode')
            .select('expires_at')
            .eq('code_id', codeId)
            .single();
        if (fetchError || !data) {
            return res.status(404).json({ message: 'Registration code not found.' });
        }
        if (!data.expires_at) {
            return res.status(400).json({ message: 'Registration code has no expiry date.' });
        }

        const expiryDate = new Date(data.expires_at);
        // Calculate the last day of the expiry month
        const endOfMonth = new Date(expiryDate.getFullYear(), expiryDate.getMonth() + 1, 0, 23, 59, 59, 999);
        const now = new Date();

        if (now <= endOfMonth) {
            return res.status(400).json({ message: 'Registration code can only be deleted after the end of its expiry month.' });
        }

        // Delete the code
        const { error: deleteError } = await supabase
            .from('RegistrationCode')
            .delete()
            .eq('code_id', codeId);
        if (deleteError) {
            return res.status(500).json({ message: 'Failed to delete registration code.', error: deleteError });
        }
        return res.status(200).json({ message: 'Registration code deleted successfully.' });
    } catch (error) {
        return res.status(500).json({ message: 'Server error.', error });
    }
};