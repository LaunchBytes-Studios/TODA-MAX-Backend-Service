import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const createTrackedMedication = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    const { name, dosage, type, quantity, start_date, end_date, schedules, medication_id } =
      req.body ?? {};

    console.log(
      `Trying to add a new tracked medication for ${patientId} with: ${name}, ${dosage}, ${type}, ${quantity}, ${schedules}, ${medication_id}`,
    );
    if (name == null || dosage == null || type == null || quantity == null) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const { data: medication, error } = await supabase
      .from('TrackedMedication')
      .insert({
        patient_id: patientId,
        medication_id: medication_id ?? null,
        name,
        dosage,
        type,
        quantity,
        start_date,
        end_date,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;

    if (schedules?.length) {
      const scheduleRows = schedules.map((time: string) => ({
        tracked_medication_id: medication.id,
        time,
      }));

      await supabase.from('TrackedMedicationSchedule').insert(scheduleRows);
    }

    console.log(`Successfully added a new tracked medication for ${patientId}`);
    return res.json({
      success: true,
      message: `Successfully added a new tracked medication for ${patientId}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create tracked medication' });
  }
};
