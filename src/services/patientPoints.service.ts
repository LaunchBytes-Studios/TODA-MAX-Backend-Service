import { supabase } from '../config/db';

export type PatientPointEventType =
  | 'daily_medication_completion'
  | 'daily_app_usage'
  | 'order_placement';

type AwardPointsInput = {
  patientId: string;
  eventType: PatientPointEventType;
  sourceId?: string;
  occurredAt?: Date;
};

export type AwardPointsResult = {
  eventType: PatientPointEventType;
  eventDate: string;
  requestedPoints: number;
  awardedPoints: number;
  alreadyAwarded: boolean;
  capped: boolean;
  currentPoints: number;
  dailyTotal: number;
  dailyCap: number;
};

type PatientPointsRow = {
  points: number | null;
};

type PointEventRow = {
  points_awarded: number | null;
};

type InsertedPointEventRow = {
  event_id: string;
};

const EVENT_POINTS: Record<PatientPointEventType, number> = {
  daily_medication_completion: 2,
  daily_app_usage: 1,
  order_placement: 3,
};

const DAILY_POINTS_CAP = 6;
const DAILY_TIMEZONE = process.env.POINTS_TIMEZONE || 'Asia/Manila';

const toDayKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to resolve event date key');
  }

  return `${year}-${month}-${day}`;
};

const getPatientCurrentPoints = async (patientId: string): Promise<number> => {
  const { data, error } = await supabase
    .from('Patient')
    .select('points')
    .eq('patient_id', patientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to retrieve patient points: ${error.message}`);
  }

  return (data as PatientPointsRow | null)?.points ?? 0;
};

const getDailyAwardedTotal = async (patientId: string, eventDate: string): Promise<number> => {
  const { data, error } = await supabase
    .from('PatientPointEvent')
    .select('points_awarded')
    .eq('patient_id', patientId)
    .eq('event_date', eventDate);

  if (error) {
    throw new Error(`Failed to retrieve daily awarded points: ${error.message}`);
  }

  return ((data ?? []) as PointEventRow[]).reduce((sum, row) => sum + (row.points_awarded ?? 0), 0);
};

export const awardPatientPointsForEvent = async ({
  patientId,
  eventType,
  sourceId,
  occurredAt = new Date(),
}: AwardPointsInput): Promise<AwardPointsResult> => {
  const requestedPoints = EVENT_POINTS[eventType];
  const eventDate = toDayKey(occurredAt);
  const normalizedSourceId =
    sourceId?.trim() || (eventType === 'order_placement' ? undefined : eventDate);

  if (!normalizedSourceId) {
    throw new Error(`sourceId is required for ${eventType}`);
  }

  const { data: existingEvent, error: existingError } = await supabase
    .from('PatientPointEvent')
    .select('event_id')
    .eq('patient_id', patientId)
    .eq('event_type', eventType)
    .eq('source_id', normalizedSourceId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to validate existing point event: ${existingError.message}`);
  }

  const currentPointsBefore = await getPatientCurrentPoints(patientId);
  const dailyTotalBefore = await getDailyAwardedTotal(patientId, eventDate);

  if (existingEvent) {
    return {
      eventType,
      eventDate,
      requestedPoints,
      awardedPoints: 0,
      alreadyAwarded: true,
      capped: dailyTotalBefore >= DAILY_POINTS_CAP,
      currentPoints: currentPointsBefore,
      dailyTotal: dailyTotalBefore,
      dailyCap: DAILY_POINTS_CAP,
    };
  }

  const remainingDailyAllowance = Math.max(0, DAILY_POINTS_CAP - dailyTotalBefore);
  const awardedPoints = Math.min(requestedPoints, remainingDailyAllowance);

  const { data: insertedEvent, error: insertError } = await supabase
    .from('PatientPointEvent')
    .insert([
      {
        patient_id: patientId,
        event_type: eventType,
        event_date: eventDate,
        source_id: normalizedSourceId,
        points_requested: requestedPoints,
        points_awarded: awardedPoints,
        created_at: new Date().toISOString(),
      },
    ])
    .select('event_id')
    .single<InsertedPointEventRow>();

  if (insertError) {
    const isDuplicate = insertError.code === '23505';

    if (isDuplicate) {
      const currentPoints = await getPatientCurrentPoints(patientId);
      const dailyTotal = await getDailyAwardedTotal(patientId, eventDate);
      return {
        eventType,
        eventDate,
        requestedPoints,
        awardedPoints: 0,
        alreadyAwarded: true,
        capped: dailyTotal >= DAILY_POINTS_CAP,
        currentPoints,
        dailyTotal,
        dailyCap: DAILY_POINTS_CAP,
      };
    }

    throw new Error(`Failed to record point event: ${insertError.message}`);
  }

  let currentPoints = currentPointsBefore;

  if (awardedPoints > 0) {
    currentPoints = currentPointsBefore + awardedPoints;

    const { error: updateError } = await supabase
      .from('Patient')
      .update({ points: currentPoints })
      .eq('patient_id', patientId);

    if (updateError) {
      if (insertedEvent?.event_id) {
        const { error: rollbackError } = await supabase
          .from('PatientPointEvent')
          .delete()
          .eq('event_id', insertedEvent.event_id);

        if (rollbackError) {
          console.error(
            `Failed to roll back point event ${insertedEvent.event_id}: ${rollbackError.message}`,
          );
        }
      }

      throw new Error(`Failed to update patient points: ${updateError.message}`);
    }
  }

  return {
    eventType,
    eventDate,
    requestedPoints,
    awardedPoints,
    alreadyAwarded: false,
    capped: awardedPoints < requestedPoints,
    currentPoints,
    dailyTotal: dailyTotalBefore + awardedPoints,
    dailyCap: DAILY_POINTS_CAP,
  };
};
