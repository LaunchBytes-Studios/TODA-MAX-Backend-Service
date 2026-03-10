import { supabase } from '../../config/db';
import { ORDER_STATUS } from '../../constants/orderStatus';
import { asyncHandler, requirePatientId, parseId } from '../../utils/helpers';

// PATCH /:orderId/confirm — patient confirms they received the order.
// Only allowed when status is 'ready'; transitions to 'completed'.
export const confirmOrder = asyncHandler('Failed to confirm order', async (req, res) => {
  const patientId = requirePatientId(req);
  const orderId = parseId(req.params.orderId);

  const { data: order, error: fetchErr } = await supabase
    .from('Order')
    .select('order_id, patient_id, status')
    .eq('order_id', orderId)
    .single();

  if (fetchErr || !order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  const currentOrder = order as { order_id: string; patient_id: string; status: string };

  if (currentOrder.patient_id !== patientId) {
    return res.status(403).json({ success: false, message: 'Forbidden: not your order' });
  }

  if (currentOrder.status !== ORDER_STATUS.READY) {
    return res.status(400).json({
      success: false,
      message: `Order cannot be confirmed. Current status: ${currentOrder.status}`,
    });
  }

  const { data: updated, error: updateErr } = await supabase
    .from('Order')
    .update({ status: ORDER_STATUS.COMPLETED, received_date: new Date().toISOString() })
    .eq('order_id', orderId)
    .select()
    .single();

  if (updateErr) throw new Error(`Failed to update order: ${updateErr.message}`);

  return res.json({ success: true, message: 'Order confirmed successfully', data: updated });
});
