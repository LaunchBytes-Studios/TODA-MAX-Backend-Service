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
  quantity?: number;
  price?: number;
}

export interface GetOrderItemsFilters {
  order_id?: string;
  medication_id?: number;
  page?: number;
  limit?: number;
}

export interface PaginatedOrderItemResponse {
  items: OrderItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
