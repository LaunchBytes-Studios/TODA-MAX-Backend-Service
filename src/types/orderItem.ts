import { Medication } from './medication';

export interface OrderItem {
  quantity: number;
  price: string | number;
  Medication: Medication;
}
