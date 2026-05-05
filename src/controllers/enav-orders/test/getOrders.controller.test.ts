import { getOrders } from '../getOrders.controller';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../../config/db';

describe('getOrders', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should return 500 on server error', async () => {
    req.query = { limit: '10', offset: '0' };

    const supabaseMock = supabase.from as Mock;
    supabaseMock.mockImplementation(() => {
      throw new Error('Database connection error');
    });

    await getOrders(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
  });
});
