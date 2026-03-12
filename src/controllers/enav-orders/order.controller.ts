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

  try {
    console.log(`--- Processing Status Update for Order: ${id} ---`);

    // 1. Fetch Order with Items
    // NOTE: Check if 'OrderItem' needs to be 'order_item' based on your Supabase relationship name
    const { data: currentOrder, error: fetchError } = await supabase
      .from('Order')
      .select(`*, OrderItem ( medication_id, quantity )`)
      .eq('order_id', id)
      .single();

    if (fetchError || !currentOrder) {
      console.error('Fetch Error:', fetchError);
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log(`Current Status: ${currentOrder.status}, New Status: ${status}`);
    console.log(`Existing received_date: ${currentOrder.received_date}`);

    const updateData: any = { status: status.toLowerCase() };

    // Trigger on "completed" if it hasn't been deducted yet
    if (status.toLowerCase() === 'completed' && !currentOrder.received_date) {
      console.log('✅ Condition Met: Order Completed - Deducting Stock...');

      updateData.received_date = new Date().toISOString();

      const items = currentOrder.OrderItem;
      if (!items || items.length === 0) {
        console.warn('⚠️ No items found in this order. Skipping deduction.');
      } else {
        for (const item of items) {
          console.log(`Processing Item: MedID ${item.medication_id}, Qty ${item.quantity}`);

          // Get current stock
          const { data: med, error: medError } = await supabase
            .from('Medication')
            .select('stock_qty')
            .eq('medication_id', item.medication_id)
            .single();

          if (medError || !med) {
            console.error(`❌ Could not find Medication ${item.medication_id}:`, medError);
            continue;
          }

          const oldStock = med.stock_qty || 0;
          const newStock = Math.max(0, oldStock - item.quantity);

          console.log(`Updating Stock: ${oldStock} -> ${newStock}`);

          // UPDATE THE MEDICATION TABLE
          const { error: invError } = await supabase
            .from('Medication')
            .update({ stock_qty: newStock })
            .eq('medication_id', item.medication_id);

          if (invError) {
            console.error(`❌ INVENTORY UPDATE FAILED for Med ${item.medication_id}:`, invError);
          } else {
            console.log(`Successfully updated inventory for Med ${item.medication_id}`);
          }
        }
      }
    }

    // Update the Order status at the end
    const { error: finalError } = await supabase
      .from('Order')
      .update(updateData)
      .eq('order_id', id);

    if (finalError) throw finalError;

    return res.status(200).json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
