import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Mock } from 'vitest';

vi.mock('../../../config/db', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { maintenanceRegistrationCode } from '../maintenanceRegistration.controller';
import { supabase } from '../../../config/db';

describe('maintenanceRegistrationCode', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();

    req = { query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-02T08:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return 400 when confirm is not true', async () => {
    req.query = {};

    await maintenanceRegistrationCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Maintenance requires explicit confirmation. Provide '?confirm=true'.",
    });
  });

  it('should perform maintenance and return 200', async () => {
    req.query = { confirm: 'true' };

    (supabase.rpc as Mock).mockResolvedValue({
      data: {
        expired_count: 4,
        deleted_count: 2,
      },
      error: null,
    });

    await maintenanceRegistrationCode(req as Request, res as Response);

    expect(supabase.rpc).toHaveBeenCalledWith('maintenance_registration_codes', {
      p_current_time: '2026-05-02T08:00:00.000Z',
      p_cleanup_threshold: '2026-04-02T08:00:00.000Z',
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      expiredCount: 4,
      deletedCount: 2,
      cleanupThresholdDays: 30,
      performedAt: '2026-05-02T08:00:00.000Z',
    });
  });

  it('should default counts to zero when rpc returns no data', async () => {
    req.query = { confirm: 'true' };

    (supabase.rpc as Mock).mockResolvedValue({
      data: null,
      error: null,
    });

    await maintenanceRegistrationCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      expiredCount: 0,
      deletedCount: 0,
      cleanupThresholdDays: 30,
      performedAt: '2026-05-02T08:00:00.000Z',
    });
  });

  it('should return 500 when rpc fails', async () => {
    req.query = { confirm: 'true' };

    (supabase.rpc as Mock).mockResolvedValue({
      data: null,
      error: { message: 'rpc failed' },
    });

    await maintenanceRegistrationCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Failed to perform maintenance operation. Please try again later.',
      correlationId: 'maintenance-1777708800000',
    });
  });

  it('should return 500 on unexpected error', async () => {
    req.query = { confirm: 'true' };

    (supabase.rpc as Mock).mockRejectedValue(new Error('unexpected failure'));

    await maintenanceRegistrationCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Internal server error during maintenance operation.',
      correlationId: 'maintenance-error-1777708800000',
    });
  });
});
