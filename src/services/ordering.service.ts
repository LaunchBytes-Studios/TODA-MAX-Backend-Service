import { supabase } from '../config/db';
import {
  OrderItem,
  CreateOrderItemDTO,
  UpdateOrderItemDTO,
  Order,
  CreateOrderDTO,
  PaginatedOrderResponse,
  GetOrderItemsFilters,
  PaginatedOrderItemResponse,
} from '../controllers/ordering/orderItem.types';

// Get all order items with optional filters
export const getOrderItemsService = async (
  filters: GetOrderItemsFilters,
): Promise<PaginatedOrderItemResponse> => {
  let query = supabase.from('OrderItem').select('*', { count: 'exact' });

  if (filters.order_id) {
    query = query.eq('order_id', filters.order_id);
  }

  if (filters.medication_id) {
    query = query.eq('medication_id', filters.medication_id);
  }

  const page = filters.page || 1;
  const limit = filters.limit || 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to).order('order_item_id', { ascending: false });

  const { data: items, error, count } = await query;

  if (error) {
    throw new Error(`Failed to retrieve order items: ${error.message}`);
  }

  return {
    items: items || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
};

// Get single order item by ID
export const getOrderItemByIdService = async (id: string): Promise<OrderItem | null> => {
  const { data: item, error } = await supabase
    .from('OrderItem')
    .select('*')
    .eq('order_item_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to retrieve order item: ${error.message}`);
  }

  return item;
};

// Get all items for a specific order
export const getOrderByIdService = async (orderId: string): Promise<OrderItem[]> => {
  const { data: items, error } = await supabase
    .from('OrderItem')
    .select('*')
    .eq('order_id', orderId)
    .order('order_item_id', { ascending: true });

  if (error) {
    throw new Error(`Failed to retrieve order items: ${error.message}`);
  }

  return items || [];
};

// Get all orders for a patient with pagination
export const getPatientOrdersService = async (
  patientId: string,
  filters?: {
    status?: string;
    page?: number;
    limit?: number;
  },
): Promise<PaginatedOrderResponse> => {
  let query = supabase
    .from('Order')
    .select('*', { count: 'exact' })
    .eq('patient_id', patientId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const page = filters?.page || 1;
  const limit = filters?.limit || 10;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to).order('order_date', { ascending: false });

  const { data: orders, error, count } = await query;

  if (error) {
    throw new Error(`Failed to retrieve patient orders: ${error.message}`);
  }

  return {
    orders: orders || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
};

// Create new order item
export const createOrderItemService = async (data: CreateOrderItemDTO): Promise<OrderItem> => {
  const { data: item, error } = await supabase
    .from('OrderItem')
    .insert([
      {
        order_id: data.order_id,
        medication_id: data.medication_id,
        quantity: data.quantity,
        price: data.price,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create order item: ${error.message}`);
  }

  return item;
};

// Update order item
export const updateOrderItemService = async (
  id: string,
  data: UpdateOrderItemDTO,
): Promise<OrderItem | null> => {
  const { data: item, error } = await supabase
    .from('OrderItem')
    .update(data)
    .eq('order_item_id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to update order item: ${error.message}`);
  }

  return item;
};

// Delete order item
export const deleteOrderItemService = async (id: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('OrderItem')
    .delete()
    .eq('order_item_id', id)
    .select('order_item_id');

  if (error) {
    throw new Error(`Failed to delete order item: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
};

// Get order items with medication details
export const getOrderItemsWithDetailsService = async (orderId: string): Promise<OrderItem[]> => {
  const { data: items, error } = await supabase
    .from('OrderItem')
    .select('*, medication:Medication(name, type)')
    .eq('order_id', orderId);

  if (error) {
    throw new Error(`Failed to retrieve order items: ${error.message}`);
  }

  return items || [];
};

// Create new order with order items
export const createOrderService = async (
  patientId: string,
  data: CreateOrderDTO,
): Promise<{ order: Order; items: OrderItem[] }> => {
  const today = new Date().toISOString().split('T')[0];

  // Step 1: Create the Order
  const { data: order, error } = await supabase
    .from('Order')
    .insert([
      {
        patient_id: patientId,
        status: 'pending',
        order_date: today,
        delivery_type: data.delivery_type,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  // Step 2: Create OrderItems if items are provided
  let createdItems: OrderItem[] = [];

  if (data.items && data.items.length > 0) {
    const orderItems = data.items.map((item) => ({
      order_id: order.order_id,
      medication_id: item.medication_id,
      quantity: item.quantity,
      price: item.price,
    }));

    const { data: items, error: itemsError } = await supabase
      .from('OrderItem')
      .insert(orderItems)
      .select();

    if (itemsError) {
      // If items creation fails, attempt to rollback by deleting the created order
      const { error: deleteOrderError } = await supabase
        .from('Order')
        .delete()
        .eq('order_id', order.order_id);

      if (deleteOrderError) {
        console.error('Failed to rollback order after item creation failure:', deleteOrderError);
      }

      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    createdItems = items || [];
  }

  return { order, items: createdItems };
};
