import { makeAnnouncement } from '../postAnnouncement.controller';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import type { Request, Response } from 'express';
import type { MockInstance } from 'vitest';

beforeAll(() => {
  (supabase.from as unknown as MockInstance).mockImplementation(() => ({
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: [{ id: 1, message: 'Hello world' }], error: null }),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }));
});

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));
vi.mock('../../../utils/getFirstEnavId', () => ({
  getFirstEnavId: vi.fn(),
}));

import { supabase } from '../../../config/db';
import { getFirstEnavId } from '../../../utils/getFirstEnavId';

describe('makeAnnouncement', () => {
  let req: Request;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: { message: 'Hello world' } } as unknown as Request;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should create an announcement and return 201', async () => {
    (getFirstEnavId as ReturnType<typeof vi.fn>).mockResolvedValue('enav123');
    const announcementData = [{ id: 1, message: 'Hello world' }];
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: announcementData, error: null }),
      }),
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockImplementation((table: string) => {
      if (table === 'Announcement') {
        return { insert: insertMock };
      }
      if (table === 'UserPushTokens') {
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    await makeAnnouncement(req, res as Response);

    expect(getFirstEnavId).toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('Announcement');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('should return 500 if getFirstEnavId fails', async () => {
    (getFirstEnavId as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('enav error'));

    await makeAnnouncement(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Error fetching enav_id from eNavigator table.',
      details: 'enav error',
    });
  });

  it('should return 500 if supabase insert fails', async () => {
    (getFirstEnavId as ReturnType<typeof vi.fn>).mockResolvedValue('enav123');
    const insertMock = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert error' } }),
      }),
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: insertMock });

    await makeAnnouncement(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'insert error' });
  });

  it('should return 500 on unexpected error', async () => {
    (getFirstEnavId as ReturnType<typeof vi.fn>).mockResolvedValue('enav123');
    const insertMock = vi.fn().mockImplementationOnce(() => {
      throw new Error('unexpected');
    });
    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({ insert: insertMock });

    await makeAnnouncement(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Internal Server Error' }),
    );
  });
});
