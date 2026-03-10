import { supabase } from '../../config/db';
import { Request, Response } from 'express';
import { Order } from '../../types/order';
import { OrderItem } from '../../types/orderItem';

export const getOrders = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate pagination parameters
    if (limit < 1 || offset < 0) {
      return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    const { data, error, count } = await supabase
      .from('Order')
      .select(
        `
        *,
        Patient ( firstname, surname, diagnosis ),
        OrderItem (
          medication_id,
          quantity,
          price,
          Medication ( name, description )
        )
      `,
        { count: 'exact' },
      )
      .eq('delivery_type', 'delivery')
      .order('order_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return res.status(400).json({ message: error.message });

    const formattedOrders = (data || []).map((order: Order) => {
      const totalAmount =
        order.OrderItem?.reduce(
          (acc: number, item: OrderItem) => acc + Number(item.price) * item.quantity,
          0,
        ) || 0;

      // Format diagnosis from object to string
      let diagnosisString = 'No diagnosis provided';
      if (order.Patient?.diagnosis && typeof order.Patient.diagnosis === 'object') {
        const conditions = Object.entries(order.Patient.diagnosis)
          .filter(([, value]) => value === true)
          .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
          .join(', ');
        if (conditions) {
          diagnosisString = conditions;
        }
      }

      return {
        id: order.order_id,
        order_number: order.order_id.substring(0, 8).toUpperCase(),
        patient_name: order.Patient
          ? `${order.Patient.firstname} ${order.Patient.surname}`
          : 'Unknown',
        patient_diagnosis: diagnosisString,
        created_at: order.order_date,
        received_date: order.received_date || null,
        amount: totalAmount,
        status: order.status,
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address || 'No address provided',
        items:
          order.OrderItem?.map((item: OrderItem) => ({
            name: item.Medication?.name,
            description: item.Medication?.description,
            quantity: item.quantity,
            price: Number(item.price),
          })) || [],
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedOrders,
      pagination: {
        total: count || 0,
        offset,
        limit,
        returned: formattedOrders.length,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Internal Server Error', details: err });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  const ALLOWED_STATUSES = ['pending', 'preparing', 'ready', 'completed', 'rejected'];

  try {
    if (!status) return res.status(400).json({ message: 'Status is required' });
    const newStatus = status.toLowerCase();

    // 1. Fetch the order and items first
    const { data: currentOrder, error: fetchError } = await supabase
      .from('Order')
      .select(`*, OrderItem ( medication_id, quantity )`)
      .eq('order_id', id)
      .single();

    if (fetchError || !currentOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Prepare update object
    const updateData: any = { status: newStatus };

    // 2. Logic: If moving to 'completed', set the received_date
    if (newStatus === 'completed' && !currentOrder.received_date) {
      updateData.received_date = new Date().toISOString();
    }

    // 3. TRIGGER INVENTORY DEDUCTION
    // We check: is the updated status 'completed' OR does the record now have a received_date?
    // We also ensure we only deduct if it hasn't been received before (to prevent double deduction)
    if (!currentOrder.received_date) {
      console.log('Order received! Deducting inventory...');

      if (currentOrder.OrderItem && currentOrder.OrderItem.length > 0) {
        for (const item of currentOrder.OrderItem) {
          // Fetch current stock
          const { data: medication } = await supabase
            .from('Medication')
            .select('stock_qty')
            .eq('medication_id', item.medication_id)
            .single();

          if (medication) {
            const currentStock = medication.stock_qty || 0;
            const newStock = Math.max(0, currentStock - item.quantity);

            // Update Medication Table
            await supabase
              .from('Medication')
              .update({ stock_qty: newStock })
              .eq('medication_id', item.medication_id);

            console.log(
              `Deducted ${item.quantity} from Med ID ${item.medication_id}. New stock: ${newStock}`,
            );
          }
        }
      }
    }

    // 4. Update the Order record
    const { data, error: updateError } = await supabase
      .from('Order')
      .update(updateData)
      .eq('order_id', id)
      .select();

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      message: updateData.received_date
        ? 'Order completed and inventory deducted'
        : 'Status updated',
      data,
    });
  } catch (err) {
    console.error('Error updating status:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
