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

export type OrderItemRow = {
  order_id: string;
  quantity: number;
  price: number;
  Medication: {
    name: string;
    description: string;
  } | null;
};
