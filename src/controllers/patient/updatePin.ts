import { Request, Response } from 'express';
import { supabase } from '../../config/db'; // Your existing server-side supabase client
import bcrypt from 'bcrypt';

// 1. Update PIN
export const updatePin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { newPin } = req.body;

    const salt = await bcrypt.genSalt(10);
    const pin_hash = await bcrypt.hash(newPin, salt);

    const { error } = await supabase.from('Patient').update({ pin_hash }).eq('patient_id', id);

    if (error) return res.status(400).json({ error: error.message });
    res.json({ message: 'PIN updated successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
