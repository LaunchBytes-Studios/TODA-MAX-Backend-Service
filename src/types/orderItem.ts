export interface OrderItem {
  order_id: string;
  medication_id: number;
  quantity: number;
  price: string | number;
  Medication: {
    name: string;
    description: string;
  };
}
