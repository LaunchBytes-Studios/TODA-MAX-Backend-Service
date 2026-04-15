export interface Order {
  order_id: string;
  patient_id: string;
  order_date: string;
  received_date: string | null;
  status: string | null;
  delivery_type: string | null;
  delivery_address: string | null;
}
