import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { Response } from 'express';
import { getChatSession } from '../getChatSession';
import { supabase } from '../../../config/db';
import { AuthenticatedRequest } from '../../../types/patient-chat';

vi.mock('../../../config/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('getChatSession', () => {
  let req: Partial<AuthenticatedRequest>;
  let res: Partial<Response>;

  type SupabaseChain<T> = {
    select: () => SupabaseChain<T>;
    insert: () => SupabaseChain<T>;
    update: () => SupabaseChain<T>;
    eq: () => SupabaseChain<T>;
    order: () => SupabaseChain<T>;
    limit: () => SupabaseChain<T>;
    single: () => Promise<T>;
    then: (onFulfilled: (value: T) => unknown) => Promise<unknown>;
  };

  beforeEach(() => {
    req = { params: { patientId: 'p-123' } };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should create new session and insert initial message if none exists', async () => {
    const supabaseMock = supabase.from as Mock;

    // This helper creates an object that acts like a Promise (has .then)
    // and also has all the Supabase chaining methods.
    const createMockChain = <T>(finalData: T): SupabaseChain<T> => {
      const obj = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => Promise.resolve(finalData)),
        // This allows the chain to be awaited even if .single() isn't called
        then: vi
          .fn()
          .mockImplementation((onFulfilled) => Promise.resolve(finalData).then(onFulfilled)),
      } as SupabaseChain<T>;
      return obj;
    };

    // We define the sequence of responses based on the controller's logic
    const responses = {
      checkExisting: { data: null, error: { code: 'PGRST116' } },
      createSession: { data: { chat_id: 'new-chat-123' }, error: null },
      insertInitialMsg: { data: { created_at: new Date().toISOString() }, error: null },
      updateSessionTime: { data: {}, error: null },
      fetchFinal: {
        data: {
          chat_id: 'new-chat-123',
          patient_id: 'p-123',
          ChatMessages: [{ role: 'chatbot', content: 'What language...' }],
        },
        error: null,
      },
    };

    let callCount = 0;
    supabaseMock.mockImplementation((table: string) => {
      if (table === 'ChatSession') {
        // ChatSession is called 4 times in this flow:
        // 1. Check existing, 2. Create, 3. Update timestamp, 4. Final fetch
        const sequence = [
          responses.checkExisting,
          responses.createSession,
          responses.updateSessionTime,
          responses.fetchFinal,
        ];
        return createMockChain(sequence[callCount++]);
      }
      if (table === 'ChatMessages') {
        // ChatMessages is called once to insert the initial message
        return createMockChain(responses.insertInitialMsg);
      }
    });

    await getChatSession(req as AuthenticatedRequest, res as Response);

    // If it hit a 500, this will fail.
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          id: 'new-chat-123',
        }),
      }),
    );
  });
});
