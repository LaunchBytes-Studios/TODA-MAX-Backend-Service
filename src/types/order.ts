import { Patient } from './patient';
import { OrderItem } from './orderItem';

export interface Order {
  order_id: string;
  order_date: string;
  received_date: string | null;
  status: string;
  delivery_type: string;
  delivery_address: string | null;
  Patient: Patient;
  OrderItem: OrderItem[];
}
