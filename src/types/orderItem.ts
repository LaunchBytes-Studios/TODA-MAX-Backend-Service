import { MedicationSummary } from './medication';

export interface OrderItem {
  quantity: number;
  price: string | number;
  Medication: MedicationSummary;
}
