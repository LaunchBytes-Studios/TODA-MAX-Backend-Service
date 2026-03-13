export interface Patient {
  firstname: string;
  surname: string;
  diagnosis: Record<string, boolean> | null;
}
