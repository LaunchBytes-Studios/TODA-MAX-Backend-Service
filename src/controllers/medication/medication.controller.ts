import { Request, Response } from 'express';
import {
  createMedicationService,
  getAllMedicationsService,
  getMedicationByIdService,
  updateMedicationService,
  deleteMedicationService,
  updateMedicationStockService,
  getMedicationStatsService,
  searchMedicationsService,
} from '../../services/medication.service';

// Helper function to safely parse ID
const parseId = (idParam: string | string[]): number => {
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  return parseInt(id);
};

// Create new medication
export const createMedication = async (req: Request, res: Response) => {
  try {
    const medicationData = {
      name: req.body.name,
      price: parseFloat(req.body.price) || 0,
      type: req.body.type || '',
      stock_qty: parseInt(req.body.stock_qty) || 0,
      threshold_qty: parseInt(req.body.threshold_qty) || 10,
      description: req.body.description ?? null,
      dosage: req.body.dosage ? parseInt(req.body.dosage) : 0,
      enav_id: req.body.enav_id || null,
    };

    const medication = await createMedicationService(medicationData);
    res.status(201).json({
      success: true,
      message: 'Medication created successfully',
      data: medication,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to create medication',
      error: error.message,
    });
  }
};

// Get all medications with filters
export const getAllMedications = async (req: Request, res: Response) => {
  try {
    const filters = {
      search: req.query.search as string,
      type: req.query.type as string,
      minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
      maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
      lowStockOnly: req.query.lowStockOnly === 'true',
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      sortBy: req.query.sortBy as 'name' | 'price' | 'stock_qty' | 'created_at',
      sortOrder: req.query.sortOrder as 'asc' | 'desc',
    };

    const result = await getAllMedicationsService(filters);
    res.json({
      success: true,
      message: 'Medications retrieved successfully',
      data: result.medications,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve medications',
      error: error.message,
    });
  }
};

// Get single medication by ID
export const getMedicationById = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const medication = await getMedicationByIdService(id);

    if (!medication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    res.json({
      success: true,
      message: 'Medication retrieved successfully',
      data: medication,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve medication',
      error: error.message,
    });
  }
};

// Update medication
export const updateMedication = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    // Prepare update data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.price !== undefined) updateData.price = parseFloat(req.body.price);
    if (req.body.type !== undefined) updateData.type = req.body.type;
    if (req.body.stock_qty !== undefined) updateData.stock_qty = parseInt(req.body.stock_qty);
    if (req.body.threshold_qty !== undefined)
      updateData.threshold_qty = parseInt(req.body.threshold_qty);
    if (req.body.enav_id !== undefined) updateData.enav_id = req.body.enav_id;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.dosage !== undefined) updateData.dosage = parseInt(req.body.dosage);

    const updatedMedication = await updateMedicationService(id, updateData);

    if (!updatedMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    res.json({
      success: true,
      message: 'Medication updated successfully',
      data: updatedMedication,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update medication',
      error: error.message,
    });
  }
};

// Delete medication
export const deleteMedication = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const deleted = await deleteMedicationService(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    res.json({
      success: true,
      message: 'Medication deleted successfully',
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete medication',
      error: error.message,
    });
  }
};

// Update medication stock
export const updateMedicationStock = async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const stock_qty = parseInt(req.body.stock_qty);

    if (isNaN(stock_qty) || stock_qty < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid stock quantity',
      });
    }

    const updatedMedication = await updateMedicationStockService(id, stock_qty);

    if (!updatedMedication) {
      return res.status(404).json({
        success: false,
        message: 'Medication not found',
      });
    }

    res.json({
      success: true,
      message: 'Stock updated successfully',
      data: updatedMedication,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update stock',
      error: error.message,
    });
  }
};

// Get medication statistics
export const getMedicationStats = async (req: Request, res: Response) => {
  try {
    const stats = await getMedicationStatsService();
    res.json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: stats,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve statistics',
      error: error.message,
    });
  }
};

// Search medications
export const searchMedications = async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const medications = await searchMedicationsService(query);
    res.json({
      success: true,
      message: 'Search completed successfully',
      data: medications,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to search medications',
      error: error.message,
    });
  }
};
