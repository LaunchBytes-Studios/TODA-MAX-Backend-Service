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
     * STEP 1 — fetch existing tracking day
     */
    const { data: existingTrackingDay, error: trackingDayError } = await supabase
      .from('MedicationTrackingDay')
      .select('*')
      .eq('patient_id', patientId)
      .eq('date', date)
      .single();

    if (trackingDayError && trackingDayError.code !== 'PGRST116') throw trackingDayError;

    /**
     * STEP 2 — past date without tracking day → no records
     */
    if (isPast && !existingTrackingDay) return res.json({ medications: [] });

    /**
     * STEP 3 — create tracking day if missing
     */
    let trackingDay = existingTrackingDay;
    if (!existingTrackingDay) {
      const { data, error } = await supabase
        .from('MedicationTrackingDay')
        .insert([{ patient_id: patientId, date, status: 'none' }])
        .select('*')
        .single();

      if (error) throw error;
      trackingDay = data;
    }

    const trackingDayId = trackingDay.id;

    /**
     * STEP 4 — fetch existing doses using scheduled_time
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
        medication:TrackedMedication(name)
      `,
      )
      .eq('medication_tracking_day_id', trackingDayId)
      .returns<ExistingDoseRow[]>();

    if (doseError) throw doseError;

    if (existingDoses && existingDoses.length > 0) {
      // Update missed doses for today/past only
      let currentDoseIndex = -1;

      const sortedDoses = [...existingDoses].sort((a, b) =>
        a.scheduled_time.localeCompare(b.scheduled_time),
      );

      sortedDoses.forEach((dose, index) => {
        const [hour, minute] = dose.scheduled_time.split(':').map(Number);
        const doseTime = new Date(date);
        doseTime.setUTCHours(hour, minute, 0, 0);
        if (doseTime <= now) currentDoseIndex = index;
      });

      const missedDoseIds: string[] = [];
      sortedDoses.forEach((dose, index) => {
        if (index < currentDoseIndex && dose.status === 'pending') missedDoseIds.push(dose.id);
      });

      if (missedDoseIds.length > 0) {
        const { error: updateError } = await supabase
          .from('TrackedMedicationDayDose')
          .update({ status: 'missed' })
          .in('id', missedDoseIds);

        if (updateError) throw updateError;

        sortedDoses.forEach((dose) => {
          if (missedDoseIds.includes(dose.id)) dose.status = 'missed';
        });
      }

      const formatted: DailyMedicationDoseDTO[] = sortedDoses.map((dose) => ({
        dose_id: dose.id,
        medication_id: dose.tracked_medication_id,
        name: dose.medication.name,
        time: dose.scheduled_time,
        taken_at: dose.taken_at ? new Date(dose.taken_at).toISOString() : null,
        status: dose.status,
      }));

      return res.json({ medications: formatted });
    }

    /**
     * STEP 5 — fetch active medications + schedules
     */
    const { data: meds, error: medsError } = await supabase
      .from('TrackedMedication')
      .select('id, name, schedules:TrackedMedicationSchedule(id, time)')
      .eq('patient_id', patientId)
      .eq('is_active', true)
      .returns<MedicationWithSchedules[]>();

    if (medsError) throw medsError;

    /**
     * STEP 6 — generate doses using scheduled_time snapshot
     */
    const doseRows: CreateDoseRow[] = [];
    meds?.forEach((med) => {
      med.schedules.forEach((schedule) => {
        if (!schedule.id) return;

        doseRows.push({
          medication_tracking_day_id: trackingDayId,
          tracked_medication_id: med.id,
          tracked_medication_schedule_id: schedule.id,
          scheduled_time: schedule.time, // ⬅ use schedule snapshot
          status: 'pending',
        });
      });
    });

    if (doseRows.length === 0) return res.json({ medications: [] });

    const { data: insertedDoses, error: insertError } = await supabase
      .from('TrackedMedicationDayDose')
      .insert(doseRows)
      .select(
        `
        id,
        status,
        taken_at,
        scheduled_time,
        tracked_medication_id,
        medication:TrackedMedication(name)
      `,
      )
      .returns<ExistingDoseRow[]>();

    if (insertError) throw insertError;

    const formatted: DailyMedicationDoseDTO[] =
      insertedDoses?.map((dose) => ({
        dose_id: dose.id,
        medication_id: dose.tracked_medication_id,
        name: dose.medication.name,
        time: dose.scheduled_time,
        taken_at: dose.taken_at ? new Date(dose.taken_at).toISOString() : null,
        status: dose.status,
      })) ?? [];

    return res.json({ medications: formatted });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch daily medications' });
  }
};
