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

// Patient JWTs only include userId — do not rely on role/contact being present.
// We reuse the global Express.Request['user'] type from enav.middleware.ts.

// Helper function to safely parse ID
const parseId = (idParam: string | string[]): string => {
  return Array.isArray(idParam) ? idParam[0] : idParam;
};

// Helper function to verify order belongs to patient
const verifyOrderOwnership = async (orderId: string, patientId: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('Order')
      .select('order_id')
      .eq('order_id', orderId)
      .eq('patient_id', patientId)
      .single();

    if (error || !data) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// Get all order items for the authenticated patient with pagination and filters
export const getAllOrderItems = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    const filters = {
      order_id: req.query.order_id as string | undefined,
      medication_id: req.query.medication_id
        ? parseInt(req.query.medication_id as string)
        : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      patientId, // pass patient ID for filtering
    };

    // Get orders for this patient first
    const { data: orders } = await supabase
      .from('Order')
      .select('order_id')
      .eq('patient_id', patientId);

    const orderIds = orders?.map((o) => o.order_id) || [];

    if (orderIds.length === 0) {
      return res.json({
        success: true,
        message: 'No orders found for this patient',
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    }

    // Get order items only for patient's orders
    let query = supabase.from('OrderItem').select('*', { count: 'exact' }).in('order_id', orderIds);

    // Apply order_id filter if provided (constrained to patient's orders)
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

    return res.json({
      success: true,
      message: 'Order items retrieved successfully',
      data: items || [],
      meta: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order items',
      error: errorMessage,
    });
  }
};

// Get single order item by ID (verify it belongs to patient)
export const getOrderItemById = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    const id = parseId(req.params.orderItemId);

    // Get the order item and verify it belongs to patient's order
    const { data: item, error } = await supabase
      .from('OrderItem')
      .select('*, order:Order(patient_id)')
      .eq('order_item_id', id)
      .single();

    if (error || !item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    // Verify the item belongs to the patient
    const itemOrder = item.order as { patient_id: string } | null;
    if (!itemOrder || itemOrder.patient_id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to this order item',
      });
    }

    return res.json({
      success: true,
      message: 'Order item retrieved successfully',
      data: item,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order item',
      error: errorMessage,
    });
  }
};

// Get all items in a specific order for the authenticated patient
export const getOrderItems = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    const orderId = parseId(req.params.orderId);

    // Verify the order belongs to the patient
    const isOwner = await verifyOrderOwnership(orderId, patientId);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to this order',
      });
    }

    const items = await getOrderByIdService(orderId);

    return res.json({
      success: true,
      message: 'Order items retrieved successfully',
      data: items,
      total: items.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order items',
      error: errorMessage,
    });
  }
};

// Get order items with medication details for the authenticated patient
export const getOrderItemsWithDetails = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    const orderId = parseId(req.params.orderId);

    // Verify the order belongs to the patient
    const isOwner = await verifyOrderOwnership(orderId, patientId);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to this order',
      });
    }

    const items = await getOrderItemsWithDetailsService(orderId);

    return res.json({
      success: true,
      message: 'Order items with details retrieved successfully',
      data: items,
      total: items.length,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order items with details',
      error: errorMessage,
    });
  }
};

// Create new order item
export const createOrderItem = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    // Validate required fields — use explicit null/undefined checks for numeric fields
    if (
      !req.body.order_id ||
      req.body.medication_id == null ||
      req.body.quantity == null
    ) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: order_id, medication_id, quantity',
      });
    }

    const orderId = req.body.order_id;

    // Verify the order belongs to the patient
    const isOwner = await verifyOrderOwnership(orderId, patientId);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only add items to your own orders',
      });
    }

    const medicationId = parseInt(req.body.medication_id);
    const quantity = parseInt(req.body.quantity);

    // Validate types
    if (isNaN(medicationId) || isNaN(quantity)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data types: medication_id and quantity must be numbers',
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0',
      });
    }

    // Fetch the authoritative medication price from the database
    const { data: medication, error: medError } = await supabase
      .from('Medication')
      .select('medication_id, price')
      .eq('medication_id', medicationId)
      .single();

    if (medError || !medication) {
      return res.status(400).json({
        success: false,
        message: 'Invalid medication_id: medication not found',
      });
    }

    if (medication.price === null || medication.price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Medication has no price configured',
      });
    }

    const itemData = {
      order_id: orderId,
      medication_id: medicationId,
      quantity,
      price: medication.price as number,
    };

    const item = await createOrderItemService(itemData);

    return res.status(201).json({
      success: true,
      message: 'Order item created successfully',
      data: item,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to create order item',
      error: errorMessage,
    });
  }
};

// Update order item
export const updateOrderItem = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    const id = parseId(req.params.orderItemId);

    // Verify the item belongs to the patient
    const { data: item, error: itemError } = await supabase
      .from('OrderItem')
      .select('*, order:Order(patient_id)')
      .eq('order_item_id', id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    const itemOrder = item.order as { patient_id: string } | null;
    if (!itemOrder || itemOrder.patient_id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only update your own order items',
      });
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (req.body.quantity !== undefined) {
      const quantity = parseInt(req.body.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be a positive number',
        });
      }
      updateData.quantity = quantity;
    }

    if (req.body.price !== undefined) {
      const price = parseFloat(req.body.price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be a non-negative number',
        });
      }
      updateData.price = price;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    const updatedItem = await updateOrderItemService(id, updateData as Record<string, number>);

    if (!updatedItem) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    return res.json({
      success: true,
      message: 'Order item updated successfully',
      data: updatedItem,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to update order item',
      error: errorMessage,
    });
  }
};

// Delete order item
export const deleteOrderItem = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    const id = parseId(req.params.orderItemId);

    // Verify the item belongs to the patient
    const { data: item, error: itemError } = await supabase
      .from('OrderItem')
      .select('*, order:Order(patient_id)')
      .eq('order_item_id', id)
      .single();

    if (itemError || !item) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    const itemOrder = item.order as { patient_id: string } | null;
    if (!itemOrder || itemOrder.patient_id !== patientId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete your own order items',
      });
    }

    const deleted = await deleteOrderItemService(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Order item not found',
      });
    }

    return res.json({
      success: true,
      message: 'Order item deleted successfully',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to delete order item',
      error: errorMessage,
    });
  }
};

// Checkout - Create a new order with items
export const checkout = async (req: Request, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Patient ID not found',
      });
    }

    // Validate required fields
    if (!req.body.delivery_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: delivery_type',
      });
    }

    if (!req.body.items || !Array.isArray(req.body.items) || req.body.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: items (must be a non-empty array)',
      });
    }

    // Validate each item (do not trust client-supplied prices)
    for (const item of req.body.items) {
      if (!item.medication_id || !item.quantity) {
        return res.status(400).json({
          success: false,
          message: 'Each item must have medication_id and quantity',
        });
      }

      if (item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be greater than 0',
        });
      }
    }

    // Look up medication prices server-side to prevent price tampering
    const items = req.body.items as Array<{
      medication_id: number;
      quantity: number;
      // price from client is intentionally ignored
    }>;

    const medicationIds = Array.from(
      new Set(items.map((item) => item.medication_id)),
    );

    const { data: medications, error: medicationsError } = await supabase
      .from('Medication')
      .select('medication_id, price')
      .in('medication_id', medicationIds);

    if (medicationsError) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch medication prices',
        error: medicationsError.message,
      });
    }

    if (!medications || medications.length !== medicationIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more medication_ids are invalid',
      });
    }

    const medicationPriceMap = new Map<number, number>();
    for (const med of medications as Array<{ medication_id: number; price: number }>) {
      if (med.price === null || med.price === undefined) {
        return res.status(400).json({
          success: false,
          message: 'One or more medications have no price configured',
        });
      }
      medicationPriceMap.set(med.medication_id, med.price);
    }

    const itemsWithPrices = items.map((item) => {
      const price = medicationPriceMap.get(item.medication_id);
      if (price === undefined) {
        throw new Error('Medication price lookup failed');
      }
      return {
        medication_id: item.medication_id,
        quantity: item.quantity,
        price,
      };
    });

    const result = await createOrderService(patientId, {
      delivery_type: req.body.delivery_type,
      items: itemsWithPrices,
    });

    return res.status(201).json({
      success: true,
      message: 'Order and items created successfully',
      data: {
        order: result.order,
        items: result.items,
        total_items: result.items.length,
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: errorMessage,
    });
  }
};
