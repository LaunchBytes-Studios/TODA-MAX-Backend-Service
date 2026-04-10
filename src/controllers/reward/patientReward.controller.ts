import { Request, Response } from 'express';
import {
  cancelRewardClaimByPatientService,
  getPatientRewardClaimsService,
  redeemRewardByPatientService,
} from '../../services/patientReward.service';

type PatientRequest = Request & {
  user?: {
    userId?: string;
  };
};

export const redeemRewardByPatient = async (req: PatientRequest, res: Response) => {
  try {
    const patientId = req.user?.userId;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rewardId = parseInt(rawId);

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (Number.isNaN(rewardId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reward id',
      });
    }

    const result = await redeemRewardByPatientService(patientId, rewardId);

    if (result.type === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    if (result.type === 'inactive_or_unavailable') {
      return res.status(400).json({
        success: false,
        message: 'Reward is currently unavailable for claiming',
      });
    }

    if (result.type === 'pending_claim_exists') {
      return res.status(409).json({
        success: false,
        message: 'You already have a pending reward claim',
        data: result.data,
      });
    }

    if (result.type === 'insufficient_points') {
      return res.status(400).json({
        success: false,
        message: 'Insufficient points',
        data: result.data,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reward claimed successfully',
      data: result.data,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Failed to claim reward',
      error: err.message,
    });
  }
};

export const getMyRewardClaims = async (req: PatientRequest, res: Response) => {
  try {
    const patientId = req.user?.userId;

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const result = await getPatientRewardClaimsService(patientId);

    return res.status(200).json({
      success: true,
      message: 'Reward claims retrieved successfully',
      data: result,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve reward claims',
      error: err.message,
    });
  }
};

export const cancelRewardClaim = async (req: PatientRequest, res: Response) => {
  try {
    const patientId = req.user?.userId;
    const rawCode =
      (Array.isArray(req.params.code) ? req.params.code[0] : req.params.code) ??
      req.body?.code;
    const code = String(rawCode ?? '').trim();

    if (!patientId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Claim code is required',
      });
    }

    const result = await cancelRewardClaimByPatientService(patientId, code);

    if (result.type === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Reward claim not found',
      });
    }

    if (result.type === 'not_pending') {
      return res.status(409).json({
        success: false,
        message: 'Only pending claims can be cancelled',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reward claim cancelled successfully',
      data: result.data,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Failed to cancel reward claim',
      error: err.message,
    });
  }
};
