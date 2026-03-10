import { MedicationSummary } from './medication';

export interface OrderItem {
  medication_id: number;
  quantity: number;
  price: string | number;
  Medication: MedicationSummary;
}
