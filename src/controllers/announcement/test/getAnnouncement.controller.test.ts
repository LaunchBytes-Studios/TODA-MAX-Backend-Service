import { getAnnouncement } from '../getAnnouncement.controller';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../../config/db';

describe('getAnnouncement', () => {
  let req: Request;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { query: {} } as unknown as Request;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should return all announcements (200)', async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: [
        {
          announce_id: 1,
          title: 'Low Stock Alert',
          content: 'Hello',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
        {
          announce_id: 2,
          title: 'Test2',
          content: 'World',
          createdAt: '2024-01-03',
          updatedAt: '2024-01-04',
        },
      ],
      error: null,
    });
    (supabase.from as Mock).mockReturnValue({ select: selectMock });

    await getAnnouncement(req, res as Response);

    expect(supabase.from).toHaveBeenCalledWith('Announcement');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      expect.objectContaining({
        announce_id: 1,
        title: 'Low Stock Alert',
        content: 'Hello',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
      }),
      expect.objectContaining({
        announce_id: 2,
        title: 'Test2',
        content: 'World',
        createdAt: '2024-01-03',
        updatedAt: '2024-01-04',
      }),
    ]);
  });

  it('should return 404 if no announcements found', async () => {
    const selectMock = vi.fn().mockResolvedValue({ data: [], error: null });
    (supabase.from as Mock).mockReturnValue({ select: selectMock });

    await getAnnouncement(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: 'No announcement(s) found.' });
  });

  it('should filter by announce_id if provided', async () => {
    req.query.announce_id = '1';

    const eqMock = vi.fn().mockResolvedValue({
      data: [
        {
          announce_id: 1,
          title: 'Test',
          content: 'Hello',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
        },
      ],
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const supabaseFromMock = supabase.from as ReturnType<typeof vi.fn>;
    supabaseFromMock.mockReturnValue({ select: selectMock });

    await getAnnouncement(req, res as Response);

    expect(supabase.from).toHaveBeenCalledWith('Announcement');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(eqMock).toHaveBeenCalledWith('announce_id', '1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ announce_id: 1 }));
  });

  it('should return 500 on error', async () => {
    const selectMock = vi.fn().mockRejectedValue(new Error('DB error'));
    (supabase.from as Mock).mockReturnValue({ select: selectMock });

    await getAnnouncement(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Server error.' }));
  });
});
