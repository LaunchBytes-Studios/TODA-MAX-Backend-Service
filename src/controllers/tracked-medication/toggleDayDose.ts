import { Request, Response } from 'express';
import { supabase } from '../../config/db';

import {
  DoseStatus,
  TrackingDayStatus,
  TrackedMedicationDayDoseRow,
  TrackedMedicationPatientRow,
} from './trackedMedication.types';

export const toggleDayDose = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;
    const { doseId } = req.params;

    if (!patientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Toggling dose ${doseId} by ${patientId}`);

    /**
     * Step 1 — fetch dose
     */
    const { data: dose, error } = await supabase
      .from('TrackedMedicationDayDose')
      .select('id, status, tracked_medication_id, medication_tracking_day_id')
      .eq('id', doseId)
      .single<TrackedMedicationDayDoseRow>();

    if (error || !dose) {
      return res.status(404).json({ error: 'Dose not found' });
    }

    /**
     * Step 2 — verify ownership
     */
    const { data: med } = await supabase
      .from('TrackedMedication')
      .select('patient_id')
      .eq('id', dose.tracked_medication_id)
      .single<TrackedMedicationPatientRow>();

    if (!med || med.patient_id !== patientId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    /**
     * Step 3 — toggle dose
     */
    const newStatus: DoseStatus = dose.status === 'taken' ? 'pending' : 'taken';

    const { error: updateError } = await supabase
      .from('TrackedMedicationDayDose')
      .update({
        status: newStatus,
        taken_at: newStatus === 'taken' ? new Date().toISOString() : null,
      })
      .eq('id', doseId);

    if (updateError) throw updateError;

    /**
     * Step 4 — fetch all doses for the day
     */
    const { data: doses, error: dosesError } = await supabase
      .from('TrackedMedicationDayDose')
      .select('status')
      .eq('medication_tracking_day_id', dose.medication_tracking_day_id)
      .returns<{ status: DoseStatus }[]>();

    if (dosesError) throw dosesError;

    const total = doses.length;
    const taken = doses.filter((d) => d.status === 'taken').length;

    /**
     * Step 5 — determine day status
     */
    let dayStatus: TrackingDayStatus = 'none';

    if (taken === total && total > 0) {
      dayStatus = 'complete';
    } else if (taken > 0) {
      dayStatus = 'partial';
    }

    /**
     * Step 6 — update tracking day
     */
    const { error: dayUpdateError } = await supabase
      .from('MedicationTrackingDay')
      .update({
        status: dayStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dose.medication_tracking_day_id);

    if (dayUpdateError) throw dayUpdateError;

    console.log(`Toggled dose ${doseId} → ${newStatus}`);
    console.log(`Updated tracking day → ${dayStatus}`);

    return res.json({
      success: true,
      status: newStatus,
      day_status: dayStatus,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update dose' });
  }
};
