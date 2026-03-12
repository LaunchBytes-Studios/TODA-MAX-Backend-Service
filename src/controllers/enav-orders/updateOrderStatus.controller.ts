import { supabase } from '../../config/db';
import { Request, Response } from 'express';

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

    const updateData: { status: string; received_date?: string } = { status: status.toLowerCase() };

    if (status.toLowerCase() === 'preparing') {
      console.log('✅ Condition Met: Order Ready - Deducting Stock...');

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
