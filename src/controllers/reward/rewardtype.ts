export interface Reward {
  reward_id: number;
  name?: string;
  description?: string;
  category?: string;
  enav_id?: string;
  points_required: number;
  stock_available?: number;
  low_stock_threshold?: number;
  total_redeemed?: number;
  reward_code?: string;
  is_active?: boolean;
  created_at?: string;
}

export interface CreateRewardDTO {
  name: string;
  description?: string;
  category?: string;
  enav_id?: string;
  points_required: number;
  stock_available?: number;
  low_stock_threshold?: number;
  total_redeemed?: number;
  reward_code?: string;
  is_active?: boolean;
}

export interface UpdateRewardDTO {
  name?: string;
  description?: string;
  category?: string;
  enav_id?: string;
  points_required?: number;
  stock_available?: number;
  low_stock_threshold?: number;
  total_redeemed?: number;
  reward_code?: string;
  is_active?: boolean;
}

export interface RewardFilterOptions {
  search?: string;
  category?: string;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'points_required' | 'stock_available' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface RewardPaginatedResponse<T = Reward> {
  rewards: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
