export interface OrderItem {
  order_item_id: string;
  order_id: string;
  medication_id: number;
  quantity: number;
  price: number;
  medication?: {
    name: string;
    dosage: number | null;
  };
}

export interface Order {
  order_id: string;
  patient_id: string;
  status: string;
  order_date: string;
  delivery_type: string;
  delivery_address: string | null;
}

export interface CheckoutItemDTO {
  medication_id: number;
  quantity: number;
  price: number;
}

export interface CreateOrderDTO {
  delivery_type: string;
  items: CheckoutItemDTO[];
  delivery_address?: string;
}
