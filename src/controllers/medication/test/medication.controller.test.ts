import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Medication, MedicationStats } from '../medicationtype';

vi.mock('../../../services/medication.service', () => ({
  createMedicationService: vi.fn(),
  getAllMedicationsService: vi.fn(),
  getMedicationByIdService: vi.fn(),
  updateMedicationService: vi.fn(),
  deleteMedicationService: vi.fn(),
  updateMedicationStockService: vi.fn(),
  getMedicationStatsService: vi.fn(),
  searchMedicationsService: vi.fn(),
}));

import {
  createMedication,
  getAllMedications,
  getMedicationById,
  updateMedication,
  deleteMedication,
  updateMedicationStock,
  getMedicationStats,
  searchMedications,
} from '../medication.controller';
import {
  createMedicationService,
  getAllMedicationsService,
  getMedicationByIdService,
  updateMedicationService,
  deleteMedicationService,
  updateMedicationStockService,
  getMedicationStatsService,
  searchMedicationsService,
} from '../../../services/medication.service';

const mockedCreateMedicationService = vi.mocked(createMedicationService);
const mockedGetAllMedicationsService = vi.mocked(getAllMedicationsService);
const mockedGetMedicationByIdService = vi.mocked(getMedicationByIdService);
const mockedUpdateMedicationService = vi.mocked(updateMedicationService);
const mockedDeleteMedicationService = vi.mocked(deleteMedicationService);
const mockedUpdateMedicationStockService = vi.mocked(updateMedicationStockService);
const mockedGetMedicationStatsService = vi.mocked(getMedicationStatsService);
const mockedSearchMedicationsService = vi.mocked(searchMedicationsService);

describe('medication controller', () => {
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

  it('creates a medication', async () => {
    req.body = {
      name: 'Aspirin',
      price: '10.5',
      type: 'Tablet',
      stock_qty: '100',
      threshold_qty: '20',
      description: 'Pain relief',
      dosage: '500',
      enav_id: 'enav-1',
    };

    const medication: Medication = {
      medication_id: 1,
      name: 'Aspirin',
      price: 10.5,
      type: 'Tablet',
      stock_qty: 100,
      threshold_qty: 20,
      description: 'Pain relief',
      dosage: 500,
      enav_id: 'enav-1',
    };
    mockedCreateMedicationService.mockResolvedValue(medication);

    await createMedication(req as Request, res as Response);

    expect(mockedCreateMedicationService).toHaveBeenCalledWith({
      name: 'Aspirin',
      price: 10.5,
      type: 'Tablet',
      stock_qty: 100,
      threshold_qty: 20,
      description: 'Pain relief',
      dosage: 500,
      enav_id: 'enav-1',
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Medication created successfully',
      data: medication,
    });
  });

  it('returns all medications with filters', async () => {
    req.query = { search: 'asp', lowStockOnly: 'true', page: '2', limit: '5' };

    const medications: Medication[] = [
      {
        medication_id: 1,
        name: 'Aspirin',
        price: 10.5,
        type: 'Tablet',
        stock_qty: 5,
        threshold_qty: 20,
      },
    ];
    mockedGetAllMedicationsService.mockResolvedValue({
      medications,
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });

    await getAllMedications(req as Request, res as Response);

    expect(mockedGetAllMedicationsService).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'asp',
        lowStockOnly: true,
        page: 2,
        limit: 5,
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Medications retrieved successfully',
      data: medications,
      meta: { total: 1, page: 2, limit: 5, totalPages: 1 },
    });
  });

  it('gets a medication by id', async () => {
    req.params = { id: '1' };
    mockedGetMedicationByIdService.mockResolvedValue({
      medication_id: 1,
      name: 'Aspirin',
      price: 10.5,
      type: 'Tablet',
      stock_qty: 100,
      threshold_qty: 20,
    });

    await getMedicationById(req as Request, res as Response);

    expect(mockedGetMedicationByIdService).toHaveBeenCalledWith(1);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Medication retrieved successfully',
      data: expect.objectContaining({ medication_id: 1 }),
    });
  });

  it('returns 404 when medication is missing', async () => {
    req.params = { id: '999' };
    mockedGetMedicationByIdService.mockResolvedValue(null);

    await getMedicationById(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Medication not found' });
  });

  it('updates a medication', async () => {
    req.params = { id: '1' };
    req.body = { name: 'Aspirin Plus', price: '12.5', dosage: '750' };
    mockedUpdateMedicationService.mockResolvedValue({
      medication_id: 1,
      name: 'Aspirin Plus',
      price: 12.5,
      type: 'Tablet',
      stock_qty: 100,
      threshold_qty: 20,
      dosage: 750,
    });

    await updateMedication(req as Request, res as Response);

    expect(mockedUpdateMedicationService).toHaveBeenCalledWith(1, {
      name: 'Aspirin Plus',
      price: 12.5,
      dosage: 750,
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Medication updated successfully',
      data: expect.objectContaining({ name: 'Aspirin Plus' }),
    });
  });

  it('returns 404 when deleting a missing medication', async () => {
    req.params = { id: '999' };
    mockedDeleteMedicationService.mockResolvedValue(false);

    await deleteMedication(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: 'Medication not found' });
  });

  it('updates medication stock', async () => {
    req.params = { id: '1' };
    req.body = { stock_qty: '50' };
    mockedUpdateMedicationStockService.mockResolvedValue({
      medication_id: 1,
      name: 'Aspirin',
      price: 10.5,
      type: 'Tablet',
      stock_qty: 50,
      threshold_qty: 20,
    });

    await updateMedicationStock(req as Request, res as Response);

    expect(mockedUpdateMedicationStockService).toHaveBeenCalledWith(1, 50);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Stock updated successfully',
      data: expect.objectContaining({ stock_qty: 50 }),
    });
  });

  it('returns statistics', async () => {
    const stats: MedicationStats = { total: 10, lowStock: 2, outOfStock: 1, totalStock: 150 };
    mockedGetMedicationStatsService.mockResolvedValue(stats);

    await getMedicationStats(req as Request, res as Response);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Statistics retrieved successfully',
      data: stats,
    });
  });

  it('searches medications', async () => {
    req.query = { q: 'asp' };
    mockedSearchMedicationsService.mockResolvedValue([
      {
        medication_id: 1,
        name: 'Aspirin',
        price: 10.5,
        type: 'Tablet',
        stock_qty: 100,
      },
    ]);

    await searchMedications(req as Request, res as Response);

    expect(mockedSearchMedicationsService).toHaveBeenCalledWith('asp');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Search completed successfully',
      }),
    );
  });
});