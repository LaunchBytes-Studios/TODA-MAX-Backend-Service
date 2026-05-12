import { supabase } from '../../config/db';
import { createOrderService } from '../../services/ordering.service';
import { awardPatientPointsForEvent } from '../../services/patientPoints.service';
import { asyncHandler, HttpError, requirePatientId, sumItemQuantities } from '../../utils/helpers';
import { getUserPushTokens } from '../../utils/getUserPushTokens';
import { sendPushNotifications } from '../../utils/sendPushNotifications';

interface ParsedCheckoutItem {
  medication_id: number;
  quantity: number;
}

interface MedicationPricingRow {
  medication_id: number;
  price: number | null;
  stock_qty: number | null;
}

const getDeliveryType = (value: unknown): 'delivery' | 'pickup' => {
  if (value !== 'pickup' && value !== 'delivery') {
    throw new HttpError(400, "delivery_type must be 'pickup' or 'delivery'");
  }

  return value;
};

const parseCheckoutItems = (items: unknown): ParsedCheckoutItem[] => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, 'items must be a non-empty array');
  }

  const aggregatedMap = new Map<number, number>();

  for (const [index, raw] of items.entries()) {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      !('medication_id' in raw) ||
      !('quantity' in raw)
    ) {
      throw new HttpError(400, `Missing fields at index ${index}`);
    }

    const medication_id = Number(raw.medication_id);
    const quantity = Number(raw.quantity);

    if (!Number.isInteger(medication_id) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new HttpError(400, `Invalid values at index ${index}`);
    }

    aggregatedMap.set(medication_id, (aggregatedMap.get(medication_id) ?? 0) + quantity);
  }

  return Array.from(aggregatedMap.entries()).map(([medication_id, quantity]) => ({
    medication_id,
    quantity,
  }));
};

const getValidatedCheckoutItems = async (
  parsedItems: ParsedCheckoutItem[],
): Promise<Array<{ medication_id: number; quantity: number; price: number }>> => {
  const medicationIds = parsedItems.map((item) => item.medication_id);
  const { data: medications, error } = await supabase
    .from('Medication')
    .select('medication_id, price, stock_qty')
    .in('medication_id', medicationIds);

  if (error) {
    throw new HttpError(500, `Failed to fetch medication prices: ${error.message}`);
  }

  if (!medications || medications.length !== medicationIds.length) {
    throw new HttpError(400, 'One or more medication_ids are invalid');
  }

  const medicationMap = new Map<number, MedicationPricingRow>();
  for (const medication of medications as MedicationPricingRow[]) {
    if (medication.price == null) {
      throw new HttpError(400, 'One or more medications have no price');
    }
    medicationMap.set(medication.medication_id, medication);
  }

  return parsedItems.map((item) => {
    const medication = medicationMap.get(item.medication_id);

    if (!medication) {
      throw new HttpError(400, 'One or more medication_ids are invalid');
    }

    const availableStock = medication.stock_qty ?? 0;
    if (availableStock < item.quantity) {
      throw new HttpError(
        400,
        `Insufficient stock for medication ID ${item.medication_id}. Available: ${availableStock}, requested: ${item.quantity}`,
      );
    }

    return {
      medication_id: item.medication_id,
      quantity: item.quantity,
      price: medication.price as number,
    };
  });
};

const getPatientDeliveryAddress = async (patientId: string): Promise<string> => {
  const { data: patient, error } = await supabase
    .from('Patient')
    .select('address')
    .eq('patient_id', patientId)
    .single();

  if (error || !patient?.address) {
    throw new HttpError(
      400,
      'No address on file for this patient. Please update your profile before placing a delivery order.',
    );
  }

  return patient.address as string;
};

const awardOrderPlacementPoints = async (patientId: string, orderId: string) => {
  try {
    return await awardPatientPointsForEvent({
      patientId,
      eventType: 'order_placement',
      sourceId: orderId,
    });
  } catch (pointsError) {
    console.error('Failed to award order placement points:', pointsError);
    return null;
  }
};

const notifyOrderPlaced = async (patientId: string, orderId: string) => {
  const tokens = await getUserPushTokens(patientId);

  if (tokens.length === 0) {
    return;
  }

  sendPushNotifications(
    tokens,
    'Order Placed',
    `Your order #${orderId} has been placed successfully.`,
    { type: 'order', id: orderId },
  ).catch(console.error);
};

export const checkout = asyncHandler('Failed to create order', async (req, res) => {
  const patientId = requirePatientId(req);
  const deliveryType = getDeliveryType(req.body.delivery_type);
  const parsedItems = parseCheckoutItems(req.body.items);
  const itemsWithPrices = await getValidatedCheckoutItems(parsedItems);

  const deliveryAddress =
    deliveryType === 'delivery' ? await getPatientDeliveryAddress(patientId) : undefined;

  const result = await createOrderService(patientId, {
    delivery_type: deliveryType,
    items: itemsWithPrices,
    delivery_address: deliveryAddress,
  });

  const pointsAward = await awardOrderPlacementPoints(patientId, result.order.order_id);
  await notifyOrderPlaced(patientId, result.order.order_id);

  return res.status(201).json({
    success: true,
    message: 'Order and items created successfully',
    data: {
      order: result.order,
      items: result.items,
      total_items: sumItemQuantities(result.items),
      pointsAward,
    },
  });
});
