import { supabase } from '../config/db';
import type {
  CreateRewardDTO,
  Reward,
  RewardFilterOptions,
  RewardPaginatedResponse,
  UpdateRewardDTO,
} from '../controllers/reward/rewardtype';

export const createRewardService = async (data: CreateRewardDTO): Promise<Reward> => {
  const { data: reward, error } = await supabase
    .from('Reward')
    .insert([
      {
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        enav_id: data.enav_id ?? null,
        points_required: data.points_required,
        stock_available: data.stock_available ?? 0,
        low_stock_threshold: data.low_stock_threshold ?? 10,
        total_redeemed: data.total_redeemed ?? 0,
        reward_code: data.reward_code ?? null,
        is_active: data.is_active ?? true,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create reward: ${error.message}`);
  }

  return reward;
};

export const getAllRewardsService = async (
  filters: RewardFilterOptions,
): Promise<RewardPaginatedResponse> => {
  let query = supabase.from('Reward').select('*', { count: 'exact' });

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%`);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  const shouldFilterLowStock = filters.lowStockOnly === true;

  const sortBy = filters.sortBy || 'name';
  const sortOrder = filters.sortOrder || 'asc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  const page = filters.page || 1;
  const limit = filters.limit || 100;
  if (!shouldFilterLowStock) {
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);
  }

  const { data: rewards, error, count } = await query;

  if (error) {
    throw new Error(`Failed to retrieve rewards: ${error.message}`);
  }

  const resolvedRewards = rewards || [];
  const filteredRewards = shouldFilterLowStock
    ? resolvedRewards.filter((reward) => {
        const stockAvailable = reward.stock_available ?? 0;
        const threshold = reward.low_stock_threshold ?? 10;
        return stockAvailable <= threshold;
      })
    : resolvedRewards;

  const total = shouldFilterLowStock ? filteredRewards.length : count || 0;
  const pagedRewards = shouldFilterLowStock
    ? filteredRewards.slice((page - 1) * limit, page * limit)
    : filteredRewards;

  return {
    rewards: pagedRewards,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
};

export const getRewardByIdService = async (id: number): Promise<Reward | null> => {
  const { data: reward, error } = await supabase
    .from('Reward')
    .select('*')
    .eq('reward_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to retrieve reward: ${error.message}`);
  }

  return reward;
};

export const updateRewardService = async (
  id: number,
  data: UpdateRewardDTO,
): Promise<Reward | null> => {
  const { data: reward, error } = await supabase
    .from('Reward')
    .update(data)
    .eq('reward_id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to update reward: ${error.message}`);
  }

  return reward;
};

export const deleteRewardService = async (id: number): Promise<boolean> => {
  const { error } = await supabase.from('Reward').delete().eq('reward_id', id);

  if (error) {
    if (error.code === 'PGRST116') {
      return false;
    }
    throw new Error(`Failed to delete reward: ${error.message}`);
  }

  return true;
};
