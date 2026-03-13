import { Request, Response } from 'express';
import {
  createRewardService,
  deleteRewardService,
  getAllRewardsService,
  getRewardByIdService,
  updateRewardService,
} from '../../services/reward.service';

const parseId = (idParam: string | string[]): number => {
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  return parseInt(id);
};

export const createReward = async (req: Request, res: Response) => {
  try {
    const rewardData = {
      name: req.body.name || req.body.reward_name || '',
      description: req.body.description ?? null,
      category: req.body.category ?? null,
      enav_id: req.body.enav_id || null,
      points_required: parseInt(req.body.points_required) || 0,
      stock_available: req.body.stock_available ? parseInt(req.body.stock_available) : 0,
      low_stock_threshold: req.body.low_stock_threshold
        ? parseInt(req.body.low_stock_threshold)
        : 10,
      total_redeemed: req.body.total_redeemed ? parseInt(req.body.total_redeemed) : 0,
      reward_code: req.body.reward_code ?? null,
      is_active: req.body.is_active ?? true,
    };

    const reward = await createRewardService(rewardData);
    res.status(201).json({
      success: true,
      message: 'Reward created successfully',
      data: reward,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: 'Failed to create reward',
      error: err.message,
    });
  }
};

export const getAllRewards = async (req: Request, res: Response) => {
  try {
    const requestedSortBy = req.query.sortBy as string | undefined;
    const normalizedSortBy = requestedSortBy === 'reward_name' ? 'name' : requestedSortBy;

    const filters = {
      search: req.query.search as string,
      category: req.query.category as string,
      lowStockOnly: req.query.lowStockOnly === 'true',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sortBy: normalizedSortBy as 'name' | 'points_required' | 'stock_available' | 'created_at',
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await getAllRewardsService(filters);
    res.json({
      success: true,
      message: 'Rewards retrieved successfully',
      data: result.rewards,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rewards',
      error: err.message,
    });
  }
};

export const getRewardById = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const reward = await getRewardByIdService(id);

    if (!reward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    res.json({
      success: true,
      message: 'Reward retrieved successfully',
      data: reward,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve reward',
      error: err.message,
    });
  }
};

export const updateReward = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const updateData: Record<string, unknown> = {};

    if (req.body.name !== undefined || req.body.reward_name !== undefined)
      updateData.name = req.body.name ?? req.body.reward_name;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.enav_id !== undefined) updateData.enav_id = req.body.enav_id;
    if (req.body.points_required !== undefined)
      updateData.points_required = parseInt(req.body.points_required);
    if (req.body.stock_available !== undefined)
      updateData.stock_available = parseInt(req.body.stock_available);
    if (req.body.low_stock_threshold !== undefined)
      updateData.low_stock_threshold = parseInt(req.body.low_stock_threshold);
    if (req.body.total_redeemed !== undefined)
      updateData.total_redeemed = parseInt(req.body.total_redeemed);
    if (req.body.reward_code !== undefined) updateData.reward_code = req.body.reward_code;
    if (req.body.is_active !== undefined) updateData.is_active = req.body.is_active;

    const updatedReward = await updateRewardService(id, updateData);

    if (!updatedReward) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    res.json({
      success: true,
      message: 'Reward updated successfully',
      data: updatedReward,
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: 'Failed to update reward',
      error: err.message,
    });
  }
};

export const deleteReward = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const deleted = await deleteRewardService(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Reward not found',
      });
    }

    res.json({
      success: true,
      message: 'Reward deleted successfully',
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({
      success: false,
      message: 'Failed to delete reward',
      error: err.message,
    });
  }
};
