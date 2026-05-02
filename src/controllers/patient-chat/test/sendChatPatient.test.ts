import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { Response } from 'express';

// FIX: This runs before imports are hoisted
vi.hoisted(() => {
  process.env.CHATBOT_ID = 'mock-chatbot-id';
});

import { sendChatMessage } from '../sendChatPatient';
import { supabase } from '../../../config/db';
import { requestAiReply } from '../../../services/ai.service';
import { AuthenticatedRequest } from '../../../types/patient-chat';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../../../services/ai.service', () => ({
  requestAiReply: vi.fn().mockResolvedValue({}),
}));

describe('sendChatPatient', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;

  beforeEach(() => {
    req = { body: {}, user: { userId: 'u-123' } as any };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should successfully send message and call AI service', async () => {
    req.body = { chatId: 'c-1', content: 'I feel sick' };

    const supabaseMock = supabase.from as Mock;

    // Define the sequence of results
    const sessionResponse = { data: { chatbot_active: true, language: 'english' }, error: null };
    const messageInsertResponse = { data: { message_id: 'm-1' }, error: null };

    const mockChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation(function () {
        // Return a promise for the .update().eq() call
        const promise = Promise.resolve({ data: {}, error: null });
        // Add .single() to the promise for .select().eq().single() calls
        (promise as any).single = vi
          .fn()
          .mockResolvedValueOnce(sessionResponse)
          .mockResolvedValueOnce(messageInsertResponse);
        return promise;
      }),
      single: vi
        .fn()
        .mockResolvedValueOnce(sessionResponse)
        .mockResolvedValueOnce(messageInsertResponse),
    };

    supabaseMock.mockReturnValue(mockChain);

    await sendChatMessage(req as AuthenticatedRequest, res as Response);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(requestAiReply).toHaveBeenCalled();
  });
});
