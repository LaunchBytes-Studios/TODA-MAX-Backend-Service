import { updateOrderStatus } from '../updateOrderStatus.controller';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../../config/db';

describe('updateOrderStatus', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { params: { id: 'ord-123' }, body: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should return 404 if order not found', async () => {
    req.body = { status: 'completed' };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        }),
      }),
    });

    await updateOrderStatus(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Order not found' });
  });

  it('should update status and deduct stock when status is preparing (200)', async () => {
    req.body = { status: 'preparing' };

    const orderData = {
      order_id: 'ord-123',
      status: 'pending',
      received_date: null,
      OrderItem: [{ medication_id: 'med-1', quantity: 2 }],
    };

    const medData = { stock_qty: 10 };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockImplementation((table: string) => {
      if (table === 'Order') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: orderData,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
      }
      if (table === 'Medication') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: medData,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
      }
    });

    await updateOrderStatus(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Updated successfully' });
  });

  it('should update status without deducting stock if not preparing (200)', async () => {
    req.body = { status: 'completed' };

    const orderData = {
      order_id: 'ord-123',
      status: 'ready',
      received_date: '2024-01-01',
      OrderItem: [{ medication_id: 'med-1', quantity: 2 }],
    };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: orderData,
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    await updateOrderStatus(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Updated successfully' });
  });

  it('should handle order with no items in preparing status', async () => {
    req.body = { status: 'preparing' };

    const orderData = {
      order_id: 'ord-123',
      status: 'pending',
      received_date: null,
      OrderItem: [],
    };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: orderData,
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          error: null,
        }),
      }),
    });

    await updateOrderStatus(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Updated successfully' });
  });

  it('should return 500 on database error', async () => {
    req.body = { status: 'completed' };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockImplementation(() => {
      throw new Error('Database error');
    });

    await updateOrderStatus(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });

  it('should handle case-insensitive status', async () => {
    req.body = { status: 'PREPARING' };

    const orderData = {
      order_id: 'ord-123',
      status: 'pending',
      received_date: null,
      OrderItem: [{ medication_id: 'med-1', quantity: 1 }],
    };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockImplementation((table: string) => {
      if (table === 'Order') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: orderData,
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
      }
      if (table === 'Medication') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { stock_qty: 10 },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
      }
    });

    await updateOrderStatus(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
  });
});
