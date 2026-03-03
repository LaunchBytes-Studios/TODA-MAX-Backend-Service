import { Request, Response } from 'express';
import {
  getOrderByIdService,
  getOrderItemsWithDetailsService,
  createOrderItemService,
  updateOrderItemService,
  deleteOrderItemService,
  createOrderService,
} from '../../services/ordering.service';
import { supabase } from '../../config/db';

// --- Helpers ---

// Catches thrown errors from route handlers and returns a uniform JSON error.
// Respects HttpError.status when thrown (e.g. 401), defaults to 500 otherwise.
const asyncHandler =
  (label: string, fn: (req: Request, res: Response) => Promise<Response>) =>
  async (req: Request, res: Response) => {
    try {
      return await fn(req, res);
    } catch (error: unknown) {
      const status = error instanceof HttpError ? error.status : 500;
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return res.status(status).json({ success: false, message: label, error: msg });
    }
  };

// Thrown when a request lacks a valid patient JWT.
class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const requirePatientId = (req: Request): string => {
  const id = req.user?.userId;
  if (!id) throw new HttpError(401, 'Unauthorized: Patient ID not found');
  return id;
};

// Express params can be string | string[] depending on route config.
const parseId = (idParam: string | string[]): string =>
  Array.isArray(idParam) ? idParam[0] : idParam;

// Checks that the given order actually belongs to this patient.
const verifyOrderOwnership = async (orderId: string, patientId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .from('Order')
    .select('order_id')
    .eq('order_id', orderId)
    .eq('patient_id', patientId)
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return false;
    console.error('Unexpected error verifying order ownership:', error);
    throw error;
  }
  return !!data;
};

// Grabs an order item and confirms the requesting patient owns it.
// Sends 404/403 directly and returns null if the check fails.
const fetchOwnedOrderItem = async (
  req: Request,
  res: Response,
  patientId: string,
) => {
  const id = parseId(req.params.orderItemId);

  const { data: item, error } = await supabase
    .from('OrderItem')
    .select('*, order:Order(patient_id)')
    .eq('order_item_id', id)
    .single();

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') {
      res.status(404).json({ success: false, message: 'Order item not found' });
      return null;
    }
    throw error;
  }
  if (!item) {
    res.status(404).json({ success: false, message: 'Order item not found' });
    return null;
  }

  const owner = item.order as { patient_id: string } | null;
  if (!owner || owner.patient_id !== patientId) {
    res.status(403).json({ success: false, message: 'Forbidden: not your order item' });
    return null;
  }
  return { id, item };
};

// Pulls the canonical price from the Medication table so clients can't tamper with it.
// Returns null (and responds 400) when the medication doesn't exist or has no price.
const fetchMedicationPrice = async (
  res: Response,
  medicationId: number,
): Promise<number | null> => {
  const { data, error } = await supabase
    .from('Medication')
    .select('price')
    .eq('medication_id', medicationId)
    .single();

  if (error || !data || data.price == null) {
    res.status(400).json({ success: false, message: 'Invalid medication_id or no price' });
    return null;
  }
  return data.price as number;
};

// --- Route handlers ---

// GET / — paginated order items scoped to the authenticated patient.
export const getAllOrderItems = asyncHandler('Failed to retrieve order items', async (req, res) => {
  const patientId = requirePatientId(req);

  const { data: orders, error: ordersError } = await supabase
    .from('Order')
    .select('order_id')
    .eq('patient_id', patientId);

  if (ordersError) throw new Error(`Failed to retrieve orders: ${ordersError.message}`);

  const orderIds = orders?.map((o) => o.order_id) || [];

  if (orderIds.length === 0) {
    return res.json({
      success: true,
      message: 'No orders found for this patient',
      data: [],
      meta: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  }

  let query = supabase.from('OrderItem').select('*', { count: 'exact' }).in('order_id', orderIds);

  const orderId = req.query.order_id as string | undefined;
  const medicationId = req.query.medication_id ? parseInt(req.query.medication_id as string) : undefined;
  if (orderId) query = query.eq('order_id', orderId);
  if (medicationId) query = query.eq('medication_id', medicationId);

  const page = req.query.page ? parseInt(req.query.page as string) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const from = (page - 1) * limit;

  query = query.range(from, from + limit - 1).order('order_item_id', { ascending: false });

  const { data: items, error, count } = await query;
  if (error) throw new Error(`Failed to retrieve order items: ${error.message}`);

  return res.json({
    success: true,
    message: 'Order items retrieved successfully',
    data: items || [],
    meta: { total: count || 0, page, limit, totalPages: Math.ceil((count || 0) / limit) },
  });
});

// GET /item/:orderItemId
export const getOrderItemById = asyncHandler('Failed to retrieve order item', async (req, res) => {
  const patientId = requirePatientId(req);
  const result = await fetchOwnedOrderItem(req, res, patientId);
  if (!result) return res; // already responded

  return res.json({ success: true, message: 'Order item retrieved successfully', data: result.item });
});

// GET /:orderId — all items within a single order.
export const getOrderItems = asyncHandler('Failed to retrieve order items', async (req, res) => {
  const patientId = requirePatientId(req);
  const orderId = parseId(req.params.orderId);

  if (!(await verifyOrderOwnership(orderId, patientId))) {
    return res.status(403).json({ success: false, message: 'Forbidden: not your order' });
  }

  const items = await getOrderByIdService(orderId);
  return res.json({ success: true, message: 'Order items retrieved successfully', data: items, total: items.length });
});

// GET /:orderId/details — items + joined medication info.
export const getOrderItemsWithDetails = asyncHandler('Failed to retrieve order items with details', async (req, res) => {
  const patientId = requirePatientId(req);
  const orderId = parseId(req.params.orderId);

  if (!(await verifyOrderOwnership(orderId, patientId))) {
    return res.status(403).json({ success: false, message: 'Forbidden: not your order' });
  }

  const items = await getOrderItemsWithDetailsService(orderId);
  return res.json({ success: true, message: 'Order items with details retrieved successfully', data: items, total: items.length });
});

// POST / — add an item to an existing order.
export const createOrderItem = asyncHandler('Failed to create order item', async (req, res) => {
  const patientId = requirePatientId(req);

  if (!req.body.order_id || req.body.medication_id == null || req.body.quantity == null) {
    return res.status(400).json({ success: false, message: 'Missing required fields: order_id, medication_id, quantity' });
  }

  const orderId = req.body.order_id;
  if (!(await verifyOrderOwnership(orderId, patientId))) {
    return res.status(403).json({ success: false, message: 'Forbidden: not your order' });
  }

  const medicationId = parseInt(req.body.medication_id);
  const quantity = parseInt(req.body.quantity);

  if (isNaN(medicationId) || isNaN(quantity)) {
    return res.status(400).json({ success: false, message: 'medication_id and quantity must be numbers' });
  }
  if (quantity <= 0) {
    return res.status(400).json({ success: false, message: 'Quantity must be greater than 0' });
  }

  const price = await fetchMedicationPrice(res, medicationId);
  if (price === null) return res; // already responded 400

  const item = await createOrderItemService({ order_id: orderId, medication_id: medicationId, quantity, price });
  return res.status(201).json({ success: true, message: 'Order item created successfully', data: item });
});

// PUT /item/:orderItemId
export const updateOrderItem = asyncHandler('Failed to update order item', async (req, res) => {
  const patientId = requirePatientId(req);
  const result = await fetchOwnedOrderItem(req, res, patientId);
  if (!result) return res;

  const updateData: Record<string, unknown> = {};

  if (req.body.quantity !== undefined) {
    const quantity = Number(req.body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive integer' });
    }
    updateData.quantity = quantity;
  }

  if (req.body.medication_id !== undefined) {
    const medicationId = Number(req.body.medication_id);
    if (!Number.isFinite(medicationId) || !Number.isInteger(medicationId)) {
      return res.status(400).json({ success: false, message: 'Invalid medication_id' });
    }
    const price = await fetchMedicationPrice(res, medicationId);
    if (price === null) return res;
    updateData.medication_id = medicationId;
    updateData.price = price;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ success: false, message: 'No fields to update' });
  }

  const updatedItem = await updateOrderItemService(result.id, updateData as Record<string, number>);
  if (!updatedItem) return res.status(404).json({ success: false, message: 'Order item not found' });

  return res.json({ success: true, message: 'Order item updated successfully', data: updatedItem });
});

// DELETE /item/:orderItemId
export const deleteOrderItem = asyncHandler('Failed to delete order item', async (req, res) => {
  const patientId = requirePatientId(req);
  const result = await fetchOwnedOrderItem(req, res, patientId);
  if (!result) return res;

  const deleted = await deleteOrderItemService(result.id);
  if (!deleted) return res.status(404).json({ success: false, message: 'Order item not found' });

  return res.json({ success: true, message: 'Order item deleted successfully' });
});

// POST /checkout — creates an Order row + its OrderItems in one go.
// Prices are always resolved server-side to prevent client tampering.
export const checkout = asyncHandler('Failed to create order', async (req, res) => {
  const patientId = requirePatientId(req);

  if (!req.body.delivery_type) {
    return res.status(400).json({ success: false, message: 'Missing required field: delivery_type' });
  }
  if (!Array.isArray(req.body.items) || req.body.items.length === 0) {
    return res.status(400).json({ success: false, message: 'items must be a non-empty array' });
  }

  const parsedItems: Array<{ medication_id: number; quantity: number }> = [];
  for (const [index, raw] of req.body.items.entries()) {
    if (raw.medication_id == null || raw.quantity == null) {
      return res.status(400).json({ success: false, message: `Missing fields at index ${index}` });
    }
    const medication_id = Number(raw.medication_id);
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(medication_id) || !Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ success: false, message: `Invalid values at index ${index}` });
    }
    parsedItems.push({ medication_id, quantity });
  }

  // Resolve prices from DB — never trust the client payload.
  const uniqueIds = [...new Set(parsedItems.map((i) => i.medication_id))];
  const { data: medications, error: medErr } = await supabase
    .from('Medication')
    .select('medication_id, price')
    .in('medication_id', uniqueIds);

  if (medErr) {
    return res.status(500).json({ success: false, message: 'Failed to fetch medication prices', error: medErr.message });
  }
  if (!medications || medications.length !== uniqueIds.length) {
    return res.status(400).json({ success: false, message: 'One or more medication_ids are invalid' });
  }

  const priceMap = new Map<number, number>();
  for (const m of medications as Array<{ medication_id: number; price: number }>) {
    if (m.price == null) {
      return res.status(400).json({ success: false, message: 'One or more medications have no price' });
    }
    priceMap.set(m.medication_id, m.price);
  }

  const itemsWithPrices = parsedItems.map((i) => ({
    medication_id: i.medication_id,
    quantity: i.quantity,
    price: priceMap.get(i.medication_id)!,
  }));

  const result = await createOrderService(patientId, { delivery_type: req.body.delivery_type, items: itemsWithPrices });

  return res.status(201).json({
    success: true,
    message: 'Order and items created successfully',
    data: { order: result.order, items: result.items, total_items: result.items.length },
  });
});
