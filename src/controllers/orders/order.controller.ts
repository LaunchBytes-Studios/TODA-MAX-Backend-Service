// backend/controllers/orders/order.controller.ts
import { supabase } from '../../config/db';
import { Request, Response } from 'express';

export const getOrders = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('Order')
      .select(
        `
        *,
        Patient ( firstname, surname, diagnosis ),
        OrderItem (
          quantity,
          price,
          Medication ( name, description )
        )
      `,
      )
      .order('order_date', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    const formattedOrders = data.map((order: any) => {
      const totalAmount =
        order.OrderItem?.reduce(
          (acc: number, item: any) => acc + Number(item.price) * item.quantity,
          0,
        ) || 0;

      return {
        id: order.order_id,
        order_number: order.order_id.substring(0, 8).toUpperCase(),
        patient_name: order.Patient
          ? `${order.Patient.firstname} ${order.Patient.surname}`
          : 'Unknown',
        patient_diagnosis: order.Patient?.diagnosis || 'No diagnosis provided',
        created_at: order.order_date,
        amount: totalAmount,
        status: order.status,
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address || 'No address provided',
        items:
          order.OrderItem?.map((item: any) => ({
            name: item.Medication?.name,
            description: item.Medication?.description,
            quantity: item.quantity,
            price: Number(item.price),
          })) || [],
      };
    });

    return res.status(200).json(formattedOrders);
  } catch (err) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Add this new function to your controller file
export const updateOrderStatus = async (req: Request, res: Response) => {
  // Ensure "id" matches the ":id" in the router definition
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Convert status format: 'out_for_delivery' -> 'out for delivery'
    const formattedStatus = status.replace(/_/g, ' ');

    const { data, error } = await supabase
      .from('Order')
      .update({ status: formattedStatus })
      .eq('order_id', id) // Ensure this is order_id in your DB
      .select();

    if (error) return res.status(400).json({ message: error.message });

    // IMPORTANT: Always send a response so the frontend doesn't hang
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};
