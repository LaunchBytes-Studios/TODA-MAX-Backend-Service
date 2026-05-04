import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { Response } from 'express';
import { setLanguagePreference } from '../setLanguagePreference';
import { supabase } from '../../../config/db';
import { AuthenticatedRequest } from '../../../types/patient-chat';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('setLanguagePreference', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: {}, user: { userId: 'u-123', role: 'patient', contact: 'test@example.com' } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should return 400 for invalid language', async () => {
    req.body = { chatId: 'c-1', language: 'spanish' };
    await setLanguagePreference(req as AuthenticatedRequest, res as Response);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should update preference and return confirmation', async () => {
    req.body = { chatId: 'c-1', language: 'tagalog' };
    const supabaseMock = supabase.from as Mock;

    supabaseMock.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValueOnce({ data: { chat_id: 'c-1' }, error: null }) // Session check
        .mockResolvedValueOnce({ data: { message_id: 'p-1' }, error: null }) // Patient msg
        .mockResolvedValueOnce({ data: { message_id: 'b-1', created_at: 'now' }, error: null }) // Bot msg
        .mockResolvedValueOnce({ data: { chat_id: 'c-1', ChatMessages: [] }, error: null }), // Refresh
    }));

    await setLanguagePreference(req as AuthenticatedRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
