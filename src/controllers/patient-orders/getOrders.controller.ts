import { supabase } from '../../config/db';
import { asyncHandler, requirePatientId } from '../../utils/helpers';

export const getPatientOrders = asyncHandler('Failed to retrieve orders', async (req, res) => {
  const patientId = requirePatientId(req);

  const { data: orders, error } = await supabase
    .from('Order')
    .select(
      'order_id, patient_id, status, order_date, delivery_type, delivery_address, received_date, items:OrderItem(quantity, medication:Medication(name, dosage))',
    )
    .eq('patient_id', patientId)
    .order('order_date', { ascending: false });

  if (error) throw new Error(`Failed to retrieve orders: ${error.message}`);

  const normalized = (orders ?? []).map((o) => {
    const itemsList = Array.isArray(o.items)
      ? (o.items as unknown as Array<{
          quantity: number;
          medication: { name: string; dosage: number | null } | null;
        }>)
      : [];

    return {
      order_id: o.order_id as string,
      patient_id: o.patient_id as string,
      status: o.status as string,
      order_date: o.order_date as string,
      delivery_type: o.delivery_type as string,
      delivery_address: o.delivery_address as string | null,
      received_date: (o.received_date as string | null) ?? null,
      total_items: itemsList.reduce((sum, item) => sum + (item.quantity || 0), 0),
      items: itemsList,
    };
  });

  return res.json({ success: true, message: 'Orders retrieved successfully', data: normalized });
});
