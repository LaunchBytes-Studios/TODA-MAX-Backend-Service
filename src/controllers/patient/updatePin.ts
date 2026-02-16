import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import bcrypt from 'bcrypt';

// src/controllers/patient/updatePin.ts
export const updatePin = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentPin, newPin } = req.body;

  // 1. Get the patient from DB
  const { data: patient } = await supabase.from('Patient')
    .select('pin_hash').eq('patient_id', id).single();

  // 2. THE CHECK: Compare provided currentPin with the stored hash
  if (!patient || !patient.pin_hash) {
    return res.status(404).json({ error: 'Patient not found or PIN not set' });
  }
  
  const isMatch = await bcrypt.compare(currentPin, patient.pin_hash);

  if (!isMatch) {
    // This sends the "Incorrect" signal to your frontend
    return res.status(401).json({ error: 'Current PIN is incorrect' });
  }

  // 3. If correct, update to the new PIN
  const newHash = await bcrypt.hash(newPin, 10);
  await supabase.from('Patient').update({ pin_hash: newHash }).eq('patient_id', id);

  res.json({ message: 'PIN updated successfully' });
};
