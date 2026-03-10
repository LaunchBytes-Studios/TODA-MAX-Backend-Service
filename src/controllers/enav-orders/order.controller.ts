import { supabase } from '../../config/db';
import { Request, Response } from 'express';
import { Order } from '../../types/order';
import { OrderItem } from '../../types/orderItem';

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
      .eq('delivery_type', 'delivery')
      .order('order_date', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    const formattedOrders = data.map((order: Order) => {
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

    return res.status(200).json(formattedOrders);
  } catch (err) {
    return res.status(500).json({ message: 'Internal Server Error', details: err });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Status
    const { data, error } = await supabase
      .from('Order')
      .update({ status })
      .eq('order_id', id)
      .select();

    if (error) return res.status(400).json({ message: error.message });

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ message: 'Internal Server Error', details: err });
  }
};
