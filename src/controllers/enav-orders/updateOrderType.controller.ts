import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const updateOrderType = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { delivery_type } = req.body;

  try {
    console.log(`--- Processing Type Update for Order: ${id} ---`);

    if (delivery_type !== 'delivery' && delivery_type !== 'pickup') {
      return res.status(400).json({ message: 'Invalid delivery type' });
    }

    const { data: currentOrder, error: fetchError } = await supabase
      .from('Order')
      .select('order_id')
      .eq('order_id', id)
      .single();

    if (fetchError || !currentOrder) {
      console.error('Fetch Error:', fetchError);
      return res.status(404).json({ message: 'Order not found' });
    }

    console.log(`Updating Type: ${delivery_type}`);

    const { error: updateError } = await supabase
      .from('Order')
      .update({ delivery_type })
      .eq('order_id', id);

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ success: true, message: 'Order type updated successfully' });
  } catch (err) {
    console.error('CRITICAL ERROR:', err);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
