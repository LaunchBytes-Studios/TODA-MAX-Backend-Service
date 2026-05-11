import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { Mock, MockInstance } from 'vitest';
import type { Request, Response } from 'express';

beforeAll(() => {
  (supabase.from as unknown as MockInstance).mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }));
});

vi.mock('../../../config/db', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../../../utils/getUserPushTokens', () => ({
  getUserPushTokens: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../utils/sendPushNotifications', () => ({
  sendPushNotifications: vi.fn(),
}));

vi.mock('../../../utils/helpers', async () => {
  const actual =
    await vi.importActual<typeof import('../../../utils/helpers')>('../../../utils/helpers');

  return {
    ...actual,
    requirePatientId: vi.fn(),
  };
});

import { confirmOrder } from '../confirmOrder.controller';
import { supabase } from '../../../config/db';
import { requirePatientId } from '../../../utils/helpers';
import { ORDER_STATUS } from '../../../constants/orderStatus';

describe('confirmOrder', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let orderFetchQuery: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };
  let orderUpdateQuery: {
    update: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: { orderId: 'order-1' },
      user: { userId: 'patient-123', role: 'patient', contact: '123-456-7890' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    (requirePatientId as Mock).mockReturnValue('patient-123');

    orderFetchQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    orderUpdateQuery = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(),
    };

    (supabase.from as Mock).mockReturnValue(orderUpdateQuery);
  });

  it('returns 404 when order is not found', async () => {
    (supabase.from as Mock)
      .mockReturnValueOnce(orderUpdateQuery)
      .mockReturnValueOnce(orderFetchQuery);

    orderUpdateQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    orderFetchQuery.single.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    });

    await confirmOrder(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Order not found',
    });
  });

  it('returns 403 when order does not belong to the patient', async () => {
    (supabase.from as Mock)
      .mockReturnValueOnce(orderUpdateQuery)
      .mockReturnValueOnce(orderFetchQuery);

    orderUpdateQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    orderFetchQuery.single.mockResolvedValue({
      data: {
        order_id: 'order-1',
        patient_id: 'other-patient',
        status: ORDER_STATUS.READY,
      },
      error: null,
    });

    await confirmOrder(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Forbidden: not your order',
    });
  });

  it('returns 400 when order status is not ready', async () => {
    (supabase.from as Mock)
      .mockReturnValueOnce(orderUpdateQuery)
      .mockReturnValueOnce(orderFetchQuery);

    orderUpdateQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    orderFetchQuery.single.mockResolvedValue({
      data: {
        order_id: 'order-1',
        patient_id: 'patient-123',
        status: ORDER_STATUS.PREPARING,
      },
      error: null,
    });

    await confirmOrder(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: `Order cannot be confirmed. Current status: ${ORDER_STATUS.PREPARING}`,
    });
  });

  it('confirms the order successfully when status is ready', async () => {
    orderUpdateQuery.maybeSingle.mockResolvedValue({
      data: {
        order_id: 'order-1',
        patient_id: 'patient-123',
        status: ORDER_STATUS.COMPLETED,
        received_date: '2026-01-01T00:00:00.000Z',
      },
      error: null,
    });

    await confirmOrder(req as Request, res as Response);

    expect(orderUpdateQuery.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ORDER_STATUS.COMPLETED,
        received_date: expect.any(String),
      }),
    );
    expect(orderUpdateQuery.eq).toHaveBeenCalledWith('order_id', 'order-1');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Order confirmed successfully',
      data: {
        order_id: 'order-1',
        patient_id: 'patient-123',
        status: ORDER_STATUS.COMPLETED,
        received_date: '2026-01-01T00:00:00.000Z',
      },
    });
  });

  it('returns wrapped 500 when updating the order fails', async () => {
    orderUpdateQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'update failed' },
    });

    await confirmOrder(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to confirm order',
      error: 'Failed to update order: update failed',
    });
  });
});
