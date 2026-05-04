import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Reward } from '../rewardtype';

vi.mock('../../../services/reward.service', () => ({
  createRewardService: vi.fn(),
  getAllRewardsService: vi.fn(),
  getRewardByIdService: vi.fn(),
  updateRewardService: vi.fn(),
  deleteRewardService: vi.fn(),
}));

import {
  createReward,
  getAllRewards,
  getRewardById,
  updateReward,
  deleteReward,
} from '../reward.controller';
import {
  createRewardService,
  getAllRewardsService,
  getRewardByIdService,
  updateRewardService,
  deleteRewardService,
} from '../../../services/reward.service';

const mockedCreateRewardService = vi.mocked(createRewardService);
const mockedGetAllRewardsService = vi.mocked(getAllRewardsService);
const mockedGetRewardByIdService = vi.mocked(getRewardByIdService);
const mockedUpdateRewardService = vi.mocked(updateRewardService);
const mockedDeleteRewardService = vi.mocked(deleteRewardService);

describe('reward controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {} };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('creates a reward', async () => {
    req.body = {
      name: 'Free Checkup',
      description: 'Checkup voucher',
      category: 'Health',
      enav_id: 'enav-1',
      points_required: '100',
      stock_available: '50',
      low_stock_threshold: '10',
      total_redeemed: '2',
      reward_code: 'RW-1234',
      is_active: true,
    };

    const reward: Reward = {
      reward_id: 1,
      name: 'Free Checkup',
      description: 'Checkup voucher',
      category: 'Health',
      enav_id: 'enav-1',
      points_required: 100,
      stock_available: 50,
      low_stock_threshold: 10,
      total_redeemed: 2,
      reward_code: 'RW-1234',
      is_active: true,
    };
    mockedCreateRewardService.mockResolvedValue(reward);

    await createReward(req as Request, res as Response);

    expect(mockedCreateRewardService).toHaveBeenCalledWith({
      name: 'Free Checkup',
      description: 'Checkup voucher',
      category: 'Health',
      enav_id: 'enav-1',
      points_required: 100,
      stock_available: 50,
      low_stock_threshold: 10,
      total_redeemed: 2,
      reward_code: 'RW-1234',
      is_active: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Reward created successfully',
      data: reward,
    });
  });

  it('returns all rewards', async () => {
    req.query = {
      search: 'voucher',
      category: 'Health',
      lowStockOnly: 'true',
      page: '1',
      limit: '10',
    };
    mockedGetAllRewardsService.mockResolvedValue({
      rewards: [{ reward_id: 1, name: 'Free Checkup', points_required: 100 } as Reward],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });

    await getAllRewards(req as Request, res as Response);

    expect(mockedGetAllRewardsService).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'voucher',
        category: 'Health',
        lowStockOnly: true,
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Rewards retrieved successfully',
      }),
    );
  });

  it('gets a reward by id', async () => {
    req.params = { id: '1' };
    mockedGetRewardByIdService.mockResolvedValue({
      reward_id: 1,
      name: 'Free Checkup',
      points_required: 100,
    });

    await getRewardById(req as Request, res as Response);

    expect(mockedGetRewardByIdService).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Reward retrieved successfully' }),
    );
  });

  it('returns 404 when reward is missing', async () => {
    req.params = { id: '999' };
    mockedGetRewardByIdService.mockResolvedValue(null);

    await getRewardById(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Reward not found' });
  });

  it('updates a reward', async () => {
    req.params = { id: '1' };
    req.body = {
      name: 'Updated Reward',
      points_required: '150',
      is_active: false,
    };
    mockedUpdateRewardService.mockResolvedValue({
      reward_id: 1,
      name: 'Updated Reward',
      points_required: 150,
      is_active: false,
    });

    await updateReward(req as Request, res as Response);

    expect(mockedUpdateRewardService).toHaveBeenCalledWith(1, {
      name: 'Updated Reward',
      points_required: 150,
      is_active: false,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Reward updated successfully' }),
    );
  });

  it('returns 404 when deleting a missing reward', async () => {
    req.params = { id: '999' };
    mockedDeleteRewardService.mockResolvedValue(false);

    await deleteReward(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Reward not found' });
  });
});
