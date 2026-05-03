import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../config/db', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../../../utils/helpers', async () => {
  const actual =
    await vi.importActual<typeof import('../../../utils/helpers')>('../../../utils/helpers');

  return {
    ...actual,
    requirePatientId: vi.fn(),
  };
});

import { getPatientOrders } from '../getOrders.controller';
import { supabase } from '../../../config/db';
import { requirePatientId } from '../../../utils/helpers';

describe('getPatientOrders', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let orderQuery: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      user: { userId: 'patient-123', role: 'patient', contact: '123-456-7890' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    (requirePatientId as Mock).mockReturnValue('patient-123');

    orderQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn(),
    };

    (supabase.from as Mock).mockReturnValue(orderQuery);
  });

  it('returns normalized patient orders with total_items', async () => {
    orderQuery.order.mockResolvedValue({
      data: [
        {
          order_id: 'order-1',
          patient_id: 'patient-123',
          status: 'pending',
          order_date: '2026-05-01T10:00:00.000Z',
          delivery_type: 'pickup',
          delivery_address: null,
          received_date: null,
          items: [
            {
              quantity: 2,
              medication: { name: 'Biogesic', dosage: 500 },
            },
            {
              quantity: 1,
              medication: { name: 'Amoxicillin', dosage: 250 },
            },
          ],
        },
      ],
      error: null,
    });

    await getPatientOrders(req as Request, res as Response);

    expect(supabase.from).toHaveBeenCalledWith('Order');
    expect(orderQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
    expect(orderQuery.order).toHaveBeenCalledWith('order_date', { ascending: false });

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Orders retrieved successfully',
      data: [
        {
          order_id: 'order-1',
          patient_id: 'patient-123',
          status: 'pending',
          order_date: '2026-05-01T10:00:00.000Z',
          delivery_type: 'pickup',
          delivery_address: null,
          received_date: null,
          total_items: 3,
          items: [
            {
              quantity: 2,
              medication: { name: 'Biogesic', dosage: 500 },
            },
            {
              quantity: 1,
              medication: { name: 'Amoxicillin', dosage: 250 },
            },
          ],
        },
      ],
    });
  });

  it('returns empty items and zero total_items when items is not an array', async () => {
    orderQuery.order.mockResolvedValue({
      data: [
        {
          order_id: 'order-2',
          patient_id: 'patient-123',
          status: 'completed',
          order_date: '2026-05-01T11:00:00.000Z',
          delivery_type: 'delivery',
          delivery_address: 'Test Address',
          received_date: '2026-05-01T12:00:00.000Z',
          items: null,
        },
      ],
      error: null,
    });

    await getPatientOrders(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Orders retrieved successfully',
      data: [
        {
          order_id: 'order-2',
          patient_id: 'patient-123',
          status: 'completed',
          order_date: '2026-05-01T11:00:00.000Z',
          delivery_type: 'delivery',
          delivery_address: 'Test Address',
          received_date: '2026-05-01T12:00:00.000Z',
          total_items: 0,
          items: [],
        },
      ],
    });
  });

  it('returns an empty list when no orders exist', async () => {
    orderQuery.order.mockResolvedValue({
      data: [],
      error: null,
    });

    await getPatientOrders(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Orders retrieved successfully',
      data: [],
    });
  });

  it('returns wrapped 500 when fetching orders fails', async () => {
    orderQuery.order.mockResolvedValue({
      data: null,
      error: { message: 'query failed' },
    });

    await getPatientOrders(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to retrieve orders',
      error: 'Failed to retrieve orders: query failed',
    });
  });
});
