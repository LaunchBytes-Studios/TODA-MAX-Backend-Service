import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import bcrypt from 'bcrypt';

export const updatePin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { currentPin, newPin } = req.body;

    // Validation
    if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
      return res.status(400).json({ error: 'New PIN must be at least 4 digits' });
    }

    // 1. Fetch current pin_hash to verify
    const { data: patient, error: fetchError } = await supabase
      .from('Patient')
      .select('pin_hash')
      .eq('patient_id', id)
      .single();

    if (fetchError || !patient) return res.status(404).json({ error: 'Patient not found' });

    // 2. Verify current PIN
    const isMatch = await bcrypt.compare(currentPin, patient.pin_hash);
    if (!isMatch) return res.status(401).json({ error: 'Current PIN is incorrect' });

    // 3. Hash and Update
    const salt = await bcrypt.genSalt(10);
    const pin_hash = await bcrypt.hash(newPin, salt);

    const { error } = await supabase.from('Patient').update({ pin_hash }).eq('patient_id', id);

    if (error) return res.status(400).json({ error: error.message });

    res.json({ message: 'PIN updated successfully' });
  } catch (err) {
    console.error('PIN Update Error:', err); // Fixed log message
    res.status(500).json({ error: 'Server error' });
  }
};
