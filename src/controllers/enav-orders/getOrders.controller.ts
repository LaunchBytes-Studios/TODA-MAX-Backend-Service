import { supabase } from '../../config/db';
import { Request, Response } from 'express';
import { Order as DBOrder } from '../../types/order';

export const getOrders = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    if (limit < 1 || offset < 0) {
      return res.status(400).json({ message: 'Invalid pagination parameters' });
    }

    let query = supabase.from('Order').select('*', { count: 'exact' });

    if (req.query.status) {
      query = query.eq('status', req.query.status);
    }
    if (req.query.delivery_type) {
      query = query.eq('delivery_type', req.query.delivery_type);
    }
    if (req.query.search) {
      const search = (req.query.search as string)?.toLowerCase();
      if (search) {
        query = query.filter('order_id::text', 'ilike', `${search}%`);
      }
    }

    const { data: allStatuses, error: statsError } = await supabase.from('Order').select('status');

    if (statsError) {
      return res.status(400).json({ message: statsError.message });
    }

    const stats = {
      total: allStatuses.filter((o) => o.status !== 'rejected').length,
      pending: allStatuses.filter((o) => o.status === 'pending').length,
      preparing: allStatuses.filter((o) => o.status === 'preparing').length,
      ready: allStatuses.filter((o) => o.status === 'ready').length,
      completed: allStatuses.filter((o) => o.status === 'completed').length,
    };

    const {
      data: orders,
      error,
      count,
    } = await query.order('order_date', { ascending: false }).range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({ message: error.message });
    }

    // console.log('limit:', limit, 'offset:', offset);
    // console.log('returned rows:', orders?.length);

    const orderIds = orders.map((o) => o.order_id);
    const patientIds = orders.map((o) => o.patient_id);

    const { data: patients, error: patientError } = await supabase
      .from('Patient')
      .select('patient_id, firstname, surname, diagnosis')
      .in('patient_id', patientIds);

    if (patientError) {
      return res.status(400).json({ message: patientError.message });
    }

    const { data: items, error: itemsError } = await supabase
      .from('OrderItem')
      .select(
        `
    order_id,
    quantity,
    price,
    Medication!inner (
      name,
      description
    )
  `,
      )
      .in('order_id', orderIds);

    if (itemsError) {
      return res.status(400).json({ message: itemsError.message });
    }

    const formattedOrders = orders.map((order: DBOrder) => {
      const patient = patients?.find((p) => p.patient_id === order.patient_id);

      const typedItems = items ?? [];

      const itemsByOrder = typedItems.reduce(
        (acc, item) => {
          if (!acc[item.order_id]) acc[item.order_id] = [];
          acc[item.order_id].push(item);
          return acc;
        },
        {} as Record<string, typeof typedItems>,
      );

      const totalAmount =
        itemsByOrder[order.order_id]?.reduce((acc, item) => {
          return acc + Number(item.price) * item.quantity;
        }, 0) || 0;

      let diagnosisString = 'No diagnosis provided';
      if (patient?.diagnosis && typeof patient.diagnosis === 'object') {
        const conditions = Object.entries(patient.diagnosis)
          .filter(([, value]) => value === true)
          .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1))
          .join(', ');

        if (conditions) {
          diagnosisString = conditions;
        }
      }

      return {
        order_id: order.order_id,
        order_number: order.order_id.substring(0, 8).toUpperCase(),
        patient_name: patient ? `${patient.firstname} ${patient.surname}` : 'Unknown',
        patient_diagnosis: diagnosisString,
        order_date: order.order_date,
        received_date: order.received_date || null,
        amount: totalAmount,
        status: order.status,
        delivery_type: order.delivery_type,
        delivery_address: order.delivery_address || 'No address provided',
        items: (itemsByOrder[order.order_id] || []).map((item) => {
          const med = Array.isArray(item.Medication) ? item.Medication[0] : item.Medication;
          return {
            name: med.name,
            description: med.description,
            quantity: item.quantity,
            price: Number(item.price),
          };
        }),
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedOrders,
      stats,
      pagination: {
        total: count || 0,
        offset,
        limit,
        returned: formattedOrders.length,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    console.error('getOrders error:', err);
    return res.status(500).json({
      message: 'Internal Server Error',
      details: err,
    });
  }
};
