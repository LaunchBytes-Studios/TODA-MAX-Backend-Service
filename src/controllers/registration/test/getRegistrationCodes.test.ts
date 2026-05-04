import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Mock } from 'vitest';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { getRegistrationCode } from '../getRegistrationCode.controller';
import { supabase } from '../../../config/db';

describe('getRegistrationCode', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let queryBuilder: {
    eq: ReturnType<typeof vi.fn>;
    then: Promise<{ data: unknown; error: unknown }>['then'];
    catch: Promise<{ data: unknown; error: unknown }>['catch'];
  };

  beforeEach(() => {
    req = { query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  const mockAwaitableQuery = (result: { data: unknown; error: unknown }) => {
    const promise = Promise.resolve(result);

    queryBuilder = {
      eq: vi.fn().mockReturnThis(),
      then: promise.then.bind(promise),
      catch: promise.catch.bind(promise),
    };

    return queryBuilder;
  };

  it('should return all registration codes when no filters are provided', async () => {
    const builder = mockAwaitableQuery({
      data: [
        { code: 'ABC123', enav_id: 'enav-1' },
        { code: 'XYZ789', enav_id: 'enav-2' },
      ],
      error: null,
    });

    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue(builder),
    });

    await getRegistrationCode(req as Request, res as Response);

    expect(supabase.from).toHaveBeenCalledWith('RegistrationCode');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { code: 'ABC123', enav_id: 'enav-1' },
      { code: 'XYZ789', enav_id: 'enav-2' },
    ]);
  });

  it('should filter by registration_code when provided', async () => {
    req.query = { registration_code: 'ABC123' };

    const builder = mockAwaitableQuery({
      data: [{ code: 'ABC123', enav_id: 'enav-1' }],
      error: null,
    });

    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue(builder),
    });

    await getRegistrationCode(req as Request, res as Response);

    expect(builder.eq).toHaveBeenCalledWith('code', 'ABC123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ code: 'ABC123', enav_id: 'enav-1' }]);
  });

  it('should filter by enavId when provided', async () => {
    req.query = { enavId: 'enav-1' };

    const builder = mockAwaitableQuery({
      data: [{ code: 'ABC123', enav_id: 'enav-1' }],
      error: null,
    });

    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue(builder),
    });

    await getRegistrationCode(req as Request, res as Response);

    expect(builder.eq).toHaveBeenCalledWith('enav_id', 'enav-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should apply both filters when registration_code and enavId are provided', async () => {
    req.query = { registration_code: 'ABC123', enavId: 'enav-1' };

    const builder = mockAwaitableQuery({
      data: [{ code: 'ABC123', enav_id: 'enav-1' }],
      error: null,
    });

    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue(builder),
    });

    await getRegistrationCode(req as Request, res as Response);

    expect(builder.eq).toHaveBeenNthCalledWith(1, 'code', 'ABC123');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'enav_id', 'enav-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('should return 404 when no matching registration code is found', async () => {
    const builder = mockAwaitableQuery({
      data: [],
      error: null,
    });

    (supabase.from as Mock).mockReturnValue({
      select: vi.fn().mockReturnValue(builder),
    });

    await getRegistrationCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Invalid registration code.',
    });
  });

  it('should return 500 on unexpected error', async () => {
    (supabase.from as Mock).mockReturnValue({
      select: vi.fn(() => {
        throw new Error('query crashed');
      }),
    });

    await getRegistrationCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Server error.',
      }),
    );
  });
});
