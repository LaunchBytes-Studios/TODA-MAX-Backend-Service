import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Mock } from 'vitest';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../../utils/getFirstEnavId', () => ({
  getFirstEnavId: vi.fn(),
}));

import { generateRegistrationCode } from '../generateRegistrationCodes.controller';
import { supabase } from '../../../config/db';
import { getFirstEnavId } from '../../../utils/getFirstEnavId';

describe('generateRegistrationCode', () => {
  let req: Request;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {} as Request;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should generate a registration code and return 201', async () => {
    (getFirstEnavId as Mock).mockResolvedValue('enav-123');

    const selectMock = vi.fn().mockResolvedValue({
      data: [
        {
          registration_code_id: 1,
          enav_id: 'enav-123',
          code: 'ABC123',
          status: 'active',
        },
      ],
      error: null,
    });

    const insertMock = vi.fn().mockReturnValueOnce({
      select: selectMock,
    });

    (supabase.from as Mock).mockReturnValue({
      insert: insertMock,
    });

    await generateRegistrationCode(req, res as Response);

    expect(getFirstEnavId).toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledWith('RegistrationCode');
    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        enav_id: 'enav-123',
        status: 'active',
        code: expect.stringMatching(/^[A-Z0-9]{6}$/),
        expires_at: expect.any(Date),
      }),
    ]);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      registration_code_id: 1,
      enav_id: 'enav-123',
      code: 'ABC123',
      status: 'active',
    });
  });

  it('should return 500 when getFirstEnavId fails', async () => {
    (getFirstEnavId as Mock).mockRejectedValue(new Error('enav fetch failed'));

    await generateRegistrationCode(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error fetching enav_id from eNavigator table.',
      error: 'enav fetch failed',
    });
  });

  it('should return 500 when insert fails', async () => {
    (getFirstEnavId as Mock).mockResolvedValue('enav-123');

    const selectMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'insert failed' },
    });

    const insertMock = vi.fn().mockReturnValueOnce({
      select: selectMock,
    });

    (supabase.from as Mock).mockReturnValue({
      insert: insertMock,
    });

    await generateRegistrationCode(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error generating registration code.',
      error: { message: 'insert failed' },
    });
  });

  it('should return 500 on unexpected error', async () => {
    (getFirstEnavId as Mock).mockResolvedValue('enav-123');

    const insertMock = vi.fn().mockImplementationOnce(() => {
      throw new Error('unexpected failure');
    });

    (supabase.from as Mock).mockReturnValue({
      insert: insertMock,
    });

    await generateRegistrationCode(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Server error.',
      }),
    );
  });
});
