// ===== Shared =====

export type UUID = string;

export type DoseStatus = 'pending' | 'taken' | 'missed';
export type TrackingDayStatus = 'none' | 'partial' | 'complete';
export type CalendarDayStatus = 'complete' | 'partial' | 'missed';

// ===== DB QUERY RESULT =====

export interface CalendarTrackingRow {
  date: string; // YYYY-MM-DD
  status: TrackingDayStatus;
}

export interface TrackedMedicationScheduleRow {
  time: string;
}

export interface TrackedMedicationRow {
  id: UUID;
  name: string;
  dosage: string | null;
  type: string | null;
  quantity: number | null;
  medication_id: number | null;
  is_active: boolean;

  schedules: TrackedMedicationScheduleRow[];
}

export interface TrackedMedicationDayDoseRow {
  id: UUID;
  status: DoseStatus;
  tracked_medication_id: UUID;
  medication_tracking_day_id: UUID;
  scheduled_time: string;
}

export interface TrackedMedicationPatientRow {
  patient_id: UUID;
}

// ===== Database Tables =====

export interface MedicationTrackingDay {
  id: UUID;
  patient_id: UUID;
  date: string; // YYYY-MM-DD
  status: TrackingDayStatus;
  created_at: string;
  updated_at: string;
}

export interface TrackedMedication {
  id: UUID;
  patient_id: UUID;
  name: string;
  is_active: boolean;
}

export interface TrackedMedicationSchedule {
  id: UUID;
  time: string; // HH:mm:ss
  tracked_medication_id: UUID;
}

export interface TrackedMedicationDayDose {
  id: UUID;
  medication_tracking_day_id: UUID;
  tracked_medication_id: UUID;
  tracked_medication_schedule_id: UUID;
  status: DoseStatus;
  taken_at: string | null;
  scheduled_time: string;
}

export interface MedicationWithSchedules {
  id: UUID;
  name: string;

  schedules: {
    id: UUID;
    time: string;
  }[];
}

export interface ExistingDoseRow {
  id: UUID;
  status: DoseStatus;
  taken_at: string | null;
  tracked_medication_id: UUID;
  scheduled_time: string;

  schedule: {
    time: string;
  };

  medication: {
    name: string;
  };
}

// ===== API RESPONSE DTO =====

export interface TrackedMedicationDTO {
  id: UUID;
  name: string;
  dosage: string | null;
  type: string | null;
  quantity: number | null;
  medication_id: number | null;
  is_active: boolean;

  schedules: string[]; // sorted time strings
}

export interface GetTrackedMedicationsResponse {
  medications: TrackedMedicationDTO[];
}

export interface DailyMedicationDoseDTO {
  dose_id: UUID | string; // string for dummy IDs
  medication_id: UUID;
  name: string;
  time: string;
  taken_at: string | null;
  status: DoseStatus;
}

// ===== INSERT PAYLOAD =====

export interface CreateDoseRow {
  medication_tracking_day_id: UUID;
  tracked_medication_id: UUID;
  tracked_medication_schedule_id: UUID;
  status: 'pending';
  scheduled_time: string;
}
