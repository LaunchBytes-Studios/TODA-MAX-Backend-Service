import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const updatePatientProfile = async (req: Request, res: Response) => {
  const { id } = req.params; // patient_id
  const {
    firstname,
    surname,
    birthday,
    contact,
    address,
    diagnosis,
    sex,
    philhealthNumber,
    avatar_url,
  } = req.body ?? {};

  if (!id) {
    return res.status(400).json({ error: 'Missing patient id' });
  }

  try {
    // Check if patient exists
    const { data: existing, error: findError } = await supabase
      .from('Patient')
      .select('*')
      .eq('patient_id', id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Update patient profile
    const { data: updated, error: updateError } = await supabase
      .from('Patient')
      .update({
        firstname,
        surname,
        birthday,
        sex,
        contact,
        address,
        diagnosis,
        philhealth_num: philhealthNumber,
        avatar_url,
      })
      .eq('patient_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating patient:', updateError);
      return res.status(500).json({ error: updateError.message });
    }

    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
