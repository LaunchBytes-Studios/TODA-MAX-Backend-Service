import { supabase } from '../config/db';
import {
  Medication,
  CreateMedicationDTO,
  UpdateMedicationDTO,
  FilterOptions,
  PaginatedResponse,
  MedicationStats,
} from '../controllers/medication/medicationtype';

// Create new medication
export const createMedicationService = async (data: CreateMedicationDTO): Promise<Medication> => {
  const { data: medication, error } = await supabase
    .from('Medication')
    .insert([
      {
        name: data.name,
        price: data.price,
        type: data.type,
        stock_qty: data.stock_qty,
        threshold_qty: data.threshold_qty || 10,
        dosage: data.dosage,
        description: data.description ?? null,
        enav_id: data.enav_id || null,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create medication: ${error.message}`);
  }

  return medication;
};

// FIXED: Return type should be PaginatedResponse (not PaginatedResponse<Medication>)
export const getAllMedicationsService = async (
  filters: FilterOptions,
): Promise<PaginatedResponse> => {
  console.log('🚀 getAllMedicationsService called with filters:', filters);

  let query = supabase.from('Medication').select('*', { count: 'exact' });

  console.log('📊 Initial query built');

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%`);
    console.log('🔍 Added search filter:', filters.search);
  }

  if (filters.type) {
    query = query.eq('type', filters.type);
    console.log('🏷️ Added type filter:', filters.type);
  }

  if (filters.lowStockOnly) {
    console.log('⚠️ Low stock filter will be applied using threshold_qty in service layer');
  }

  query = query.order('name', { ascending: true });

  const page = filters.page || 1;
  const limit = filters.limit || 100;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  console.log(`📄 Pagination: page=${page}, limit=${limit}, from=${from}, to=${to}`);

  if (filters.lowStockOnly) {
    const { data: medications, error } = await query;

    console.log('Query executed');
    console.log('Data received:', medications);

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to retrieve medications: ${error.message}`);
    }

    const lowStockMedications = (medications || []).filter((medication) => {
      const threshold = medication.threshold_qty ?? 10;
      return medication.stock_qty <= threshold;
    });

    const paginatedMedications = lowStockMedications.slice(from, to + 1);
    const total = lowStockMedications.length;

    console.log('Successfully retrieved low stock medications');

    return {
      medications: paginatedMedications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  query = query.range(from, to);

  const { data: medications, error, count } = await query;

  console.log('✅ Query executed');
  console.log('📦 Data received:', medications);
  console.log('🔢 Count:', count);

  if (error) {
    console.error('❌ Database error:', error);
    throw new Error(`Failed to retrieve medications: ${error.message}`);
  }

  console.log('🎉 Successfully retrieved medications');

  return {
    medications: medications || [],
    total: count || 0,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  };
};

export const getMedicationByIdService = async (id: number): Promise<Medication | null> => {
  const { data: medication, error } = await supabase
    .from('Medication')
    .select('*')
    .eq('medication_id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to retrieve medication: ${error.message}`);
  }

  return medication;
};

export const updateMedicationService = async (
  id: number,
  data: UpdateMedicationDTO,
): Promise<Medication | null> => {
  const { data: medication, error } = await supabase
    .from('Medication')
    .update(data)
    .eq('medication_id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to update medication: ${error.message}`);
  }

  return medication;
};

export const deleteMedicationService = async (id: number): Promise<boolean> => {
  const { error } = await supabase.from('Medication').delete().eq('medication_id', id);

  if (error) {
    if (error.code === 'PGRST116') {
      return false;
    }
    throw new Error(`Failed to delete medication: ${error.message}`);
  }

  return true;
};

export const updateMedicationStockService = async (
  id: number,
  stock_qty: number,
): Promise<Medication | null> => {
  const { data: medication, error } = await supabase
    .from('Medication')
    .update({ stock_qty })
    .eq('medication_id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Failed to update stock: ${error.message}`);
  }

  return medication;
};

export const getMedicationStatsService = async (): Promise<MedicationStats> => {
  try {
    const { data: medications, error } = await supabase
      .from('Medication')
      .select('stock_qty, threshold_qty');

    if (error) {
      throw new Error(`Failed to get medications: ${error.message}`);
    }

    let lowStock = 0;
    let outOfStock = 0;
    let totalStock = 0;

    medications?.forEach((med) => {
      totalStock += med.stock_qty;

      if (med.stock_qty === 0) {
        outOfStock++;
      }

      const threshold = med.threshold_qty || 10;
      if (med.stock_qty <= threshold) {
        lowStock++;
      }
    });

    return {
      total: medications?.length || 0,
      lowStock,
      outOfStock,
      totalStock,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    throw new Error(`Failed to get statistics: ${error.message}`);
  }
};

export const searchMedicationsService = async (query: string): Promise<Medication[]> => {
  const { data: medications, error } = await supabase
    .from('Medication')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(20);

  if (error) {
    throw new Error(`Failed to search medications: ${error.message}`);
  }

  return medications || [];
};
