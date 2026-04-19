import { Request, Response } from 'express';
import { supabase } from '../../config/db';
import { awardPatientPointsForEvent } from '../../services/patientPoints.service';

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

    /**
     * STEP 1 — Fetch dose (for ownership check only)
     */
    const { data: dose, error } = await supabase
      .from('TrackedMedicationDayDose')
      .select('tracked_medication_id, medication_tracking_day_id')
      .eq('id', doseId)
      .single<TrackedMedicationDayDoseRow>();

    if (error || !dose) {
      return res.status(404).json({ error: 'Dose not found' });
    }

    /**
     * STEP 2 — Verify ownership
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
     * STEP 3 — Toggle dose safely (DB handles quantity + activation)
     */
    const { data: result, error: rpcError } = await supabase.rpc('toggle_day_dose_safe', {
      p_dose_id: doseId,
    });

    if (rpcError) {
      if (rpcError.message.includes('NO_QUANTITY')) {
        return res.status(400).json({
          error: 'Medication has no remaining quantity',
        });
      }

      throw rpcError;
    }

    const newStatus: DoseStatus = result.status;

    /**
     * STEP 4 — Recalculate day status
     */
    const { data: doses, error: dosesError } = await supabase
      .from('TrackedMedicationDayDose')
      .select('status')
      .eq('medication_tracking_day_id', dose.medication_tracking_day_id)
      .returns<{ status: DoseStatus }[]>();

    if (dosesError) throw dosesError;

    const total = doses.length;
    const taken = doses.filter((d) => d.status === 'taken').length;

    let dayStatus: TrackingDayStatus = 'none';

    if (taken === total && total > 0) {
      dayStatus = 'complete';
    } else if (taken > 0) {
      dayStatus = 'partial';
    }

    /**
     * STEP 5 — Update tracking day
     */
    const { error: dayUpdateError } = await supabase
      .from('MedicationTrackingDay')
      .update({
        status: dayStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dose.medication_tracking_day_id);

    if (dayUpdateError) throw dayUpdateError;

    let pointsAward: Awaited<ReturnType<typeof awardPatientPointsForEvent>> | null = null;

    if (dayStatus === 'complete' && total > 0) {
      try {
        pointsAward = await awardPatientPointsForEvent({
          patientId,
          eventType: 'daily_medication_completion',
        });
      } catch (pointsError) {
        console.error('Failed to award daily medication completion points:', pointsError);
      }
    }

    return res.json({
      success: true,
      status: newStatus,
      day_status: dayStatus,
      pointsAward,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to update dose' });
  }
};
