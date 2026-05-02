import { updateOrderType } from '../updateOrderType.controller';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../../config/db';

describe('updateOrderType', () => {
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

  it('should update order delivery type to delivery (200)', async () => {
    req.body = { delivery_type: 'delivery' };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { order_id: 'ord-123' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await updateOrderType(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Order type updated successfully',
    });
  });

  it('should update order delivery type to pickup (200)', async () => {
    req.body = { delivery_type: 'pickup' };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { order_id: 'ord-123' }, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    await updateOrderType(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Order type updated successfully',
    });
  });

  it('should return 400 if delivery_type is invalid', async () => {
    req.body = { delivery_type: 'invalid' };

    await updateOrderType(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid delivery type' });
  });

  it('should return 404 if order not found', async () => {
    req.body = { delivery_type: 'delivery' };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: new Error('Not found') }),
        }),
      }),
    });

    await updateOrderType(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'Order not found' });
  });

  it('should return 500 on update error', async () => {
    req.body = { delivery_type: 'delivery' };

    const selectMock = vi.fn().mockResolvedValue({
      data: { order_id: 'ord-123' },
      error: null,
    });

    const updateMock = vi.fn().mockResolvedValue({
      error: new Error('Update failed'),
    });

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockReturnValue({
      select: selectMock,
      update: updateMock,
    });

    selectMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: { order_id: 'ord-123' }, error: null }),
    });
    updateMock.mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: new Error('Update failed') }),
    });

    await updateOrderType(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
  });
});
