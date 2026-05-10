import { supabase } from '../../config/db';
import { ORDER_STATUS } from '../../constants/orderStatus';
import { getUserPushTokens } from '../../utils/getUserPushTokens';
import { asyncHandler, requirePatientId, parseId } from '../../utils/helpers';
import { sendPushNotifications } from '../../utils/sendPushNotifications';

export const confirmOrder = asyncHandler('Failed to confirm order', async (req, res) => {
  const patientId = requirePatientId(req);
  const orderId = parseId(req.params.orderId);

  const { data: updated, error: updateErr } = await supabase
    .from('Order')
    .update({
      status: ORDER_STATUS.COMPLETED,
      received_date: new Date().toISOString(),
    })
    .eq('order_id', orderId)
    .eq('patient_id', patientId)
    .eq('status', ORDER_STATUS.READY)
    .select()
    .maybeSingle();

  if (updateErr && updateErr.code !== 'PGRST116') {
    throw new Error(`Failed to update order: ${updateErr.message}`);
  }

  if (!updated) {
    const { data: order, error: fetchErr } = await supabase
      .from('Order')
      .select('order_id, patient_id, status')
      .eq('order_id', orderId)
      .single();

    if (fetchErr || !order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const currentOrder = order as {
      order_id: string;
      patient_id: string;
      status: string;
    };

    if (currentOrder.patient_id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: not your order',
      });
    }

    return res.status(400).json({
      success: false,
      message: `Order cannot be confirmed. Current status: ${currentOrder.status}`,
    });
  }

  const tokens = await getUserPushTokens(patientId);

  if (tokens.length > 0) {
    sendPushNotifications(
      tokens,
      'Order Completed',
      'Your order has been marked as completed. Thank you!',
      { type: 'order', id: orderId },
    ).catch(console.error);
  }

  const { data: orderItems, error: itemsErr } = await supabase
    .from('OrderItem')
    .select('medication_id, quantity')
    .eq('order_id', orderId);

  if (itemsErr) {
    throw new Error(`Failed to fetch order items: ${itemsErr.message}`);
  }

  if (orderItems?.length) {
    for (const item of orderItems) {
      const { medication_id, quantity } = item;

      const { data: tracked, error: trackErr } = await supabase
        .from('TrackedMedication')
        .select('id, quantity')
        .eq('patient_id', patientId)
        .eq('medication_id', medication_id)
        .single();

      if (trackErr || !tracked) {
        continue;
      }

      const newQuantity = (tracked.quantity ?? 0) + quantity;

      const { error: updateErr } = await supabase
        .from('TrackedMedication')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq('id', tracked.id);

      if (updateErr) {
        console.error(`Failed to update tracked medication ${medication_id}:`, updateErr.message);
      }
    }
  }

  return res.json({ success: true, message: 'Order confirmed successfully', data: updated });
});
