import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../services/patientReward.service', () => ({
  redeemRewardByPatientService: vi.fn(),
  getPatientRewardClaimsService: vi.fn(),
  cancelRewardClaimByPatientService: vi.fn(),
}));

import {
  redeemRewardByPatient,
  getMyRewardClaims,
  cancelRewardClaim,
} from '../patientReward.controller';
import {
  redeemRewardByPatientService,
  getPatientRewardClaimsService,
  cancelRewardClaimByPatientService,
} from '../../../services/patientReward.service';

const mockedRedeemRewardByPatientService = vi.mocked(redeemRewardByPatientService);
const mockedGetPatientRewardClaimsService = vi.mocked(getPatientRewardClaimsService);
const mockedCancelRewardClaimByPatientService = vi.mocked(cancelRewardClaimByPatientService);

type PatientRequest = Request & {
  user?: {
    userId?: string;
  };
};

describe('patient reward controller', () => {
  let req: Partial<PatientRequest>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      user: {
        userId: 'patient-1',
        role: 'patient',
        contact: 'patient@example.com',
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('redeems a reward successfully', async () => {
    req.params = { id: '1' };
    mockedRedeemRewardByPatientService.mockResolvedValue({
      type: 'success',
      data: {
        ticket: {
          transId: 'tx-1',
          code: 'RW-AAAA1111',
          status: 'pending',
          pointsSpent: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          rewardId: 1,
          rewardName: 'Free Checkup',
          rewardDescription: 'Checkup voucher',
          rewardCategory: 'Health',
          instructions: 'Present this claim code to an eNavigator in person to receive your reward.',
        },
        remainingPoints: 50,
      },
    });

    await redeemRewardByPatient(req as PatientRequest, res as Response);

    expect(mockedRedeemRewardByPatientService).toHaveBeenCalledWith('patient-1', 1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Reward claimed successfully' }),
    );
  });

  it('returns 401 when the patient is missing', async () => {
    delete req.user;
    req.params = { id: '1' };

    await redeemRewardByPatient(req as PatientRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Unauthorized' });
  });

  it('returns 409 when a pending claim exists', async () => {
    req.params = { id: '1' };
    mockedRedeemRewardByPatientService.mockResolvedValue({
      type: 'pending_claim_exists',
      data: {
        currentPoints: 150,
        claim: {
          transId: 'tx-2',
          code: 'RW-BBBB2222',
          status: 'pending',
          pointsSpent: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          rewardId: 1,
          rewardName: 'Free Checkup',
          rewardDescription: 'Checkup voucher',
          rewardCategory: 'Health',
          instructions: 'Present this claim code to an eNavigator in person to receive your reward.',
        },
      },
    });

    await redeemRewardByPatient(req as PatientRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'You already have a pending reward claim',
      }),
    );
  });

  it('returns claims for the current patient', async () => {
    mockedGetPatientRewardClaimsService.mockResolvedValue({
      currentPoints: 250,
      claims: [],
    });

    await getMyRewardClaims(req as PatientRequest, res as Response);

    expect(mockedGetPatientRewardClaimsService).toHaveBeenCalledWith('patient-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Reward claims retrieved successfully',
      }),
    );
  });

  it('cancels a reward claim successfully', async () => {
    req.params = { code: 'CLAIM123' };
    mockedCancelRewardClaimByPatientService.mockResolvedValue({
      type: 'success',
      data: {
        ticket: {
          transId: 'tx-3',
          code: 'CLAIM123',
          status: 'cancelled',
          pointsSpent: 100,
          createdAt: '2024-01-01T00:00:00.000Z',
          rewardId: 1,
          rewardName: 'Free Checkup',
          rewardDescription: 'Checkup voucher',
          rewardCategory: 'Health',
          instructions: 'Present this claim code to an eNavigator in person to receive your reward.',
        },
        remainingPoints: 150,
      },
    });

    await cancelRewardClaim(req as PatientRequest, res as Response);

    expect(mockedCancelRewardClaimByPatientService).toHaveBeenCalledWith('patient-1', 'CLAIM123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Reward claim cancelled successfully',
      }),
    );
  });
});