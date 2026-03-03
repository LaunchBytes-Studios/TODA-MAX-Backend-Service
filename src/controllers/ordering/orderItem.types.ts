// filepath: src/controllers/ordering/orderItem.types.ts

export interface OrderItem {
  order_item_id: string;
  order_id: string;
  medication_id: number;
  quantity: number;
  price: number;
  medication?: {
    name: string;
    type: string;
  };
}

export interface CreateOrderItemDTO {
  order_id: string;
  medication_id: number;
  quantity: number;
  price: number;
}

export interface UpdateOrderItemDTO {
  /**
   * Optionally change the medication associated with this order item.
   * When provided, the server will re-calculate the price.
   */
  medication_id?: number;
  /**
   * Optionally change the quantity. The server may re-calculate the price.
   */
  quantity?: number;
  /**
   * Server-derived field — not accepted from the client.
   * Included here so the service layer can persist the re-calculated value.
   */
  price?: number;
}

export interface Order {
  order_id: string;
  patient_id: string;
  status: string;
  order_date: string;
  delivery_type: string;
}

export interface CheckoutItemDTO {
  medication_id: number;
  quantity: number;
  price: number;
}

export interface CreateOrderDTO {
  delivery_type: string;
  items: CheckoutItemDTO[];
}
