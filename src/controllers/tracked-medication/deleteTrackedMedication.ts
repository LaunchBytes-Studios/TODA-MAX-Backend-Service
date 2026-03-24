import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const deleteTrackedMedication = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;
    const { id } = req.params;

    console.log('Deleting medication id:', id, 'for patient:', patientId);

    // Fetch the medication first
    const { data: medication, error } = await supabase
      .from('TrackedMedication')
      .select('id, patient_id')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!medication) {
      return res.status(404).json({ error: 'Tracked medication not found' });
    }

    // Authorization check
    if (medication.patient_id !== patientId) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Delete the medication
    await supabase.from('TrackedMedication').delete().eq('id', id);

    console.log(`Deleted medication ${id} for patient: ${patientId}`);
    return res.json({ success: true, message: 'Medication deleted successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to delete tracked medication.' });
  }
};
