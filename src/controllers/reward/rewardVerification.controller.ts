import { Request, Response } from 'express';
import {
  finalizeRewardCodeService,
  verifyRewardCodeService,
} from '../../services/rewardVerification.service';

export const verifyRewardCode = async (req: Request, res: Response) => {
  try {
    const code = String(req.query.code ?? '').trim();

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Reward code is required',
      });
    }

    const result = await verifyRewardCodeService(code);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Reward code not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: result.isValid ? 'Reward code is valid' : 'Reward code is not eligible for claiming',
      data: result,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Failed to verify reward code',
      error: err.message,
    });
  }
};

export const finalizeRewardCode = async (req: Request, res: Response) => {
  try {
    const code = String(req.body.code ?? '').trim();

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Reward code is required',
      });
    }

    const enavId = req.user?.userId;
    const result = await finalizeRewardCodeService(code, enavId);

    if (result.type === 'not_found') {
      return res.status(404).json({
        success: false,
        message: 'Reward code not found',
      });
    }

    if (result.type === 'already_finalized') {
      return res.status(409).json({
        success: false,
        message: 'Reward code has already been finalized',
        data: result.data,
      });
    }

    if (result.type === 'not_finalizable') {
      return res.status(400).json({
        success: false,
        message: 'Reward code cannot be finalized in its current state',
        data: result.data,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Reward successfully finalized',
      data: result.data,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: 'Failed to finalize reward code',
      error: err.message,
    });
  }
};
