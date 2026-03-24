import { Request, Response } from 'express';
import { supabase } from '../../config/db';

import { CalendarTrackingRow, CalendarDayStatus } from './trackedMedication.types';

export const getMedicationCalendar = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;
    const { year, month } = req.query;

    if (!patientId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month required' });
    }

    const y = Number(year);
    const m = Number(month) - 1; // frontend sends 1–12

    if (Number.isNaN(y) || Number.isNaN(m)) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    const startDate = new Date(Date.UTC(y, m, 1));
    const endDate = new Date(Date.UTC(y, m + 1, 0));

    const { data, error } = await supabase
      .from('MedicationTrackingDay')
      .select('date, status')
      .eq('patient_id', patientId)
      .gte('date', startDate.toISOString().slice(0, 10))
      .lte('date', endDate.toISOString().slice(0, 10))
      .returns<CalendarTrackingRow[]>();

    if (error) throw error;

    const result: Record<number, CalendarDayStatus> = {};

    data?.forEach((row) => {
      const day = new Date(row.date).getUTCDate();

      let status: CalendarDayStatus;

      switch (row.status) {
        case 'complete':
          status = 'complete';
          break;

        case 'partial':
          status = 'partial';
          break;

        case 'none':
        default:
          status = 'missed';
          break;
      }

      result[day] = status;
    });

    return res.json({ days: result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to fetch calendar' });
  }
};
