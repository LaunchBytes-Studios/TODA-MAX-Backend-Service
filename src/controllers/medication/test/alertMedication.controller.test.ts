import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import type { Request, Response } from 'express';
import { alertMedication } from '../alertMedication.controller';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '../../../config/db';

describe('alertMedication', () => {
  let req: Request;
  let res: Partial<Response>;

  beforeEach(() => {
    req = {} as Request;
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    vi.clearAllMocks();
  });

  it('should return medications with stock_qty less than or equal to threshold_qty', async () => {
    const medications = [
      { name: 'Paracetamol', price: 10, type: 'Tablet', stock_qty: 5, threshold_qty: 10 },
      { name: 'Amoxicillin', price: 20, type: 'Capsule', stock_qty: 10, threshold_qty: 10 },
      { name: 'Vitamin C', price: 15, type: 'Tablet', stock_qty: 12, threshold_qty: 10 },
    ];

    const selectMock = vi.fn().mockResolvedValue({
      data: medications,
      error: null,
    });

    (supabase.from as Mock).mockReturnValue({ select: selectMock });

    await alertMedication(req, res as Response);

    expect(supabase.from).toHaveBeenCalledWith('Medication');
    expect(selectMock).toHaveBeenCalledWith('*');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([
      { name: 'Paracetamol', price: 10, type: 'Tablet', stock_qty: 5, threshold_qty: 10 },
      { name: 'Amoxicillin', price: 20, type: 'Capsule', stock_qty: 10, threshold_qty: 10 },
    ]);
  });

  it('should return an empty array when no medications are below threshold', async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: [{ name: 'Vitamin C', price: 15, type: 'Tablet', stock_qty: 20, threshold_qty: 10 }],
      error: null,
    });

    (supabase.from as Mock).mockReturnValue({ select: selectMock });

    await alertMedication(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('should return 500 when Supabase returns an error', async () => {
    const selectMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    (supabase.from as Mock).mockReturnValue({ select: selectMock });

    await alertMedication(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Error fetching medications.',
      error: { message: 'Database error' },
    });
  });

  it('should return 500 when an unexpected exception is thrown', async () => {
    const selectMock = vi.fn().mockRejectedValue(new Error('Unexpected failure'));

    (supabase.from as Mock).mockReturnValue({ select: selectMock });

    await alertMedication(req, res as Response);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Server error.',
      }),
    );
  });
});
