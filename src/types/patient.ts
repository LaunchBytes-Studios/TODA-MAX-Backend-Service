export interface Patient {
  patient_id: string;
  firstname: string;
  surname: string;
  contact: string;
  address: string;
  sex: string;
  birthday: string;
  philhealth_num: string;
  diagnosis: Record<string, boolean> | null;
  avatar_url: string | null;
}
