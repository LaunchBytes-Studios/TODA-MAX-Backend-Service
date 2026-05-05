import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../../config/db', () => ({
  supabase: { from: vi.fn() },
}));

vi.mock('../../../services/ordering.service', () => ({
  createOrderService: vi.fn(),
}));

vi.mock('../../../services/patientPoints.service', () => ({
  awardPatientPointsForEvent: vi.fn(),
}));

vi.mock('../../../utils/helpers', async () => {
  const actual =
    await vi.importActual<typeof import('../../../utils/helpers')>('../../../utils/helpers');

  return {
    ...actual,
    requirePatientId: vi.fn(),
  };
});

import { checkout } from '../checkout.controller';
import { supabase } from '../../../config/db';
import { createOrderService } from '../../../services/ordering.service';
import { awardPatientPointsForEvent } from '../../../services/patientPoints.service';
import { requirePatientId } from '../../../utils/helpers';

describe('checkout', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let medicationQuery: { select: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn> };
  let patientQuery: {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      body: {
        delivery_type: 'pickup',
        items: [{ medication_id: 1, quantity: 2 }],
      },
      user: { userId: 'patient-123', role: 'patient', contact: '123-456-7890' },
    };

    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    (requirePatientId as Mock).mockReturnValue('patient-123');

    medicationQuery = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn(),
    };

    patientQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    (supabase.from as Mock).mockImplementation((table: string) => {
      if (table === 'Medication') return medicationQuery;
      if (table === 'Patient') return patientQuery;
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('returns 400 when delivery_type is invalid', async () => {
    req.body = {
      delivery_type: 'invalid',
      items: [{ medication_id: 1, quantity: 2 }],
    };

    await checkout(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "delivery_type must be 'pickup' or 'delivery'",
    });
  });

  it('returns 400 when items is empty', async () => {
    req.body = {
      delivery_type: 'pickup',
      items: [],
    };

    await checkout(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'items must be a non-empty array',
    });
  });

  it('returns 400 when an item has invalid values', async () => {
    req.body = {
      delivery_type: 'pickup',
      items: [{ medication_id: 1, quantity: 0 }],
    };

    await checkout(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid values at index 0',
    });
  });

  it('creates a pickup order successfully and aggregates duplicate medication quantities', async () => {
    req.body = {
      delivery_type: 'pickup',
      items: [
        { medication_id: 1, quantity: 2 },
        { medication_id: 1, quantity: 3 },
        { medication_id: 2, quantity: 1 },
      ],
    };

    medicationQuery.in.mockResolvedValue({
      data: [
        { medication_id: 1, price: 10, stock_qty: 10 },
        { medication_id: 2, price: 20, stock_qty: 5 },
      ],
      error: null,
    });

    (createOrderService as Mock).mockResolvedValue({
      order: { order_id: 'order-1' },
      items: [
        { medication_id: 1, quantity: 5, price: 10 },
        { medication_id: 2, quantity: 1, price: 20 },
      ],
    });

    (awardPatientPointsForEvent as Mock).mockResolvedValue({
      eventType: 'order_placement',
      awardedPoints: 3,
      alreadyAwarded: false,
    });

    await checkout(req as Request, res as Response);

    expect(supabase.from).toHaveBeenCalledWith('Medication');
    expect(medicationQuery.select).toHaveBeenCalledWith('medication_id, price, stock_qty');
    expect(medicationQuery.in).toHaveBeenCalledWith('medication_id', [1, 2]);

    expect(createOrderService).toHaveBeenCalledWith('patient-123', {
      delivery_type: 'pickup',
      items: [
        { medication_id: 1, quantity: 5, price: 10 },
        { medication_id: 2, quantity: 1, price: 20 },
      ],
      delivery_address: undefined,
    });

    expect(awardPatientPointsForEvent).toHaveBeenCalledWith({
      patientId: 'patient-123',
      eventType: 'order_placement',
      sourceId: 'order-1',
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Order and items created successfully',
      data: {
        order: { order_id: 'order-1' },
        items: [
          { medication_id: 1, quantity: 5, price: 10 },
          { medication_id: 2, quantity: 1, price: 20 },
        ],
        total_items: 6,
        pointsAward: {
          eventType: 'order_placement',
          awardedPoints: 3,
          alreadyAwarded: false,
        },
      },
    });
  });

  it('returns 400 when stock is insufficient', async () => {
    medicationQuery.in.mockResolvedValue({
      data: [{ medication_id: 1, price: 10, stock_qty: 1 }],
      error: null,
    });

    await checkout(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Insufficient stock for medication ID 1. Available: 1, requested: 2',
    });
  });

  it('returns 400 for delivery orders when patient has no address', async () => {
    req.body = {
      delivery_type: 'delivery',
      items: [{ medication_id: 1, quantity: 2 }],
    };

    medicationQuery.in.mockResolvedValue({
      data: [{ medication_id: 1, price: 10, stock_qty: 10 }],
      error: null,
    });

    patientQuery.single.mockResolvedValue({
      data: { address: null },
      error: null,
    });

    await checkout(req as Request, res as Response);

    expect(supabase.from).toHaveBeenCalledWith('Patient');
    expect(patientQuery.select).toHaveBeenCalledWith('address');
    expect(patientQuery.eq).toHaveBeenCalledWith('patient_id', 'patient-123');
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message:
        'No address on file for this patient. Please update your profile before placing a delivery order.',
    });
  });

  it('returns wrapped 500 when medication lookup fails', async () => {
    medicationQuery.in.mockResolvedValue({
      data: null,
      error: { message: 'db failed' },
    });

    await checkout(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Failed to fetch medication prices',
      error: 'db failed',
    });
  });

  it('still succeeds when awarding points throws', async () => {
    medicationQuery.in.mockResolvedValue({
      data: [{ medication_id: 1, price: 10, stock_qty: 10 }],
      error: null,
    });

    (createOrderService as Mock).mockResolvedValue({
      order: { order_id: 'order-2' },
      items: [{ medication_id: 1, quantity: 2, price: 10 }],
    });

    (awardPatientPointsForEvent as Mock).mockRejectedValue(new Error('points failed'));

    await checkout(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: 'Order and items created successfully',
      data: {
        order: { order_id: 'order-2' },
        items: [{ medication_id: 1, quantity: 2, price: 10 }],
        total_items: 2,
        pointsAward: null,
      },
    });
  });
});
