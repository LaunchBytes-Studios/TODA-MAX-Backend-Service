import { Request, Response } from 'express';
import { supabase } from '../../config/db';

import { TrackedMedicationRow, TrackedMedicationDTO } from './trackedMedication.types';

export const getTrackedMedications = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await supabase
      .from('TrackedMedication')
      .select(
        `
        id,
        name,
        dosage,
        type,
        quantity,
        medication_id,
        is_active,
        schedules:TrackedMedicationSchedule(time)
      `,
      )
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .returns<TrackedMedicationRow[]>();

    if (error) throw error;

    const medications: TrackedMedicationDTO[] =
      data?.map((med) => ({
        id: med.id,
        name: med.name,
        dosage: med.dosage,
        type: med.type,
        quantity: med.quantity,
        medication_id: med.medication_id,
        is_active: med.is_active,

        // schedule objects → sorted time array
        schedules: (med.schedules ?? [])
          .map((s) => s.time)
          .filter((t): t is string => Boolean(t))
          .sort((a, b) => a.localeCompare(b)),
      })) ?? [];

    return res.json({ medications });
  } catch (err) {
    console.error('getTrackedMedications error:', err);

    return res.status(500).json({
      error: 'Failed to fetch tracked medications',
    });
  }
};
