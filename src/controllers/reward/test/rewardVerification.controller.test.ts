import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { RewardVerificationPayload } from '../../../services/rewardVerification.service';

vi.mock('../../../services/rewardVerification.service', () => ({
  verifyRewardCodeService: vi.fn(),
  finalizeRewardCodeService: vi.fn(),
}));

import { verifyRewardCode, finalizeRewardCode } from '../rewardVerification.controller';
import {
  verifyRewardCodeService,
  finalizeRewardCodeService,
} from '../../../services/rewardVerification.service';

const mockedVerifyRewardCodeService = vi.mocked(verifyRewardCodeService);
const mockedFinalizeRewardCodeService = vi.mocked(finalizeRewardCodeService);

type VerificationRequest = Request & {
  user?: {
    userId?: string;
  };
};

const buildPayload = (
  overrides: Partial<RewardVerificationPayload> = {},
): RewardVerificationPayload => ({
  transId: 'tx-1',
  code: 'RW-AAAA1111',
  status: 'claimed',
  points: 100,
  patientId: 'patient-1',
  patientName: 'Jane Doe',
  rewardId: 1,
  rewardName: 'Free Checkup',
  createdAt: '2024-01-01T00:00:00.000Z',
  validatedByEnavId: 'enav-1',
  isValid: true,
  isFinalized: false,
  ...overrides,
});

describe('reward verification controller', () => {
  let req: Partial<VerificationRequest>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      user: {
        userId: 'enav-1',
        role: 'admin',
        contact: 'enav@example.com',
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('returns 400 when no code is provided for verification', async () => {
    await verifyRewardCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Reward code is required' });
  });

  it('returns 404 when verification code is not found', async () => {
    req.query = { code: 'RW-AAAA1111' };
    mockedVerifyRewardCodeService.mockResolvedValue(null);

    await verifyRewardCode(req as Request, res as Response);

    expect(mockedVerifyRewardCodeService).toHaveBeenCalledWith('RW-AAAA1111');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Reward code not found' });
  });

  it('returns the verification payload when the code is valid', async () => {
    req.query = { code: 'RW-AAAA1111' };
    const payload = buildPayload({ isValid: true, isFinalized: false, status: 'pending' });
    mockedVerifyRewardCodeService.mockResolvedValue(payload);

    await verifyRewardCode(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Reward code is valid',
      data: payload,
    });
  });

  it('finalizes a reward code successfully', async () => {
    req.body = { code: 'RW-AAAA1111' };
    mockedFinalizeRewardCodeService.mockResolvedValue({
      type: 'success',
      data: buildPayload({ isValid: false, isFinalized: true, status: 'finalized' }),
    });

    await finalizeRewardCode(req as VerificationRequest, res as Response);

    expect(mockedFinalizeRewardCodeService).toHaveBeenCalledWith('RW-AAAA1111', 'enav-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Reward successfully finalized' }),
    );
  });

  it('returns 409 when the code is already finalized', async () => {
    req.body = { code: 'RW-AAAA1111' };
    mockedFinalizeRewardCodeService.mockResolvedValue({
      type: 'already_finalized',
      data: buildPayload({ isValid: false, isFinalized: true, status: 'finalized' }),
    });

    await finalizeRewardCode(req as VerificationRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'Reward code has already been finalized',
      }),
    );
  });
});
