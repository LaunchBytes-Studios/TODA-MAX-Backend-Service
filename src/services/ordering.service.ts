import { supabase } from '../config/db';
import { ORDER_STATUS } from '../constants/orderStatus';
import {
  OrderItem,
  Order,
  CreateOrderDTO,
} from '../types/ordering/orderItem.types';

export const createOrderService = async (
  patientId: string,
  data: CreateOrderDTO,
): Promise<{ order: Order; items: OrderItem[] }> => {
  // create the order
  const { data: order, error } = await supabase
    .from('Order')
    .insert([
      {
        patient_id: patientId,
        status: 'pending',
        order_date: new Date().toISOString(),
        delivery_type: data.delivery_type,
        delivery_address: data.delivery_type === 'delivery' ? (data.delivery_address ?? null) : null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }

  // insert order items
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
      // mark as rejected if items fail — keeps an audit trail
      const { error: updateOrderError } = await supabase
        .from('Order')
        .update({ status: ORDER_STATUS.REJECTED })
        .eq('order_id', order.order_id);

      if (updateOrderError) {
        console.error(
          'Failed to mark order as rejected after item creation failure:',
          updateOrderError,
        );
      }

      throw new Error(`Failed to create order items: ${itemsError.message}`);
    }

    createdItems = items || [];
  }

  return { order, items: createdItems };
};
