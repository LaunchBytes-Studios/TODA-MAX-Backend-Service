export interface Medication {
  medication_id: number;
  name: string;
  price: number;
  type: string;
  stock_qty: number;
  threshold_qty?: number;
  enav_id?: string;
  created_at?: string;
}

export interface CreateMedicationDTO {
  name: string;
  price: number;
  type: string;
  stock_qty: number;
  threshold_qty?: number;
  enav_id?: string;
}

export interface UpdateMedicationDTO {
  name?: string;
  price?: number;
  type?: string;
  stock_qty?: number;
  threshold_qty?: number;
  enav_id?: string;
}

export interface FilterOptions {
  search?: string;
  type?: string;
  minPrice?: number;
  maxPrice?: number;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'price' | 'stock_qty' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T = Medication> {
  medications: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface MedicationStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  totalStock: number;
}