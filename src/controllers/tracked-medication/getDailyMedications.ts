import { Response, Request } from 'express';
import { supabase } from '../../config/db';

import {
  DailyMedicationDoseDTO,
  ExistingDoseRow,
  MedicationWithSchedules,
  CreateDoseRow,
} from './trackedMedication.types';

export const getDailyMedications = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;
    const { date } = req.query;

    if (!patientId) return res.status(401).json({ error: 'Unauthorized' });
    if (!date || typeof date !== 'string')
      return res.status(400).json({ error: 'Date is required' });

    const requestDate = new Date(date);
    const now = new Date();

    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const isPast = requestDate < todayUTC;

    /**
     * STEP 1 — fetch or create tracking day
     */
    const { data: existingTrackingDay, error: trackingDayError } = await supabase
      .from('MedicationTrackingDay')
      .select('*')
      .eq('patient_id', patientId)
      .eq('date', date)
      .single();

    if (trackingDayError && trackingDayError.code !== 'PGRST116') throw trackingDayError;

    if (isPast && !existingTrackingDay) {
      return res.json({ medications: [] });
    }

    let trackingDay = existingTrackingDay;

    if (!trackingDay) {
      const { data, error } = await supabase
        .from('MedicationTrackingDay')
        .insert([
          {
            patient_id: patientId,
            date,
            status: 'none',
          },
        ])
        .select('*')
        .single();

      if (error) throw error;
      trackingDay = data;
    }

    const trackingDayId = trackingDay.id;

    /**
     * STEP 2 — fetch existing doses
     */
    const { data: existingDoses, error: doseError } = await supabase
      .from('TrackedMedicationDayDose')
      .select(
        `
        id,
        status,
        taken_at,
        scheduled_time,
        tracked_medication_id,
        medication:TrackedMedication(name, dosage)
      `,
      )
      .eq('medication_tracking_day_id', trackingDayId)
      .returns<ExistingDoseRow[]>();

    if (doseError) throw doseError;

    const existingKeySet = new Set(
      existingDoses?.map((d) => `${d.tracked_medication_id}-${d.scheduled_time}`) ?? [],
    );

    /**
     * STEP 3 — fetch active medications
     */
    const { data: meds, error: medsError } = await supabase
      .from('TrackedMedication')
      .select('id, name, schedules:TrackedMedicationSchedule(id, time)')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .returns<MedicationWithSchedules[]>();

    if (medsError) throw medsError;

    /**
     * STEP 4 — generate ONLY missing doses
     */
    const doseRows: CreateDoseRow[] = [];

    meds?.forEach((med) => {
      med.schedules.forEach((schedule) => {
        if (!schedule.id) return;

        const key = `${med.id}-${schedule.time}`;

        if (existingKeySet.has(key)) return;

        doseRows.push({
          medication_tracking_day_id: trackingDayId,
          tracked_medication_id: med.id,
          tracked_medication_schedule_id: schedule.id,
          scheduled_time: schedule.time,
          status: 'pending',
        });
      });
    });

    if (doseRows.length > 0) {
      const { error: insertError } = await supabase
        .from('TrackedMedicationDayDose')
        .insert(doseRows);

      if (insertError) throw insertError;
    }

    /**
     * STEP 5 — refetch updated doses (important)
     */
    const { data: updatedDoses, error: refetchError } = await supabase
      .from('TrackedMedicationDayDose')
      .select(
        `
        id,
        status,
        taken_at,
        scheduled_time,
        tracked_medication_id,
        medication:TrackedMedication(name, dosage)
      `,
      )
      .eq('medication_tracking_day_id', trackingDayId)
      .returns<ExistingDoseRow[]>();

    if (refetchError) throw refetchError;

    /**
     * STEP 6 — update missed doses (your existing logic preserved)
     */
    const sortedDoses = [...(updatedDoses ?? [])].sort((a, b) =>
      a.scheduled_time.localeCompare(b.scheduled_time),
    );

    let currentDoseIndex = -1;

    sortedDoses.forEach((dose, index) => {
      const [hour, minute] = dose.scheduled_time.split(':').map(Number);
      const doseTime = new Date(date);
      doseTime.setUTCHours(hour, minute, 0, 0);

      if (doseTime <= now) currentDoseIndex = index;
    });

    const missedDoseIds: string[] = [];

    sortedDoses.forEach((dose, index) => {
      if (index < currentDoseIndex && dose.status === 'pending') {
        missedDoseIds.push(dose.id);
      }
    });

    if (missedDoseIds.length > 0) {
      await supabase
        .from('TrackedMedicationDayDose')
        .update({ status: 'missed' })
        .in('id', missedDoseIds);

      sortedDoses.forEach((d) => {
        if (missedDoseIds.includes(d.id)) d.status = 'missed';
      });
    }

    /**
     * STEP 7 — response
     */
    const formatted: DailyMedicationDoseDTO[] = sortedDoses.map((dose) => ({
      dose_id: dose.id,
      medication_id: dose.tracked_medication_id,
      name: dose.medication.name,
      dosage: dose.medication.dosage,
      time: dose.scheduled_time,
      taken_at: dose.taken_at ? new Date(dose.taken_at).toISOString() : null,
      status: dose.status,
    }));

    return res.json({ medications: formatted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch daily medications' });
  }
};
