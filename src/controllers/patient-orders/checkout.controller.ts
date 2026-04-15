import { supabase } from '../../config/db';
import { createOrderService } from '../../services/ordering.service';
import { asyncHandler, requirePatientId, sumItemQuantities } from '../../utils/helpers';

export const checkout = asyncHandler('Failed to create order', async (req, res) => {
  const patientId = requirePatientId(req);

  if (req.body.delivery_type !== 'pickup' && req.body.delivery_type !== 'delivery') {
    return res
      .status(400)
      .json({ success: false, message: "delivery_type must be 'pickup' or 'delivery'" });
  }
  const deliveryType = req.body.delivery_type as 'delivery' | 'pickup';

  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
  }

  const rawParsedItems: Array<{ medication_id: number; quantity: number }> = [];
  for (const [index, raw] of req.body.items.entries()) {
    if (raw.medication_id == null || raw.quantity == null) {
      return res.status(400).json({ success: false, message: `Missing fields at index ${index}` });
    }
    const medication_id = Number(raw.medication_id);
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(medication_id) || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: `Invalid values at index ${index}` });
    }
    rawParsedItems.push({ medication_id, quantity });
  }

  // Aggregate quantities per medication_id so duplicate entries cannot bypass stock validation
  const aggregatedMap = new Map<number, number>();
  for (const item of rawParsedItems) {
    aggregatedMap.set(
      item.medication_id,
      (aggregatedMap.get(item.medication_id) ?? 0) + item.quantity,
    );
  }
  const parsedItems = Array.from(aggregatedMap.entries()).map(([medication_id, quantity]) => ({
    medication_id,
    quantity,
  }));

  // prices and stock come from DB, not the client
  const uniqueIds = [...new Set(parsedItems.map((i) => i.medication_id))];
  const { data: medications, error: medErr } = await supabase
    .from('Medication')
    .select('medication_id, price, stock_qty')
    .in('medication_id', uniqueIds);

  if (medErr) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch medication prices',
      error: medErr.message,
    });
  }
  if (!medications || medications.length !== uniqueIds.length) {
    return res
      .status(400)
      .json({ success: false, message: 'One or more medication_ids are invalid' });
  }

  const priceMap = new Map<number, number>();
  const stockMap = new Map<number, number>();
  for (const m of medications as Array<{
    medication_id: number;
    price: number;
    stock_qty: number;
  }>) {
    if (m.price == null) {
      return res
        .status(400)
        .json({ success: false, message: 'One or more medications have no price' });
    }
    priceMap.set(m.medication_id, m.price);
    stockMap.set(m.medication_id, m.stock_qty ?? 0);
  }

  for (const item of parsedItems) {
    const available = stockMap.get(item.medication_id) ?? 0;
    if (available < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for medication ID ${item.medication_id}. Available: ${available}, requested: ${item.quantity}`,
      });
    }
  }

  const itemsWithPrices = parsedItems.map((i) => ({
    medication_id: i.medication_id,
    quantity: i.quantity,
    price: priceMap.get(i.medication_id)!,
  }));

  let deliveryAddress: string | undefined;
  if (deliveryType === 'delivery') {
    const { data: patient, error: patientErr } = await supabase
      .from('Patient')
      .select('address')
      .eq('patient_id', patientId)
      .single();

    if (patientErr || !patient?.address) {
      return res.status(400).json({
        success: false,
        message:
          'No address on file for this patient. Please update your profile before placing a delivery order.',
      });
    }
    deliveryAddress = patient.address as string;
  }

  const result = await createOrderService(patientId, {
    delivery_type: deliveryType,
    items: itemsWithPrices,
    delivery_address: deliveryAddress,
  });

  return res.status(201).json({
    success: true,
    message: 'Order and items created successfully',
    data: {
      order: result.order,
      items: result.items,
      total_items: sumItemQuantities(result.items),
    },
  });
});
