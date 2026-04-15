import { Request, Response } from 'express';
import { supabase } from '../../config/db';

export const updateTrackedMedication = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;
    const { id } = req.params;

    if (!patientId) return res.status(401).json({ error: 'Unauthorized' });

    const { name, dosage, type, quantity, is_active, schedules } = req.body;

    const { data: existing, error: fetchError } = await supabase
      .from('TrackedMedication')
      .select('id, medication_id')
      .eq('id', id)
      .eq('patient_id', patientId)
      .single();

    if (fetchError || !existing) return res.status(404).json({ error: 'Medication not found' });

    // If medication_id exists → only quantity & status allowed
    const updatePayload =
      existing.medication_id !== null
        ? {
            quantity,
            is_active,
            updated_at: new Date().toISOString(),
          }
        : {
            name,
            dosage,
            type,
            quantity,
            is_active,
            updated_at: new Date().toISOString(),
          };

    const { error: updateError } = await supabase
      .from('TrackedMedication')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) throw updateError;

    // ------------------------------
    // UPDATE SCHEDULES + TODAY'S DOSES
    // ------------------------------
    if (Array.isArray(schedules)) {
      // 1️⃣ Delete old schedules
      await supabase.from('TrackedMedicationSchedule').delete().eq('tracked_medication_id', id);

      // 2️⃣ Insert new schedules
      if (schedules.length > 0) {
        const rows = schedules.map((time: string) => ({
          tracked_medication_id: id,
          time,
        }));

        const { error: insertError } = await supabase
          .from('TrackedMedicationSchedule')
          .insert(rows);

        if (insertError) throw insertError;
      }

      // 3️⃣ Update today's doses based on new schedule
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

      // Fetch today's tracking day
      const { data: trackingDay } = await supabase
        .from('MedicationTrackingDay')
        .select('*')
        .eq('patient_id', patientId)
        .eq('date', todayStr)
        .single();

      if (trackingDay) {
        const trackingDayId = trackingDay.id;

        // Get existing doses for today
        const { data: existingDoses } = await supabase
          .from('TrackedMedicationDayDose')
          .select('*')
          .eq('medication_tracking_day_id', trackingDayId)
          .eq('tracked_medication_id', id);

        const takenDoses = existingDoses?.filter((d) => d.status === 'taken') ?? [];

        // Delete non-taken doses (pending or missed)
        const nonTakenIds =
          existingDoses?.filter((d) => d.status !== 'taken').map((d) => d.id) ?? [];
        if (nonTakenIds.length > 0) {
          await supabase.from('TrackedMedicationDayDose').delete().in('id', nonTakenIds);
        }

        // Insert new doses based on updated schedule
        const newDoseTimes = schedules.map((time: string) => ({
          medication_tracking_day_id: trackingDayId,
          tracked_medication_id: id,
          tracked_medication_schedule_id: null, // will link to new schedule if needed
          scheduled_time: time,
          status: 'pending',
        }));

        // Remove duplicates (don't reinsert doses already taken)
        const takenTimes = new Set(takenDoses.map((d) => d.scheduled_time));
        const dosesToInsert = newDoseTimes.filter((d) => !takenTimes.has(d.scheduled_time));

        if (dosesToInsert.length > 0) {
          await supabase.from('TrackedMedicationDayDose').insert(dosesToInsert);
        }
      }
    }

    return res.json({ success: true });
  } catch (err) {
    console.error('updateTrackedMedication error:', err);
    return res.status(500).json({ error: 'Failed to update tracked medication' });
  }
};
